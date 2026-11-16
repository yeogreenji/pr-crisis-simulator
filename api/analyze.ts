/**
 * PRISM 대응 패키지 백엔드 (Vercel 서버리스 함수)
 *
 * POST /api/analyze
 *   body: {
 *     mode: "package" | "review",
 *     situation?: string,        // 위기 상황 한 줄 또는 기사 URL
 *     stance?: "apology" | "investigating" | "rebuttal",
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
const MIN_INPUT_CHARS = 8;
const UPSTREAM_TIMEOUT_MS = 55_000;
const ARTICLE_TIMEOUT_MS = 12_000;
const ARTICLE_MAX_BYTES = 1_800_000;
const ARTICLE_MAX_CHARS = 6_000;

const OPENAI_BASE = (ENV.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_URL = `${OPENAI_BASE}/chat/completions`;
/** GEMINI_BASE_URL은 검증 하네스가 모의 서버를 물릴 때만 씁니다. */
const GEMINI_BASE = (ENV.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");

type Provider = "gemini" | "openai";
type Stance = "apology" | "investigating" | "rebuttal";
type Mode = "package" | "review";

const isGeminiKey = (key: string): boolean => key.length > 0 && !key.startsWith("sk-");
const STANCES: Stance[] = ["apology", "investigating", "rebuttal"];

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
- 입장(stance)에 따라 문안과 전략이 완전히 달라져야 합니다.
  · apology(사실 인정·즉시 사과): 첫 문단이 사과, 두 번째가 고객이 지금 할 일. 원인 변명·책임 전가 금지. 보상 기준과 시점을 반드시 포함.
  · investigating(경위 확인 중·선제 안내): 확정되지 않은 사실은 인정하지 않되, 확인 항목과 '공개 시각'을 약속. 사과는 확인된 사실에만 한정. 선제 조치를 반드시 포함.
  · rebuttal(사실무근·강경 반박): 근거 자료와 사실관계 중심. 감정 표현·“루머/악플러”·근거 없는 단정 금지. 정당한 비판은 수용한다는 문장 포함.
- 기업 유형(entities)의 지침을 모든 섹션에 구체적으로 반영하세요. 유형이 여러 개면 첫 번째를 대표로 삼고 나머지는 해당 섹션에 보강 항목으로 넣습니다.
- 전체 대응 시스템(roadmap)은 1시간 → 6시간 → 24시간~ 3단계로, 각 단계에 목표(goal)와 다음 단계로 넘어가기 위한 통과 기준(gate)을 씁니다.
- 출력은 아래 스키마의 JSON 객체 하나뿐입니다. 코드블록, 설명, 인사말을 붙이지 마세요.

JSON 스키마:
{
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
  "watchouts": ["이 유형에서만 생기는 함정 3개"]
}

분량: roadmap 3개(1시간·6시간·24시간~), actions 3개(각 5~7항목), statements 정확히 2개(public·press), qa 5개, banned 5개, stakeholders 4~6개, outlook.reactions 4개, triggers 3개, escalation 3개, watchouts 3개.
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

function buildPackagePrompt(input: {
  situation: string;
  brand: string;
  stance: Stance;
  entities: string[];
  article: FetchedArticle | null;
  articleError: string;
  context: PackageContext;
}): string {
  const lines: string[] = [];
  lines.push(`[위기 상황]\n${input.situation || "(본문 없음 — 아래 기사 원문 참고)"}`);
  if (input.brand) lines.push(`\n[브랜드]\n${input.brand}`);
  lines.push(
    `\n[우리 입장]\n${input.stance} — ${
      input.stance === "apology"
        ? "잘못이 확인된 상황. 즉시 사과하고 수습·보상을 먼저 제시."
        : input.stance === "investigating"
          ? "아직 확인 전. 확인 일정과 범위를 먼저 약속하고 추측하지 않음."
          : "보도·주장이 사실과 다름. 근거 중심으로 반박하고 원칙을 밝힘."
    }`,
  );
  if (input.entities.length) {
    lines.push(`\n[기업·상황 유형]`);
    for (const [i, id] of input.entities.entries()) {
      const guide = ENTITY_GUIDE[id];
      if (!guide) continue;
      lines.push(`- ${i === 0 ? "대표" : "보강"}: ${guide.label} — ${guide.directive} (금기: ${guide.banned})`);
    }
  }
  const c = input.context;
  if (c.industryLabel) lines.push(`\n[업종]\n${c.industryLabel}`);
  if (c.playbook) lines.push(`\n[업종 매뉴얼]\n${c.playbook}`);
  if (c.entityDigest) lines.push(`\n[선택한 유형의 상세 지침]\n${c.entityDigest}`);

  if (input.article) {
    lines.push(`\n[기사 원문 — 서버가 직접 읽음]`);
    lines.push(`URL: ${input.article.url}`);
    if (input.article.title) lines.push(`제목: ${input.article.title}`);
    if (input.article.description) lines.push(`요약: ${input.article.description}`);
    lines.push(`본문:\n${input.article.body}`);
  } else if (input.articleError) {
    lines.push(`\n[기사 원문 읽기 실패]\n${input.articleError} — 위 [위기 상황] 설명만으로 작성하세요.`);
  }

  lines.push(
    `\n위 내용으로 스키마에 맞는 대응 패키지 JSON을 만들어 주세요. 입장(${input.stance})과 유형(${input.entities.join(", ") || "general"})에 따라 모든 섹션이 달라져야 합니다.`,
  );
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
}

function sanitizeContext(raw: unknown): PackageContext {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  return {
    industryLabel: clean(r.industryLabel, 60) || undefined,
    playbook: clean(r.playbook, 3_000) || undefined,
    entityDigest: clean(r.entityDigest, 2_500) || undefined,
  };
}

function parseJson(content: string): unknown {
  return JSON.parse(content.replace(/^```(?:json)?/i, "").replace(/```$/g, "").trim());
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

  const mode: Mode = body.mode === "review" ? "review" : "package";
  const stance: Stance = STANCES.includes(body.stance as Stance) ? (body.stance as Stance) : "investigating";
  const brand = clean(body.brand, 60);
  // 길이 판정은 자르기 전 원문으로 합니다. 잘라 놓고 검사하면 초과 입력이 통과합니다.
  const rawSituation = typeof body.situation === "string" ? body.situation.replace(/\u0000/g, "").trim() : "";
  const rawDraft = typeof body.draft === "string" ? body.draft.replace(/\u0000/g, "").trim() : "";
  const situation = rawSituation.slice(0, MAX_SITUATION_CHARS);
  const draft = rawDraft.slice(0, MAX_DRAFT_CHARS);
  const target = mode === "review" ? draft : situation;

  if (target.length < MIN_INPUT_CHARS) {
    res.status(400).json({
      error: "input_too_short",
      message:
        mode === "review"
          ? `검수할 입장문은 최소 ${MIN_INPUT_CHARS}자 이상이어야 합니다.`
          : "위기 상황을 한 줄 이상 적어 주세요(기사 URL만 넣어도 됩니다).",
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
  let sourceInfo: { url: string; title: string; chars: number; ok: boolean; note?: string } | undefined;
  const url = mode === "package" ? extractUrl(situation) : null;
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
      sourceInfo = { url: article.url, title: article.title, chars: article.chars, ok: true };
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

  const system = mode === "review" ? SYSTEM_REVIEW : SYSTEM_PACKAGE;
  const user =
    mode === "review"
      ? [
          brand ? `[브랜드]\n${brand}` : "",
          `[검수할 입장문 초안]\n${draft}`,
          "위 초안을 진단하고 스키마에 맞는 JSON을 만들어 주세요.",
        ]
          .filter(Boolean)
          .join("\n\n")
      : buildPackagePrompt({ situation, brand, stance, entities, article, articleError, context });

  const maxTokens = mode === "review" ? 3_500 : 6_000;
  const temperature = mode === "review" ? 0.3 : 0.45;

  const controller = new AbortController();
  const remaining = Math.max(8_000, UPSTREAM_TIMEOUT_MS - (Date.now() - startedAt));
  const timer = setTimeout(() => controller.abort(), remaining);

  try {
    const outcome =
      provider === "gemini"
        ? await completeGemini({ apiKey, model, system, user, maxTokens, temperature, signal: controller.signal })
        : await completeOpenAI({ apiKey, model, system, user, maxTokens, temperature: temperature - 0.1, signal: controller.signal });
    if (!outcome.ok) {
      res.status(502).json({ error: outcome.error, status: outcome.status, message: outcome.message });
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
