/**
 * PRISM 대응 패키지 백엔드 (Vercel 서버리스 함수)
 *
 * POST /api/analyze
 *   body: {
 *     mode: "package" | "review",
 *     situation?: string,        // 위기 상황 한 줄 또는 기사 URL
 *     stance?: "apology" | "facts" | "investigating" | "compensation" | "silence" | "rebuttal" | "custom",
 *     stanceCustom?: string,     // stance=custom일 때 사용자가 적은 입장 문장
 *     situations?: string[],     // 기업 상황 태그 (listed-large, ipo, b2b, spreading …)
 *     situationNote?: string,    // 기업 상황 직접 입력
 *     brand?: string,
 *     entities?: string[],       // general | listed | consumer | platform | entertainment | labor
 *     draft?: string,            // review 모드: 검수할 기존 입장문
 *     context?: { industryLabel?, playbook?, entityDigest? },  // 로컬 매뉴얼 보강 자료
 *     apiKey?: string
 *   }
 *
 * - situation 안에 http(s) URL이 있으면 서버가 직접 기사를 읽어(title·description·본문) 프롬프트에 넣습니다.
 * - GEMINI_API_KEY 가 있으면 Gemini, 없으면 OPENAI_API_KEY. 둘 다 없을 때만 요청의 개인 키를 씁니다.
 * - 키 값은 응답에 절대 포함하지 않습니다.
 *
 * GET /api/analyze → 서버 상태(키 설정 여부·제공자·모델·URL 읽기 지원)만 반환합니다.
 */

const ENV: Record<string, string | undefined> =
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = (ENV.GEMINI_MODEL || "").trim() || "gemini-3.5-flash-lite";
const MAX_SITUATION_CHARS = 8_000;
const MAX_DRAFT_CHARS = 8_000;
/** "가격 인상"처럼 4~15자 키워드만 넣어도 분석합니다. */
const MIN_PACKAGE_CHARS = 4;
const MIN_REVIEW_CHARS = 20;
const UPSTREAM_TIMEOUT_MS = 55_000;
const ARTICLE_TIMEOUT_MS = 12_000;
const ARTICLE_MAX_BYTES = 1_800_000;
const ARTICLE_MAX_CHARS = 6_000;

