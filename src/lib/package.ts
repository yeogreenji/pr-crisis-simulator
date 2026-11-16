import type { IndustryId, Severity } from "../types";
import { getIndustry } from "./industries";
import { getChannel } from "./presets";
import { RISK_RULES } from "./rules";
import { ENTITY_PROFILES, getProfiles, type EntityId, type EntityProfile } from "./profiles";
export type { EntityId };

/* ------------------------------------------------------------------ */
/* 모델                                                                */
/* ------------------------------------------------------------------ */

export type Stance = "apology" | "investigating" | "rebuttal";
export type RiskLevel = "높음" | "보통" | "낮음";

export interface StanceSpec {
  id: Stance;
  label: string;
  short: string;
  desc: string;
  /** 이 입장에서 절대 흔들리면 안 되는 한 줄 */
  rule: string;
  accent: string;
}

export const STANCES: StanceSpec[] = [
  {
    id: "apology",
    label: "사실 인정 · 즉시 사과",
    short: "즉시 사과",
    desc: "잘못이 확인됐습니다. 사과와 수습이 먼저, 원인 규명은 그다음입니다.",
    rule: "첫 문단은 사과, 두 번째는 고객이 지금 할 일. 변명은 쓰지 않습니다.",
    accent: "#c8352b",
  },
  {
    id: "investigating",
    label: "경위 확인 중 · 선제 안내",
    short: "확인 중",
    desc: "아직 사실이 확정되지 않았습니다. 확인 일정과 범위를 먼저 약속합니다.",
    rule: "추측하지 않는 대신, 확인 시각을 반드시 약속하고 지킵니다.",
    accent: "#a9660a",
  },
  {
    id: "rebuttal",
    label: "사실무근 · 강경 반박",
    short: "강경 반박",
    desc: "보도·주장이 사실과 다릅니다. 근거 공개와 원칙으로 대응합니다.",
    rule: "근거 2개 없이 ‘사실무근’만 말하면 태도 논란으로 번집니다.",
    accent: "#1c2fa8",
  },
];

export const getStance = (id: Stance): StanceSpec => STANCES.find((s) => s.id === id) ?? STANCES[0];

export interface RoadmapPhase {
  window: string;
  title: string;
  goal: string;
  gate: string;
  items: string[];
}

export interface ActionItem {
  text: string;
  owner: string;
}

export interface ActionGroup {
  window: string;
  title: string;
  items: ActionItem[];
}

export interface Statement {
  id: "public" | "press";
  label: string;
  channel: string;
  title: string;
  body: string;
}

export interface QaScript {
  question: string;
  answer: string;
  guide: string;
  avoid: string[];
  level: Severity;
  source: "local" | "ai";
}

export interface StakeholderPlan {
  who: string;
  when: string;
  action: string;
  line: string;
}

export interface Outlook {
  reactions: { channel: string; text: string; tone: string }[];
  triggers: string[];
  escalation: string[];
}

export interface BannedPhrase {
  phrase: string;
  why: string;
}

export interface FetchMeta {
  url: string;
  title: string;
  chars: number;
  ok: boolean;
  note?: string;
}

export interface ResponsePackage {
  id: string;
  createdAt: string;
  mode: "ai" | "local";
  modeNote?: string;
  situation: string;
  brand: string;
  stance: Stance;
  entities: EntityId[];
  industry: IndustryId;
  industryLabel: string;
  eventLabel: string;
  risk: RiskLevel;
  headline: string;
  strategy: string;
  roadmap: RoadmapPhase[];
  actions: ActionGroup[];
  statements: Statement[];
  qa: QaScript[];
  banned: BannedPhrase[];
  stakeholders: StakeholderPlan[];
  outlook: Outlook;
  watchouts: string[];
  ai?: { model: string; latencyMs?: number; provider?: string };
  fetch?: FetchMeta;
}

export interface ReviewFinding {
  quote: string;
  label: string;
  why: string;
  fix: string;
  level: Severity;
}

export interface ReviewResult {
  id: string;
  createdAt: string;
  mode: "ai" | "local";
  modeNote?: string;
  draft: string;
  brand: string;
  score: number;
  summary: string;
  findings: ReviewFinding[];
  rewrite: string;
  checklist: { label: string; ok: boolean; hint: string }[];
  ai?: { model: string; latencyMs?: number; provider?: string };
}

export interface PackageInput {
  situation: string;
  brand: string;
  stance: Stance;
  entities: EntityId[];
}

/* ------------------------------------------------------------------ */
/* 분류                                                                */
/* ------------------------------------------------------------------ */

const URL_RE = /https?:\/\/[^\s<>"'）)\]]+/i;

export function extractUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[0].replace(/[.,;:!?]+$/, "") : null;
}

export function stripUrl(text: string): string {
  return text.replace(URL_RE, " ").replace(/\s{2,}/g, " ").trim();
}

