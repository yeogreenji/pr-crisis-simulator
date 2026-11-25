/**
 * 요금제 — Starter / Pro / Enterprise (B2B 엔터프라이즈 기준).
 *
 * 기업 홍보팀·PR 대행사가 위기 대응 실무에 실제로 지출하는 금액대(월 19만~149만 원)로
 * 설계했습니다. 차이는 ‘몇 건 만드나’가 아니라 구매 결정 포인트로 갈립니다:
 * 월 분석 건수 · 임원 보고서 내보내기 · 업종 매뉴얼 대조 · 팀 공유/권한.
 *
 * 결제는 아직 연결되어 있지 않습니다. Pro는 "무료 체험 활성화" 스위치로 켜고,
 * 실제 과금 없이 전체 기능을 검증할 수 있게 해 두었습니다(데모 상태를 화면에 표시).
 */

export type PlanId = "starter" | "pro" | "enterprise";
export type BillingCycle = "monthly" | "annual";

export type FeatureKey =
  | "channels" // 4채널 문안(사내·SNS 포함)
  | "execExport" // 임원 보고서 Word·PDF
  | "share" // 임원·법무 공유 링크
  | "compare" // 시나리오·입장 비교
  | "caseStudio" // 내 사례 등록
  | "team" // 팀 워크스페이스
  | "sso"; // SSO·감사 로그·API

export interface PlanSpec {
  id: PlanId;
  name: string;
  /** 한 줄 정의 — 결제 페이지 상단에 그대로 노출 */
  tagline: string;
  /** 월 결제가(원). VAT 별도 */
  monthly: number;
  /** 연 결제가(원) — 10개월분(2개월 무료) */
  annual: number;
  audience: string;
  /** 월 대응 패키지 생성 한도 */
  runs: string;
  /** 월 생성 건수(무제한이면 undefined) — 건당 단가 계산에 씁니다 */
  runsPerMonth?: number;
  seats: string;
  highlights: string[];
  cta: string;
}

const PLAN_RANK: Record<PlanId, number> = { starter: 0, pro: 1, enterprise: 2 };

export const PLANS: PlanSpec[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "1인 홍보 담당의 첫 위기 대응",
    monthly: 190_000,
    annual: 1_900_000,
    audience: "초기 스타트업 · 1인 PR 담당",
    runs: "월 10건",
    runsPerMonth: 10,
    seats: "1인",
    highlights: [
      "월 10건 대응 패키지 생성",
      "공식 입장문·보도자료 2종 + 기자 Q&A 5문항",
      "7축 위험 스코어카드 · 사건 조사 파일",
      "업종별 위기 매뉴얼 12종 열람",
      "골든타임 체크리스트 · 유관기관 첫 문장",
    ],
    cta: "Starter 시작하기",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "기업 홍보팀의 표준 대응 체계",
    monthly: 490_000,
    annual: 4_900_000,
    audience: "기업 홍보·커뮤니케이션팀",
    runs: "월 30건",
    runsPerMonth: 30,
    seats: "3인 공유",
    highlights: [
      "월 30건 · 시나리오·입장 비교 무제한",
      "4채널 문안 전체 — 사내 공지·SNS 포함",
      "임원 보고서 Word·PDF 무제한 + 브랜드 서식",
      "임원·법무 공유 브리핑 링크",
      "업종별 위기 매뉴얼 대조 · 내 사례 등록",
    ],
    cta: "Pro 14일 무료 체험",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "여러 브랜드·여러 팀을 한 계정에서",
    monthly: 1_490_000,
    annual: 14_900_000,
    audience: "대기업 커뮤니케이션실 · PR 대행사",
    runs: "무제한",
    seats: "10인 이상 팀 계정",
    highlights: [
      "Pro 전체 기능 + 생성 무제한",
      "다중 브랜드 워크스페이스 · 역할별 권한",
      "SSO · 감사 로그 · API 액세스",
      "브랜드 표준 템플릿 · 승인 워크플로",
      "전담 온보딩 · 분기 대응 리허설 · 4시간 SLA",
      "세금계산서 · 연간 계약 · 비밀유지계약(NDA)",
    ],
    cta: "도입 문의",
  },
];

/** 기능별 최소 플랜. 이 값보다 낮은 플랜에서는 잠금 카드가 뜹니다. */
export const FEATURE_MIN: Record<FeatureKey, PlanId> = {
  channels: "pro",
  execExport: "pro",
  share: "pro",
  compare: "pro",
  caseStudio: "pro",
  team: "enterprise",
  sso: "enterprise",
};

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  channels: "4채널 문안(사내·SNS)",
  execExport: "임원 보고서 Word·PDF",
  share: "임원·법무 공유 링크",
  compare: "시나리오·입장 비교",
  caseStudio: "내 사례 등록",
  team: "팀 워크스페이스",
  sso: "SSO·감사 로그·API",
};