const OPENAI_BASE = (ENV.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_URL = `${OPENAI_BASE}/chat/completions`;
/** GEMINI_BASE_URL은 검증 하네스가 모의 서버를 물릴 때만 씁니다. */
const GEMINI_BASE = (ENV.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");

type Provider = "gemini" | "openai";
type Stance = "apology" | "facts" | "investigating" | "compensation" | "silence" | "rebuttal" | "custom";
type Mode = "package" | "review" | "case";

const isGeminiKey = (key: string): boolean => key.length > 0 && !key.startsWith("sk-");

/** 이슈 유형별 서버 지침 — 클라이언트 컨텍스트가 없어도 유형 차이가 남도록. */
const TYPE_GUIDE: Record<string, { label: string; directive: string; banned: string }> = {
  pricing: {
    label: "가격·요금 인상",
    directive:
      "인상 시점·폭·적용 대상·기존 고객 적용일 네 숫자를 먼저 확정하세요. 명분(원가·환율·인건비·투자)은 인상률과 비교한 수치로만 말하고, 기존 고객 유예·동결·할인, 해지·환불·위약금 처리, 경쟁사·대안 요금제 비교표를 반드시 포함하세요. 커뮤니티의 ‘월 N원=연 N만원’ 환산, 해지 인증, 총선·실적 발표 직후 타이밍 보도를 예상해 Q&A를 만드세요. 규제(공정위·방통위·소비자원, 약관 고지)도 확인하세요.",
    banned: "숫자 없는 ‘원가 상승으로 불가피’, ‘고객님들의 이해를 부탁드립니다’, 검증 없는 ‘업계 평균보다 낮다’, ‘서비스 개선을 위해’",
  },
  "product-safety": {
    label: "제품·서비스 안전",
    directive: "사용 중단·회수 범위(로트·유통기한·채널), 검사 기관·항목·결과 공개 시각, 2차 유통 추적, 환불 창구를 첫 시간에 확정하세요.",
    banned: "‘단순한 이물’, ‘섭취해도 문제없다’, 범위 없는 ‘전량 회수’",
  },
  "false-claim": {
    label: "허위·과장·조작",
    directive: "문제 문장을 원문으로 특정하고, 사실관계·검증 근거, 게시 중단·정정 노출, 환불 기준, 규제 대응을 함께 내세요.",
    banned: "‘오해의 소지’, ‘일부 표현이 부적절’, ‘법적 문제없다’",
  },
  "data-breach": {
    label: "개인정보·보안",
    directive: "침해 경로 차단·세션 무효화, 유출 항목·규모·기간, 정보주체 통지와 개인정보보호위원회/KISA 신고(1,000명 이상·민감정보 72시간), 비밀번호 재설정·2단계 인증을 포함하세요.",
    banned: "‘유출 아니다’, ‘규모 미미’, ‘해킹 시도는 흔한 일’",
  },
  outage: {
    label: "서비스 장애",
    directive: "발생·인지·복구 시각, 영향 범위(기능·지역·이용자), 데이터 손실 여부, 보상 기준과 재발 방지 보고서 일정을 포함하세요.",
    banned: "‘일시적 오류’, ‘정상화됐다’만 반복, 확인 전 외부 공격 단정",
  },
  labor: {
    label: "노사·고용",
    directive: "교섭 일정·쟁점, 안전·처우 사실관계, 고객·거래처 영향과 대체 계획, 노동청 대응 창구를 포함하세요.",
    banned: "‘생산 차질 없다’만 반복, ‘내부 사정’, ‘법대로 하겠다’",
  },
  regulatory: {
    label: "규제·제재",
    directive: "처분 기관·유형·금액, 대상 행위, 이의·시정 절차와 일정, 소비자 보상·서비스 영향을 포함하세요.",
    banned: "‘규제 과도’, ‘혁신을 막는 처분’, ‘즉시 소송’",
  },
};
const STANCES: Stance[] = ["apology", "facts", "investigating", "compensation", "silence", "rebuttal", "custom"];

/** 스탠스별 지침 — 클라이언트 컨텍스트가 없어도 입장 차이가 프롬프트에 남도록. */
const STANCE_GUIDE: Record<Stance, { label: string; directive: string; banned: string }> = {
  apology: {
    label: "공식 사과·전면 시정",
    directive:
      "잘못이 확인된 상황. 첫 문단은 사과, 두 번째는 고객이 지금 할 일. 보상 기준·접수 창구·처리 일정을 숫자로 제시하고, 원인 규명은 그다음 순서로 쓴다.",
    banned: "‘유감입니다’로 끝내기, 변명, 책임을 개인·협력사로 돌리기, 숫자 없는 ‘최선을 다하겠습니다’",
  },
  facts: {
    label: "사실 적시·팩트체크",
    directive:
      "사과도 반박도 아닌 ‘사실 적시’형. ①보도·주장 요약 ②확인된 사실 ③사실과 다른 점과 근거(자료·출처·기준 시점) ④아직 확인되지 않은 사항과 공개 시각 ⑤고객·피해자 조치 ⑥정정 요청 순서로 쓴다. 감정 표현 없이 숫자와 출처만 쓴다.",
    banned: "근거 없는 ‘사실무근’, ‘일부 표현이 부적절’, 유감만 있고 조치가 없는 문장, 출처 없는 수치",
  },
  investigating: {
    label: "유감 표명·조사 경과",
    directive:
      "아직 확정 전. 유감을 한 줄 표하고, 확인된 사실과 확인 중인 사항을 구분한다. 확인 결과 공개 시각을 반드시 약속하고, 그 전에 할 수 있는 선제 조치를 함께 낸다.",
    banned: "확인 전 단정, 시각 없는 ‘확인 중’, 근거 없는 부인",
  },
  compensation: {
    label: "선제 보상·상생안",
    directive:
      "원인 규명 전이라도 피해를 먼저 회복시키는 ‘선제 보상’형. 보상 대상·기준·금액·신청 방법·지급 일정을 앞세우고, 보상은 비밀유지·게시물 삭제·합의 등 어떤 조건과도 연결하지 않는다고 명시한다. 원인 조사 일정도 함께 밝힌다.",
    banned: "‘합의·선처’, 비밀유지·삭제 요구, 금액 없는 ‘최대한 보상’, 조사 결과가 나오면 보상하겠다는 미루기",
  },
  silence: {
    label: "무대응·모니터링",
    directive:
      "전략적 무대응. statements.public은 ‘보류 문안’으로 만들고 ①공개 전환 조건(보도 수준·증거·당국 요청) ②전환 시 쓸 첫 문장 ③지금 내부에서 하는 확인·기록 ④문의 회신 원칙을 담는다. statements.press는 기자 문의에 쓸 최소 회신 문안과 회신 시각, 하지 말아야 할 것을 담는다. 사실을 단정하거나 추측하지 않는다.",
    banned: "‘노코멘트’만 반복, 근거 없는 ‘사실무근’, 임직원 개인 답변, 확인되지 않은 확산 규모 언급",
  },
  rebuttal: {
    label: "강경 대응·법적 조치",
    directive:
      "허위·왜곡에 대한 강경 대응. 근거 자료 2개 이상과 공개 위치를 먼저 제시하고, 허위로 확인된 범위에 한해 법적 절차 방침을 밝힌다. 정당한 비판은 수용한다는 원칙을 함께 쓴다.",
    banned: "‘루머·악플러’ 같은 감정 표현, 전원 고소, 근거 없는 ‘100% 사실’",
  },
  custom: {
    label: "직접 입력",
    directive:
      "사용자가 직접 정한 입장을 따른다. 그 문장을 첫 문단에 그대로 두고, 확인된 사실과 조치만 뒤에 붙인다. 입장에 없는 사실·약속을 추가하지 않는다.",
    banned: "직접 정한 입장과 다른 톤, 입장에 없는 사실 추가, 범위를 넘는 약속",
  },
};

/** 기업 상황 태그 — 회사 단계·고객 구조·지금의 여론 상태. */
const SITUATION_GUIDE: Record<string, { label: string; directive: string }> = {
  "listed-large": {
    label: "상장사·대기업",
    directive:
      "거래소 조회공시·수시공시 요구 여부를 먼저 판단하고 공시 시각·IR 창구를 1시간 항목에 넣는다. 계열사·해외법인까지 같은 숫자를 쓰도록 승인선을 정하고, 확정 전 실적·주가 전망은 쓰지 않는다.",
  },
  ipo: {
    label: "성장기·IPO 준비",
    directive:
      "공모 일정·투자자 신뢰가 걸려 있다. 사안의 성격·규모를 사실로만 밝히고 공모 일정 변경 여부는 확정 뒤에 말한다. 주관사·법률대리인과 문안을 맞춘다.",
  },
  funding: {
    label: "자금난·투자 유치",
    directive:
      "지급 능력(정산·급여·환불)이 핵심 질문이다. 확정된 현금흐름·조달 계획만 밝히고, 이용자·판매자 보호 조치(에스크로·정산 우선순위)를 먼저 제시한다. 미확정 투자 유치 발표는 금지.",
  },
  mna: {
    label: "M&A·구조조정",
    directive:
      "확인되지 않은 인수·합병·감원 루머는 사실관계로만 답하고, 임직원 → 거래처 → 외부 순서로 알린다. 노조·대주주·규제기관 통보 절차와 일정을 밝힌다.",
  },
  b2c: {
    label: "B2C 대중 브랜드",
    directive:
      "확산이 빠르므로 첫 1시간 안에 고객이 할 일(환불·중단·신청)을 앱·SNS·커뮤니티에 동시에 올린다. 현장·매장 CS 스크립트를 같은 시각에 배포한다.",
  },
  b2b: {
    label: "B2B 거래처 중심",
    directive:
      "공개 성명보다 개별 통지가 먼저다. 영향 고객사 목록·담당자에게 먼저 알리고, SLA·계약 조항에 따른 보상과 대체 수단을 제시한다. 고객사 이름·계약 내용은 공개 문안에 쓰지 않는다.",
  },
  global: {
    label: "해외·수출 비중 큼",
    directive:
      "본사·현지 법인의 고지 기준·언어·시차를 맞추고 현지 규제기관 신고 의무를 먼저 확인한다. 국가별 보상 기준이 갈라지지 않도록 원칙 하나와 현지 예외만 밝힌다.",
  },
  rumor: {
    label: "초기 루머·커뮤니티",
    directive:
      "확산 규모가 작다. 대형 성명보다 ①원 게시물·유포 경로 기록 ②사실 확인 ③확산 지표 모니터링 ④필요 시 짧은 사실 안내 순서로 움직인다.",
  },
  spreading: {
    label: "여론 악화·보도 확산",
    directive:
      "2차 보도·해지·불매가 진행 중이다. 같은 말을 반복하면 프레임이 굳으므로, 첫 6시간 안에 새 숫자·일정을 담은 공지를 내고 이후 중간 브리핑 시각을 고정한다.",
  },
  regulator: {
    label: "당국 조사·제재",
    directive:
      "처분 전 결론을 단정하지 않고 조사 협조 사실과 제출 자료·일정만 밝힌다. 처분 가능성은 통보받은 내용 기준으로만 말하고, 이의신청·시정 절차와 소비자 영향을 함께 안내한다.",
  },
  "labor-internal": {
    label: "노사·내부 제보",
    directive:
      "고발자 신원 추정·보복으로 읽히는 표현을 배제하고, 사실 확인과 제도 개선(처우·안전·신고 채널)을 함께 제시한다. 노조 교섭 일정·근로감독 대응 창구를 밝히고 사내 공지를 외부보다 먼저 한다.",
  },
  owner: {
    label: "오너·경영진 리스크",
    directive:
      "회사와 개인의 책임을 분리하되 경영 공백·의사결정 체계(비상경영·대행)를 먼저 밝힌다. 사법 절차는 확인된 사실만 쓰고 주주·임직원·거래처 영향과 통제 방안을 함께 낸다.",
  },
};

/**
 * 서버가 직접 들고 있는 유형 지침.
 * 클라이언트가 보내는 상세 컨텍스트가 없어도 유형별 차이가 프롬프트에 남도록 하는 최소 세트입니다.
 */
const ENTITY_GUIDE: Record<string, { label: string; directive: string; banned: string }> = {
  general: {
    label: "일반 기업·브랜드",
    directive:
      "사실 확인 → 창구 단일화 → 공식 입장 → 보상·재발방지 순서. 임직원 외부 발언 금지와 문의 창구 통일을 1시간 항목에 넣으세요.",
    banned: "“확인 중입니다”만 반복, “최선을 다하겠습니다”, “전혀 문제 없습니다”",
  },
  listed: {
    label: "상장사(공시·IR·주가)",
    directive:
      "거래소 조회공시 요구(자본시장법 제161조) 여부를 먼저 판단하고, 조회·수시·공정공시 일정과 제출 시각을 명시하세요. 임직원 블랙아웃(자사주 거래 제한), 미공개중요정보 관리(자본시장법 제174조), IR·애널리스트 문의 창구 단일화, 주주서한을 포함하세요. 주가 전망·목표주가·확정 전 재무 수치는 절대 쓰지 마세요.",
    banned: "주가 전망·목표주가, 확정 전 실적 수치, “공시할 사안 아니다” 단정",
  },
  consumer: {
    label: "소비재·식품(리콜·식약처·CS)",
    directive:
      "섭취·사용 중단과 회수 범위(제조번호·유통기한·판매 채널)를 첫 항목에 두고, 식약처·지자체 자진회수 신고(식품위생법 제45조), 검사기관·항목·결과 공개 일시, 환불 접수 창구, 2차 유통(가공·급식) 추적을 포함하세요.",
    banned: "“단순한 이물”, “섭취해도 문제 없다”, 범위 없는 “전량 회수”",
  },
  platform: {
    label: "IT·플랫폼(개인정보 유출·서비스 장애)",
    directive:
      "침해·장애 경로 차단과 영향 범위(이용자 수·항목·기간)를 먼저 확정하고, 개인정보보호법 제34조에 따른 정보주체 통지와 개인정보보호위원회·KISA 신고(1,000명 이상·민감정보는 72시간 내), 비밀번호 재설정·2단계 인증 안내, 원인 분석·외부 보안 점검 일정을 포함하세요.",
    banned: "“유출 아니다” 성급한 부인, 피해 규모 축소, “해킹 시도는 흔한 일”",
  },
  entertainment: {
    label: "엔터·크리에이터(아티스트·팬덤)",
    directive:
      "당사자 보호와 2차 가해 차단을 최우선으로 하고, 확인 전 의혹을 단정하지 마세요. 공식 채널 일원화, 팬덤 공지, 광고주·방송사 사전 통보, 활동·계약 일정 조정 여부, 명예훼손·2차 가해 대응(정보통신망법 제44조)을 포함하세요.",
    banned: "확인 전 의혹 단정, 당사자 실명·사생활 언급, 팬덤 비하",
  },
  labor: {
    label: "노사·내부 고발·오너 리스크",
    directive:
      "인명·안전 사안이면 산업안전보건법 제54조에 따른 중대재해 즉시 보고와 증거 보전을 첫 항목에 두세요. 고용노동부 조사 대응 창구, 노조 교섭 일정, 내부고발자 보호·보복 금지, 경영진 사법 리스크에 대한 이사회·감사 보고, 처우·안전 개선안을 포함하세요. 고발자 신원 추정 발언은 금지입니다.",
    banned: "“내부 사정”으로 뭉개기, 고발자 신원 추정, “법대로 하겠다” 협박조",
  },
};

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(chunk?: string): void;
}

interface CompletionInput {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  signal: AbortSignal;
}

interface CompletionSuccess {
  content: string;
  model: string;
  usage: unknown;
}

type CompletionOutcome =
  | { ok: true; value: CompletionSuccess }
  | { ok: false; status: number; error: string; message: string };

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  error?: { message?: string };
}