const INDUSTRY_KEYWORDS: Record<IndustryId, RegExp> = {
  food: /식품|식당|외식|음식|만두|라면|과자|음료|원재료|원료|이물|식중독|식약처|유통기한|소비기한|리콜|회수|급식|납품|중금속|잔류|위생|알레르기|커피|베이커리|도시락|반찬|정육|수산|농산/g,
  tech: /서비스|장애|서버|접속|개인정보|유출|해킹|랜섬|결제|데이터|앱|플랫폼|업데이트|API|로그|계정|비밀번호|클라우드|보안|침해|이용자|가입자|구독/g,
  retail: /배송|택배|환불|교환|가격|인상|판촉|입점|수수료|정산|판매|매장|유통|마트|쿠폰|멤버십|주문|재고/g,
  consumer: /제품|품질|성분|부작용|피부|화장품|생활용품|가전|리뷰|사용감|파손|불량|AS|보증|교체|향|색상|사이즈/g,
  steel: /공장|제조|생산|설비|안전|사고|끼임|추락|화재|폭발|협력사|하청|중대재해|노조|파업|임금|해고|산재|근로|노동|조합|고발|횡령|배임|오너|경영진|감사/g,
  entertainment: /아티스트|연예인|배우|가수|아이돌|팬덤|팬|소속사|전속|광고|방송|드라마|앨범|콘서트|표절|논란|발언|사생활|열애|학폭|크리에이터|유튜버|인플루언서|커뮤니티/g,
};

export function inferIndustry(text: string, fallback: IndustryId): IndustryId {
  let best: IndustryId = fallback;
  let bestScore = 0;
  for (const [id, re] of Object.entries(INDUSTRY_KEYWORDS) as [IndustryId, RegExp][]) {
    const hits = text.match(re)?.length ?? 0;
    const weighted = hits + (id === fallback ? 0.5 : 0);
    if (weighted > bestScore) {
      bestScore = weighted;
      best = id;
    }
  }
  return bestScore >= 1 ? best : fallback;
}

const EVENT_RULES: { re: RegExp; label: string; risk: RiskLevel }[] = [
  { re: /사망|숨(?:지|졌)|중상|끼임|추락|폭발|화재|중대재해/, label: "중대재해", risk: "높음" },
  { re: /개인정보|유출|해킹|랜섬|침해/, label: "개인정보 유출 의혹", risk: "높음" },
  { re: /이물|식중독|중금속|잔류|기준치\s?초과|발암|부적합/, label: "안전성 논란", risk: "높음" },
  { re: /리콜|회수|판매\s?중지|폐기/, label: "회수·리콜 사태", risk: "높음" },
  { re: /횡령|배임|사기|성(?:범죄|폭력)|갑질|괴롭힘|학폭/, label: "경영진·조직 리스크", risk: "높음" },
  { re: /아티스트|전속|사생활|팬덤|아이돌|연예인|배우|가수/, label: "소속사·아티스트 논란", risk: "높음" },
  { re: /장애|먹통|접속\s?불가|서비스\s?중단|결제\s?오류/, label: "서비스 장애", risk: "보통" },
  { re: /주가|공시|자사주|미공개|내부자\s?거래/, label: "공시·주가 리스크", risk: "높음" },
  { re: /가격\s?인상|인상|수수료|요금/, label: "가격·요금 논란", risk: "보통" },
  { re: /의혹|폭로|고발/, label: "의혹 보도", risk: "높음" },
  { re: /논란|비판|항의|불만|민원|댓글|여론/, label: "여론 논란", risk: "보통" },
  { re: /노조|파업|교섭|임금|해고|고발|내부고발/, label: "노사 갈등", risk: "높음" },
  { re: /광고|협찬|표절|저작권|계약\s?분쟁/, label: "계약·콘텐츠 논란", risk: "보통" },
];

export function detectEvent(text: string): { label: string; risk: RiskLevel } {
  for (const rule of EVENT_RULES) {
    if (rule.re.test(text)) return { label: rule.label, risk: rule.risk };
  }
  return { label: "위기 상황", risk: "보통" };
}

function summarize(text: string, max = 260): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("다. "), cut.lastIndexOf("요. "));
  return `${(lastStop > 80 ? cut.slice(0, lastStop + 1) : cut).trim()}…`;
}

/* ------------------------------------------------------------------ */
/* 로컬 패키지 생성                                                     */
/* ------------------------------------------------------------------ */

const place = (label: string) => `[확인 필요: ${label}]`;

const STANCE_BANNED: Record<Stance, BannedPhrase[]> = {
  apology: [
    { phrase: "“유감입니다”로 끝내는 표현", why: "책임을 인정하지 않는 표현으로 읽힙니다. 사과 주체와 대상이 필요합니다." },
    { phrase: "“확인 중”만 반복", why: "사과를 해놓고 정보를 숨기는 문장이 됩니다. 확인 일정을 함께 붙이세요." },
  ],
  investigating: [
    { phrase: "“전혀 문제 없습니다”", why: "확인 전 단정은 이후 사실이 달라질 때 신뢰 손실로 돌아옵니다." },
    { phrase: "근거 없는 “사실무근”", why: "확인 전 부인은 ‘은폐’ 프레임을 만듭니다." },
  ],
  rebuttal: [
    { phrase: "“루머·악플러” 같은 감정 표현", why: "사실관계보다 태도가 기사가 됩니다." },
    { phrase: "근거 없는 “100% 사실”", why: "반박의 근거가 없으면 강경함만 남습니다." },
  ],
};

