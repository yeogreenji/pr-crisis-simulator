export type IssueCategoryId =
  | "service-outage"
  | "product-safety"
  | "pricing-change"
  | "data-privacy"
  | "people-org"
  | "safety-accident"
  | "executive-speech";

export type IndustryId = "food" | "retail" | "consumer" | "tech" | "steel" | "entertainment";

export interface IndustryCheck {
  id: string;
  /** 점검 항목 이름 (예: 회수 범위·제조번호) */
  label: string;
  patterns: RegExp[];
  severity: Severity;
  /** 이 항목이 비었을 때 기자가 던지는 질문 */
  question: string;
  why: string;
  detail: string;
}

export interface CrisisTrigger {
  label: string;
  desc: string;
  severity: Severity;
}

export interface PlaybookStakeholder {
  who: string;
  tone: string;
  dos: string[];
  donts: string[];
}

export interface IndustryPlaybook {
  stance: string;
  triggers: CrisisTrigger[];
  regulators: { name: string; role: string }[];
  laws: { name: string; note: string }[];
  timeline: { window: string; title: string; items: string[] }[];
  banned: { phrase: string; why: string; instead: string }[];
  required: { label: string; desc: string }[];
  stakeholders: PlaybookStakeholder[];
  evidence: string[];
  watchouts: string[];
}

export interface Industry {
  id: IndustryId;
  label: string;
  short: string;
  tagline: string;
  description: string;
  accent: string;
  /** 이 업종에서 기본으로 켜 두면 좋은 채널 */
  recommended: ChannelId[];
  /** 이 업종의 점수 가중치 보정 (근거/책임/감정/톤) */
  weights: Partial<Record<RiskCategoryId, number>>;
  baseline: number;
  channelsBias: Partial<Record<ChannelId, number>>;
  themes: string[];
  checks: IndustryCheck[];
  qa: { q: string; a: string }[];
  closing: string;
  apologyTarget: string;
  playbook: IndustryPlaybook;
}

export type CaseVerdict = "exemplary" | "mixed" | "failure";

export interface CrisisCase {
  id: string;
  industry: IndustryId;
  company: string;
  country: "KR" | "US" | "GLOBAL";
  date: string;
  title: string;
  trigger: string;
  scale: string[];
  timeline: { when: string; what: string }[];
  response: string[];
  outcome: string;
  lesson: string;
  verdict: CaseVerdict;
  sources: { label: string; url: string }[];
}

export type ChannelId =
  | "econ-press"
  | "it-press"
  | "office-community"
  | "sns-x"
  | "youtube"
  | "consumer-cafe";

export type RiskCategoryId = "evidence" | "liability" | "emotion" | "tone";
export type Severity = 1 | 2 | 3;
export type ToneKind = "분노" | "냉소" | "질문" | "연대" | "지지" | "우려";

export interface IssueCategory {
  id: IssueCategoryId;
  label: string;
  short: string;
  baseline: number;
  description: string;
  factChecks: string[];
}

export interface Channel {
  id: ChannelId;
  label: string;
  kind: "press" | "community" | "social";
  short: string;
  negativityOffset: number;
  weight: number;
  note: string;
}

export interface RiskCategory {
  id: RiskCategoryId;
  label: string;
  short: string;
  weight: number;
  hint: string;
}

export interface Preset {
  id: string;
  brand: string;
  product: string;
  issue: IssueCategoryId;
  industry: IndustryId;
  label: string;
  tagline: string;
  channels: ChannelId[];
  draft: string;
}

export interface RiskSpan {
  id: string;
  start: number;
  end: number;
  text: string;
  ruleId: string;
  category: RiskCategoryId;
  severity: Severity;
  label: string;
  reason: string;
  /** 문장 안에서 위험 구절을 대체하는 문구 */
  replacement: string;
  /** 교체 후 문장 미리보기 */
  suggestion: string;
  /** 이 구절만 교체했을 때의 실제 점수 감소분 */
  delta: number;
}

export interface RuleHit {
  ruleId: string;
  category: RiskCategoryId;
  severity: Severity;
  label: string;
  reason: string;
  matched: string;
  index: number;
}

export interface RiskBreakdown {
  id: RiskCategoryId;
  label: string;
  short: string;
  score: number;
  weight: number;
  hint: string;
}

export interface Headline {
  tone: "critical" | "positive";
  outlet: string;
  text: string;
  note: string;
}

export interface FactCheck {
  question: string;
  why: string;
  severity: Severity;
}