export const config = { maxDuration: 60 };

/* ------------------------------------------------------------------ */
/* 프롬프트                                                            */
/* ------------------------------------------------------------------ */

const SYSTEM_PACKAGE = `당신은 한국 기업의 위기 커뮤니케이션을 실무에서 총괄하는 수석 PR 전략가입니다.
사용자가 준 위기 상황(또는 기사 URL의 원문)과 '우리 입장', '기업 유형'을 읽고, 담당자가 오늘 바로 실행·복붙할 수 있는 대응 패키지를 만듭니다.

반드시 지킬 것:
- 상황·기사·유형 정보에 없는 사실·수치·기관명·인물명을 만들어내지 마세요. 필요한 값은 [확인 필요: 항목]으로 표기하고, 입장문 한 편당 4개를 넘기지 마세요.
- 실존 인물의 실명·연락처·계정을 새로 만들지 마세요.
- "확인 중", "최선을 다하겠습니다" 같은 빈 문장으로 빈칸을 덮지 마세요. 확인된 사실과 확인해야 할 항목을 구분합니다.
- 모든 문장은 한국어 실무 문체로, 보도자료·공지에 그대로 붙여 넣을 수 있는 완성된 형태로 씁니다.
- 입장(stance)에 따라 문안과 전략이 완전히 달라져야 합니다. 지침은 프롬프트의 [우리 입장]에 그대로 들어 있으니 그 지침을 우선합니다.
  · apology(공식 사과·전면 시정): 첫 문단이 사과, 두 번째가 고객이 지금 할 일. 원인 변명·책임 전가 금지. 보상 기준과 시점을 반드시 포함.
  · facts(사실 적시·팩트체크): 사과도 반박도 아닌 사실관계 정리. 확인된 사실·사실과 다른 점·근거(출처·기준 시점)·확인 중인 사항·고객 조치·정정 요청. 감정 표현 금지.
  · investigating(유감 표명·조사 경과): 확정되지 않은 사실은 인정하지 않되, 확인 항목과 '공개 시각'을 약속. 유감은 확인된 사실에만 한정. 선제 조치를 반드시 포함.
  · compensation(선제 보상·상생안): 보상 대상·기준·금액·신청 방법·지급 일정을 앞세운다. 보상은 비밀유지·삭제·합의 등 어떤 조건과도 연결하지 않는다고 명시.
  · silence(무대응·모니터링): 공개 입장문은 ‘보류 문안’(공개 전환 조건·전환 시 첫 문장·내부 확인·문의 원칙), 기자 대응은 최소 회신 문안과 회신 시각. 사실 단정·추측 금지.
  · rebuttal(강경 대응·법적 조치): 근거 자료와 사실관계 중심. 감정 표현·“루머/악플러”·근거 없는 단정 금지. 정당한 비판은 수용한다는 문장 포함.
  · custom(직접 입력): [우리 입장]의 사용자 문장을 첫 문단에 그대로 두고, 확인된 사실과 조치만 덧붙인다.
- [기업 상황]이 주어지면 그 조건을 모든 섹션의 순서·이해관계자·문안에 반영하세요(예: B2B는 개별 통지가 먼저, 상장사는 공시 일정, 초기 루머는 기록·모니터링 우선).
- channels는 목적이 다른 4번째 산출물입니다. statements(대외 입장)·qa(기자 응대)와 같은 사실·숫자·일정을 쓰되, internal은 임직원이 ‘무엇을 하고 무엇을 하지 말아야 하는지’를 실행 문장으로, social은 짧고 사실만(이모지·과장·감성 표현 금지) 씁니다. defense는 기자가 반박할 때 되돌릴 3개의 축입니다.
- 기업 유형(entities)의 지침을 모든 섹션에 구체적으로 반영하세요. 유형이 여러 개면 첫 번째를 대표로 삼고 나머지는 해당 섹션에 보강 항목으로 넣습니다.
- 입력이 20자 이하로 짧으면(예: "가격 인상 이슈"), 곧바로 일반론을 쓰지 말고 아래 5축으로 쟁점을 먼저 구체화하세요.
  ① 소비자·이용자 반발(해지·환산·인증샷) ② 명분(원가·품질·투자·환율) ③ 커뮤니티·SNS 여론 ④ 경쟁사·대안 비교 ⑤ 언론 보도 포인트(수치·타이밍·규제).
  이 5축을 issueBrief.issues에 넣고, 입력에 없는 배경은 단정하지 말고 assumptions에 ‘가정’으로 적으세요.
- 이슈 유형(caseType)이 주어지면 그 유형의 표준 프로토콜을 따르세요. 특히 가격·요금 인상은 ‘인상 시점·폭·적용 대상·기존 고객 적용일’ 네 숫자와 기존 고객 보호·해지 방법을 모든 문안에 넣으세요.
- investigation은 담당자가 대응 문안을 쓰기 전에 여는 ‘사건 조사’ 파일입니다. ① 확인된 것과 확인되지 않은 것을 갈라 쓰고 ② 입력·기사·[참고 자료]에 없는 사실은 [확인 필요: 항목]으로 두며 ③ 기자가 던질 질문과 내부에서 확인할 항목을 담당 팀(PR·법무·운영·데이터)까지 지정합니다. issues는 side를 언론·여론·규제 중 하나로 표시하고, 같은 내용을 세 번 반복하지 마세요. pattern은 이 유형이 커지는 일반 경로이며, 이 사건에서 확인된 사실처럼 단정하지 마세요.
- [유사 사례]가 없으면 사례를 만들어내지 말고, [이슈 유형 표준 프로토콜]의 절차를 그대로 이 상황에 적용하세요.
- [유사 사례]가 주어지면 그 사례들의 실제 대응 순서와 교훈을 참고해 이번 상황에 맞게 다시 씁니다. 사례의 회사명·수치·날짜를 이번 사안의 사실처럼 옮기지 말고, 참고한 사례는 qa.guide나 watchouts에 "OO 사례에서는 …" 형태로만 표시하세요.
- 전체 대응 시스템(roadmap)은 1시간 → 6시간 → 24시간~ 3단계로, 각 단계에 목표(goal)와 다음 단계로 넘어가기 위한 통과 기준(gate)을 씁니다.
- 출력은 아래 스키마의 JSON 객체 하나뿐입니다. 코드블록, 설명, 인사말을 붙이지 마세요.

JSON 스키마:
{
  "issueBrief": {
    "label": "이슈 유형 이름",
    "summary": "이 상황을 한 문장으로 진단",
    "issues": [{"title": "핵심 쟁점", "detail": "왜 문제인지·무엇을 확인해야 하는지 2문장"}],
    "factsToConfirm": ["대외 문안에 숫자로 들어가야 할 항목"],
    "mediaPoints": ["언론이 파고들 지점"],
    "assumptions": ["입력에 없어 가정한 배경"]
  },
  "investigation": {
    "summary": "이 사건이 무엇이고 지금 어디까지 확인됐는지 2문장",
    "trigger": "확인된 촉발 요인 한 줄 (모르면 [확인 필요: 항목])",
    "background": ["업종·규제·이해관계자 맥락 2~3개"],
    "issues": [{"side": "언론|여론|규제", "title": "쟁점 이름", "detail": "기자가 물을 질문 또는 왜 쟁점인지 한 문장"}],
    "checks": [{"team": "PR|법무|운영|데이터|총괄", "item": "대외 발표 전에 내부에서 확인할 항목", "question": "그 항목을 기자가 물을 때의 질문 형태", "why": "확인하지 않고 발표하면 무엇이 터지는지", "severity": 1|2|3}],
    "evidence": ["지금 확보해 둘 증거(기록·자료·시료 등) 3~4개"],
    "pattern": ["이 유형이 커지는 경로 3단계 — 일반 경로"]
  },
  "headline": "이 상황의 가장 큰 리스크를 짚는 한 문장 (상황에 특화)",
  "risk": "높음" | "보통" | "낮음",
  "strategy": "이 입장을 유지하기 위한 원칙 한 문장",
  "roadmap": [
    {"window": "1시간", "title": "단계 이름", "goal": "이 단계의 목표", "gate": "다음 단계로 넘어가기 위한 통과 기준", "items": ["핵심 3개"]},
    {"window": "6시간", ...}, {"window": "24시간~", ...}
  ],
  "actions": [
    {"window": "1시간", "title": "체크리스트 제목", "items": [{"text": "구체적 실행 항목", "owner": "담당(예: 공시, 법무, CS, 보안)"}]},
    {"window": "6시간", ...}, {"window": "24시간~", ...}
  ],
  "statements": [
    {"id": "public", "title": "고객·커뮤니티 공지 제목", "body": "완성된 공지 전문. 제목/사과 또는 상황/확인된 사실/지금 할 일/조치·일정/문의처 포함"},
    {"id": "press", "title": "언론 배포·기자 회신용 제목", "body": "완성된 보도자료·입장문 전문. 번호로 나눈 사실관계·조치·규제 대응·일정·문의처 포함"}
  ],
  "qa": [
    {"question": "기자·커뮤니티의 압박 질문", "answer": "그대로 읽거나 복붙할 수 있는 완성된 답변", "guide": "답변 요령 한 줄", "avoid": ["이 질문에서 피할 말 1~2개"], "severity": 1|2|3}
  ],
  "banned": [{"phrase": "절대 쓰면 안 되는 표현", "why": "왜 위험한지 한 줄"}],
  "stakeholders": [
    {"who": "대상(기관·이해관계자)", "when": "1시간" | "6시간" | "24시간", "action": "이 대상에게 할 일", "line": "전화·메일 첫 문장으로 그대로 쓸 한 줄"}
  ],
  "outlook": {
    "reactions": [{"channel": "소비자 커뮤니티|X(트위터)|유튜브|경제지|기자 단톡", "text": "이 입장을 냈을 때 실제로 나올 법한 반응", "tone": "분노|냉소|질문|연대|우려"}],
    "triggers": ["이 입장에서 여론이 더 나빠지는 구체적 트리거 3개"],
    "escalation": ["악화 시 다음 대응 3개 — 실행 순서대로"]
  },
  "channels": {
    "internal": {
      "title": "사내 공지 제목",
      "lead": "임직원에게 먼저 알리는 한 문장",
      "body": "사내 임직원 공지 전문(300~700자). 제목/상황/회사가 하는 일/임직원이 할 일/하지 말아야 할 말/문의처 포함",
      "dos": ["임직원이 지금 해야 할 구체적 행동 3개"],
      "donts": ["임직원이 하면 안 되는 행동·표현 3개"],
      "qa": [{"q": "임직원이 물을 법한 질문", "a": "사내에서 그대로 공유할 답"}]
    },
    "social": {
      "short": "공식 X·스레드 게시물(200자 이내, 이모지 없이)",
      "long": "인스타그램·블로그 캐피션(줄바꿈 포함)",
      "hashtags": ["#해시태그"],
      "pinned": "게시물 고정 댓글(문의 창구 안내)",
      "cards": [{"head": "카드뉴스 장표 제목", "body": "한 문장"}],
      "commentGuide": [{"pattern": "예상 댓글 유형", "tag": "안내|사실|공감|비공개", "reply": "그대로 달 댓글 답변"}],
      "escalation": ["댓글 운영·악화 시 원칙"]
    },
    "defense": [{"frame": "핵심 방어 논리 이름", "line": "기자·상대에게 그대로 말할 한 문장", "proof": "이 문장을 받지려면 필요한 숫자·자료", "avoid": "이 국면에서 피해야 할 말"}],
    "bridge": ["공격적 질문을 사실관계로 되돌릴 브릿지 문장"]
  },
  "watchouts": ["이 유형에서만 생기는 함정 3개"]
}

분량: issueBrief.issues 5~7개(짧은 입력일수록 구체적으로), investigation.issues 4~6개·checks 5~7개·background 2~3개·evidence 3~4개·pattern 3개, roadmap 3개(1시간·6시간·24시간~), actions 3개(각 5~7항목), statements 정확히 2개(public·press), qa 5~7개, banned 5개, stakeholders 4~6개, outlook.reactions 4개, triggers 3개, escalation 3개, watchouts 3개, channels.internal.body 300~700자·dos 3개·donts 3개·qa 2개, channels.social.short 200자 이내·commentGuide 4개, channels.defense 3개, channels.bridge 3개.
기사 URL 원문이 주어지면 그 기사에 나온 사실(수치·기관·주장)을 우선 인용하고, 기사에 없는 내용은 [확인 필요]로 둡니다.`;

