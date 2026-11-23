import type { CaseType } from "../types";
import { getStance, type Stance } from "./stances";

/**
 * 7축 위험 스코어카드.
 *
 * 같은 입력·같은 입장이면 언제 계산해도 같은 점수가 나오는 규칙 기반 모델입니다.
 * AI 응답과 무관하게 계산되므로, 두 입장(예: 선제 보상 vs 사실 적시)을 정확히 같은 기준으로 비교할 수 있습니다.
 * 모든 축은 ‘0 = 안전, 100 = 심각’으로 통일했습니다. 숫자가 클수록 나쁩니다.
 */

export type AxisId = "trust" | "legal" | "press" | "spread" | "cost" | "internal" | "delay";

export interface AxisSpec {
  id: AxisId;
  label: string;
  short: string;
  hint: string;
  weight: number;
}

export const AXES: AxisSpec[] = [
  {
    id: "trust",
    label: "브랜드 신뢰 타격",
    short: "신뢰",
    hint: "고객·거래처가 이 사안을 ‘이 회사의 문제’로 기억하는 정도",
    weight: 0.18,
  },
  {
    id: "legal",
    label: "법적·규제 노출",
    short: "법적",
    hint: "과징금·소송·당국 조사로 이어질 가능성",
    weight: 0.18,
  },
  {
    id: "press",
    label: "기자 추가 취재 가능성",
    short: "언론",
    hint: "첫 보도 이후 후속 기사·추가 취재가 붙을 가능성",
    weight: 0.14,
  },
  {
    id: "spread",
    label: "커뮤니티 확산도",
    short: "확산",
    hint: "커뮤니티·SNS에서 2차 확산(캡처·인증샷·밈)이 일어날 가능성",
    weight: 0.16,
  },
  {
    id: "cost",
    label: "보상·비용 부담",
    short: "비용",
    hint: "환불·보상·재작업·재고 처리에 들어갈 비용의 크기",
    weight: 0.1,
  },
  {
    id: "internal",
    label: "내부 통제 리스크",
    short: "내부",
    hint: "임직원 발언·유출·현장 대응 불일치로 문안이 흔들릴 위험",
    weight: 0.1,
  },
  {
    id: "delay",
    label: "대응 지연 위험",
    short: "지연",
    hint: "확인·승인·공지가 늦어져 프레임이 굳을 위험",
    weight: 0.14,
  },
];

export interface ScoreAxis extends AxisSpec {
  value: number;
  reasons: string[];
}

export type ScoreBand = {
  label: "낮음" | "관찰" | "주의" | "심각";
  tone: "ok" | "info" | "warn" | "risk";
  color: string;
  desc: string;
};

export interface Scorecard {
  overall: number;
  band: ScoreBand;
  axes: ScoreAxis[];
  top: ScoreAxis[];
  note: string;
}

export interface ScoreSource {
  stance: Stance;
  stanceCustom?: string;
  risk: string;
  caseType?: CaseType;
  industry: string;
  stage?: string;
  scale?: string;
  situations?: string[];
  situation: string;
  brand: string;
  mode: "ai" | "local";
  statements: { body: string }[];
  qa: { question: string }[];
  actions: { items: { text: string }[] }[];
  entities: string[];
}

const BASE: Record<CaseType, Partial<Record<AxisId, number>>> = {
  "product-safety": { trust: 66, legal: 60, press: 58, spread: 64, cost: 58, internal: 40, delay: 46 },
  "data-breach": { trust: 72, legal: 78, press: 64, spread: 62, cost: 52, internal: 55, delay: 44 },
  outage: { trust: 52, legal: 46, press: 50, spread: 56, cost: 46, internal: 38, delay: 52 },
  pricing: { trust: 58, legal: 52, press: 58, spread: 66, cost: 42, internal: 34, delay: 42 },
  "false-claim": { trust: 64, legal: 60, press: 56, spread: 58, cost: 36, internal: 38, delay: 44 },
  "industrial-accident": { trust: 78, legal: 76, press: 64, spread: 58, cost: 70, internal: 50, delay: 38 },
  disaster: { trust: 80, legal: 62, press: 66, spread: 60, cost: 64, internal: 48, delay: 36 },
  "owner-risk": { trust: 70, legal: 64, press: 68, spread: 62, cost: 40, internal: 66, delay: 42 },
  labor: { trust: 58, legal: 58, press: 54, spread: 52, cost: 40, internal: 62, delay: 46 },
  financial: { trust: 70, legal: 72, press: 60, spread: 58, cost: 56, internal: 52, delay: 44 },
  governance: { trust: 66, legal: 70, press: 62, spread: 52, cost: 38, internal: 58, delay: 48 },
  misconduct: { trust: 62, legal: 58, press: 58, spread: 58, cost: 34, internal: 54, delay: 44 },
  statement: { trust: 58, legal: 46, press: 62, spread: 66, cost: 30, internal: 40, delay: 40 },
  environment: { trust: 64, legal: 66, press: 58, spread: 54, cost: 52, internal: 46, delay: 44 },
  regulatory: { trust: 60, legal: 74, press: 54, spread: 48, cost: 44, internal: 46, delay: 42 },
  celebrity: { trust: 56, legal: 52, press: 60, spread: 70, cost: 30, internal: 44, delay: 40 },
};