const STANCE_QA: Record<Stance, { question: string; answer: string; guide: string; level: Severity }[]> = {
  apology: [
    {
      question: "왜 이렇게 늦게 알렸습니까?",
      answer:
        "최초 인지 시각은 [확인 필요: 시각]이고, 첫 공지는 [확인 필요: 시각]에 나갔습니다. 늦었다면 그 이유도 함께 공개하겠습니다. 타임라인 전체를 숨기지 않고 공개하겠습니다.",
      guide: "인지·공지 시각을 숫자로 제시합니다. 변명보다 기록이 설득력 있습니다.",
      level: 3,
    },
    {
      question: "책임은 누구에게 있습니까?",
      answer:
        "원인과 책임은 당사에 있습니다. 내부 조사 결과에 따라 담당자와 조직의 책임을 명확히 하고, 그 결과도 같은 채널에 공개하겠습니다.",
      guide: "책임 주체를 회사로 명확히 합니다. 개인에게 미루는 표현은 금지입니다.",
      level: 3,
    },
    {
      question: "보상은 어떻게 하십니까?",
      answer:
        "보상 기준은 [날짜]까지 확정해 공지하겠습니다. 접수는 [채널]에서 받고, 처리 현황도 정해진 시각에 공개하겠습니다.",
      guide: "기준·시점·창구 세 가지를 반드시 함께 답합니다.",
      level: 3,
    },
  ],
  investigating: [
    {
      question: "‘확인 중’이라는 말만 반복하십니까?",
      answer:
        "확인된 사실과 확인 중인 사항을 구분해 알려드리고 있습니다. 확인 결과는 [확인 필요: 시각]에 공개하겠습니다. 일정을 지키는 것으로 답하겠습니다.",
      guide: "확인 시각을 반드시 함께 말합니다. 시각 없는 ‘확인 중’은 답이 아닙니다.",
      level: 3,
    },
    {
      question: "지금이라도 입장을 밝히십시오.",
      answer:
        "확인되지 않은 내용을 추측해 말하지 않겠습니다. 지금까지 확인된 사실은 [확인된 사실]이고, 선제 조치로 [조치]를 진행했습니다.",
      guide: "확인된 사실 1개 + 이미 한 조치 1개로 답합니다. 빈손으로 나가지 않습니다.",
      level: 2,
    },
    {
      question: "피해가 커지면 책임지겠습니까?",
      answer:
        "확인 결과에 따라 책임과 보상을 포함해 필요한 조치를 다 하겠습니다. 지금은 확인 일정과 선제 조치를 먼저 말씀드립니다.",
      guide: "책임 회피로 읽히지 않게 ‘결과에 따라’가 아니라 ‘필요한 조치를 다 한다’로 답합니다.",
      level: 3,
    },
  ],
  rebuttal: [
    {
      question: "근거를 제시하십시오.",
      answer:
        "근거 자료는 [확인 필요: 자료]이며, 공개 가능한 범위에서 [채널]에 게시하겠습니다. 확인되지 않은 주장에는 사실관계로 답하겠습니다.",
      guide: "근거를 먼저 확보한 뒤 말합니다. 자료 없이 강경하게 나가면 태도 논란이 됩니다.",
      level: 3,
    },
    {
      question: "왜 이제야 해명합니까?",
      answer:
        "보도 시점 이전에는 해당 내용을 인지하지 못했습니다. 인지 시각은 [확인 필요: 시각]이며, 확인 후 즉시 입장을 냈습니다.",
      guide: "인지 시각과 입장 발표 시각을 분리해 제시합니다.",
      level: 2,
    },
    {
      question: "법적 대응까지 하겠다는 겁니까?",
      answer:
        "허위·왜곡으로 확인되는 내용에 대해서는 절차에 따라 대응하겠습니다. 다만 정당한 비판과 지적은 겸허히 받아들이겠습니다.",
      guide: "위협이 아니라 원칙으로 읽히게 말합니다. ‘모두 고소’는 역효과입니다.",
      level: 2,
    },
  ],
};