const SYSTEM_REVIEW = `당신은 한국 기업의 위기 대응 입장문을 감수하는 수석 PR 전략가입니다.
사용자가 붙여넣은 기존 입장문 초안을 기자·이용자·규제기관의 시선에서 냉정하게 진단하고, 바로 배포 가능한 리라이트를 만듭니다.

반드시 지킬 것:
- 초안에 없는 사실·수치·기관명을 만들어내지 마세요. 필요한 값은 [확인 필요: 항목]으로 표기합니다.
- 위험 표현은 초안의 실제 문구를 그대로 인용(quote)해 지적합니다.
- 리라이트는 초안의 사실관계를 유지하면서 위험 표현을 걷어내고, 사과 주체·대상·일정·문의처를 보강한 완성 문안으로 씁니다.
- 출력은 아래 스키마의 JSON 객체 하나뿐입니다.

JSON 스키마:
{
  "score": 0~100 정수 (이 초안을 그대로 배포했을 때의 위기 위험도),
  "summary": "가장 큰 문제를 짚는 한 문장",
  "findings": [{"quote": "초안의 문제 문구 그대로", "label": "문제 유형", "why": "왜 위험한지", "fix": "이렇게 바꿔 쓰세요", "severity": 1|2|3}],
  "rewrite": "완성된 리라이트 전문 (제목 포함, 여러 문단)",
  "checklist": [{"label": "점검 항목", "ok": true|false, "hint": "보완 방법"}]
}
분량: findings 5개, checklist 5개.`;