export interface MissingEvidence {
  label: string;
  detail: string;
  severity: Severity;
}

export interface Reaction {
  id: string;
  handle: string;
  initials: string;
  accent: string;
  time: string;
  text: string;
  tone: ToneKind;
  likes: number;
  replies: number;
  badge?: string;
}

export interface ChannelForecast {
  id: ChannelId;
  label: string;
  short: string;
  kind: Channel["kind"];
  negativity: number;
  volume: "낮음" | "보통" | "높음" | "매우 높음";
  themes: string[];
  reactions: Reaction[];
  memeRisk: number;
  note: string;
}

export interface QaItem {
  id: string;
  question: string;
  answer: string;
  status: "ready" | "confirm";
  source: string;
}

export interface ViralRisk {
  score: number;
  level: "낮음" | "관찰" | "주의" | "높음";
  drivers: string[];
  halfLife: string;
}

export interface StructureCheck {
  label: string;
  ok: boolean;
  group: RiskCategoryId;
  hint?: string;
}

export interface AnalysisStats {
  chars: number;
  sentences: number;
  riskySpans: number;
  criticalSpans: number;
  suggestedGain: number;
  projectedScore: number;
  industryChecksPassed: number;
  industryChecksTotal: number;
}

export type AnalysisMode = "ai" | "local";

/** AI·로컬 엔진이 함께 만드는 실전 산출물 */
export interface RevisionVariant {
  id: "empathy" | "authority";
  label: string;
  audience: string;
  /** 완성된 문안 (복사 버튼으로 그대로 사용) */
  body: string;
  /** 핵심 변경 포인트 */
  changes: string[];
}

export interface ChannelSimulation {
  id: ChannelId;
  label: string;
  reactions: Reaction[];
  /** 이 문안에서 반응이 악화되는 트리거 */
  triggers: string[];
  source: "ai" | "local";
}

export interface PressQaItem {
  id: string;
  question: string;
  /** 바로 읽을 수 있는 모범 답변 가이드 */
  answerGuide: string;
  /** 피해야 할 말 */
  avoid: string[];
  severity: Severity;
  source: "ai" | "local";
}

export interface GoldenTimeStep {
  window: string;
  title: string;
  items: string[];
}

export interface AiMeta {
  model: string;
  usedAt: string;
  /** AI가 따로 제안한 종합 판단 점수 (내장 엔진 점수와 별개) */
  score?: number;
  comment?: string;
  latencyMs?: number;
}

export interface Analysis {
  id: string;
  createdAt: string;
  /** 결과를 만든 모드 — 상단 배지에 표시 */
  mode: AnalysisMode;
  /** 로컬 모드로 떨어진 이유 (AI 모드면 없음) */
  modeNote?: string;
  ai?: AiMeta;
  revisions: RevisionVariant[];
  channelSimulations: ChannelSimulation[];
  pressQa: PressQaItem[];
  goldenTime: GoldenTimeStep[];
  brand: string;
  issue: IssueCategoryId;
  issueLabel: string;
  industry: IndustryId;
  industryLabel: string;
  structureChecks: StructureCheck[];
  channels: ChannelId[];
  text: string;
  score: number;
  grade: Grade;
  breakdown: RiskBreakdown[];
  spans: RiskSpan[];
  headlines: Headline[];
  factChecks: FactCheck[];
  missing: MissingEvidence[];
  channelForecasts: ChannelForecast[];
  viral: ViralRisk;
  qa: QaItem[];
  revisedDraft: string;
  summaryLine: string;
  pressAngle: string;
  stats: AnalysisStats;
  engine: "heuristic" | "llm";
  source?: "heuristic" | "llm";
}

export interface Grade {
  label: string;
  tone: "ok" | "watch" | "warn" | "risk";
  color: string;
  desc: string;
}

export interface RunRecord {
  id: string;
  createdAt: string;
  brand: string;
  issue: IssueCategoryId;
  issueLabel: string;
  industry?: IndustryId;
  industryLabel?: string;
  channels: ChannelId[];
  score: number;
  gradeLabel: string;
  text: string;
  stats: AnalysisStats;
  breakdown: RiskBreakdown[];
  channelTones: { id: ChannelId; label: string; negativity: number }[];
  summaryLine: string;
  topIssues: string[];
  engine: "heuristic" | "llm";
  mode?: AnalysisMode;
}

/** 실시간 AI 분석 설정 — 서버 키가 없을 때만 개인 키를 프록시로 전달합니다. */
export interface LlmConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
}
