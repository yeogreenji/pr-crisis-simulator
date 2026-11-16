import { MEDIA_DESKS, type MediaDesk } from "../lib/mediaDesks";
import { ArrowUpRight, Check, ChevronDown, Loader2, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import type { ChannelId, IndustryId, IssueCategoryId, Preset } from "../types";
import { CHANNELS, ISSUE_CATEGORIES, PRESETS } from "../lib/presets";
import { getIndustry } from "../lib/industries";
import { IndustrySelector } from "./IndustrySelector";
import { Card, Eyebrow, cx } from "./ui";

const RUN_STEPS = ["초안 문장 분해", "기자 시각 생성", "채널 톤 추정", "리스크 스코어 산정"];

export function InputPanel({
  desk,
  onDesk,
  scenario,
  onScenario,
  draft,
  onDraft,
  brand,
  onBrand,
  issue,
  onIssue,
  industry,
  onIndustry,
  channels,
  onToggleChannel,
  onPreset,
  running,
  step,
  onRun,
  stale,
  apiEnabled,
  onOpenApi,
  activePresetId,
  onOpenPlaybook,
}: {
  desk: MediaDesk | "";
  onDesk: (value: MediaDesk | "") => void;
  scenario: string;
  onScenario: (value: string) => void;
  draft: string;
  onDraft: (v: string) => void;
  brand: string;
  onBrand: (v: string) => void;
  issue: IssueCategoryId;
  onIssue: (v: IssueCategoryId) => void;
  industry: IndustryId;
  onIndustry: (v: IndustryId) => void;
  channels: ChannelId[];
  onToggleChannel: (id: ChannelId) => void;
  onPreset: (p: Preset) => void;
  running: boolean;
  step: number;
  onRun: () => void;
  stale: boolean;
  apiEnabled: boolean;
  onOpenApi: () => void;
  activePresetId: string | null;
  onOpenPlaybook?: (id: IndustryId) => void;
}) {
  const chars = draft.trim().length;
  const sortedPresets = [...PRESETS].sort((a, b) => {
    const ai = a.industry === industry ? 0 : 1;
    const bi = b.industry === industry ? 0 : 1;
    return ai - bi;
  });

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative border-b border-line px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow>시뮬레이터</Eyebrow>
            <h2 className="mt-1 text-[14px] font-semibold tracking-[-0.02em]">사건과 대응 문안</h2>
          </div>
          <div className="num text-right text-[10.5px] leading-tight text-faint">
            <div>{chars.toLocaleString()}자</div>
            <div className="text-[9.5px]">{draft.trim() ? `${Math.max(1, draft.split(/[.!?]\s|\n/).filter((s) => s.trim()).length)}문장` : "비어 있음"}</div>
          </div>
        </div>
        {running && (
          <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-accent-soft">
            <div
              className="h-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${((step + 1) / RUN_STEPS.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <label className="block text-xs font-semibold">어떤 사건인가요?<textarea className="field mt-1 p-2 text-sm" rows={3} maxLength={2000} value={scenario} onChange={(event) => onScenario(event.target.value)} placeholder="발생 경위, 피해 범위, 확인된 사실, 들어온 문의를 적으세요." /></label>
        <p className="text-xs text-muted">사건만 입력하면 예상 질문을 확인할 수 있습니다. 입장문을 추가하면 문장 위험도도 검토합니다.</p>
        <IndustrySelector value={industry} onChange={onIndustry} onOpenPlaybook={onOpenPlaybook} />

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-ink-2">브랜드</span>
            <input
              className="field px-2.5 py-2 text-[12.5px]"
              value={brand}
              onChange={(e) => onBrand(e.target.value)}
              placeholder="회사·제품명"
              maxLength={24}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-ink-2">이슈 유형</span>
            <span className="relative block">
              <select
                className="field appearance-none px-2.5 py-2 pr-7 text-[12.5px]"
                value={issue}
                onChange={(e) => onIssue(e.target.value as IssueCategoryId)}
              >
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint" />
            </span>
          </label>
        </div>

        <label className="block text-xs font-semibold">기자 담당 데스크 (선택)
          <select className="field mt-1 p-2 text-sm" value={desk} onChange={(event) => onDesk(event.target.value as MediaDesk | "")}>
            <option value="">공통 질문</option>
            {Object.keys(MEDIA_DESKS).map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-2">예상 반응을 볼 매체·채널</span>
            <span className="text-[10px] text-faint">{channels.length}개 선택</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => {
              const active = channels.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggleChannel(c.id)}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2 py-[5px] text-[11px] font-medium transition-colors",
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-ink-2 hover:border-line-strong hover:bg-[#fcfcfa]",
                  )}
                >
                  <span
                    className={cx("h-1 w-1 rounded-full", active ? "bg-white/70" : c.kind === "press" ? "bg-info" : c.kind === "social" ? "bg-risk/70" : "bg-warn/80")}
                  />
                  {c.label}
                  {active && <Check size={10} className="opacity-70" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-2">샘플 시나리오</span>
            <span className="text-[10px] text-faint">클릭하면 바로 분석</span>
          </div>
          <div className="space-y-1.5">
            {sortedPresets.map((p, i) => {
              const active = activePresetId === p.id;
              const presetIndustry = getIndustry(p.industry);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPreset(p)}
                  className={cx(
                    "group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
                    active
                      ? "border-accent/35 bg-accent-soft/60"
                      : "border-line bg-[#fcfcfa] hover:border-line-strong hover:bg-white",
                  )}
                >
                  <span
                    className={cx(
                      "num grid h-5 w-5 shrink-0 place-items-center rounded-[5px] text-[9.5px] font-semibold",
                      active ? "bg-accent text-white" : "bg-paper-deep text-muted",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[11.5px] font-semibold text-ink">{p.label}</span>
                      <span
                        className="shrink-0 rounded px-1 py-[1px] text-[8.5px] font-semibold"
                        style={{ background: `${presetIndustry.accent}14`, color: presetIndustry.accent }}
                      >
                        {presetIndustry.short}
                      </span>
                    </span>
                    <span className="block truncate text-[10px] text-muted">
                      {p.brand} · {p.tagline}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={13}
                    className={cx("shrink-0 transition-transform", active ? "text-accent" : "text-faint group-hover:-translate-y-0.5 group-hover:text-ink-2")}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-2">검토할 입장문 (선택)</span>
            {stale && draft.trim() !== "" && (
              <span className="chip bg-warn-soft text-warn">수정됨 · 재분석 필요</span>
            )}
          </div>
          <div>
            <textarea
              maxLength={4000}
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  onRun();
                }
              }}
              placeholder="보도자료·입장문 초안을 붙여넣으세요."
              className="field h-[260px] resize-none px-3 py-2.5 text-[12.5px] leading-[1.9] placeholder:text-[12px]"
              spellCheck={false}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[9.5px] text-faint">
            <span>⌘/Ctrl + Enter로 실행</span>
            <span className="num">{draft.length.toLocaleString()} / 4,000</span>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-line bg-[#fbfbf8] px-4 py-3.5">
        <button
          type="button"
          onClick={onRun}
          disabled={running || (chars > 0 ? chars < 20 : !scenario.trim())}
          className="btn btn-accent h-10 w-full text-[13px]"
        >
          {running ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {RUN_STEPS[Math.min(step, RUN_STEPS.length - 1)]}…
            </>
          ) : (
            <>
              <Sparkles size={15} />
              {stale ? "변경사항 반영해 다시 분석" : "시뮬레이션 실행"}
            </>
          )}
        </button>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenApi}
            className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-muted transition-colors hover:text-ink"
          >
            <Wand2 size={11} />
            {apiEnabled ? "LLM 정밀 분석 켜짐" : "LLM 정밀 분석 (선택)"}
          </button>
          <span className="inline-flex items-center gap-1 text-[10px] text-faint">
            <RotateCcw size={10} />
            API 없이도 동작
          </span>
        </div>
        {chars > 0 && chars < 20 && (
          <p className="text-[10.5px] text-warn">최소 20자 이상 입력해야 분석할 수 있습니다.</p>
        )}
      </div>
    </Card>
  );
}
