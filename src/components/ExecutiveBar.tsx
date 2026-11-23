import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Download,
  FileText,
  History,
  Link2,
  Lock,
  MoreHorizontal,
  Printer,
  RotateCcw,
} from "lucide-react";
import type { ResponsePackage } from "../lib/package";
import { getStance, packageToMarkdown, packageToText } from "../lib/package";
import type { Scorecard } from "../lib/scorecard";
import type { ChannelKit } from "../lib/channels";
import { downloadDoc, downloadMarkdown } from "../lib/report";
import { planAllows, planBadge, type FeatureKey, type PlanState } from "../lib/plans";
import { readinessSummary, type ChannelState } from "../lib/readiness";
import { usePlan } from "./PlanContext";
import { cx } from "./ui";

const TONE_ON_DARK: Record<string, string> = {
  ok: "#7BE0B4",
  info: "#9CC4F5",
  warn: "#F3CE7A",
  risk: "#F5A79C",
};

export function ExecutiveBar({
  pkg,
  card,
  kit,
  states,
  plan,
  onEdit,
  onRegenerate,
  onOpenHistory,
  onNotice,
  onShare,
}: {
  pkg: ResponsePackage;
  card: Scorecard;
  kit: ChannelKit;
  states: ChannelState[];
  plan: PlanState;
  onEdit: () => void;
  onRegenerate: () => void;
  onOpenHistory: () => void;
  onNotice: (message: string) => void;
  onShare: () => void;
}) {
  const { openPricing } = usePlan();
  const [exportOpen, setExportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const stance = getStance(pkg.stance, pkg.stanceCustom);
  const summary = readinessSummary(states);
  const tone = TONE_ON_DARK[card.band.tone] ?? "#D7DEE9";
  const canExport = planAllows(plan.id, "execExport");
  const canShare = planAllows(plan.id, "share");

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(packageToText(pkg));
      onNotice("대응 패키지 전체를 복사했습니다.");
    } catch {
      onNotice("복사가 막혀 있습니다. 브라우저 권한을 확인해 주세요.");
    }
  };

  const gate = (feature: FeatureKey, run: () => void) => {
    setExportOpen(false);
    setMoreOpen(false);
    if (!planAllows(plan.id, feature)) {
      openPricing(feature);
      return;
    }
    run();
  };

  return (
    <div className="sticky top-0 z-30 border-b border-white/10 bg-ink text-white print:hidden" data-testid="exec-bar">
      <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-5">
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[12px] font-semibold tracking-[0.18em] text-white">PRISM</span>
          <button
            type="button"
            onClick={onEdit}
            data-testid="new-situation"
            className="btn h-7 border border-white/20 bg-white/[0.06] px-2 text-[11.5px] font-medium text-white/80 hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft size={11} /> 새 상황
          </button>
        </div>

        <div className="hidden h-5 w-px bg-white/15 sm:block" />

        <div className="mr-auto hidden min-w-0 sm:block">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Executive command center
          </div>
          <div className="truncate text-[13px] font-medium text-white" title={`${pkg.brand} · ${pkg.eventLabel}`}>
            {pkg.brand}
            <span className="mx-1.5 text-white/30">/</span>
            <span className="text-white/75">{pkg.caseTypeLabel ?? pkg.eventLabel}</span>
          </div>
        </div>

        <div className="no-scrollbar order-3 flex w-full items-stretch gap-1.5 overflow-x-auto sm:order-none sm:w-auto sm:overflow-visible">
          <button
            type="button"
            onClick={() => openPricing()}
            data-testid="plan-badge"
            title="요금제 보기"
            className="btn h-8 border border-white/20 bg-white/[0.06] px-2 text-[11.5px] font-medium text-white/85 hover:bg-white/15 hover:text-white"
          >
            <span
              className={cx(
                "h-1.5 w-1.5 rounded-full",
                plan.id === "starter" ? "bg-white/40" : "bg-[#7BE0B4]",
              )}
            />
            {planBadge(plan)}
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1.5" data-testid="exec-risk">
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 sm:inline">Risk</span>
            <span className="num text-[16px] font-semibold leading-none" style={{ color: tone }}>
              {card.overall}
            </span>
            <span className="text-[11px] leading-none text-white/50">/100</span>
            <span
              className="rounded-full px-1.5 py-[1px] text-[10.5px] font-semibold"
              style={{ background: `${tone}1f`, color: tone }}
            >
              {card.band.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1.5" data-testid="exec-stance">
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 sm:inline">Stance</span>
            <span className="max-w-[132px] truncate text-[12px] font-medium text-white" title={stance.label}>
              {stance.short}
            </span>
          </div>

          <div
            className="flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1.5"
            data-testid="exec-readiness"
            title={summary.allReady ? "이 플랜에서 쓰는 채널 문안이 모두 준비됐습니다" : "일부 채널 문안이 비어 있습니다"}
          >
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 sm:inline">Channels</span>
            <span className="num text-[12.5px] font-semibold text-white">
              {summary.usable}/{summary.total}
            </span>
            <span className="flex items-center gap-1">
              {states.map((s) => (
                <span
                  key={s.id}
                  title={`${s.n} ${s.label} — ${s.unlocked ? (s.ready ? "준비됨" : "준비 중") : "Pro 잠금"}`}
                  className={cx(
                    "h-1.5 w-1.5 rounded-full",
                    !s.unlocked ? "bg-white/20" : s.ready ? "bg-[#7BE0B4]" : "bg-white/35",
                  )}
                />
              ))}
            </span>
          </div>
        </div>

        <div className="order-2 flex items-center gap-1 sm:order-none sm:ml-auto">
          <button
            type="button"
            onClick={onShare}
            data-testid="share-open"
            aria-label="임원·법무팀 공유 링크"
            className={cx(
              "btn h-8 px-2.5 text-[12px]",
              canShare ? "border border-white bg-white text-ink hover:bg-white/90" : "border border-white/25 bg-white/10 text-white hover:bg-white/15",
            )}
          >
            {canShare ? <Link2 size={12} /> : <Lock size={11} />}
            <span className="hidden sm:inline">공유 링크</span>
            {!canShare && <span className="rounded bg-white/15 px-1 text-[9.5px] font-semibold tracking-wide">PRO</span>}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                setExportOpen((v) => !v);
              }}
              data-testid="export-menu"
              aria-expanded={exportOpen}
              className="btn h-8 border border-white/20 bg-white/[0.06] px-2.5 text-[12px] text-white hover:bg-white/15"
            >
              <Download size={12} />
              <span className="hidden sm:inline">임원 보고서</span>
              <ChevronDown size={11} className="opacity-60" />
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} aria-hidden />
                <div className="absolute right-0 z-50 mt-1 w-[252px] overflow-hidden rounded-xl border border-line bg-white text-ink shadow-float">
                  <button
                    type="button"
                    data-testid="print-pdf"
                    onClick={() =>
                      gate("execExport", () => {
                        setExportOpen(false);
                        setTimeout(() => window.print(), 80);
                      })
                    }
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-paper"
                  >
                    <Printer size={13} className="mt-[2px] text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-ink">인쇄 · PDF 저장</span>
                      <span className="block text-[11.5px] text-muted">임원 보고서 레이아웃 · 4채널 모두 포함</span>
                    </span>
                    {!canExport && <Lock size={11} className="mt-1 shrink-0 text-faint" />}
                  </button>
                  <button
                    type="button"
                    data-testid="report-doc"
                    onClick={() =>
                      gate("execExport", () => {
                        setExportOpen(false);
                        downloadDoc(pkg, card, kit);
                        onNotice("Word(.doc) 보고서를 내려받았습니다.");
                      })
                    }
                    className="flex w-full items-start gap-2 border-t border-line px-3 py-2 text-left hover:bg-paper"
                  >
                    <FileText size={13} className="mt-[2px] text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-ink">Word(.doc) 다운로드</span>
                      <span className="block text-[11.5px] text-muted">표·점수표 포함 · 바로 편집</span>
                    </span>
                    {!canExport && <Lock size={11} className="mt-1 shrink-0 text-faint" />}
                  </button>
                  <button
                    type="button"
                    data-testid="report-md"
                    onClick={() => {
                      setExportOpen(false);
                      downloadMarkdown(pkg, card, kit);
                      onNotice("Markdown(.md) 보고서를 내려받았습니다.");
                    }}
                    className="flex w-full items-start gap-2 border-t border-line px-3 py-2 text-left hover:bg-paper"
                  >
                    <ClipboardList size={13} className="mt-[2px] text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-ink">Markdown(.md) 다운로드</span>
                      <span className="block text-[11.5px] text-muted">노션·위키·슬랙 붙여넣기용 · 무료</span>
                    </span>
                  </button>
                  {!canExport && (
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false);
                        openPricing("execExport");
                      }}
                      className="flex w-full items-center gap-2 border-t border-line bg-accent-soft/60 px-3 py-2 text-left text-[11.5px] font-medium text-accent-deep"
                    >
                      Word·PDF는 Pro에 포함 · 무료 체험 켜기
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setExportOpen(false);
                setMoreOpen((v) => !v);
              }}
              aria-expanded={moreOpen}
              aria-label="더 보기"
              className="btn h-8 w-8 border border-white/20 bg-white/[0.06] px-0 text-white hover:bg-white/15"
            >
              <MoreHorizontal size={14} />
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} aria-hidden />
                <div className="absolute right-0 z-50 mt-1 w-[186px] overflow-hidden rounded-xl border border-line bg-white py-1 text-ink shadow-float">
                  <button
                    type="button"
                    data-testid="copy-all"
                    onClick={() => {
                      setMoreOpen(false);
                      void copyAll();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-ink-2 hover:bg-paper"
                  >
                    <Copy size={12} className="text-muted" /> 전체 복사
                  </button>
                  <button
                    type="button"
                    data-testid="copy-markdown"
                    onClick={() => {
                      setMoreOpen(false);
                      void navigator.clipboard
                        .writeText(packageToMarkdown(pkg))
                        .then(() => onNotice("팀 공유용 마크다운을 복사했습니다."))
                        .catch(() => onNotice("복사가 막혀 있습니다. 브라우저 권한을 확인해 주세요."));
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-ink-2 hover:bg-paper"
                  >
                    <ClipboardList size={12} className="text-muted" /> Markdown 복사
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      onOpenHistory();
                    }}
                    data-testid="open-history"
                    className="flex w-full items-center gap-2 border-t border-line px-3 py-1.5 text-left text-[12px] text-ink-2 hover:bg-paper"
                  >
                    <History size={12} className="text-muted" /> 기록·비교
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      onRegenerate();
                    }}
                    className="flex w-full items-center gap-2 border-t border-line px-3 py-1.5 text-left text-[12px] text-ink-2 hover:bg-paper"
                  >
                    <RotateCcw size={12} className="text-muted" /> 다시 만들기
                  </button>
                  <div className="flex items-center gap-1 border-t border-line bg-[#fbfbf8] px-3 py-1 text-[10.5px] text-faint">
                    <Check size={10} /> 개인정보·API 키 미포함
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