const SYSTEM_CASE = `당신은 기업 위기관리 사례를 정리하는 리서치 편집자입니다. 제공된 기사 원문·메모만을 근거로 사례 카드 초안을 JSON으로 만듭니다.
절대 규칙:
- 입력에 없는 사실·숫자·날짜를 추가하지 마세요. 모르면 빈 문자열이나 빈 배열로 두고 "uncertain"에 무엇이 비었는지 적으세요.
- 기사에서 확인되는 사실과 당신의 해석(교훈·평가)을 분리하세요. 교훈은 "lesson"에만 쓰고 근거가 기사에 있는 만큼만 쓰세요.
- sources에는 입력으로 받은 URL만 넣으세요. 새 URL을 만들지 마세요.
- 문체는 담백한 한국어 평서문. 감탄·수식 금지.
JSON 스키마:
{
  "company": "회사명(브랜드)",
  "country": "KR" | "US" | "GLOBAL",
  "date": "YYYY-MM 또는 YYYY-MM~YYYY-MM",
  "industry": "food|retail|consumer|tech|steel|entertainment|construction|pharma 중 하나",
  "type": "product-safety|false-claim|data-breach|outage|industrial-accident|disaster|owner-risk|labor|celebrity|financial|governance|misconduct|statement|environment|regulatory 중 하나",
  "stance": "apology|investigating|rebuttal|silence 중 하나 (초기 입장이 기사로 확인될 때만, 아니면 빈 문자열)",
  "title": "회사 — 한 줄 요지",
  "trigger": "발단 한두 문장",
  "scale": ["피해·규모 수치 (기사에 있는 것만)"],
  "timeline": [{"when": "날짜", "what": "사실"}],
  "response": ["회사가 실제로 취한 대응"],
  "outcome": "결과(기사에 있는 범위만)",
  "lesson": "실무 교훈 2~3문장",
  "verdict": "exemplary|mixed|failure 중 하나 (근거가 약하면 mixed)",
  "tags": ["검색 키워드 4~8개"],
  "uncertain": ["기사만으로 확인되지 않은 항목"]
}
timeline 4~8개, response 3~6개.`;

function buildPackagePrompt(input: {
  situation: string;
  brand: string;
  stance: Stance;
  stanceCustom: string;
  situations: string[];
  situationNote: string;
  entities: string[];
  caseType: string;
  stage: string;
  scale: string;
  article: FetchedArticle | null;
  articleError: string;
  context: PackageContext;
}): string {
  const lines: string[] = [];
  lines.push(`[위기 상황]\n${input.situation || "(본문 없음 — 아래 기사 원문 참고)"}`);
  const shortInput = input.situation.replace(/\s/g, "").length <= 20 && !input.article;
  if (shortInput) {
    lines.push(
      "\n[짧은 입력 — 쟁점 확장 필요]\n입력이 짧습니다. 일반론을 쓰지 말고 소비자 반발·명분·커뮤니티 여론·경쟁사 비교·언론 보도 포인트 5축으로 쟁점을 먼저 구체화한 뒤, 이 상황에만 맞는 문안을 쓰세요. 입력에 없는 업종·수치·시점은 assumptions에 ‘가정’으로 표시하세요.",
    );
  }
  if (input.brand) lines.push(`\n[브랜드]\n${input.brand}`);
  const stanceGuide = STANCE_GUIDE[input.stance];
  lines.push(
    `\n[우리 입장]\n${input.stance}(${stanceGuide.label}) — ${stanceGuide.directive}\n금기: ${stanceGuide.banned}`,
  );
  if (input.stance === "custom" && input.stanceCustom) {
    lines.push(`\n[사용자가 직접 정한 입장 문장]\n${input.stanceCustom}`);
  }
  const situationRows = input.situations
    .map((id) => SITUATION_GUIDE[id])
    .filter(Boolean)
    .map((g) => `- ${g.label}: ${g.directive}`);
  if (situationRows.length || input.situationNote) {
    lines.push(
      `\n[기업 상황]\n${[...situationRows, input.situationNote ? `- 직접 입력: ${input.situationNote}` : ""].filter(Boolean).join("\n")}`,
    );
  }
  if (input.entities.length) {
    lines.push(`\n[기업·상황 유형]`);
    for (const [i, id] of input.entities.entries()) {
      const guide = ENTITY_GUIDE[id];
      if (!guide) continue;
      lines.push(`- ${i === 0 ? "대표" : "보강"}: ${guide.label} — ${guide.directive} (금기: ${guide.banned})`);
    }
  }
  const c = input.context;
  const typeGuide = TYPE_GUIDE[input.caseType];
  if (typeGuide) {
    lines.push(`\n[이슈 유형 — ${typeGuide.label}]\n${typeGuide.directive} (금기: ${typeGuide.banned})`);
  } else if (input.caseType && input.caseType !== "auto") {
    lines.push(`\n[이슈 유형]\n${input.caseType}`);
  }
  if (input.stage) {
    const stageNote =
      input.stage === "planned"
        ? "사전(공지 전) — 아직 통제 가능. 공지 전 숫자·보호안·비교표를 먼저 완성하는 순서로 쓰세요."
        : input.stage === "breaking"
          ? "보도 직후 — 확인된 숫자와 공식 입장을 같은 시각 기준으로 내는 순서로 쓰세요."
          : "여론 확산 — 해지·불매·2차 보도에 대응하는 실행 순서로 쓰세요.";
    lines.push(`\n[현재 단계]\n${stageNote}`);
  }
  if (input.scale) {
    const scaleNote =
      input.scale === "small" ? "스타트업·중소 — 대표가 직접 설명, 인력·예산 한계를 일정으로 약속"
        : input.scale === "mid" ? "중견 — 부서 간 창구 단일화, 대표·실무 역할 분리"
          : input.scale === "large" ? "대기업 — 계열사·해외법인까지 동일 숫자, 승인선 사전 확정"
            : "글로벌 — 본사·현지 법인 가격·고지 기준 차이, 현지 규제 확인";
    lines.push(`\n[기업 규모]\n${scaleNote}`);
  }
  if (c.industryLabel) lines.push(`\n[업종]\n${c.industryLabel}`);
  if (c.caseTypeLabel) lines.push(`\n[이슈 유형]\n${c.caseTypeLabel}`);
  if (c.playbook) lines.push(`\n[업종 매뉴얼]\n${c.playbook}`);
  if (c.entityDigest) lines.push(`\n[선택한 유형의 상세 지침]\n${c.entityDigest}`);
  if (c.protocolDigest) lines.push(`\n[이슈 유형 표준 프로토콜]\n${c.protocolDigest}`);
  if (c.caseDigest) {
    lines.push(
      `\n[유사 사례 — 검수 완료 실제 사례의 대응·교훈]\n${c.caseDigest}\n` +
        "위 사례들의 대응 순서와 실수를 참고하되, 사례의 고유 사실(회사명·수치·날짜)을 이번 사안의 사실로 쓰지 마세요.",
    );
  } else {
    lines.push("\n[유사 사례]\n관련도 기준을 넘는 사례가 없습니다. 사례를 만들어내지 말고 표준 프로토콜로만 쓰세요.");
  }

  if (input.article) {
    lines.push(`\n[기사 원문 — 서버가 직접 읽음]`);
    lines.push(`URL: ${input.article.url}`);
    if (input.article.title) lines.push(`제목: ${input.article.title}`);
    if (input.article.description) lines.push(`요약: ${input.article.description}`);
    if (input.article.partial) {
      lines.push(
        "⚠ 본문은 로그인·페이월 등으로 읽지 못했고 제목·요약만 인용했습니다. 요약에 없는 사실·수치·피해 규모·기관명은 절대 만들어내지 말고 [확인 필요]로 두세요. 이 경우 issueBrief.assumptions에 ‘기사 본문을 읽지 못해 제목·요약만 참고’라고 밝히세요.",
      );
    }
    lines.push(`본문:\n${input.article.body}`);
  } else if (input.articleError) {
    lines.push(`\n[기사 원문 읽기 실패]\n${input.articleError} — 위 [위기 상황] 설명만으로 작성하세요.`);
  }

  lines.push(
    `\n위 내용으로 스키마에 맞는 대응 패키지 JSON을 만들어 주세요. 입장(${input.stance})과 유형(${input.entities.join(", ") || "general"})에 따라 모든 섹션이 달라져야 합니다.`,
  );
  return lines.join("\n");
}

