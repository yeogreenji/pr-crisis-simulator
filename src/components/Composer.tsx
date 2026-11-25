import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Library,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  FileText,
  History,
  LineChart,
  Link2,
  Mic2,
  Paperclip,
  ServerCog,
  Settings2,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Users2,
} from "lucide-react";
import { ENTITY_PROFILES, type EntityId } from "../lib/profiles";
import { STANCES, buildLocalPackage, extractUrl, getStance, type ResponsePackage, type Stance, type CompanyScale, type ProtocolStage } from "../lib/package";
import { buildScorecard, type Scorecard } from "../lib/scorecard";
import { INDUSTRIES } from "../lib/industries";
import { classifyIndustry } from "../lib/classify";
import { SITUATIONS, SITUATION_GROUPS, getSituation, type SituationTagId } from "../lib/situations";
import { DEFAULT_EXAMPLES, INDUSTRY_EXAMPLES, INDUSTRY_GROUPS } from "../lib/sector-examples";
import { CASE_TYPES } from "../lib/case-store";
import { CASE_TYPE_LABEL } from "../lib/cases";
import type { CaseType, IndustryId } from "../types";
import { cx } from "./ui";
import { usePlan } from "./PlanContext";
import { planBadge } from "../lib/plans";

export interface ComposeValue {
  situation: string;
  brand: string;
  stance: Stance;
  /** stance === "custom"일 때 직접 적은 입장 */
  stanceCustom: string;
  /** 기업 상황 태그 */
  situations: SituationTagId[];
  /** 기업 상황 직접 입력 */
  situationNote: string;
  entities: EntityId[];
  /** "auto"면 문장에서 자동 판별 */
  industry: IndustryId | "auto";
  caseType: CaseType | "auto";
  /** 지금 어느 단계인지 */
  stage: ProtocolStage;
  /** 기업 규모 */
  scale: CompanyScale;
}

const STAGES: { id: ProtocolStage; label: string; hint: string }[] = [
  { id: "planned", label: "공지 전", hint: "아직 통제 가능한 구간" },
  { id: "breaking", label: "보도 직후", hint: "첫 보도가 나간 상태" },
  { id: "spreading", label: "여론 확산", hint: "커뮤니티·기사로 번지는 중" },
];

const SCALES: { id: CompanyScale; label: string }[] = [
  { id: "small", label: "스타트업·중소" },
  { id: "mid", label: "중견" },
  { id: "large", label: "대기업" },
  { id: "global", label: "글로벌" },
];

const ENTITY_ICON: Record<EntityId, typeof Building2> = {
  general: Building2,
  listed: LineChart,
  consumer: ShoppingBasket,
  platform: ServerCog,
  entertainment: Mic2,
  labor: Users2,
};

const FLOW = [
  { n: "1", t: "상황 입력", short: "상황 입력", d: "기사 URL 또는 한 줄 설명" },
  { n: "2", t: "대응 스탠스 선택", short: "스탠스 선택", d: "사과·사실 적시·보상·반박 중 택 1" },
  { n: "3", t: "문안·보고서 생성", short: "문안 생성", d: "4채널 문안 · 임원 보고서" },
];

const CAPABILITIES = ["4채널 문안", "7축 스코어카드", "골든타임 체크리스트", "임원 보고서", "법무 공유 링크"];

/** 히어로 오른쪽 — 실제 규칙 엔진으로 만든 예시 리포트를 그대로 보여 줍니다. */
function buildSampleCard() {
  const pkg = buildLocalPackage({
    situation:
      "대표 상품 가격을 인상한다는 보도가 나간 뒤, 온라인 커뮤니티에 해지 인증과 환불 요구가 확산되고 있습니다.",
    brand: "예시 브랜드",
    stance: "investigating",
    situations: ["spreading"],
    entities: ["consumer"],
    industry: "auto",
    caseType: "auto",
    stage: "spreading",
    scale: "mid",
  });
  return buildScorecard(pkg);
}

const AXIS_COLOR = (v: number) => (v >= 70 ? "#dc2626" : v >= 50 ? "#d97706" : v >= 35 ? "#2563eb" : "#059669");
const BAND_CHIP: Record<string, string> = {
  ok: "bg-ok-soft text-ok",
  info: "bg-accent-soft text-accent-deep",
  warn: "bg-warn-soft text-warn",
  risk: "bg-risk-soft text-risk",
};
const BAND_TEXT: Record<string, string> = {
  ok: "text-ok",
  info: "text-accent-deep",
  warn: "text-warn",
  risk: "text-risk",
};