const DEFAULT_BASE: Record<AxisId, number> = {
  trust: 55,
  legal: 50,
  press: 54,
  spread: 55,
  cost: 44,
  internal: 44,
  delay: 48,
};

const STANCE_MOD: Record<Stance, Partial<Record<AxisId, number>>> = {
  apology: { trust: -7, legal: -4, press: 2, spread: -8, cost: 4, internal: 2, delay: -4 },
  facts: { trust: 2, legal: 4, press: 6, spread: 0, cost: -4, internal: 0, delay: -2 },
  investigating: { trust: 6, legal: -2, press: 8, spread: 2, cost: -2, internal: 2, delay: 10 },
  compensation: { trust: -9, legal: 2, press: 2, spread: -10, cost: 18, internal: 4, delay: 0 },
  silence: { trust: 10, legal: 2, press: 8, spread: 8, cost: -8, internal: 6, delay: 14 },
  rebuttal: { trust: 4, legal: 12, press: 10, spread: 6, cost: -6, internal: 2, delay: -2 },
  custom: {},
};

const STANCE_REASON: Record<Stance, { label: string; axis: AxisId; delta: number }[]> = {
  apology: [
    { label: "사과가 확산을 낮춥니다", axis: "spread", delta: -8 },
    { label: "사과만 있고 숫자가 없으면 지연 위험이 커집니다", axis: "delay", delta: -4 },
  ],
  facts: [
    { label: "정정 요청은 법적 분쟁 소지가 있습니다", axis: "legal", delta: 4 },
    { label: "숫자·출처 공개는 추가 취재를 부릅니다", axis: "press", delta: 6 },
  ],
  investigating: [
    { label: "‘확인 중’은 확인 일정을 못 지키면 신뢰를 잃습니다", axis: "delay", delta: 10 },
    { label: "확인 예고는 후속 취재 요청을 늘립니다", axis: "press", delta: 8 },
  ],
  compensation: [
    { label: "보상 재원·충당금 부담이 큽니다", axis: "cost", delta: 18 },
    { label: "선제 보상은 확산을 실제로 낮춥니다", axis: "spread", delta: -10 },
  ],
  silence: [
    { label: "공개 대응 보류는 확산·의혹 고정 위험이 있습니다", axis: "spread", delta: 8 },
    { label: "전환 시점을 놓치면 지연 위험이 커집니다", axis: "delay", delta: 14 },
  ],
  rebuttal: [
    { label: "강경 대응은 명예훼손·소송 리스크를 동반합니다", axis: "legal", delta: 12 },
    { label: "근거 공개는 추가 취재·반박을 부릅니다", axis: "press", delta: 10 },
  ],
  custom: [],
};