const OUTLOOK: Record<Stance, Outlook> = {
  apology: {
    reactions: [
      { channel: "consumer-cafe", text: "사과는 봤는데 환불은 언제부터 되나요? 접수 창구부터 알려주세요.", tone: "질문" },
      { channel: "sns-x", text: "첫 문장이 사과면 일단 읽는다. 보상 기준 나오는지 보자.", tone: "우려" },
      { channel: "youtube", text: "정리 영상 각 — ‘사과는 했는데 숫자가 없다’.", tone: "냉소" },
      { channel: "econ-press", text: "보상 규모와 충당금 계상 여부, 재발 방지 일정을 확인해야 합니다.", tone: "질문" },
    ],
    triggers: [
      "보상 기준 공지가 늦어지면 ‘말뿐인 사과’ 프레임이 고정됩니다.",
      "피해 인증샷이 확산되면 사과 문장보다 사례가 먼저 인용됩니다.",
      "임직원·매장이 다른 말을 하면 공지 전체의 신뢰가 무너집니다.",
    ],
    escalation: [
      "보상 기준을 조기에 확정·공지 — ‘숫자’가 나오면 사과 프레임이 유지됩니다.",
      "피해 사례 접수 창구를 개설하고 처리 현황을 시간 단위로 공개합니다.",
      "현장·매장 대응 스크립트를 재배포하고 본사 문안과 일치시킵니다.",
    ],
  },
  investigating: {
    reactions: [
      { channel: "consumer-cafe", text: "‘확인 중’이라는 말이 벌써 세 번째네요. 일정이라도 지켜주세요.", tone: "냉소" },
      { channel: "sns-x", text: "선제 안내는 했으니 일단 지켜보자. 결과 나올 때까지.", tone: "우려" },
      { channel: "youtube", text: "해설 영상 — ‘확인 중’ 프레임이 얼마나 버티는지 보는 각.", tone: "질문" },
      { channel: "econ-press", text: "확인 일정을 못 지키면 그때부터가 진짜 기사입니다.", tone: "질문" },
    ],
    triggers: [
      "약속한 확인 시각을 넘기면 ‘확인 중’이 거짓말이 됩니다.",
      "선제 조치 없이 공지만 반복하면 ‘무대응’ 프레임이 붙습니다.",
      "피해 사례가 등장하면 확인보다 즉시 대응 요구가 먼저 옵니다.",
    ],
    escalation: [
      "확인 결과가 나오는 즉시 같은 채널에 먼저 공개 — 입장 전환(사과/반박)을 미루지 않습니다.",
      "확인이 길어지면 중간 브리핑을 정해진 시각에 올려 ‘진행 중’을 증명합니다.",
      "피해 사례 접수 창구를 열어 개별 안내로 전환합니다.",
    ],
  },
  rebuttal: {
    reactions: [
      { channel: "consumer-cafe", text: "근거 자료부터 올려주세요. 말로만 반박하면 못 믿습니다.", tone: "질문" },
      { channel: "sns-x", text: "회사 입장 캡처 — 태도 논란으로 번질 각.", tone: "냉소" },
      { channel: "youtube", text: "찬반 대결 구도 영상 — 어느 쪽 말이 맞는지 비교.", tone: "질문" },
      { channel: "econ-press", text: "근거 자료 공개 시점과 법적 대응 방향을 확인해야 합니다.", tone: "질문" },
    ],
    triggers: [
      "근거 자료 없이 반박만 반복하면 ‘태도 논란’으로 프레임이 이동합니다.",
      "상대방의 추가 폭로가 나오면 앞선 반박 전체가 무너집니다.",
      "감정적 표현이 캡처되면 사안이 ‘갑질’로 재구성됩니다.",
    ],
    escalation: [
      "근거 자료를 공개 가능한 형태로 정리해 한 번에 공개합니다.",
      "추가 주장에는 사실관계 단위로만 반박 — 감정 표현을 넣지 않습니다.",
      "법적 절차는 ‘방침’만 밝히고, 진행 상황은 결과가 나온 뒤 공개합니다.",
    ],
  },
};

function buildRoadmap(profileIndex: number, extras: EntityProfile[], industryId: IndustryId, profileIndustry: IndustryId): RoadmapPhase[] {
  const profile = ENTITY_PROFILES[profileIndex];
  const industry = getIndustry(industryId);
  return profile.roadmap.map((phase, i) => {
    const items = [...phase.items];
    if (industryId !== profileIndustry) {
      const extra = industry.playbook.timeline[i]?.items?.[0];
      if (extra && !items.some((t) => t.includes(extra.slice(0, 12)))) items.push(extra);
    }
    for (const p of extras) {
      const line = p.roadmap[i]?.items?.[0];
      if (line && !items.includes(line)) items.push(`[${p.short}] ${line}`);
    }
    return { ...phase, items: items.slice(0, 5) };
  });
}

function buildActions(profileIndex: number, extras: EntityProfile[], industryId: IndustryId, profileIndustry: IndustryId): ActionGroup[] {
  const profile = ENTITY_PROFILES[profileIndex];
  const industry = getIndustry(industryId);
  return profile.actions.map((group, i) => {
    const items = [...group.items];
    if (industryId !== profileIndustry) {
      const extra = industry.playbook.timeline[i]?.items ?? [];
      extra.slice(0, 3).forEach((text) => {
        if (!items.some((it) => it.text.slice(0, 14) === text.slice(0, 14))) items.push({ text, owner: industry.short });
      });
    }
    for (const p of extras) {
      for (const item of (p.actions[i]?.items ?? []).slice(0, 2)) {
        if (!items.some((it) => it.text.slice(0, 12) === item.text.slice(0, 12))) items.push({ text: item.text, owner: item.owner });
      }
    }
    return { ...group, items: items.slice(0, 8) };
  });
}