function PreviewCard({ card }: { card: Scorecard }) {
  return (
    <div className="relative" data-testid="hero-preview">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[32px] bg-[radial-gradient(60%_60%_at_70%_10%,rgba(29,78,216,0.16),transparent_70%)] blur-[2px]"
      />
      <div className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-float">
        <div className="flex items-center justify-between gap-2 border-b border-line bg-tint px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
            <Sparkles size={12} className="text-accent" />
            예시 리포트 미리보기
          </span>
          <span className="chip border border-accent/20 bg-accent-soft px-2 py-0.5 text-[11.5px] text-accent-deep">7축 스코어카드</span>
        </div>

        <div className="px-4 pb-4 pt-3.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12.5px] font-medium text-muted">종합 위험지수</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={cx("num text-[38px] font-bold leading-none tracking-[-0.04em]", BAND_TEXT[card.band.tone])}>
                  {card.overall}
                </span>
                <span className="text-[12.5px] font-medium text-faint">/ 100</span>
                <span className={cx("chip ml-1 px-2 py-0.5 text-[12px]", BAND_CHIP[card.band.tone])}>
                  {card.band.label}
                </span>
              </div>
            </div>
            <div className="hidden flex-col items-end gap-1 text-[12px] text-faint sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                4채널 문안 준비 완료
              </span>
              <span>임원 보고서 · 공유 링크 포함</span>
            </div>
          </div>

          <div className="mt-3.5 space-y-2">
            {[...card.axes].sort((a, b) => b.value - a.value).filter((_, i) => [0, 1, 3, 6].includes(i)).map((axis) => (
              <div key={axis.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-ink-2">{axis.label}</span>
                  <span className="num text-[12px] font-semibold" style={{ color: AXIS_COLOR(axis.value) }}>
                    {axis.value}
                  </span>
                </div>
                <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-tint-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${axis.value}%`, background: AXIS_COLOR(axis.value) }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {["공식 입장문", "기자 Q&A", "사내 공지", "SNS 대응"].map((t) => (
              <span key={t} className="chip border border-line bg-white px-2 py-0.5 text-[12px] font-medium text-ink-2">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="border-t border-line bg-tint px-4 py-2 text-[12px] leading-relaxed text-faint">
          입력한 상황 그대로 이 구조의 리포트가 나옵니다 · 예시 화면
        </div>
      </div>
    </div>
  );
}

function StepHead({
  no,
  step,
  title,
  note,
}: {
  no: string;
  step: string;
  title: string;
  note: string;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-white px-4 py-3.5 sm:px-5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-[13px] font-bold text-accent" data-testid="step-badge">
        {no}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{step}</div>
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
      </div>
      <span className="ml-auto text-[12.5px] font-medium text-faint">{note}</span>
    </header>
  );
}

function RowLabel({ no, title, note }: { no: string; title: string; note?: string }) {
  return (
    <div className="form-label">
      <span className="form-label-no">{no}</span>
      <span className="form-label-title">{title}</span>
      {note && <span className="form-label-note">{note}</span>}
    </div>
  );
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onOpenManual,
  onOpenLibrary,
  onOpenSettings,
  reviewMode,
  onReviewMode,
  recent,
  onOpenRecent,
  onRemoveRecent,
  error,
  fallbackOffer,
  onFallbackOffer,
  historyCount,
  onOpenHistory,
  aiReady,
  aiNote,
}: {
  value: ComposeValue;
  onChange: (next: ComposeValue) => void;
  onSubmit: () => void;
  onOpenManual: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  reviewMode: boolean;
  onReviewMode: (v: boolean) => void;
  recent: ResponsePackage[];
  onOpenRecent: (pkg: ResponsePackage) => void;
  onRemoveRecent: (id: string) => void;
  error: string | null;
  /** 기사 본문을 읽지 못해 재입력이 필요한 상태 */
  fallbackOffer: boolean;
  onFallbackOffer: () => void;
  historyCount: number;
  onOpenHistory: () => void;
  aiReady: boolean;
  aiNote: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { plan, openPricing } = usePlan();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const url = useMemo(() => extractUrl(value.situation), [value.situation]);
  const urlOnly = useMemo(() => {
    if (!url) return false;
    return value.situation.replace(url, "").replace(/\s+/g, "").length < 6;
  }, [url, value.situation]);
  const selectedProfile = ENTITY_PROFILES.find((p) => p.id === value.entities[0]) ?? ENTITY_PROFILES[0];
  const tooShort = reviewMode ? value.situation.trim().length < 20 : value.situation.trim().length < 4;
  const activeStance = getStance(value.stance, value.stanceCustom);
  /** 업종을 고르지 않았으면 지금 입력에서 추정한 업종의 예시를 보여 줍니다. */
  const exampleIndustry = useMemo(
    () =>
      value.industry !== "auto"
        ? value.industry
        : classifyIndustry(value.situation, selectedProfile.industry).industry,
    [value.industry, value.situation, selectedProfile.industry],
  );
  const exampleLabel = INDUSTRIES.find((i) => i.id === exampleIndustry)?.label ?? "업종";
  const examples = INDUSTRY_EXAMPLES[exampleIndustry] ?? DEFAULT_EXAMPLES;
  const sampleCard = useMemo(buildSampleCard, []);

  const toggleSituation = (id: SituationTagId) => {
    const has = value.situations.includes(id);
    const next = has ? value.situations.filter((s) => s !== id) : [...value.situations, id].slice(0, 3);
    onChange({ ...value, situations: next });
  };

  const insertExample = (text: string) => {
    const current = value.situation.trim();
    onChange({ ...value, situation: current ? `${current}\n${text}` : text });
  };

  const toggleEntity = (id: EntityId) => {
    // 기본값 general만 선택된 상태에서 다른 유형을 고르면, 그 유형을 대표로 삼습니다.
    if (id === "general") {
      onChange({ ...value, entities: ["general"] });
      return;
    }
    const base = value.entities.length === 1 && value.entities[0] === "general" ? [] : value.entities;
    const next = base.includes(id) ? base.filter((e) => e !== id) : [...base, id];
    onChange({ ...value, entities: next.length ? next.slice(0, 3) : ["general"] });
  };

  const readFile = async (file: File) => {
    if (file.size > 400_000) return;
    const text = await file.text();
    const body = text.replace(/\r\n/g, "\n").slice(0, 8_000);
    onChange({ ...value, situation: value.situation.trim() ? `${value.situation.trim()}\n\n${body}` : body });
  };

  const stanceRows = STANCES.filter((s) => s.id !== "custom");

  return (
    <div className="min-h-screen bg-paper">
      {/* ── 상단 바 ── */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-1.5 px-3 sm:gap-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[#2563EB] to-[#1E3A8A] text-[11px] font-bold tracking-tight text-white shadow-[0_2px_6px_-1px_rgba(29,78,216,0.45)]">
              PR
            </span>
            <div className="min-w-0 leading-none">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[14px] font-bold tracking-[-0.01em] text-ink">PRISM</span>
                <span className="hidden rounded-md bg-tint-2 px-1.5 py-[2px] text-[9.5px] font-semibold tracking-[0.08em] text-muted sm:inline">
                  B2B
                </span>
              </div>
              <span className="mt-0.5 hidden text-[11px] font-medium text-faint sm:block">기업 위기 대응 워크스페이스</span>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => openPricing()}
              data-testid="plan-badge"
              title="요금제 보기"
              className="btn btn-outline h-8 rounded-full px-2.5 text-[12.5px]"
            >
              <span
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  plan.id === "starter" ? "bg-faint" : plan.id === "pro" ? "bg-accent" : "bg-ink",
                )}
              />
              <span className="num">{planBadge(plan)}</span>
              <ChevronDown size={11} className="text-faint" />
            </button>
            <span className="mx-0.5 hidden h-5 w-px bg-line sm:block" />
            <button
              type="button"
              onClick={onOpenManual}
              className="btn btn-ghost h-8 px-1.5 text-[13px] text-muted hover:text-ink sm:px-2"
              aria-label="매뉴얼"
            >
              <BookOpen size={13} /> <span className="hidden sm:inline">매뉴얼</span>
            </button>
            <button
              type="button"
              onClick={onOpenLibrary}
              data-testid="open-library"
              className="btn btn-outline h-8 px-2 text-[13px] text-ink"
            >
              <Library size={13} />
              <span className="hidden sm:inline">사례 라이브러리</span>
              <span className="sm:hidden">사례</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="btn btn-ghost h-8 px-1.5 text-[13px] text-muted hover:text-ink sm:px-2"
              aria-label="AI 설정"
            >
              <Settings2 size={13} />
              <span className="hidden sm:inline">AI 설정</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 히어로: 제품 첫 화면 ── */}
      <section className="relative overflow-hidden border-b border-line bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_85%_-10%,rgba(29,78,216,0.10),transparent_60%),radial-gradient(50%_90%_at_10%_0%,rgba(37,99,235,0.06),transparent_65%)]"
        />
        <div className="relative mx-auto grid w-full max-w-[1120px] items-center gap-7 px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-11 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] lg:gap-12 lg:pb-12 lg:pt-14">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent-deep">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              PR 팀을 위한 위기 대응 OS
            </span>
            <h1 className="display mt-4 text-[28px] leading-[1.16] text-ink sm:text-[40px] lg:text-[44px]">
              위기 보도가 나간 뒤,
              <br />
              <span className="text-accent">첫 6시간</span>을 한 화면에서.
            </h1>
            <p className="mt-3.5 max-w-[540px] text-[13.5px] leading-[1.75] text-muted sm:text-[14.5px]">
              기사 URL이나 상황 한 줄을 넣고 우리 입장을 고르면, 4채널 문안·7축 위험 스코어카드·골든타임
              체크리스트가 바로 나옵니다. 그대로 임원 보고서와 법무 공유 링크가 됩니다.
            </p>
            <div className="mt-4 hidden flex-wrap gap-1.5 sm:flex">
              {CAPABILITIES.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-tint px-2.5 py-1 text-[12px] font-medium text-ink-2"
                >
                  <Check size={11} className="text-accent" />
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2 items-center justify-center">
                  <span
                    className={cx(
                      "h-2 w-2 rounded-full",
                      aiReady ? "bg-ok animate-pulse-ring" : "bg-faint",
                    )}
                  />
                </span>
                <span className="font-semibold text-ink-2">{aiReady ? "실시간 AI 연결" : "매뉴얼 엔진 모드"}</span>
              </span>
              <span className="text-line-strong">·</span>
              <span className="text-faint">{aiNote}</span>
            </div>

            {/* 모바일: 컴팩트 미리보기 */}
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-line bg-tint px-3 py-2.5 sm:hidden">
              <span className={cx("num text-[22px] font-bold leading-none", BAND_TEXT[sampleCard.band.tone])}>
                {sampleCard.overall}
              </span>
              <span className="text-[11.5px] text-faint">/100</span>
              <span className={cx("chip px-2 py-0.5 text-[11.5px]", BAND_CHIP[sampleCard.band.tone])}>
                {sampleCard.band.label}
              </span>
              <span className="text-[12.5px] font-medium text-ink-2">예시 리포트</span>
              <span className="ml-auto text-[11.5px] text-faint">7축 스코어카드</span>
            </div>
          </div>

          <div className="hidden sm:block">
            <PreviewCard card={sampleCard} />
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1120px] px-4 pb-16 sm:px-6">
        {/* ── 3단계 흐름: 스텝퍼 ── */}
        <div className="mt-4 flex items-center gap-1 rounded-xl border border-line bg-white px-2 py-1.5 shadow-card sm:hidden">
          {FLOW.map((s, i) => (
            <div key={s.n} className="flex min-w-0 flex-1 items-center gap-1">
              <span
                className={cx(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                  i === 0 ? "bg-accent text-white" : "bg-tint-2 text-muted",
                )}
              >
                {s.n}
              </span>
              <span className={cx("truncate text-[12px] font-semibold", i === 0 ? "text-accent-deep" : "text-muted")}>
                {s.short}
              </span>
              {i < FLOW.length - 1 && <span className="ml-auto shrink-0 text-[11.5px] text-line-strong">›</span>}
            </div>
          ))}
        </div>
        <div className="mt-5 hidden gap-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-card sm:grid sm:grid-cols-3">
          {FLOW.map((s, i) => (
            <div
              key={s.n}
              className={cx(
                "flex items-start gap-2.5 rounded-xl px-3 py-2.5",
                i === 0 ? "bg-accent-soft/70" : "bg-white",
              )}
            >
              <span
                className={cx(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold",
                  i === 0 ? "bg-accent text-white" : "bg-tint-2 text-muted",
                )}
              >
                {s.n}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink">{s.t}</div>
                <p className="mt-0.5 text-[12px] leading-snug text-muted">{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── STEP 1 ── */}
        <section className="sheet mt-5 overflow-hidden" data-testid="step-situation">
          <StepHead no="1" step="STEP 1 / 03" title="상황 입력" note="기사 URL · 텍스트 · 파일" />

          <div className="form-row form-row-first">
            <RowLabel no="01" title={reviewMode ? "검수할 입장문" : "위기 상황"} note={reviewMode ? "전문을 붙여넣으세요" : "기사 URL 또는 한 줄"} />
            <div className="form-body">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
                  {reviewMode ? <FileText size={12} /> : <AlertTriangle size={12} className="text-warn" />}
                  {reviewMode ? "검수할 기존 입장문" : "상황 설명 또는 기사 링크"}
                </span>
                <span className="chip border border-line bg-paper-deep text-[11.5px] text-muted">
                  {reviewMode ? "검수 모드" : url ? "URL 읽기" : "직접 입력"}
                </span>
              </div>
              <textarea
                value={value.situation}
                onChange={(e) => onChange({ ...value, situation: e.target.value })}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !tooShort) onSubmit();
                }}
                rows={reviewMode ? 8 : 5}
                aria-label={reviewMode ? "검수할 기존 입장문" : "위기 상황 또는 기사 URL"}
                data-testid="situation-input"
                className="field mt-2 resize-y text-[13px] leading-[1.7] sm:text-[13.5px]"
                placeholder={
                  reviewMode
                    ? "지금 올릴 예정인 입장문·보도자료 전문을 붙여넣으세요. 위험 표현과 빠진 요소를 짚어 드립니다."
                    : "가격 인상 이슈\n\n또는 상황을 한 줄로: ‘넷플릭스가 구독료를 올린다는 보도가 나갔고, 커뮤니티에 해지 인증이 확산 중입니다.’\n\n또는 기사 주소를 붙여넣으세요: https://news.example.com/article/12345"
                }
              />
              {!reviewMode && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-muted">
                  <Sparkles size={11} className="mt-[3px] shrink-0 text-accent" />
                  <span>
                    <span className="font-semibold text-ink-2">짧게 입력해도 쟁점을 자동 확장합니다.</span> ‘가격 인상’처럼
                    2~6단어만 넣어도 소비자 반발·명분·커뮤니티·경쟁사·언론 포인트로 나눠 매뉴얼을 만듭니다.
                  </span>
                </p>
              )}
              {url && !reviewMode && (
                <div className="mt-2 flex items-start gap-2 border border-accent/25 border-l-4 border-l-accent bg-accent-soft px-2.5 py-2">
                  <Link2 size={12} className="mt-[2px] shrink-0 text-accent" />
                  <div className="min-w-0 text-[12.5px] leading-relaxed text-accent-deep">
                    <span className="font-semibold">기사 본문을 서버가 직접 읽습니다.</span>{" "}
                    <span className="break-all opacity-80">{url.slice(0, 90)}</span>
                    {urlOnly && (
                      <span className="mt-0.5 block text-accent-deep/75">
                        URL만으로 분석합니다. 읽지 못하면 본문 붙여넣기로 안내드립니다.
                      </span>
                    )}
                  </div>
                </div>
              )}
              {error && (
                <div className="mt-2 border border-risk/30 border-l-4 border-l-risk bg-risk-soft px-2.5 py-2 text-[12.5px] leading-relaxed text-risk">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={12} className="mt-[2px] shrink-0" />
                    <span>{error}</span>
                  </div>
                  {fallbackOffer && (
                    <div className="mt-1.5 border-t border-risk/20 pt-1.5">
                      <button
                        type="button"
                        onClick={onFallbackOffer}
                        data-testid="fallback-without-article"
                        className="btn btn-outline h-7 border-risk/30 px-2 text-[12.5px] text-ink-2"
                      >
                        기사 본문 없이 지금 분석 계속
                      </button>
                      <span className="ml-2 text-[12px] text-risk/85">URL 주소만 가진 맥락으로 매뉴얼 결과를 바로 만듭니다.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {!reviewMode && (
            <>
              <div className="form-row" data-testid="classify-row">
                <RowLabel no="02" title="분류" note="업종·이슈 유형·단계·규모" />
                <div className="form-body">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-[9px] border border-line-strong bg-white px-2.5 py-2">
                      <span className="shrink-0 text-[12.5px] font-medium text-muted">업종</span>
                      <select
                        value={value.industry}
                        onChange={(e) => onChange({ ...value, industry: e.target.value as IndustryId | "auto" })}
                        data-testid="industry-select"
                        aria-label="업종 선택"
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-ink outline-none"
                      >
                        <option value="auto">자동 판별</option>
                        {INDUSTRY_GROUPS.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.ids.map((id) => {
                              const industry = INDUSTRIES.find((i) => i.id === id);
                              if (!industry) return null;
                              return (
                                <option key={id} value={id}>
                                  {industry.label}
                                </option>
                              );
                            })}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 rounded-[9px] border border-line-strong bg-white px-2.5 py-2">
                      <span className="shrink-0 text-[12.5px] font-medium text-muted">이슈 유형</span>
                      <select
                        value={value.caseType}
                        onChange={(e) => onChange({ ...value, caseType: e.target.value as CaseType | "auto" })}
                        data-testid="type-select"
                        aria-label="이슈 유형 선택"
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-ink outline-none"
                      >
                        <option value="auto">자동 판별</option>
                        {CASE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {CASE_TYPE_LABEL[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                    비워 두면 자동 판별합니다. 잘못 잡히면 직접 고르세요 — 대응 순서와 유사 사례가 달라집니다.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12.5px] font-semibold text-ink-2">현재 단계</span>
                        <span className="text-[11.5px] text-faint">체크리스트 순서</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {STAGES.map((s) => {
                          const active = value.stage === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              aria-pressed={active}
                              data-testid={`stage-${s.id}`}
                              onClick={() => onChange({ ...value, stage: s.id })}
                              className={cx(
                                "rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold transition-colors",
                                active
                                  ? "border-accent bg-accent text-white shadow-[0_1px_2px_rgba(29,78,216,0.3)]"
                                  : "border-line bg-white text-ink-2 hover:border-accent/40 hover:text-ink",
                              )}
                              title={s.hint}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12.5px] font-semibold text-ink-2">기업 규모</span>
                        <span className="text-[11.5px] text-faint">이해관계자 접점 보정</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {SCALES.map((s) => {
                          const active = value.scale === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              aria-pressed={active}
                              data-testid={`scale-${s.id}`}
                              onClick={() => onChange({ ...value, scale: s.id })}
                              className={cx(
                                "rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold transition-colors",
                                active
                                  ? "border-accent/45 bg-accent-soft text-accent-deep"
                                  : "border-line bg-white text-ink-2 hover:border-accent/40 hover:text-ink",
                              )}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-line bg-tint px-3 py-2.5" data-testid="industry-examples">
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <span className="text-[12.5px] font-semibold text-ink-2">
                        사업분야 예시 <span className="text-faint">· {exampleLabel}</span>
                      </span>
                      <span className="text-[11.5px] text-faint">누르면 입력란에 들어갑니다</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {examples.map((text) => (
                        <button
                          key={text}
                          type="button"
                          data-testid="industry-example"
                          onClick={() => insertExample(text)}
                          title="입력란에 넣기"
                          className="max-w-full rounded-lg border border-line bg-white px-2 py-1 text-left text-[12.5px] leading-snug text-ink-2 transition-colors hover:border-accent/50 hover:bg-accent-soft"
                        >
                          <span className="line-clamp-1">{text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-row" data-testid="situation-tags">
                <RowLabel no="03" title="기업 상황" note="최대 3개 · 순서가 중요도" />
                <div className="form-body">
                  <div className="space-y-2">
                    {SITUATION_GROUPS.map((group) => (
                      <div key={group.label}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{group.label}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {group.ids.map((id) => {
                            const tag = SITUATIONS.find((t) => t.id === id);
                            if (!tag) return null;
                            const active = value.situations.includes(id);
                            return (
                              <button
                                key={id}
                                type="button"
                                data-testid={`situation-tag-${id}`}
                                aria-pressed={active}
                                title={tag.hint}
                                onClick={() => toggleSituation(id)}
                                className={cx(
                                  "rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold transition-colors",
                                  active
                                    ? "border-accent/45 bg-accent-soft text-accent-deep"
                                    : "border-line bg-white text-ink-2 hover:border-accent/40 hover:text-ink",
                                )}
                              >
                                {tag.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {value.situations.length > 0 && (
                    <ul className="mt-2 border-t border-line pt-2">
                      {value.situations.map((id) => {
                        const tag = getSituation(id);
                        if (!tag) return null;
                        return (
                          <li key={id} className="flex gap-2 py-0.5 text-[12px] leading-relaxed text-muted">
                            <span className="mt-[6px] h-1 w-1 shrink-0 bg-accent" />
                            <span>
                              <span className="font-semibold text-ink-2">{tag.label}</span> — {tag.hint}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <input
                    value={value.situationNote}
                    onChange={(e) => onChange({ ...value, situationNote: e.target.value })}
                    placeholder="직접 입력 (선택) — 예: 투자사 요청으로 확인 중, 사내 제보 1건 접수"
                    aria-label="기업 상황 직접 입력"
                    data-testid="situation-note"
                    maxLength={300}
                    className="field mt-2 h-8 text-[12.5px]"
                  />
                </div>
              </div>

              <div className="form-row">
                <RowLabel no="04" title="기업 유형" note="첫 선택이 대표 유형" />
                <div className="form-body">
                  <div className="flex flex-wrap gap-1.5">
                    {ENTITY_PROFILES.map((p) => {
                      const Icon = ENTITY_ICON[p.id];
                      const active = value.entities.includes(p.id);
                      const primary = value.entities[0] === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          data-testid={`entity-${p.id}`}
                          aria-pressed={active}
                          onClick={() => toggleEntity(p.id)}
                          className={cx(
                            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold transition-colors",
                            active
                              ? "border-accent bg-accent text-white shadow-[0_1px_2px_rgba(29,78,216,0.3)]"
                              : "border-line bg-white text-ink-2 hover:border-accent/40 hover:text-ink",
                          )}
                        >
                          <Icon size={12} className={active ? "opacity-90" : "opacity-60"} />
                          {p.label}
                          {primary && value.entities.length > 1 && (
                            <span className="bg-white/20 px-1 py-[1px] text-[11px] font-semibold">대표</span>
                          )}
                          {active && <Check size={11} className="opacity-80" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">
                    <span className="font-semibold text-ink-2">{selectedProfile.short}</span> · {selectedProfile.tagline}
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-line bg-tint px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={value.brand}
                onChange={(e) => onChange({ ...value, brand: e.target.value })}
                placeholder="브랜드명 (선택)"
                aria-label="브랜드명"
                className="field h-8 w-[150px] shrink-0 text-[13px]"
              />
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className={cx("btn btn-ghost h-8 px-2 text-[12.5px]", showAdvanced ? "text-ink" : "text-muted")}
              >
                <ClipboardList size={12} /> {showAdvanced ? "추가 입력 닫기" : "파일·추가 입력"}
              </button>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onReviewMode(!reviewMode)}
                  className={cx(
                    "btn h-8 px-2.5 text-[12.5px]",
                    reviewMode ? "bg-accent text-white" : "btn-ghost text-muted hover:text-ink",
                  )}
                >
                  <ShieldCheck size={12} /> 기존 입장문 검수
                </button>
              </div>
            </div>
            {showAdvanced && (
              <div className="mt-2 border-t border-line pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-outline h-8 px-2.5 text-[13px]">
                    <Paperclip size={12} /> .txt/.md 첨부
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    className="hidden"
                    data-testid="file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void readFile(file);
                      e.target.value = "";
                    }}
                  />
                  {value.situation.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...value, situation: "" })}
                      className="btn btn-ghost h-8 px-2 text-[13px] text-muted hover:text-risk"
                    >
                      <Trash2 size={12} /> 입력 비우기
                    </button>
                  )}
                  <span className="num text-[12px] text-faint">{value.situation.trim().length.toLocaleString()}자</span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                  브랜드명을 비우면 “당사”로 씁니다. 입력은 분석에만 쓰이고 서버에 저장하지 않습니다.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── STEP 2 ── */}
        <section className="sheet mt-4 overflow-hidden" data-testid="step-stance">
          <StepHead no="2" step="STEP 2 / 03" title="대응 스탠스 선택" note="하나를 고르면 문안·전략이 전부 달라집니다" />
          <div className="px-4 py-4 sm:px-5">
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="우리 입장">
              {STANCES.map((s) => {
                const active = value.stance === s.id;
                const custom = s.id === "custom";
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`stance-${s.id}`}
                    title={`${s.bestFor} / 주의: ${s.caution}`}
                    onClick={() => onChange({ ...value, stance: s.id })}
                    className={cx(
                      "rounded-xl border px-3 py-2.5 text-left transition-all",
                      custom && "sm:col-span-3",
                      active
                        ? "border-accent bg-accent text-white shadow-[0_4px_14px_-6px_rgba(29,78,216,0.55)]"
                        : "border-line bg-white text-ink-2 hover:border-accent/40 hover:shadow-[0_2px_10px_-6px_rgba(15,23,42,0.2)]",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-bold">
                      <span className="h-1.5 w-1.5" style={{ background: active ? "#fff" : s.accent }} />
                      {s.label}
                      {custom && !active && (
                        <span className="ml-1 border border-line px-1.5 py-[1px] text-[11px] font-medium text-muted">
                          현장 판단
                        </span>
                      )}
                      {active && <Check size={12} className="ml-auto opacity-80" />}
                    </span>
                    <span className={cx("mt-1 block text-[12px] leading-snug", active ? "text-white/70" : "text-muted")}>
                      {s.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {value.stance === "custom" && (
              <div className="mt-2 rounded-xl border border-line bg-tint px-3 py-2.5" data-testid="custom-stance-box">
                <label className="block text-[12.5px] font-semibold text-ink-2" htmlFor="stance-custom">
                  우리 입장을 한 줄로
                </label>
                <textarea
                  id="stance-custom"
                  data-testid="custom-stance-input"
                  value={value.stanceCustom}
                  onChange={(e) => onChange({ ...value, stanceCustom: e.target.value })}
                  rows={2}
                  maxLength={200}
                  placeholder="예: 사실관계는 인정하되 형사 책임은 부인하고, 피해 고객 보상과 재발 방지부터 진행한다."
                  className="field mt-1.5 resize-y text-[13px] leading-relaxed"
                />
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  이 문장이 문안 첫 문단과 톤의 기준이 됩니다. ‘무엇을 인정하고 무엇을 부인하는지’를 넣으면 정확해집니다.
                </p>
              </div>
            )}

            {/* 스탠스 비교표 — 고르는 상황과 감수할 위험을 같은 축에 놓습니다 */}
            <div className="mt-3 hidden overflow-hidden rounded-xl border border-line md:block">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th className="w-[24%]">스탠스</th>
                    <th className="w-[36%]">고르는 상황</th>
                    <th className="w-[32%]">감수할 위험</th>
                    <th className="w-[8%] text-center">선택</th>
                  </tr>
                </thead>
                <tbody>
                  {stanceRows.map((s) => {
                    const active = value.stance === s.id;
                    return (
                      <tr
                        key={s.id}
                        data-testid={`cmp-${s.id}`}
                        onClick={() => onChange({ ...value, stance: s.id })}
                        className={cx("cursor-pointer align-top", active ? "bg-accent-soft/60" : "hover:bg-tint")}
                      >
                        <td className="font-semibold text-ink">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 shrink-0" style={{ background: s.accent }} />
                            {s.label}
                          </span>
                        </td>
                        <td className="text-muted">{s.bestFor}</td>
                        <td className="text-warn">{s.caution}</td>
                        <td className="text-center">
                          {active ? (
                            <span className="num text-[11.5px] font-bold text-accent">선택됨</span>
                          ) : (
                            <span className="text-[11.5px] text-faint">선택</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-2 border-t border-line pt-2 text-[12px] leading-relaxed text-muted" data-testid="active-stance-note">
              <span className="font-semibold text-ink">현재 선택 — {activeStance.label}</span>
              {value.stance === "custom" && value.stanceCustom.trim() ? ` “${value.stanceCustom.trim()}”` : ""}
              <span className="block">
                고르는 상황: {activeStance.bestFor}
                <span className="block text-warn">주의: {activeStance.caution}</span>
              </span>
            </p>
          </div>
        </section>

        {/* ── STEP 3 ── */}
        <section className="sheet mt-4 overflow-hidden" data-testid="step-output">
          <StepHead no="3" step="STEP 3 / 03" title="실행 문안 · 임원 보고서" note="생성 즉시 복사·내보내기" />
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="px-4 py-3.5 sm:px-5">
              <div className="eyebrow">4채널 실행 문안</div>
              <ul className="mt-2 border-t border-line-strong">
                {[
                  { n: "①", t: "공식 입장문 · 보도자료", d: "대외 배포용 2종 — 제목·리드·본문" },
                  { n: "②", t: "기자 Q&A · 방어 논리", d: "예상 질문과 답변, 피할 말" },
                  { n: "③", t: "사내 임직원 공지", d: "할 일·하지 말 말·예상 질문", pro: true },
                  { n: "④", t: "SNS 공지 · 댓글 대응", d: "짧은 공지, 고정 댓글, 답글 가이드", pro: true },
                ].map((row, i) => (
                  <li
                    key={row.n}
                    className={cx("flex items-start gap-2.5 py-2", i > 0 && "border-t border-line")}
                  >
                    <span className="num pt-[1px] text-[12px] font-semibold text-faint">{row.n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-ink">{row.t}</span>
                      <span className="block text-[12px] leading-snug text-muted">{row.d}</span>
                    </span>
                    <span
                      className={cx(
                        "chip shrink-0 px-1.5 text-[11px]",
                        row.pro ? "border border-line bg-paper-deep text-muted" : "border border-ok/30 bg-ok-soft text-ok",
                      )}
                    >
                      {row.pro ? "Pro" : "포함"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-line px-4 py-3.5 sm:px-5 lg:border-l lg:border-t-0">
              <div className="eyebrow">임원 보고서</div>
              <ul className="mt-2 border-t border-line-strong">
                {[
                  { t: "Word(.doc) · PDF · Markdown", d: "브랜드명·일시·위험지수 머리말 포함" },
                  { t: "7축 위험 스코어카드 요약", d: "보고 첫 장에 붙는 표" },
                  { t: "임원·법무 공유 브리핑 링크", d: "열람 전용 페이지 · 로그인 불필요" },
                ].map((row, i) => (
                  <li key={row.t} className={cx("py-2", i > 0 && "border-t border-line")}>
                    <span className="block text-[13px] font-semibold text-ink">{row.t}</span>
                    <span className="block text-[12px] leading-snug text-muted">{row.d}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => openPricing()}
                className="mt-1.5 text-[12px] font-semibold text-accent hover:underline"
              >
                현재 플랜: {planBadge(plan)} — 플랜별 포함 범위 보기 →
              </button>
            </div>
          </div>

          <div className="border-t border-line bg-tint px-4 py-4 sm:px-5">
            <button
              type="button"
              disabled={tooShort}
              onClick={onSubmit}
              data-testid="submit"
              className={cx(
                "btn w-full py-3.5 text-[14px]",
                tooShort
                  ? "cursor-not-allowed border border-line bg-tint-2 text-faint"
                  : "btn-accent",
              )}
            >
              {reviewMode ? <ShieldCheck size={15} /> : <Sparkles size={15} />}
              {reviewMode ? "입장문 위험 표현 검수하기" : "대응 패키지 생성"}
              <span className="ml-1 hidden text-[12px] opacity-60 sm:inline">⌘/Ctrl + Enter</span>
            </button>
            <p className="mt-2 text-center text-[12px] leading-relaxed text-muted">
              확인되지 않은 사실은 만들지 않습니다. <span className="font-semibold text-ink-2">[확인 필요]</span> 표시만
              실제 값으로 바꾸면 그대로 배포할 수 있습니다.
            </p>
          </div>
        </section>

        {recent.length > 0 && (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-2 pb-2">
              <div>
                <div className="eyebrow">최근 만든 패키지</div>
                <h2 className="mt-1 text-[14px] font-bold text-ink">이 브라우저에 남은 대응 기록</h2>
              </div>
              <button
                type="button"
                onClick={onOpenHistory}
                data-testid="open-history-compose"
                className="btn btn-outline h-7 px-2 text-[12px]"
              >
                <History size={11} /> 기록 {historyCount}건 · 비교
              </button>
            </div>
            <ul className="mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-card">
              {recent.slice(0, 4).map((pkg) => (
                <li key={pkg.id} className="group flex items-center gap-2 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-tint">
                  <button
                    type="button"
                    data-testid="recent-item"
                    onClick={() => onOpenRecent(pkg)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <Copy size={12} className="shrink-0 text-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink-2">{pkg.headline}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-faint">
                        {pkg.brand} · {pkg.statements[0]?.title ?? pkg.situation.slice(0, 40)}
                      </span>
                    </span>
                    <ArrowRight size={12} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveRecent(pkg.id)}
                    className="p-1 text-faint opacity-0 transition-opacity hover:text-risk group-hover:opacity-100"
                    aria-label="최근 기록 삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recent.length === 0 && historyCount > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2.5 shadow-card">
            <span className="text-[12.5px] text-muted">저장된 시뮬레이션 기록이 있습니다. 같은 상황의 다른 입장과 비교해 보세요.</span>
            <button type="button" onClick={onOpenHistory} className="btn btn-outline h-7 px-2 text-[12px]">
              <History size={11} /> 기록 {historyCount}건
            </button>
          </div>
        )}

        <p className="mt-8 border-t border-line pt-3 text-[12px] leading-relaxed text-faint">
          PRISM은 기업 홍보팀·PR 대행사를 위한 위기 대응 워크스페이스입니다. 입력한 내용은 분석에만 쓰이고 서버에
          저장하지 않으며, 대응 기록은 이 브라우저에만 남습니다.
        </p>
      </main>
    </div>
  );
}