/** 가격표 아래 비교표 — 구매 결정 포인트별로 묶습니다. */
export const PLAN_MATRIX: { group: string; rows: { label: string; values: [string, string, string] }[] }[] = [
  {
    group: "사용량",
    rows: [
      { label: "월 대응 패키지 생성", values: ["10건", "30건", "무제한"] },
      { label: "시나리오·입장 비교", values: ["3건", "무제한", "무제한"] },
      { label: "동시 브랜드(워크스페이스)", values: ["1개", "1개", "브랜드별 무제한"] },
      { label: "계정·좌석", values: ["1인", "3인 공유", "10인 이상"] },
    ],
  },
  {
    group: "산출물·내보내기",
    rows: [
      { label: "공식 입장문·보도자료 2종", values: ["포함", "포함", "포함"] },
      { label: "기자 Q&A·핵심 방어 논리", values: ["5문항", "전체", "전체"] },
      { label: "4채널 문안(사내·SNS 포함)", values: ["—", "포함", "포함"] },
      { label: "임원 보고서 Word·PDF", values: ["—", "무제한", "무제한 + 브랜드 서식"] },
      { label: "임원·법무 공유 브리핑 링크", values: ["—", "포함", "만료일·열람 기록"] },
    ],
  },
  {
    group: "분석·매뉴얼",
    rows: [
      { label: "7축 위험 스코어카드", values: ["포함", "포함", "포함"] },
      { label: "사건 조사 파일·실무 팩트체크", values: ["포함", "포함", "법무 확인 워크플로"] },
      { label: "업종별 위기 매뉴얼", values: ["12종 열람", "대조 비교", "전용 매뉴얼 작성"] },
      { label: "사례 라이브러리", values: ["열람", "열람 + 내 사례 등록", "동일"] },
    ],
  },
  {
    group: "협업·보안·계약",
    rows: [
      { label: "팀 워크스페이스·권한", values: ["—", "공유 링크", "역할별 권한·승인 워크플로"] },
      { label: "SSO·감사 로그·API", values: ["—", "—", "포함"] },
      { label: "온보딩·대응 리허설·SLA", values: ["—", "가이드 문서", "전담 온보딩·분기 리허설·4시간"] },
      { label: "계약·정산", values: ["카드 결제", "카드·세금계산서", "연간 계약·NDA·세금계산서"] },
    ],
  },
];

export function getPlan(id: PlanId): PlanSpec {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function planAllows(plan: PlanId, feature: FeatureKey): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN[feature]];
}

/** 연 결제 월 환산액 (원, 내림) */
export function monthlyEquivalent(plan: PlanSpec): number {
  return Math.floor(plan.annual / 12);
}

export function annualSaving(plan: PlanSpec): number {
  return plan.monthly * 12 - plan.annual;
}

/** 무제한이 아니면 건당 단가(원) — 구매 판단용 산술값 */
export function perRun(plan: PlanSpec): number | null {
  if (!plan.runsPerMonth) return null;
  return Math.ceil(plan.monthly / plan.runsPerMonth);
}

const won = new Intl.NumberFormat("ko-KR");
export const formatWon = (value: number) => `${won.format(value)}원`;

export const TRIAL_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export interface PlanState {
  id: PlanId;
  cycle: BillingCycle;
  /** Pro 무료 체험(데모) 시작 시각 */
  trialStartedAt?: string;
  /** 체험 종료 시각 */
  trialEndsAt?: string;
  /** 결제 없이 켠 데모 상태인지 */
  demo: boolean;
}

const PLAN_KEY = "prism.plan.v1";

export const DEFAULT_PLAN: PlanState = { id: "starter", cycle: "monthly", demo: false };

export function loadPlanState(): PlanState {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return DEFAULT_PLAN;
    const parsed = JSON.parse(raw) as Partial<PlanState>;
    const id: PlanId = parsed.id === "pro" || parsed.id === "enterprise" ? parsed.id : "starter";
    const cycle: BillingCycle = parsed.cycle === "annual" ? "annual" : "monthly";
    const state: PlanState = {
      id,
      cycle,
      demo: Boolean(parsed.demo),
      trialStartedAt: typeof parsed.trialStartedAt === "string" ? parsed.trialStartedAt : undefined,
      trialEndsAt: typeof parsed.trialEndsAt === "string" ? parsed.trialEndsAt : undefined,
    };
    // 체험이 끝났으면 조용히 Starter로 돌립니다.
    if (state.id === "pro" && state.demo && state.trialEndsAt && Date.parse(state.trialEndsAt) < Date.now()) {
      return { ...DEFAULT_PLAN, cycle: state.cycle };
    }
    return state;
  } catch {
    return DEFAULT_PLAN;
  }
}

export function persistPlanState(state: PlanState): PlanState {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(state));
  } catch {
    /* 저장 공간이 없으면 현재 탭에서만 유지됩니다 */
  }
  return state;
}

export function startProTrial(cycle: BillingCycle): PlanState {
  const now = Date.now();
  return persistPlanState({
    id: "pro",
    cycle,
    demo: true,
    trialStartedAt: new Date(now).toISOString(),
    trialEndsAt: new Date(now + TRIAL_DAYS * DAY).toISOString(),
  });
}

/**
 * 플랜 전환 지점.
 *
 * 지금은 결제 없이 로컬 상태만 바꿉니다. 실결제(PG)를 붙일 때는 이 함수 하나만 바꾸면 됩니다:
 *   1) `const session = await createCheckout({ plan: id, cycle, customerId })`
 *   2) successUrl에서 돌아오면 서버가 서명한 영수증으로 `persistPlanState(...)`를 호출
 *   3) 실패·취소면 기존 상태를 그대로 두고 모달에 사유를 표시
 * 플랜 ID·가격·기능 매핑(PLANS, FEATURE_MIN, PLAN_MATRIX)은 이미 서버와 공유할 수 있는 형태로 분리되어 있습니다.
 */
export function switchPlan(id: PlanId, cycle: BillingCycle): PlanState {
  if (id === "pro") return startProTrial(cycle);
  return persistPlanState({ id, cycle, demo: false });
}

/** 남은 체험 일수 (0이면 종료) */
export function trialDaysLeft(state: PlanState): number {
  if (!state.trialEndsAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(state.trialEndsAt) - Date.now()) / DAY));
}

export function planBadge(state: PlanState): string {
  const plan = getPlan(state.id);
  if (state.id === "pro" && state.demo) return `Pro 체험 ${trialDaysLeft(state)}일`;
  return plan.name;
}