const SITUATION_MOD: Record<string, { axis: AxisId; delta: number; why: string }[]> = {
  "listed-large": [
    { axis: "legal", delta: 6, why: "상장사는 공시 의무가 붙습니다" },
    { axis: "press", delta: 4, why: "주가·공시는 증권 매체가 따라붙습니다" },
  ],
  ipo: [
    { axis: "trust", delta: 6, why: "공모 일정과 투자자 신뢰가 걸려 있습니다" },
    { axis: "press", delta: 4, why: "공모 직전 사안은 투자 매체가 먼저 봅니다" },
  ],
  funding: [
    { axis: "trust", delta: 10, why: "정산·급여 지급 능력이 핵심 질문이 됩니다" },
    { axis: "cost", delta: 6, why: "환불·정산 재원 부담이 큽니다" },
  ],
  mna: [
    { axis: "internal", delta: 8, why: "감원·구조조정 루머는 내부에서 먼저 샙니다" },
    { axis: "press", delta: 4, why: "인수·합병 보도는 확인 전에도 나갑니다" },
  ],
  b2c: [
    { axis: "spread", delta: 6, why: "B2C는 캡처·인증샷으로 확산이 빠릅니다" },
    { axis: "trust", delta: 3, why: "불특정 다수 고객이 직접 영향받습니다" },
  ],
  b2b: [
    { axis: "spread", delta: -5, why: "B2B는 공개 확산보다 개별 통지가 먼저입니다" },
    { axis: "legal", delta: 3, why: "SLA·계약 위반 보상 조항이 걸립니다" },
  ],
  global: [
    { axis: "legal", delta: 6, why: "국가별 고지·신고 의무가 다릅니다" },
    { axis: "internal", delta: 4, why: "본사·현지 법인 문안 불일치 위험이 큽니다" },
  ],
  rumor: [
    { axis: "spread", delta: -6, why: "아직 소수 계정 확산 단계입니다" },
    { axis: "press", delta: -5, why: "매체 보도 전 단계입니다" },
  ],
  spreading: [
    { axis: "spread", delta: 10, why: "이미 2차 확산이 진행 중입니다" },
    { axis: "press", delta: 6, why: "후속 보도가 붙는 단계입니다" },
  ],
  regulator: [
    { axis: "legal", delta: 10, why: "당국 조사·제재가 진행 중입니다" },
    { axis: "delay", delta: 3, why: "조사 대응 창구와 일정 관리가 필요합니다" },
  ],
  "labor-internal": [
    { axis: "internal", delta: 9, why: "내부 제보·노사 갈등은 통제가 어렵습니다" },
    { axis: "legal", delta: 4, why: "근로감독·산재 이슈로 번질 수 있습니다" },
  ],
  owner: [
    { axis: "internal", delta: 8, why: "경영진 리스크는 내부 통제 문제로 이어집니다" },
    { axis: "trust", delta: 5, why: "오너 리스크는 회사 신뢰로 직결됩니다" },
  ],
};

const TEXT_SIGNALS: { re: RegExp; mods: { axis: AxisId; delta: number; why: string }[] }[] = [
  {
    re: /사망|숨(?:지|졌)|중대재해|끼임|추락|폭발|화재|유가족|애도/,
    mods: [
      { axis: "trust", delta: 10, why: "인명 피해가 언급됐습니다" },
      { axis: "legal", delta: 11, why: "중대재해처벌법·산재 이슈가 붙습니다" },
    ],
  },
  {
    re: /개인정보|유출|해킹|정보주체|계정\s?탈취/,
    mods: [
      { axis: "legal", delta: 9, why: "개인정보보호법 신고·과징금 대상입니다" },
      { axis: "trust", delta: 4, why: "이용자 이탈·탈퇴 인증으로 이어집니다" },
    ],
  },
  {
    re: /가격|인상|요금|구독|단가/,
    mods: [
      { axis: "spread", delta: 6, why: "요금 환산·해지 인증이 확산을 만듭니다" },
      { axis: "cost", delta: 5, why: "기존 고객 유예·할인 재원이 필요합니다" },
    ],
  },
  {
    re: /환불|보상|리콜|회수/,
    mods: [
      { axis: "cost", delta: 7, why: "회수·보상 범위가 비용으로 잡힙니다" },
      { axis: "legal", delta: 3, why: "보상 기준 미공개는 분쟁으로 이어집니다" },
    ],
  },
  {
    re: /루머|카더라|확인되지 않은|소수 계정/,
    mods: [
      { axis: "spread", delta: -6, why: "아직 근거 없는 확산 단계입니다" },
      { axis: "press", delta: -4, why: "매체 확인 전 단계입니다" },
    ],
  },
  {
    re: /보도|기사|단독|논평|매체/,
    mods: [
      { axis: "press", delta: 7, why: "이미 보도가 나간 사안입니다" },
      { axis: "trust", delta: 3, why: "보도는 고객·거래처가 함께 봅니다" },
    ],
  },
  {
    re: /노조|파업|근로|산재|고발|제보/,
    mods: [
      { axis: "internal", delta: 7, why: "내부 제보·노사 갈등 요소가 있습니다" },
      { axis: "press", delta: 3, why: "노동·사회부 취재가 붙습니다" },
    ],
  },
  {
    re: /당국|공정위|금감원|금융위|식약처|방통위|개보위|조사|제재|과징금/,
    mods: [
      { axis: "legal", delta: 8, why: "규제기관 절차가 언급됐습니다" },
      { axis: "delay", delta: 2, why: "기관 대응 창구·일정 관리가 필요합니다" },
    ],
  },
];