function buildCasePrompt(input: { situation: string; article: FetchedArticle | null; articleError: string }): string {
  const rest = input.situation.replace(URL_RE, " ").replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  if (input.article) {
    lines.push(`[기사 원문 — 서버가 직접 읽음]\nURL: ${input.article.url}`);
    if (input.article.title) lines.push(`제목: ${input.article.title}`);
    if (input.article.description) lines.push(`요약: ${input.article.description}`);
    lines.push(`본문:\n${input.article.body}`);
  } else if (input.articleError) {
    lines.push(`[기사 원문 읽기 실패]\n${input.articleError}`);
  }
  if (rest) lines.push(`\n[붙여넣은 메모·본문]\n${rest}`);
  lines.push("\n위 자료만 근거로 사례 카드 초안 JSON을 만들어 주세요. 자료에 없는 내용은 비워 두세요.");
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* 기사 본문 읽기                                                       */
/* ------------------------------------------------------------------ */

interface FetchedArticle {
  url: string;
  title: string;
  description: string;
  body: string;
  chars: number;
  /** 본문을 끝까지 읽지 못하고 제목·오픈그래프 요약만 얻은 경우 */
  partial?: boolean;
}

const URL_RE = /https?:\/\/[^\s<>"'）)\]]+/i;

const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[::1\]|metadata\.|.*\.local$)/i;
/** 검증 하네스가 127.0.0.1 기사 서버를 읽을 때만 켭니다. 배포 환경에서는 항상 차단합니다. */
const ALLOW_LOCAL_FETCH = ENV.PRISM_ALLOW_LOCAL_FETCH === "1";

function extractUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[0].replace(/[.,;:!?]+$/, "") : null;
}

function safeUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes(".")) return null;
    if (!ALLOW_LOCAL_FETCH && (BLOCKED_HOST.test(host) || host.endsWith(".internal"))) return null;
    return url;
  } catch {
    return null;
  }
}

const decodeEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16) || 32));

function metaContent(html: string, patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const value = decodeEntities(m[1]).replace(/\s+/g, " ").trim();
      if (value.length > 1) return value.slice(0, 300);
    }
  }
  return "";
}

function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const article = withoutNoise.match(/<article[\s\S]*?<\/article>/i)?.[0];
  const main = withoutNoise.match(/<main[\s\S]*?<\/main>/i)?.[0];
  const scope = article || main || withoutNoise;
  const paragraphs = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 20);
  const text = paragraphs.length >= 3 ? paragraphs.join("\n") : decodeEntities(scope.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  try {
    await reader.cancel();
  } catch {
    /* 이미 끝났으면 무시 */
  }
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= merged.length) break;
    const slice = chunk.slice(0, merged.length - offset);
    merged.set(slice, offset);
    offset += slice.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function fetchArticle(url: string, signal: AbortSignal): Promise<{ ok: true; article: FetchedArticle } | { ok: false; reason: string }> {
  const parsed = safeUrl(url);
  if (!parsed) return { ok: false, reason: "주소를 읽을 수 없거나 접근할 수 없는 호스트입니다." };
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      redirect: "follow",
      signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 PRISM/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, reason: aborted ? "기사 응답이 제한 시간(12초)을 넘겼습니다." : "기사 서버에 연결하지 못했습니다." };
  }
  if (!res.ok) return { ok: false, reason: `기사 서버가 ${res.status} 응답을 보냈습니다.` };
  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (!/text\/html|application\/xhtml|text\/plain/.test(type)) {
    return { ok: false, reason: `기사 본문이 아닌 형식(${type || "알 수 없음"})입니다.` };
  }
  const raw = await readCapped(res, ARTICLE_MAX_BYTES);
  const title =
    metaContent(raw, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    ]) || "";
  const description = metaContent(raw, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ]);
  let body = htmlToText(raw);
  if (title && body.startsWith(title)) body = body.slice(title.length).trim();
  if (body.length < 200) {
    // 로그인·페이월·스크립트 렌더링 페이지라도 제목·요약(og:description)이 있으면 그 범위에서 분석을 이어갑니다.
    const summary = description.length >= 40 ? description : "";
    if (summary && title) {
      return {
        ok: true,
        article: {
          url: parsed.toString(),
          title: title.slice(0, 200),
          description: summary.slice(0, 400),
          body: `${title}\n${summary}`,
          chars: summary.length,
          partial: true,
        },
      };
    }
    return { ok: false, reason: "본문을 충분히 읽지 못했습니다(로그인·페이월·스크립트 렌더링 페이지일 수 있음)." };
  }
  return {
    ok: true,
    article: {
      url: parsed.toString(),
      title: title.slice(0, 200),
      description,
      body: body.slice(0, ARTICLE_MAX_CHARS),
      chars: body.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* 모델 호출                                                            */
/* ------------------------------------------------------------------ */

async function completeOpenAI(input: CompletionInput): Promise<CompletionOutcome> {
  const upstream = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
    signal: input.signal,
  });

  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => "");
    let detail = raw.slice(0, 240);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed?.error?.message) detail = parsed.error.message.slice(0, 240);
    } catch {
      /* 원문 유지 */
    }
    const hint =
      upstream.status === 401
        ? "API 키가 유효하지 않습니다."
        : upstream.status === 429
          ? "OpenAI 요청 한도에 걸렸습니다. 잠시 후 다시 시도하세요."
          : "AI 제공자 응답 오류입니다.";
    return { ok: false, status: upstream.status, error: "upstream_error", message: `${hint} ${detail}`.trim() };
  }

  const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) return { ok: false, status: 502, error: "empty_completion", message: "AI가 빈 응답을 보냈습니다." };
  return { ok: true, value: { content, model: input.model, usage: data.usage ?? null } };
}

