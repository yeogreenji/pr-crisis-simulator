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
import { STANCES, extractUrl, getStance, type ResponsePackage, type Stance, type CompanyScale, type ProtocolStage } from "../lib/package";
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

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-20 pt-5 sm:px-6 sm:pt-9">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-[11px] font-bold tracking-tight text-white">
            PR
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-[0.18em] text-ink">PRISM</div>
            <div className="mt-0.5 hidden font-mono text-[10px] uppercase tracking-[0.14em] text-faint sm:block">Executive PR command center</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => openPricing()}
            data-testid="plan-badge"
            title="요금제 보기"
            className="btn btn-outline h-8 px-2 text-[12px]"
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
          <span className="mx-0.5 hidden h-4 w-px bg-line sm:block" />
          <button
            type="button"
            onClick={onOpenManual}
            className="btn btn-ghost h-8 px-2.5 text-[13px] text-muted hover:text-ink"
          >
            <BookOpen size={13} /> <span className="hidden sm:inline">참고 매뉴얼</span>
          </button>
          <button
            type="button"
            onClick={onOpenLibrary}
            data-testid="open-library"
            className="btn btn-outline h-8 px-2.5 text-[13px] text-ink"
          >
            <Library size={13} /> <span className="hidden sm:inline">사례 라이브러리</span><span className="sm:hidden">사례</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn btn-ghost h-8 px-2.5 text-[13px] text-muted hover:text-ink"
            aria-label="AI 설정"
          >
            <Settings2 size={13} />
            <span className="hidden sm:inline">AI 설정</span>
          </button>
        </div>
      </div>

      <div className="mt-9 text-center sm:mt-12">
        <div className="flex items-center justify-center gap-2">
          <span className="h-px w-7 bg-line-strong" />
          <div className="eyebrow">Crisis response · one input</div>
          <span className="h-px w-7 bg-line-strong" />
        </div>
        <h1 className="display mx-auto mt-4 max-w-[720px] text-[29px] leading-[1.24] tracking-[-0.035em] text-ink sm:text-[43px]">
          상황 한 줄이면,
          <br className="sm:hidden" /> 임원 보고까지 한 번에.
        </h1>
        <p className="mx-auto mt-3 max-w-[560px] text-[13.5px] leading-relaxed text-muted">
          기사 URL이나 상황을 넣고 우리 입장을 고르세요. 4채널 문안·7축 위험 스코어카드·골든타임
          체크리스트가 한 화면에 나오고, 그대로 임원 보고서와 법무 공유 링크가 됩니다.
        </p>
        <div className="mx-auto mt-5 flex max-w-[640px] flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-y border-line py-2 text-[11.5px] text-muted">
          {["4채널 실행 문안", "7축 위험 스코어카드", "임원 보고서 Word·PDF", "임원·법무 공유 링크"].map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <Check size={11} className="text-ok" />
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="card mt-7 overflow-hidden sm:mt-9">
        <div className="px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              {reviewMode ? <FileText size={13} /> : <AlertTriangle size={13} className="text-warn" />}
              {reviewMode ? "검수할 기존 입장문" : "위기 상황 또는 기사 URL"}
            </span>
            <span className="chip border border-line bg-paper-deep text-[12px] text-muted">
              {reviewMode ? "검수 모드" : "URL 읽기"}
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
            className="field mt-2.5 resize-y text-[13px] leading-[1.7] sm:text-[13.5px]"
            placeholder={
              reviewMode
                ? "지금 올릴 예정인 입장문·보도자료 전문을 붙여넣으세요. 위험 표현과 빠진 요소를 짚어 드립니다."
                : "가격 인상 이슈\n\n또는 상황을 한 줄로: ‘넷플릭스가 구독료를 올린다는 보도가 나갔고, 커뮤니티에 해지 인증이 확산 중입니다.’\n\n또는  https://news.example.com/article/12345"
            }
          />
          {!reviewMode && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-accent-deep">
              <Sparkles size={11} className="mt-[3px] shrink-0" />
              <span>
                <span className="font-semibold">짧게 입력해도 AI가 쟁점을 자동 확장합니다.</span>{" "}
                ‘가격 인상’처럼 2~6단어만 넣어도 소비자 반발·명분·커뮤니티·경쟁사·언론 포인트로 먼저 나눠
                매뉴얼을 만듭니다.
              </span>
            </p>
          )}
          {url && !reviewMode && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-accent/20 bg-accent-soft px-2.5 py-2">
              <Link2 size={12} className="mt-[2px] shrink-0 text-accent" />
              <div className="min-w-0 text-[12.5px] leading-relaxed text-accent-deep">
                <span className="font-semibold">기사 본문을 서버가 직접 읽습니다.</span>{" "}
                <span className="break-all opacity-80">{url.slice(0, 90)}</span>
                {urlOnly && <span className="mt-0.5 block text-accent-deep/70">URL만으로 분석합니다. 읽지 못하면 붙여넣기로 안내드립니다.</span>}
              </div>
            </div>
          )}
          {error && (
            <div className="mt-2 rounded-lg border border-risk/25 bg-risk-soft px-2.5 py-2 text-[12.5px] leading-relaxed text-risk">
              <div className="flex items-start gap-2">
                <AlertTriangle size={12} className="mt-[2px] shrink-0" />
                <span>{error}</span>
              </div>
              {fallbackOffer && (
                <div className="mt-1.5 border-t border-risk/15 pt-1.5">
                  <button
                    type="button"
                    onClick={onFallbackOffer}
                    data-testid="fallback-without-article"
                    className="btn btn-outline h-7 border-risk/30 px-2 text-[12px] text-ink-2"
                  >
                    기사 본문 없이 지금 분석 계속
                  </button>
                  <span className="ml-2 text-[11.5px] text-risk/80">URL 주소만 가진 맥락으로 매뉴얼 결과를 바로 만듭니다.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {!reviewMode && (
          <>
            <div className="hairline" />
            <div className="px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink">우리 입장</span>
                <span className="text-[12px] text-faint">하나를 고르면 문안·전략이 완전히 달라집니다</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="우리 입장">
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
                          ? "border-ink bg-ink text-white shadow-[0_10px_24px_-16px_rgba(16,19,25,0.9)]"
                          : "border-line-strong bg-[#fcfcfa] text-ink-2 hover:border-ink/30 hover:bg-white",
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: active ? "#fff" : s.accent }}
                        />
                        {s.label}
                        {custom && !active && (
                          <span className="ml-1 rounded-full border border-line px-1.5 py-[1px] text-[11px] font-medium text-faint">
                            현장 판단
                          </span>
                        )}
                      </span>
                      <span className={cx("mt-1 block text-[12px] leading-snug", active ? "text-white/70" : "text-muted")}>
                        {s.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              {value.stance === "custom" && (
                <div className="mt-2 rounded-xl border border-line-strong bg-white px-3 py-2.5" data-testid="custom-stance-box">
                  <label className="block text-[12.5px] font-medium text-ink-2" htmlFor="stance-custom">
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
                  <p className="mt-1 text-[12px] leading-relaxed text-faint">
                    이 문장이 문안 첫 문단과 톤의 기준이 됩니다. ‘무엇을 인정하고 무엇을 부인하는지’를 넣으면 정확해집니다.
                  </p>
                </div>
              )}
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted" data-testid="active-stance-note">
                <span className="font-semibold text-ink-2">{activeStance.label}</span>
                {value.stance === "custom" && value.stanceCustom.trim() ? ` — “${value.stanceCustom.trim()}”` : ""} — 고르는 상황:{" "}
                {activeStance.bestFor}
                <span className="block text-warn">주의: {activeStance.caution}</span>
              </p>
            </div>

            <div className="hairline" />
            <div className="px-4 py-4 sm:px-5" data-testid="classify-row">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[13px] font-semibold text-ink">업종·이슈 유형</span>
                <span className="text-[12px] text-faint">비워 두면 자동 판별 · 잘못 잡히면 직접 고르세요</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-line-strong bg-[#fcfcfa] px-2.5 py-2">
                  <span className="shrink-0 text-[12.5px] font-medium text-muted">업종</span>
                  <select
                    value={value.industry}
                    onChange={(e) => onChange({ ...value, industry: e.target.value as IndustryId | "auto" })}
                    data-testid="industry-select"
                    aria-label="업종 선택"
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink outline-none"
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
                <label className="flex items-center gap-2 rounded-xl border border-line-strong bg-[#fcfcfa] px-2.5 py-2">
                  <span className="shrink-0 text-[12.5px] font-medium text-muted">이슈 유형</span>
                  <select
                    value={value.caseType}
                    onChange={(e) => onChange({ ...value, caseType: e.target.value as CaseType | "auto" })}
                    data-testid="type-select"
                    aria-label="이슈 유형 선택"
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink outline-none"
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
              {value.caseType !== "auto" && (
                <p className="mt-1.5 text-[12px] leading-relaxed text-accent-deep">
                  직접 고른 유형으로 유사 사례·대응 순서·표준 프로토콜을 계산합니다. 업종도 함께 맞춰 주세요.
                </p>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-medium text-muted">현재 단계</span>
                    <span className="text-[11.5px] text-faint">체크리스트 순서가 달라집니다</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
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
                            "rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                            active
                              ? "border-ink bg-ink text-white"
                              : "border-line-strong bg-white text-ink-2 hover:border-ink/30",
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
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-medium text-muted">기업 규모</span>
                    <span className="text-[11.5px] text-faint">이해관계자 접점 보정</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
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
                            "rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                            active
                              ? "border-accent bg-accent-soft text-accent-deep"
                              : "border-line-strong bg-white text-ink-2 hover:border-ink/30",
                          )}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-line bg-[#fbfbf8] px-3 py-2.5" data-testid="industry-examples">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-[12.5px] font-medium text-ink-2">
                    사업분야 예시 <span className="text-faint">· {exampleLabel}</span>
                  </span>
                  <span className="text-[11.5px] text-faint">누르면 입력란에 들어갑니다</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {examples.map((text) => (
                    <button
                      key={text}
                      type="button"
                      data-testid="industry-example"
                      onClick={() => insertExample(text)}
                      title="입력란에 넣기"
                      className="max-w-full rounded-lg border border-line-strong bg-white px-2 py-1 text-left text-[12px] leading-snug text-ink-2 transition-colors hover:border-ink/40 hover:bg-accent-soft"
                    >
                      <span className="line-clamp-1">{text}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
                  업종을 직접 고르면 그 분야 예시로 바뀝니다. 숫자·기관은 실제 사안에 맞게 고쳐 쓰세요.
                </p>
              </div>
            </div>

            <div className="hairline" />
            <div className="px-4 py-4 sm:px-5" data-testid="situation-tags">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[13px] font-semibold text-ink">기업 상황</span>
                <span className="text-[12px] text-faint">최대 3개 · 순서와 이해관계자가 달라집니다</span>
              </div>
              <div className="mt-2 space-y-2">
                {SITUATION_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="text-[11.5px] font-medium uppercase tracking-wide text-faint">{group.label}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
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
                              "rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                              active
                                ? "border-accent bg-accent-soft text-accent-deep"
                                : "border-line-strong bg-white text-ink-2 hover:border-ink/30",
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
                <ul className="mt-2 space-y-1">
                  {value.situations.map((id) => {
                    const tag = getSituation(id);
                    if (!tag) return null;
                    return (
                      <li key={id} className="flex gap-1.5 text-[12px] leading-relaxed text-muted">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                        <span>
                          <span className="font-medium text-ink-2">{tag.label}</span> — {tag.hint}
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

            <div className="hairline" />
            <div className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[13px] font-semibold text-ink">기업 유형</span>
                <span className="text-[12px] text-faint">최대 3개 · 첫 선택이 대표 유형</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
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
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                        active
                          ? "border-ink bg-ink text-white"
                          : "border-line-strong bg-white text-ink-2 hover:border-ink/30",
                      )}
                    >
                      <Icon size={12} className={active ? "opacity-90" : "opacity-60"} />
                      {p.label}
                      {primary && value.entities.length > 1 && (
                        <span className="rounded-full bg-white/20 px-1 py-[1px] text-[11px] font-semibold">대표</span>
                      )}
                      {active && <Check size={11} className="opacity-80" />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                <span className="font-semibold text-ink-2">{selectedProfile.short}</span> · {selectedProfile.tagline}
              </p>
            </div>
          </>
        )}

        <div className="hairline" />
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
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
            <ClipboardList size={12} /> {showAdvanced ? "추가 입력 닫기" : "추가 입력"}
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => onReviewMode(!reviewMode)}
              className={cx("btn h-8 px-2 text-[12.5px]", reviewMode ? "bg-ink text-white" : "btn-ghost text-muted hover:text-ink")}
            >
              <ShieldCheck size={12} /> 기존 입장문 검수
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div className="border-t border-line bg-[#fcfcfa] px-4 py-3 sm:px-5">
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
              <span className="text-[12px] text-faint">{value.situation.trim().length.toLocaleString()}자</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-faint">
              브랜드명을 비우면 “당사”로 씁니다. 입력은 분석에만 쓰이고 서버에 저장하지 않습니다.
            </p>
          </div>
        )}

        <div className="border-t border-line px-4 py-4 sm:px-5">
          <button
            type="button"
            disabled={tooShort}
            onClick={onSubmit}
            data-testid="submit"
            className={cx(
              "btn w-full py-3 text-[13px]",
              tooShort ? "cursor-not-allowed border border-accent/25 bg-accent-soft text-accent-deep/70" : "btn-accent",
            )}
          >
            {reviewMode ? <ShieldCheck size={15} /> : <Sparkles size={15} />}
            {reviewMode ? "입장문 위험 표현 검수하기" : "바로 대응 패키지 만들기"}
            <span className="ml-1 hidden text-[12px] opacity-60 sm:inline">⌘/Ctrl + Enter</span>
          </button>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-faint">
            <span className="inline-flex items-center gap-1">
              <span className={cx("h-1.5 w-1.5 rounded-full", aiReady ? "bg-ok" : "bg-faint")} />
              {aiReady ? "실시간 AI 연결" : "매뉴얼 엔진 모드"}
            </span>
            <span className="hidden sm:inline">·</span>
            <span>{aiNote}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          { n: "01", t: "상황 넣기", d: "한 줄 설명 또는 기사 URL" },
          { n: "02", t: "대안·상황 선택", d: "사과·사실 적시·보상·무대응·반박" },
          { n: "03", t: "그대로 복사", d: "입장문·답변·체크리스트" },
        ].map((s) => (
          <div key={s.n} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface/70 px-3 py-2.5">
            <span className="num text-[12px] font-semibold text-faint">{s.n}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink-2">{s.t}</div>
              <div className="text-[12px] text-muted">{s.d}</div>
            </div>
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <div className="mt-7">
          <div className="flex items-center justify-between">
            <span className="eyebrow">최근 만든 패키지</span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-faint">이 브라우저에만 저장</span>
              <button
                type="button"
                onClick={onOpenHistory}
                data-testid="open-history-compose"
                className="btn btn-outline h-7 px-2 text-[12px]"
              >
                <History size={11} /> 기록 {historyCount}건 · 비교
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            {recent.slice(0, 4).map((pkg) => (
              <div key={pkg.id} className="group flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
                <button
                  type="button"
                  data-testid="recent-item"
                  onClick={() => onOpenRecent(pkg)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <Copy size={12} className="shrink-0 text-faint" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink-2">{pkg.headline}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-faint">
                      {pkg.brand} · {pkg.statements[0]?.title ?? pkg.situation.slice(0, 40)}
                    </span>
                  </span>
                  <ArrowRight size={12} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRecent(pkg.id)}
                  className="rounded p-1 text-faint opacity-0 transition-opacity hover:text-risk group-hover:opacity-100"
                  aria-label="최근 기록 삭제"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {recent.length === 0 && historyCount > 0 && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2">
          <span className="text-[12.5px] text-muted">저장된 시뮬레이션 기록이 있습니다. 같은 상황의 다른 입장과 비교해 보세요.</span>
          <button type="button" onClick={onOpenHistory} className="btn btn-outline h-7 px-2 text-[12px]">
            <History size={11} /> 기록 {historyCount}건
          </button>
        </div>
      )}

      <p className="mt-8 text-center text-[12px] leading-relaxed text-faint">
        PRISM은 확인되지 않은 사실을 만들지 않습니다. <span className="text-muted">[확인 필요]</span> 표시만 실제 값으로
        바꾸면 그대로 배포할 수 있습니다.
      </p>
    </div>
  );
}