function buildPublicStatement(input: {
  brand: string;
  stance: Stance;
  eventLabel: string;
  situation: string;
  grave: boolean;
  profileIdx: number;
  extras: EntityProfile[];
  industryId: IndustryId;
  industry: ReturnType<typeof getIndustry>;
}): Statement {
  const { brand, stance, eventLabel, situation, grave, profileIdx, extras, industry } = input;
  const profile = ENTITY_PROFILES[profileIdx];
  const support = [...profile.publicAdd, ...extras.flatMap((p) => p.publicAdd.slice(0, 1))].join("\n");
  const firstActions = profile.actions[1]?.items.slice(0, 3).map((i) => i.text) ?? [];
  const contact =
    profile.id === "labor"
      ? "문의: [노사·인사 담당 창구]"
      : profile.id === "entertainment"
        ? "문의: [공식 팬 채널 · 고객센터]"
        : "문의: [고객센터 번호·담당 채널]";
  const audience =
    profile.id === "labor" ? "근로자·이해관계자" : profile.id === "entertainment" ? "팬덤·커뮤니티" : "고객·커뮤니티";
  const signature = profile.id === "labor" ? `${brand} 임직원 일동` : `${brand} 드림`;
  const publicLabel = `${audience} 공지`;
  const publicChannel =
    profile.id === "labor" ? "노사 협의 채널 · 사내 공지" : profile.id === "entertainment" ? "공식 팬 채널 · SNS" : "자사 채널 · 앱 공지 · 커뮤니티";

  if (stance === "apology") {
    const body = [
      grave
        ? `이번 사고로 소중한 생명을 잃으신 분과 유가족께 깊은 애도를 표하며, 고개 숙여 사과드립니다.`
        : `이번 ${eventLabel} 사안으로 불편과 불안을 드린 점, 고개 숙여 사과드립니다.`,
      "",
      "[확인된 사실]",
      situation,
      "",
      "[지금 해 주실 일]",
      profile.id === "labor"
        ? "- 유가족 지원과 산재·보상 절차는 [담당 창구]에서 전담해 안내드립니다."
        : industry.id === "food"
          ? "- 해당 제품은 섭취를 멈추시고, 구매처나 당사 고객센터로 반품·환불을 접수해 주세요."
          : "- 피해를 입으신 경우 [접수 채널]로 연락해 주시면 확인 후 즉시 조치하겠습니다.",
      `- 접수는 ${place("날짜")}부터 받고, 처리 현황도 공개하겠습니다.`,
      "",
      "[조치와 보상]",
      ...firstActions.map((t) => `- ${t}`),
      `- 보상 기준: ${place("보상 범위·시점")} — 확정되는 대로 이 공지에 바로 반영하겠습니다.`,
      "",
      support,
      "",
      profile.legal,
      "",
      "원인과 책임은 당사에 있습니다. 확인되는 내용은 이 채널에 계속 올리겠습니다.",
      "",
      contact,
      "",
      signature,
    ].join("\n");
    return {
      id: "public",
      label: publicLabel,
      channel: publicChannel,
      title: grave ? `${brand}, 중대재해 관련 사과 말씀` : `${brand}, ${eventLabel} 관련 사과 말씀`,
      body,
    };
  }

  if (stance === "investigating") {
    const body = [
      `이번 ${eventLabel} 사안과 관련한 내용이 확산되고 있어, 확인된 사실과 확인 중인 사항을 구분해 먼저 알려드립니다.`,
      "",
      "[현재 상황]",
      situation,
      "",
      "[확인 중인 사항]",
      `- 원인: ${place("원인")} — ${place("공개 시각")}까지 확인 결과를 공지하겠습니다.`,
      `- 영향 범위: ${place("범위")}`,
      "",
      "[지금 하고 있는 조치]",
      ...firstActions.map((t) => `- ${t}`),
      "",
      support,
      "",
      profile.legal,
      "",
      "확인되지 않은 사항을 추측해 말하지 않겠습니다. 대신 확인 일정을 지키고, 결과가 나오는 대로 이 채널에 먼저 올리겠습니다.",
      "",
      contact,
      "",
      signature,
    ].join("\n");
    return {
      id: "public",
      label: publicLabel,
      channel: publicChannel,
      title: `${brand}, ${eventLabel} 관련 안내 말씀`,
      body,
    };
  }

  const body = [
    `최근 일부 채널에서 확산된 ‘${eventLabel}’ 관련 주장은 사실과 다릅니다. 확인된 사실관계와 근거를 정확히 알려드립니다.`,
    "",
    "[보도·주장 내용]",
    situation,
    "",
    "[당사 확인 결과]",
    `- ${place("확인 결과")}`,
    "",
    "[근거]",
    `- ${place("반박 근거 1 — 자료·출처")}`,
    `- ${place("반박 근거 2 — 자료·출처")}`,
    "",
    "[조치]",
    ...firstActions.map((t) => `- ${t}`),
    "",
    support,
    "",
    profile.legal,
    "",
    "정당한 비판과 지적은 겸허히 받아들이고, 확인되지 않은 내용의 반복 유포에는 사실관계로 답하겠습니다.",
    "",
    contact,
    "",
    signature,
  ].join("\n");
  return {
    id: "public",
    label: publicLabel,
    channel: publicChannel,
    title: `${brand}, ${eventLabel} 관련 사실관계 안내`,
    body,
  };
}

