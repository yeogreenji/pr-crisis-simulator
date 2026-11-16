import { useRef } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  FilePlus2,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import type { ChannelId, IndustryId, IssueCategoryId, Preset } from "../types";
import { CHANNELS, ISSUE_CATEGORIES, PRESETS } from "../lib/presets";
import { getIndustry } from "../lib/industries";
import { IndustrySelector } from "./IndustrySelector";
import { Card, Eyebrow, cx } from "./ui";

const RUN_STEPS = ["초안 문장 분해", "기자 시각 생성", "채널 톤 추정", "리스크 스코어 산정"];
const MAX_AI_CHARS = 8_000;

export function InputPanel({
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
  aiPending,
  step,
  onRun,
  stale,
  apiEnabled,
  onOpenApi,
  activePresetId,
  onOpenPlaybook,
  onReset,
  onNotice,
}: {
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
  aiPending: boolean;
  step: number;
  onRun: () => void;
  stale: boolean;
  apiEnabled: boolean;
  onOpenApi: () => void;
  activePresetId: string | null;
  onOpenPlaybook?: (id: IndustryId) => void;
  onReset: () => void;
  onNotice: (message: string, tone?: "ok" | "warn" | "err") => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const chars = draft.trim().length;
  const sortedPresets = [...PRESETS].sort((a, b) => {
    const ai = a.industry === industry ? 0 : 1;
    const bi = b.industry === industry ? 0 : 1;
    return ai - bi;
  });

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const raw = await file.text();
      const text = raw.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
      if (text.length < 20) {
        onNotice("파일에 분석할 만한 문장이 없습니다(최소 20자).", "warn");
        return;
      }
      onDraft(text.slice(0, 40_000));
      onNotice(
        text.length > MAX_AI_CHARS
          ? `‘${file.name}’을 불러왔습니다. 8,000자를 넘어 AI는 건너뛰고 로컬로 분석합니다.`
          : `‘${file.name}’을 불러왔습니다. 내용을 확인하고 분석을 실행하세요.`,
        text.length > MAX_AI_CHARS ? "warn" : "ok",
      );
    } catch {
      onNotice("파일을 읽지 못했습니다. .txt 또는 .md 파일인지 확인하세요.", "err");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative border-b border-line px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow>01 · Draft</Eyebrow>
            <h2 className="mt-1 text-[14px] font-semibold tracking-[-0.02em]">내 초안 분석</h2>
          </div>
          <div className="num text-right text-[10.5px] leading-tight text-faint">
            <div>{chars.toLocaleString()}자</div>
            <div className="text-[9.5px]">
              {draft.trim() ? `${Math.max(1, draft.split(/[.!?]\s|\n/).filter((s) => s.trim()).length)}문장` : "비어 있음"}
            </div>
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

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onReset}
            className="btn btn-outline h-9 border-ink/15 bg-white text-[11.5px] text-ink hover:border-ink/30"
            title="에디터를 비우고 새 글을 씁니다"
          >
            <FilePlus2 size={13} /> 새 글 작성
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn btn-outline h-9 border-ink/15 bg-white text-[11.5px] text-ink hover:border-ink/30"
            title=".txt / .md 파일을 불러옵니다"
          >
            <Upload size={13} /> 파일 불러오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => void importFile(e.target.files?.[0])}
            aria-label="초안 파일 선택"
            data-testid="draft-file-input"
          />
        </div>
        <p className="-mt-2 text-[9.5px] leading-relaxed text-faint">
          보도자료·입장문을 그대로 붙여넣거나(Ctrl+V), 파일로 불러오세요. 예시는 아래 ‘예시로 테스트하기’에 있습니다.
        </p>

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

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-2">타깃 채널</span>
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
                    className={cx(
                      "h-1 w-1 rounded-full",
                      active ? "bg-white/70" : c.kind === "press" ? "bg-info" : c.kind === "social" ? "bg-risk/70" : "bg-warn/80",
                    )}
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
            <span className="text-[11px] font-semibold text-ink-2">초안 본문</span>
            {stale && draft.trim() !== "" && <span className="chip bg-warn-soft text-warn">수정됨 · 재분석 필요</span>}
          </div>
          <textarea
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onRun();
              }
            }}
            placeholder="보도자료·입장문 초안을 그대로 붙여넣으세요. 예: 고객 여러분께 알려드립니다…"
            className="field h-[224px] resize-none px-3 py-2.5 text-[12.5px] leading-[1.9] placeholder:text-[12px]"
            spellCheck={false}
          />
          <div className="mt-1 flex items-center justify-between text-[9.5px] text-faint">
            <span>⌘/Ctrl + Enter로 실행</span>
            <span className={cx("num", draft.length > MAX_AI_CHARS && "text-warn")}>
              {draft.length.toLocaleString()} / {MAX_AI_CHARS.toLocaleString()}
            </span>
          </div>
          {draft.length > MAX_AI_CHARS && (
            <p className="mt-1 text-[10px] leading-relaxed text-warn">
              8,000자를 넘으면 실시간 AI는 건너뛰고 로컬 규칙으로만 분석합니다.
            </p>
          )}
        </div>

        <details className="group rounded-lg border border-line bg-[#fcfcfa]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
            <Sparkles size={12} className="text-accent" />
            <span className="text-[11px] font-semibold text-ink-2">예시로 테스트하기</span>
            <span className="chip bg-paper-deep px-1.5 py-0 text-[9px] text-muted">6개 업종</span>
            <ChevronDown size={12} className="ml-auto text-faint transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-1.5 border-t border-line p-2">
            {sortedPresets.map((p) => {
              const active = activePresetId === p.id;
              const presetIndustry = getIndustry(p.industry);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPreset(p)}
                  className={cx(
                    "group/item flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
                    active
                      ? "border-accent/35 bg-accent-soft/60"
                      : "border-line bg-white hover:border-line-strong",
                  )}
                >
                  <span
                    className="shrink-0 rounded px-1 py-[1px] text-[8.5px] font-semibold"
                    style={{ background: `${presetIndustry.accent}14`, color: presetIndustry.accent }}
                  >
                    {presetIndustry.short}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-ink">{p.label}</span>
                    <span className="block truncate text-[9.5px] text-muted">
                      {p.brand} · {p.tagline}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={12}
                    className={cx(
                      "shrink-0 transition-transform",
                      active ? "text-accent" : "text-faint group-hover/item:-translate-y-0.5 group-hover/item:text-ink-2",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </details>
      </div>

      <div className="space-y-2 border-t border-line bg-[#fbfbf8] px-4 py-3.5">
        <button
          type="button"
          onClick={onRun}
          disabled={running || aiPending || chars < 20}
          className="btn btn-accent h-10 w-full text-[13px]"
        >
          {running ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {RUN_STEPS[Math.min(step, RUN_STEPS.length - 1)]}…
            </>
          ) : aiPending ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              AI가 문안을 다시 쓰는 중…
            </>
          ) : (
            <>
              <Sparkles size={15} />
              {stale ? "변경사항 반영해 다시 분석" : "내 초안 분석하기"}
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
            {apiEnabled ? "실시간 AI 켜짐" : "실시간 AI (선택)"}
          </button>
          <span className="inline-flex items-center gap-1 text-[10px] text-faint">
            <RotateCcw size={10} />
            AI 없이도 동작
          </span>
        </div>
        {chars > 0 && chars < 20 && (
          <p className="text-[10.5px] text-warn">최소 20자 이상 입력해야 분석할 수 있습니다.</p>
        )}
      </div>
    </Card>
  );
}