const BANDS: { max: number; band: ScoreBand }[] = [
  { max: 32, band: { label: "낮음", tone: "ok", color: "#17694c", desc: "문안을 그대로 실행해도 프레임이 크게 흔들릴 지점은 적습니다." } },
  { max: 48, band: { label: "관찰", tone: "info", color: "#2f5f8a", desc: "한두 축이 남아 있습니다. 확인 항목을 채우면 위험을 더 낮출 수 있습니다." } },
  { max: 62, band: { label: "주의", tone: "warn", color: "#96620d", desc: "후속 보도·2차 확산을 전제로 대응 일정을 잡아야 합니다." } },
  { max: 101, band: { label: "심각", tone: "risk", color: "#b02a22", desc: "첫 6시간 안에 숫자·일정을 확정하지 않으면 프레임이 굳습니다." } },
];

const clamp = (n: number) => Math.max(4, Math.min(97, Math.round(n)));

const countPlaceholders = (text: string) => (text.match(/\[[^\]\n]{1,40}\]/g) ?? []).length;

export function bandFor(overall: number): ScoreBand {
  return (BANDS.find((b) => overall < b.max) ?? BANDS[BANDS.length - 1]).band;
}

export function buildScorecard(src: ScoreSource): Scorecard {
  const stance = getStance(src.stance, src.stanceCustom);
  const scores: Record<AxisId, number> = { ...DEFAULT_BASE };
  const reasons: Record<AxisId, string[]> = { trust: [], legal: [], press: [], spread: [], cost: [], internal: [], delay: [] };
  const stanceReasons: Record<AxisId, string[]> = { trust: [], legal: [], press: [], spread: [], cost: [], internal: [], delay: [] };

  if (src.caseType) {
    const base = BASE[src.caseType];
    if (base) for (const axis of AXES) if (typeof base[axis.id] === "number") scores[axis.id] = base[axis.id] as number;
  }

  /** detail은 이 축에만 해당하는 근거, stance는 입장 선택으로 생긴 보정 — 화면에는 detail을 먼저 보여 줍니다. */
  const push = (axis: AxisId, delta: number, why: string, kind: "detail" | "stance" = "detail") => {
    if (!delta) return;
    scores[axis] += delta;
    if (kind === "stance") {
      if (!stanceReasons[axis].includes(why)) stanceReasons[axis].push(why);
      return;
    }
    reasons[axis].push(why);
  };

  for (const [axis, delta] of Object.entries(STANCE_MOD[src.stance]) as [AxisId, number][]) {
    push(axis, delta, `${stance.short} 입장 ${delta > 0 ? "+" : ""}${delta}`, "stance");
  }
  for (const item of STANCE_REASON[src.stance]) push(item.axis, item.delta, item.label);

  for (const tag of src.situations ?? []) {
    for (const mod of SITUATION_MOD[tag] ?? []) push(mod.axis, mod.delta, mod.why);
  }

  for (const signal of TEXT_SIGNALS) {
    if (!signal.re.test(src.situation)) continue;
    for (const mod of signal.mods) push(mod.axis, mod.delta, mod.why);
  }

  if (!/\d/.test(src.situation)) push("press", 3, "입력에 숫자가 없어 확인 질문이 늘어납니다");

  const placeholders = src.statements.reduce((n, s) => n + countPlaceholders(s.body), 0);
  if (placeholders >= 6) push("press", 5, "입장문에 확인 필요 항목이 6곳 이상입니다");
  if (placeholders >= 11) push("trust", 3, "확인 필요 항목이 11곳 이상이면 문안이 미완성으로 읽힙니다");
  if (src.qa.length > 0 && src.qa.length < 5) push("delay", 4, "예상 질문이 5개 미만입니다");
  const firstActionCount = src.actions[0]?.items.length ?? 0;
  if (firstActionCount > 0 && firstActionCount < 5) push("delay", 3, "1시간 체크리스트가 5개 미만입니다");
  if (src.mode === "local") push("delay", 2, "매뉴얼 엔진 산출물이라 확인 항목이 더 많습니다");

  if (src.stage === "planned") for (const axis of AXES) push(axis.id, -5, "공지 전 단계");
  if (src.stage === "breaking") push("press", 3, "첫 보도가 나간 직후");
  if (src.stage === "spreading") {
    push("spread", 8, "여론 확산 단계");
    push("press", 5, "2차 보도가 붙는 단계");
  }

  if (src.scale === "global") push("legal", 4, "글로벌 사업장은 국가별 고지 의무가 다릅니다");
  if (src.scale === "large") push("press", 3, "대기업 사안은 매체가 크게 다룹니다");
  if (src.scale === "small") push("trust", 2, "중소·스타트업은 대응 여력이 제한됩니다");

  if (src.risk === "높음") for (const axis of AXES) push(axis.id, 4, "패키지 위험도 ‘높음’");
  if (src.risk === "낮음") for (const axis of AXES) push(axis.id, -4, "패키지 위험도 ‘낮음’");

  if (src.entities.length > 1) push("internal", 2, "기업 유형을 여러 개 겹쳐 문안이 복잡합니다");

  const axes: ScoreAxis[] = AXES.map((axis) => {
    const value = clamp(scores[axis.id]);
    const list = Array.from(new Set([...reasons[axis.id], ...stanceReasons[axis.id]]));
    return { ...axis, value, reasons: list.length ? list.slice(0, 3) : ["입력에 특별한 가중 요인이 없습니다"] };
  });

  const overall = Math.round(axes.reduce((n, a) => n + a.value * a.weight, 0));
  const top = [...axes].sort((a, b) => b.value - a.value).slice(0, 3);

  return {
    overall,
    band: bandFor(overall),
    axes,
    top,
    note: "PRISM 내장 위험 모델(규칙 기반)입니다. 같은 입력·같은 입장이면 항상 같은 점수가 나오므로 두 입장을 같은 기준으로 비교할 수 있습니다. 예측값이 아니라 점검 우선순위입니다.",
  };
}