function buildPressStatement(input: {
  brand: string;
  stance: Stance;
  eventLabel: string;
  situation: string;
  grave: boolean;
  profileIdx: number;
  extras: EntityProfile[];
  industry: ReturnType<typeof getIndustry>;
}): Statement {
  const { brand, stance, eventLabel, situation, grave, profileIdx, extras, industry } = input;
  const profile = ENTITY_PROFILES[profileIdx];
  const regulators = industry.playbook.regulators.slice(0, 2);
  const legal = industry.playbook.laws.slice(0, 2);
  const actionItems = profile.actions[1]?.items.slice(0, 4).map((i) => i.text) ?? [];

  const section = (title: string, rows: string[]) => [title, ...rows, ""].join("\n");

  if (stance === "apology") {
    const body = [
      `${brand}는 이번 ${eventLabel} 사안과 관련해 다음과 같이 입장을 밝힙니다.`,
      "",
      section("1. 사과", [
        grave
          ? "이번 사고로 소중한 생명을 잃으신 분과 유가족께 깊은 애도를 표하며, 원인과 책임을 통감하고 있습니다."
          : `${industry.apologyTarget}께 고개 숙여 사과드립니다. 원인과 책임은 당사에 있습니다.`,
      ]),
      section("2. 확인된 사실", [
        `- 내용: ${situation}`,
        `- 최초 인지 시각: ${place("시각")}`,
        `- 영향 범위: ${place("대상·규모")}`,
      ]),
      section("3. 현재 조치", actionItems.map((t) => `- ${t}`)),
      section("4. 규제·법적 대응", [
        ...regulators.map((r) => `- ${r.name}: ${r.role}`),
        ...(legal.length ? [`- 검토 법령: ${legal.map((l) => `${l.name}(${l.note})`).join(", ")}`] : []),
        `- ${profile.legal}`,
      ]),
      section("5. 보상·재발 방지", [
        `- 보상 기준·시점: ${place("보상 기준")}`,
        `- 재발 방지 대책: ${place("대책·완료 일정")}`,
      ]),
      "문의: " + `${brand} 커뮤니케이션팀 ` + place("연락처"),
      "",
      section(`부록. ${profile.pressSection.title}`, profile.pressSection.items.map((t) => `- ${t}`)),
      ...extras.map((p) => section(`부록. ${p.pressSection.title}`, p.pressSection.items.slice(0, 2).map((t) => `- ${t}`))),
    ].join("\n");
    return { id: "press", label: "언론 배포·기자 회신", channel: "보도자료 · 기자 메일", title: `[보도자료] ${brand}, ${eventLabel} 관련 사과 및 대응 계획`, body };
  }

  if (stance === "investigating") {
    const body = [
      `${brand}는 이번 ${eventLabel} 사안과 관련해 현재까지 확인된 사실과 확인 계획을 다음과 같이 밝힙니다.`,
      "",
      section("1. 현재 상황", [
        `- 내용: ${situation}`,
        `- 인지 시각: ${place("시각")}`,
        `- 확인 중인 사항: ${place("원인·범위")}`,
      ]),
      section("2. 확인 계획", [
        `- 확인 결과 공개: ${place("일시")}`,
        "- 확인된 사실과 추정을 구분해 발표하겠습니다.",
      ]),
      section("3. 선제 조치", actionItems.map((t) => `- ${t}`)),
      section("4. 규제·법적 대응", [
        ...regulators.map((r) => `- ${r.name}: ${r.role}`),
        `- ${profile.legal}`,
      ]),
      section("5. 보도 요청", [
        "- 확인되지 않은 내용의 확대 보도는 지양해 주시고, 공식 확인 결과는 배포 즉시 전달드리겠습니다.",
      ]),
      "문의: " + `${brand} 커뮤니케이션팀 ` + place("연락처"),
      "",
      section(`부록. ${profile.pressSection.title}`, profile.pressSection.items.map((t) => `- ${t}`)),
      ...extras.map((p) => section(`부록. ${p.pressSection.title}`, p.pressSection.items.slice(0, 2).map((t) => `- ${t}`))),
    ].join("\n");
    return { id: "press", label: "언론 배포·기자 회신", channel: "보도자료 · 기자 메일", title: `[입장문] ${brand}, ${eventLabel} 관련 확인 진행 상황`, body };
  }

  const body = [
    `${brand}는 이번 ${eventLabel} 사안 관련 보도·주장에 대해 다음과 같이 사실관계를 밝힙니다.`,
    "",
    section("1. 주장 요약", [
      `- ${situation}`,
    ]),
    section("2. 확인 결과", [
      `- 당사 확인 결과: ${place("확인 결과")}`,
      `- 근거 자료: ${place("자료·출처")}`,
      `- 반박 근거: ${place("반박 1")} / ${place("반박 2")}`,
    ]),
    section("3. 조치", actionItems.map((t) => `- ${t}`)),
    section("4. 법적 대응 방침", [
      `- ${profile.legal}`,
      "- 허위·왜곡으로 확인되는 내용에 한해 절차에 따라 대응합니다.",
    ]),
    section("5. 보도 요청", [
      "- 보도 전 사실관계 확인을 요청드리며, 근거 자료는 공개 가능한 범위에서 제공하겠습니다.",
    ]),
    "문의: " + `${brand} 커뮤니케이션팀 ` + place("연락처"),
    "",
    section(`부록. ${profile.pressSection.title}`, profile.pressSection.items.map((t) => `- ${t}`)),
    ...extras.map((p) => section(`부록. ${p.pressSection.title}`, p.pressSection.items.slice(0, 2).map((t) => `- ${t}`))),
  ].join("\n");
  return { id: "press", label: "언론 배포·기자 회신", channel: "보도자료 · 기자 메일", title: `[입장문] ${brand}, ${eventLabel} 관련 사실관계 및 대응 방침`, body };
}

function buildStakeholders(profileIdx: number, extras: EntityProfile[], industryId: IndustryId): StakeholderPlan[] {
  const profile = ENTITY_PROFILES[profileIdx];
  const industry = getIndustry(industryId);
  const rows: StakeholderPlan[] = profile.stakeholders.map((s) => ({ ...s }));
  for (const p of extras) {
    for (const s of p.stakeholders.slice(0, 3)) {
      if (rows.some((r) => r.who.replace(/\s/g, "").slice(0, 6) === s.who.replace(/\s/g, "").slice(0, 6))) continue;
      rows.push({ ...s, who: s.who });
    }
  }
  for (const regulator of industry.playbook.regulators.slice(0, 2)) {
    if (rows.some((r) => r.who.includes(regulator.name.slice(0, 3)) || regulator.name.includes(r.who.slice(0, 3)))) continue;
    rows.push({
      who: regulator.name,
      when: "24시간",
      action: `필요 시 신고·협의, ${regulator.role} 관련 진행 상황 보고`,
      line: "현재 확인된 범위와 조치 계획을 보고드리고, 지도 사항을 반영하겠습니다.",
    });
  }
  return rows;
}

