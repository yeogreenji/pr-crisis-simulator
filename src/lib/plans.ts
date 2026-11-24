/**
 * 요금제 — Starter / Pro / Enterprise.
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
  /** 연 결제가(원) — 2개월분 할인 */
  annual: number;
  audience: string;
  /** 월 대응 패키지 생성 한도 */
  runs: string;
  seats: string;
  highlights: string[];
  cta: string;
}

const PLAN_RANK: Record<PlanId, number> = { starter: 0, pro: 1, enterprise: 2 };

export const PLANS: PlanSpec[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "혼자 쓰는 기본 대응",
    monthly: 0,
    annual: 0,
    audience: "PR 담당자 1인 · 첫 위기 대응",
    runs: "월 3건",
    seats: "1인",
    highlights: [
      "공식 입장문·보도자료 2종",
      "기자 Q&A 5문항 · 핵심 방어 논리",
      "7축 위험 스코어카드",
      "사건 조사 파일 · 실무 팩트체크",
      "골든타임 체크리스트 · 유관기관 접점",
      "사례 라이브러리 열람",
    ],
    cta: "무료로 시작",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "실무 팀의 표준 대응",
    monthly: 49_000,
    annual: 490_000,
    audience: "PR 실무팀 · 대행사 AE",
    runs: "월 100건",
    seats: "3인",
    highlights: [
      "4채널 문안 전체 — 사내 공지·SNS 포함",
      "임원 보고서 Word(.doc) · PDF 저장",
      "임원·법무팀 공유 브리핑 링크",
      "시나리오·입장 비교 무제한",
      "내 사례 등록 · 우선 AI 모델",
    ],
    cta: "Pro 무료 체험",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "여러 브랜드를 동시에",
    monthly: 199_000,
    annual: 1_990_000,
    audience: "그룹 커뮤니케이션 · 법무 연동",
    runs: "무제한",
    seats: "5인 이상",
    highlights: [
      "Pro 전체 기능 + 무제한 생성",
      "팀 워크스페이스 · 권한 관리",
      "SSO · 감사 로그 · API 액세스",
      "브랜드 표준 템플릿 · 승인 워크플로",
      "전담 온보딩 · 대응 리허설 · SLA",
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

export function startProTrial(cycle: BillingCycle): PlanState {  const now = Date.now();
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
 * 플랜 ID·가격·기능 매핑(PLANS, FEATURE_MIN)은 이미 서버와 공유할 수 있는 형태로 분리되어 있습니다.
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