export interface AxisDelta {
  id: AxisId;
  label: string;
  short: string;
  a: number;
  b: number;
  delta: number;
}

export interface ScoreComparison {
  rows: AxisDelta[];
  overallDelta: number;
  better: "a" | "b" | "tie";
  tradeoffs: string[];
}

export function compareScorecards(a: Scorecard, b: Scorecard): ScoreComparison {
  const rows: AxisDelta[] = a.axes.map((axis) => {
    const other = b.axes.find((x) => x.id === axis.id);
    return {
      id: axis.id,
      label: axis.label,
      short: axis.short,
      a: axis.value,
      b: other?.value ?? axis.value,
      delta: (other?.value ?? axis.value) - axis.value,
    };
  });
  const overallDelta = b.overall - a.overall;
  const better: "a" | "b" | "tie" = Math.abs(overallDelta) < 2 ? "tie" : overallDelta < 0 ? "b" : "a";
  const tradeoffs: string[] = [];
  for (const row of rows) {
    if (Math.abs(row.delta) < 8) continue;
    const lower = row.delta < 0 ? "B" : "A";
    const higher = row.delta < 0 ? "A" : "B";
    tradeoffs.push(`${row.label} — ${lower}가 ${Math.abs(row.delta)}점 낮고, ${higher}가 그만큼 높습니다.`);
  }
  return { rows, overallDelta, better, tradeoffs: tradeoffs.slice(0, 4) };
}

export function scorecardToText(card: Scorecard, brand?: string): string {
  return [
    `[PRISM 위험 스코어카드] ${brand ?? ""}`.trim(),
    `종합 위험지수 ${card.overall}/100 · ${card.band.label}`,
    ...card.axes.map((a) => `- ${a.label}: ${a.value}/100 — ${a.reasons[0]}`),
    "",
    card.note,
  ].join("\n");
}