function buildQa(profileIdx: number, extras: EntityProfile[], stance: Stance): QaScript[] {
  const profile = ENTITY_PROFILES[profileIdx];
  const stanceItems = STANCE_QA[stance].map((q) => ({ ...q, avoid: STANCE_BANNED[stance].slice(0, 2).map((b) => b.phrase), source: "local" as const }));
  const profileItems: QaScript[] = profile.qa.map((q, i) => ({
    question: q.question,
    answer: q.script,
    guide: q.approach,
    avoid: [profile.banned[i % profile.banned.length]?.phrase ?? "감정적 표현"].filter(Boolean),
    level: (i < 2 ? 3 : 2) as Severity,
    source: "local",
  }));
  const extraItems: QaScript[] = extras.flatMap((p) =>
    p.qa.slice(0, 1).map((q) => ({
      question: q.question,
      answer: q.script,
      guide: q.approach,
      avoid: [p.banned[0]?.phrase ?? "감정적 표현"].filter(Boolean),
      level: 3 as Severity,
      source: "local" as const,
    })),
  );
  const all = [...profileItems, ...extraItems, ...stanceItems];
  const seen = new Set<string>();
  return all
    .filter((q) => {
      const key = q.question.replace(/[\s?？.·,:]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.level - a.level)
    .slice(0, 6);
}

export function buildLocalPackage(input: PackageInput): ResponsePackage {
  const profileIdx = Math.max(
    0,
    ENTITY_PROFILES.findIndex((p) => p.id === (input.entities[0] ?? "general")),
  );
  const primary = ENTITY_PROFILES[profileIdx];
  const extras = getProfiles(input.entities).extras;
  const situationText = stripUrl(input.situation) || input.situation.trim();
  const industryId = inferIndustry(situationText || input.situation, primary.industry);
  const industry = getIndustry(industryId);
  const event = detectEvent(situationText || input.situation);
  const stance = getStance(input.stance);
  const brand = input.brand.trim() || "당사";
  const summary = summarize(situationText || input.situation, 240);
  const grave = /사망|숨(?:지|졌)|중대재해|끼임|추락|폭발|화재/.test(situationText || input.situation);

  const headlineByStance: Record<Stance, string> = {
    apology: `${event.label} — 피해 범위와 보상 기준을 첫 6시간 안에 확정해야 합니다.`,
    investigating: `${event.label} — 지금은 ‘확인 중’이 아니라 ‘확인 일정’으로 신뢰를 만드는 구간입니다.`,
    rebuttal: `${event.label} — 근거 2개를 먼저 확보하지 않으면 반박이 태도 논란으로 바뀝니다.`,
  };

  const statements: Statement[] = [
    buildPublicStatement({ brand, stance: input.stance, eventLabel: event.label, situation: summary, grave, profileIdx, extras, industryId, industry }),
    buildPressStatement({ brand, stance: input.stance, eventLabel: event.label, situation: summary, grave, profileIdx, extras, industry }),
  ];

  const banned: BannedPhrase[] = [
    ...primary.banned.slice(0, 3),
    ...extras.flatMap((p) => p.banned.slice(0, 1)),
    ...STANCE_BANNED[input.stance],
  ].slice(0, 6);
  const qa = buildQa(profileIdx, extras, input.stance);
  const watchouts = [...primary.watchouts, ...extras.flatMap((p) => p.watchouts.slice(0, 1)), stance.rule];

  return {
    id: `pkg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    mode: "local",
    situation: input.situation.trim(),
    brand,
    stance: input.stance,
    entities: input.entities.length ? input.entities.slice(0, 3) : ["general"],
    industry: industryId,
    industryLabel: industry.label,
    eventLabel: event.label,
    risk: event.risk,
    headline: headlineByStance[input.stance],
    strategy: stance.rule,
    roadmap: buildRoadmap(profileIdx, extras, industryId, primary.industry),
    actions: buildActions(profileIdx, extras, industryId, primary.industry),
    statements,
    qa,
    banned,
    stakeholders: buildStakeholders(profileIdx, extras, industryId),
    outlook: OUTLOOK[input.stance],
    watchouts: watchouts.slice(0, 6),
  };
}

/* ------------------------------------------------------------------ */
/* 로컬 입장문 검수                                                     */
/* ------------------------------------------------------------------ */

export function buildLocalReview(draft: string, brand: string): ReviewResult {
  const findings: ReviewFinding[] = [];
  for (const rule of RISK_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
    for (const match of draft.matchAll(re)) {
      const matched = match[0];
      if (!matched) continue;
      findings.push({
        quote: matched,
        label: rule.label,
        why: rule.reason,
        fix: rule.replace(matched),
        level: rule.severity,
      });
      break;
    }
  }
  findings.sort((a, b) => b.level - a.level);
  const unique = findings.filter((f, i) => findings.findIndex((x) => x.quote === f.quote) === i).slice(0, 6);
  const high = unique.filter((f) => f.level === 3).length;
  const mid = unique.filter((f) => f.level === 2).length;
  const score = Math.min(96, 38 + high * 14 + mid * 7);

  let rewrite = draft;
  for (const rule of RISK_RULES) {
    rewrite = rewrite.replace(rule.pattern, (m: string) => rule.replace(m));
  }
  rewrite = rewrite.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!/문의|연락처|고객센터/.test(rewrite)) rewrite += "\n\n문의: [고객센터·담당 채널]";
  if (!/사과|죄송/.test(rewrite)) rewrite = `고객 여러분께 불편과 불안을 드린 점 사과드립니다.\n\n${rewrite}`;

  const checklist = [
    { label: "사과 주체와 대상이 첫 문단에 있음", ok: /사과|죄송|고개\s?숙/.test(draft), hint: "‘누가 누구에게’ 사과하는지 첫 문단에서 보여야 합니다." },
    { label: "피해 규모·범위 수치가 있음", ok: /\d[\d,.]*\s?(명|건|원|%|시간|분|개|대|회)/.test(draft), hint: "수치가 없으면 외부 추측치가 먼저 인용됩니다." },
    { label: "확인·공개 일정이 날짜로 있음", ok: /\d{1,2}\s?월|\d{1,2}\s?일|까지|이내/.test(draft), hint: "‘곧·신속히’ 대신 날짜와 시각을 씁니다." },
    { label: "문의·접수 창구가 있음", ok: /문의|연락처|고객센터|접수/.test(draft), hint: "독자가 다음에 할 행동을 알려야 합니다." },
    { label: "금기 표현이 없음", ok: unique.length === 0, hint: "표시된 표현을 먼저 지우고 필요한 정보로 바꿉니다." },
  ];

  return {
    id: `rev-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    mode: "local",
    draft,
    brand: brand.trim() || "당사",
    score,
    summary: unique.length
      ? `위험 표현 ${unique.length}개가 잡혔습니다. 특히 “${unique[0].quote}”가 가장 먼저 고쳐야 할 부분입니다.`
      : "치명적인 위험 표현은 없습니다. 수치·일정·창구 세 가지를 보강하면 바로 배포할 수 있습니다.",
    findings: unique,
    rewrite,
    checklist,
  };
}

/* ------------------------------------------------------------------ */
/* 복사용 텍스트                                                        */
/* ------------------------------------------------------------------ */

export const countPlaceholders = (text: string): number => (text.match(/\[[^\]\n]{1,40}\]/g) ?? []).length;

export const statementToText = (s: Statement) => `${s.title}\n\n${s.body}`;

export function actionsToText(groups: ActionGroup[]): string {
  return groups
    .map((g) => `[${g.window}] ${g.title}\n${g.items.map((i) => `□ ${i.text} (${i.owner})`).join("\n")}`)
    .join("\n\n");
}

export function packageToText(pkg: ResponsePackage): string {
  const stance = getStance(pkg.stance);
  const lines: string[] = [
    `[PRISM 대응 패키지] ${pkg.brand}`,
    `상황: ${pkg.situation}`,
    `유형: ${pkg.entities.map((id) => ENTITY_PROFILES.find((p) => p.id === id)?.label ?? id).join(" · ")} / 입장: ${stance.label}`,
    `진단: ${pkg.headline}`,
    "",
    "■ 전체 대응 시스템",
    ...pkg.roadmap.map((p, i) => `${"①②③"[i] ?? "•"} ${p.window} · ${p.title} — ${p.goal}\n   통과 기준: ${p.gate}`),
    "",
    "■ 01 지금 당장 할 일",
    actionsToText(pkg.actions),
    "",
    "■ 02 공식 입장문",
    ...pkg.statements.map((s) => `【${s.label}】\n${statementToText(s)}`),
    "",
    "■ 03 압박 질문 & 답변",
    ...pkg.qa.map((q, i) => `${i + 1}. ${q.question}\n답변: ${q.answer}\n피할 말: ${q.avoid.join(", ")}`),
    "",
    "금기 표현",
    ...pkg.banned.map((b) => `- ${b.phrase} — ${b.why}`),
    "",
    "■ 04 유관기관·이해관계자 대응",
    ...pkg.stakeholders.map((s) => `- ${s.who} (${s.when}) ${s.action}\n  첫 문장: “${s.line}”`),
    "",
    "■ 05 예상 여론 & 악화 시 다음 대응",
    ...pkg.outlook.reactions.map((r) => `- [${r.channel}] ${r.text}`),
    "악화 트리거:",
    ...pkg.outlook.triggers.map((t) => `- ${t}`),
    "다음 대응:",
    ...pkg.outlook.escalation.map((t) => `- ${t}`),
    "",
    "※ 대괄호 [확인 필요: …] 값만 채우면 그대로 배포할 수 있습니다.",
  ];
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* 저장                                                                */
/* ------------------------------------------------------------------ */

const STORE_KEY = "prism.packages.v3";

export function loadPackages(): ResponsePackage[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ResponsePackage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => typeof p?.id === "string" && Array.isArray(p?.statements)).slice(0, 8);
  } catch {
    return [];
  }
}

export function savePackage(pkg: ResponsePackage): ResponsePackage[] {
  const next = [pkg, ...loadPackages().filter((p) => p.id !== pkg.id && p.situation !== pkg.situation)].slice(0, 8);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* 저장 공간이 없으면 무시 */
  }
  return next;
}

export function removePackage(id: string): ResponsePackage[] {
  const next = loadPackages().filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/* 채널 라벨 헬퍼 (AI 응답의 채널 id를 사람이 읽는 이름으로) */
export function channelLabel(id: string): string {
  try {
    return getChannel(id as never).label;
  } catch {
    return id;
  }
}

export const ALL_ENTITY_IDS = ENTITY_PROFILES.map((p) => p.id);
export function entityLabels(ids: EntityId[]): string[] {
  return ids.map((id) => ENTITY_PROFILES.find((p) => p.id === id)?.label ?? id);
}

export { getProfiles };