async function completeGemini(input: CompletionInput): Promise<CompletionOutcome> {
  const url = `${GEMINI_BASE}/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    temperature: input.temperature,
  };
  if (/^gemini-3\./.test(input.model)) {
    // Gemini 3.x는 thinking 토큰이 maxOutputTokens에 포함됩니다. 잘린 JSON을 받지 않도록 한도를 넓힙니다.
    generationConfig.maxOutputTokens = Math.min(65_536, input.maxTokens * 3 + 1_024);
  } else {
    generationConfig.maxOutputTokens = input.maxTokens;
    if (/^gemini-2\.5-flash(?!-lite)/.test(input.model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.user }] }],
      generationConfig,
    }),
    signal: input.signal,
  });

  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => "");
    let detail = raw.slice(0, 240);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed?.error?.message) detail = parsed.error.message.slice(0, 240);
    } catch {
      /* 원문 유지 */
    }
    const hint =
      upstream.status === 404
        ? "Gemini 모델을 사용할 수 없습니다. GEMINI_MODEL을 확인하세요."
        : upstream.status === 400 || upstream.status === 401 || upstream.status === 403
          ? "Gemini API 키나 요청이 거부되었습니다."
          : upstream.status === 429
            ? "Gemini 요청 한도에 걸렸습니다. 잠시 후 다시 시도하세요."
            : "AI 제공자 응답 오류입니다.";
    return { ok: false, status: upstream.status, error: "upstream_error", message: `${hint} ${detail}`.trim() };
  }

  const data = (await upstream.json()) as GeminiResponse;
  const content = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => part.thought !== true)
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!content) {
    const reason = data.candidates?.[0]?.finishReason;
    return {
      ok: false,
      status: 502,
      error: "empty_completion",
      message: reason ? `Gemini가 응답을 만들지 못했습니다 (${reason}).` : "AI가 빈 응답을 보냈습니다.",
    };
  }
  const usage = data.usageMetadata
    ? {
        prompt_tokens: data.usageMetadata.promptTokenCount ?? 0,
        completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
        total_tokens: data.usageMetadata.totalTokenCount ?? 0,
      }
    : null;
  return { ok: true, value: { content, model: input.model, usage } };
}

/* ------------------------------------------------------------------ */
/* 재시도                                                              */
/* ------------------------------------------------------------------ */

/** Gemini가 과부하(503)·한도(429)로 거절할 때만 한 번 더 시도합니다. */
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAY_MS = 700;

async function completeWithRetry(
  provider: Provider,
  input: CompletionInput,
  startedAt: number,
): Promise<{ outcome: CompletionOutcome; attempts: number }> {
  const call = provider === "gemini" ? completeGemini : completeOpenAI;
  const first = await call(input);
  if (first.ok || !RETRYABLE_STATUS.has(first.status)) return { outcome: first, attempts: 1 };

  // 남은 시간이 짧으면(3초 미만) 재시도 대신 깔끔하게 실패를 돌려줍니다.
  if (UPSTREAM_TIMEOUT_MS - (Date.now() - startedAt) < 3_000) return { outcome: first, attempts: 1 };
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  if (input.signal.aborted) return { outcome: first, attempts: 1 };

  const second = await call(input);
  if (!second.ok) {
    return {
      outcome: {
        ...second,
        message: `${second.message} (자동 재시도 1회 후 실패)`,
      },
      attempts: 2,
    };
  }
  return { outcome: second, attempts: 2 };
}

/* ------------------------------------------------------------------ */
/* 유틸                                                                */
/* ------------------------------------------------------------------ */

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");
}

function headerValue(req: VercelRequest, name: string): string {
  const raw = req.headers[name] ?? req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0]?.trim() ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

const clean = (value: unknown, max = 2_000): string =>
  typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, max) : "";

interface PackageContext {
  industryLabel?: string;
  playbook?: string;
  entityDigest?: string;
  caseTypeLabel?: string;
  protocolDigest?: string;
  caseDigest?: string;
}

function sanitizeContext(raw: unknown): PackageContext {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  return {
    industryLabel: clean(r.industryLabel, 60) || undefined,
    playbook: clean(r.playbook, 3_000) || undefined,
    entityDigest: clean(r.entityDigest, 2_500) || undefined,
    caseTypeLabel: clean(r.caseTypeLabel, 60) || undefined,
    protocolDigest: clean(r.protocolDigest, 3_500) || undefined,
    caseDigest: clean(r.caseDigest, 3_500) || undefined,
  };
}

function parseJson(content: string): unknown {
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const salvaged = salvageJson(cleaned);
    if (salvaged !== null) return salvaged;
    throw error;
  }
}

/**
 * 모델이 출력 한도에 걸려 JSON이 중간에 잘린 경우, 마지막으로 완결된 지점까지 되돌려
 * 괄호를 닫아 해석합니다. 성공하면 패키지 전체를 버리지 않고 부분 결과를 쓸 수 있습니다.
 * 해석이 불가능하면 null을 돌려주고 원래 오류를 그대로 냅니다.
 */
function salvageJson(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const body = text.slice(start);
  const tryClose = (fragment: string): unknown | null => {
    const closed = closeJson(fragment);
    if (!closed) return null;
    try {
      return JSON.parse(closed);
    } catch {
      return null;
    }
  };

  // 1) 마지막 ‘}’까지 그대로 닫기 시도
  const lastBrace = body.lastIndexOf("}");
  if (lastBrace > 0) {
    const direct = tryClose(body.slice(0, lastBrace + 1));
    if (direct !== null) return direct;
  }

  // 2) 쉼표 단위로 뒤에서부터 잘라 가며 닫기
  let cut = body.length;
  for (let guard = 0; guard < 400 && cut > 0; guard += 1) {
    const comma = body.lastIndexOf(",", cut - 1);
    if (comma <= 0) break;
    const candidate = tryClose(body.slice(0, comma));
    if (candidate !== null) return candidate;
    cut = comma;
  }
  return null;
}

/** 문자열·중괄보 상태를 추적해 열린 괄호를 닫습니다. 구조가 깨졌으면 null. */
function closeJson(fragment: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of fragment) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      stack.push("}");
    } else if (ch === "[") {
      stack.push("]");
    } else if (ch === "}" || ch === "]") {
      const expected = stack.pop();
      if (expected !== ch) return null;
    }
  }
  let out = fragment;
  if (inString) out += '"';
  out = out.replace(/[,:]\s*$/, "");
  // {"key": } 처럼 값 없이 끝난 경우 키를 제거
  out = out.replace(/"[^"\\]*"\s*:\s*$/, "");
  while (stack.length) out += stack.pop();
  return out;
}

/* ------------------------------------------------------------------ */
/* 핸들러                                                              */
/* ------------------------------------------------------------------ */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  const geminiEnvKey = (ENV.GEMINI_API_KEY ?? "").trim();
  const openaiEnvKey = (ENV.OPENAI_API_KEY ?? "").trim();
  const envProvider: Provider | null = geminiEnvKey ? "gemini" : openaiEnvKey ? "openai" : null;

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      model: envProvider === "gemini" ? GEMINI_MODEL : OPENAI_MODEL,
      provider: envProvider,
      serverKey: Boolean(envProvider),
      urlFetch: true,
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed", message: "POST 요청만 지원합니다." });
    return;
  }

  const startedAt = Date.now();

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as Record<string, unknown>;
    if (!body || typeof body !== "object") throw new Error("empty");
  } catch {
    res.status(400).json({ error: "bad_request", message: "JSON 본문을 읽을 수 없습니다." });
    return;
  }

  const mode: Mode = body.mode === "review" ? "review" : body.mode === "case" ? "case" : "package";
  const stance: Stance = STANCES.includes(body.stance as Stance) ? (body.stance as Stance) : "investigating";
  const stanceCustom = stance === "custom" ? clean(body.stanceCustom, 200) : "";
  const situations = Array.isArray(body.situations)
    ? body.situations
        .filter((v): v is string => typeof v === "string" && Boolean(SITUATION_GUIDE[v]))
        .slice(0, 4)
    : [];
  const situationNote = clean(body.situationNote, 300);
  const brand = clean(body.brand, 60);
  // 길이 판정은 자르기 전 원문으로 합니다. 잘라 놓고 검사하면 초과 입력이 통과합니다.
  const rawSituation = typeof body.situation === "string" ? body.situation.replace(/\u0000/g, "").trim() : "";
  const rawDraft = typeof body.draft === "string" ? body.draft.replace(/\u0000/g, "").trim() : "";
  const situation = rawSituation.slice(0, MAX_SITUATION_CHARS);
  const draft = rawDraft.slice(0, MAX_DRAFT_CHARS);
  const target = mode === "review" ? draft : situation;

  if (target.length < (mode === "review" ? MIN_REVIEW_CHARS : MIN_PACKAGE_CHARS)) {
    res.status(400).json({
      error: "input_too_short",
      message:
        mode === "review"
          ? `검수할 입장문은 최소 ${MIN_REVIEW_CHARS}자 이상이어야 합니다.`
          : "위기 상황을 한 줄 이상 적어 주세요(기사 URL만 넣어도 됩니다). ‘가격 인상’처럼 짧은 키워드도 됩니다.",
    });
    return;
  }
  if (rawSituation.length > MAX_SITUATION_CHARS || rawDraft.length > MAX_DRAFT_CHARS) {
    res.status(413).json({ error: "input_too_long", message: "입력이 너무 깁니다. 8,000자까지 처리할 수 있습니다." });
    return;
  }

  const entities = Array.isArray(body.entities)
    ? body.entities.filter((e): e is string => typeof e === "string" && Boolean(ENTITY_GUIDE[e])).slice(0, 3)
    : [];
  const caseType = clean(body.caseType, 40) || "auto";
  const stage = ["planned", "breaking", "spreading"].includes(clean(body.stage, 20)) ? clean(body.stage, 20) : "";
  const scale = ["small", "mid", "large", "global"].includes(clean(body.scale, 20)) ? clean(body.scale, 20) : "";
  const context = sanitizeContext(body.context);

  /* 서버 키 → 요청 개인 키 순서, 키 앞자리로 제공자 판별 */
  const headerKey = headerValue(req, "x-api-key");
  const bodyKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const requestKey = headerKey || bodyKey;
  const geminiKey = geminiEnvKey || (requestKey && isGeminiKey(requestKey) ? requestKey : "");
  const openaiKey = openaiEnvKey || (requestKey && !isGeminiKey(requestKey) ? requestKey : "");
  const provider: Provider | null = geminiKey ? "gemini" : openaiKey ? "openai" : null;
  const apiKey = geminiKey || openaiKey;
  if (!provider) {
    res.status(501).json({
      error: "no_key",
      message:
        "서버에 GEMINI_API_KEY나 OPENAI_API_KEY가 설정되지 않았습니다. 배포 환경변수를 추가하거나 설정에서 개인 키(Gemini AQ./AIza… 또는 OpenAI sk-…)를 입력하세요.",
    });
    return;
  }
  const model = provider === "gemini" ? GEMINI_MODEL : OPENAI_MODEL;

  /* 기사 URL이 있으면 서버가 직접 읽습니다. */
  let article: FetchedArticle | null = null;
  let articleError = "";
  let sourceInfo: { url: string; title: string; chars: number; ok: boolean; note?: string; partial?: boolean } | undefined;
  const url = mode !== "review" ? extractUrl(situation) : null;
  if (url) {
    const rest = situation.replace(URL_RE, " ").replace(/\s+/g, " ").trim();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ARTICLE_TIMEOUT_MS);
    let outcome: Awaited<ReturnType<typeof fetchArticle>>;
    try {
      outcome = await fetchArticle(url, controller.signal);
    } finally {
      clearTimeout(timer);
    }
    if (outcome.ok) {
      article = outcome.article;
      sourceInfo = {
        url: article.url,
        title: article.title,
        chars: article.chars,
        ok: true,
        partial: article.partial === true,
        note: article.partial ? "본문은 읽지 못해 제목·요약만 참고했습니다." : undefined,
      };
    } else {
      articleError = outcome.reason;
      sourceInfo = { url, title: "", chars: 0, ok: false, note: outcome.reason };
      // URL만 넣었고 설명이 거의 없으면, 읽지 못한 채로 분석하지 않고 이유를 알려 줍니다.
      if (rest.length < 30) {
        res.status(422).json({
          error: "fetch_failed",
          message: `기사 본문을 읽지 못했습니다. ${outcome.reason} 기사 내용을 복사해 상황 설명에 붙여넣으면 바로 분석합니다.`,
          source: sourceInfo,
        });
        return;
      }
    }
  }

  const system = mode === "review" ? SYSTEM_REVIEW : mode === "case" ? SYSTEM_CASE : SYSTEM_PACKAGE;
  const user =
    mode === "case"
      ? buildCasePrompt({ situation, article, articleError })
      : mode === "review"
      ? [
          brand ? `[브랜드]\n${brand}` : "",
          `[검수할 입장문 초안]\n${draft}`,
          "위 초안을 진단하고 스키마에 맞는 JSON을 만들어 주세요.",
        ]
          .filter(Boolean)
          .join("\n\n")
      : buildPackagePrompt({ situation, brand, stance, stanceCustom, situations, situationNote, entities, caseType, stage, scale, article, articleError, context });

  const maxTokens = mode === "review" ? 3_500 : mode === "case" ? 5_000 : 8_000;
  const temperature = mode === "review" ? 0.3 : mode === "case" ? 0.15 : 0.45;

  const controller = new AbortController();
  const remaining = Math.max(8_000, UPSTREAM_TIMEOUT_MS - (Date.now() - startedAt));
  const timer = setTimeout(() => controller.abort(), remaining);

  try {
    const { outcome, attempts } = await completeWithRetry(
      provider,
      {
        apiKey,
        model,
        system,
        user,
        maxTokens,
        temperature: provider === "gemini" ? temperature : temperature - 0.1,
        signal: controller.signal,
      },
      startedAt,
    );
    if (!outcome.ok) {
      res.status(502).json({ error: outcome.error, status: outcome.status, message: outcome.message, attempts });
      return;
    }

    let result: unknown;
    try {
      result = parseJson(outcome.value.content);
    } catch {
      res.status(502).json({ error: "bad_json", message: "AI 응답을 JSON으로 해석하지 못했습니다. 다시 시도해 주세요." });
      return;
    }

    res.status(200).json({
      ok: true,
      provider,
      model: outcome.value.model,
      latencyMs: Date.now() - startedAt,
      attempts,
      usage: outcome.value.usage,
      mode,
      source: sourceInfo,
      result,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    res.status(aborted ? 504 : 502).json({
      error: aborted ? "timeout" : "upstream_unreachable",
      message: aborted
        ? "AI 응답이 제한 시간을 넘겼습니다. 입력을 줄이거나 잠시 후 다시 시도하세요."
        : "AI 제공자에 연결하지 못했습니다.",
    });
  } finally {
    clearTimeout(timer);
  }
}
