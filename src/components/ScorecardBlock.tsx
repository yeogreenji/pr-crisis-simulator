import { useState } from "react";
import { ArrowLeftRight, Gauge, Info, Lock, Target } from "lucide-react";
import { RadarChart } from "./Charts";
import { CopyButton, cx } from "./ui";
import { STANCES, getStance, type ResponsePackage } from "../lib/package";
import { scorecardToText, type Scorecard } from "../lib/scorecard";
import type { Stance } from "../lib/stances";
import { usePlan } from "./PlanContext";

const bandCls: Record<string, string> = {
  ok: "bg-ok-soft text-ok border-ok/20",
  info: "bg-accent-soft text-accent-deep border-accent/20",
  warn: "bg-warn-soft text-warn border-warn/25",
  risk: "bg-risk-soft text-risk border-risk/25",
};

function axisColor(value: number) {
  if (value >= 70) return "#b02a22";
  if (value >= 50) return "#96620d";
  if (value >= 35) return "#2f5f8a";
  return "#17694c";
}

export function ScorecardBlock({
  pkg,
  card,
  onCompareStance,
  onOpenHistory,
}: {
  pkg: ResponsePackage;
  card: Scorecard;
  onCompareStance: (stance: Stance) => void;
  onOpenHistory?: () => void;
}) {
  const current = getStance(pkg.stance, pkg.stanceCustom);
  const { allows, openPricing } = usePlan();
  const canCompare = allows("compare");
  const options = STANCES.filter((s) => s.id !== "custom");
  const [picked, setPicked] = useState<Stance>(
    options.find((s) => s.id !== pkg.stance)?.id ?? "facts",
  );

  return (
    <section className="card overflow-hidden" data-testid="block-scorecard">
      <div className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span className="mt-[1px] grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-white">
          <Gauge size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-ink">위험 스코어카드 — 7축</h2>
            <span className={cx("chip border px-1.5 py-0 text-[11.5px] font-semibold", bandCls[card.band.tone])}>
              종합 {card.overall}/100 · {card.band.label}
            </span>
            <span className="chip border border-line bg-white px-1.5 py-0 text-[11.5px] text-muted">{current.short}</span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            같은 입력이면 입장만 바꿔도 점수가 이렇게 달라집니다. 모든 축은 <span className="font-semibold text-ink-2">0=안전 · 100=심각</span> 기준입니다.
          </p>
        </div>
        <CopyButton text={scorecardToText(card, pkg.brand)} label="스코어카드 복사" className="btn btn-outline h-7 shrink-0 px-2 text-[12.5px]" />
      </div>

      <div className="grid gap-0 lg:grid-cols-[270px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center gap-1 border-b border-line px-4 py-4 lg:border-b-0 lg:border-r">
          <RadarChart
            axes={card.axes.map((a) => ({ label: a.label, short: a.short }))}
            series={[{ label: current.short, color: "#1e3a5f", values: card.axes.map((a) => a.value) }]}
            size={250}
          />
          <div className="flex items-baseline gap-1.5">
            <span className="num text-[26px] font-semibold leading-none" style={{ color: card.band.color }}>
              {card.overall}
            </span>
            <span className="text-[12px] text-faint">/ 100 종합 위험지수</span>
          </div>
          <p className="mt-0.5 max-w-[230px] text-center text-[12px] leading-snug text-muted">{card.band.desc}</p>
        </div>

        <div className="px-4 py-3.5 sm:px-5">
          <div className="space-y-2.5">
            {card.axes.map((axis) => (
              <div key={axis.id}>
                <div className="flex items-center gap-2">
                  <span className="w-[122px] shrink-0 truncate text-[12.5px] font-medium text-ink-2">{axis.label}</span>
                  <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#ecece7]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out"
                      style={{ width: `${Math.max(3, axis.value)}%`, background: axisColor(axis.value) }}
                    />
                  </div>
                  <span className="num w-7 shrink-0 text-right text-[12.5px] font-semibold" style={{ color: axisColor(axis.value) }}>
                    {axis.value}
                  </span>
                </div>
                <p className="ml-[130px] mt-0.5 text-[11.5px] leading-snug text-faint">{axis.reasons[0]}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-line bg-[#fcfcfa] px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Target size={12} className="text-risk" />
              <span className="text-[12.5px] font-semibold text-ink">먼저 줄여야 할 3축</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {card.top.map((axis) => (
                <span key={axis.id} className="chip border border-line bg-white px-2 py-0.5 text-[12px] text-ink-2">
                  {axis.label}
                  <span className="num text-[11.5px] font-semibold" style={{ color: axisColor(axis.value) }}>
                    {axis.value}
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
              가장 높은 축부터 대응 항목을 배치하면 같은 노력으로 종합지수를 더 낮출 수 있습니다.
            </p>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-xl border border-accent/20 bg-accent-soft/40 px-3 py-2">
            <ArrowLeftRight size={12} className="text-accent-deep" />
            <span className="text-[12.5px] font-semibold text-accent-deep">다른 입장과 비교</span>
            <select
              aria-label="비교할 입장"
              value={picked}
              onChange={(e) => setPicked(e.target.value as Stance)}
              className="field h-7 w-auto min-w-[132px] py-0 text-[12.5px]"
            >
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="compare-stance"
              onClick={() => (canCompare ? onCompareStance(picked) : openPricing("compare"))}
              className="btn btn-accent h-7 px-2.5 text-[12.5px]"
            >
              {canCompare ? <ArrowLeftRight size={11} /> : <Lock size={11} />}
              같은 상황으로 즉시 비교
              {!canCompare && <span className="rounded bg-white/20 px-1 text-[9.5px] font-semibold tracking-wide">PRO</span>}
            </button>
            {onOpenHistory && (
              <button type="button" onClick={onOpenHistory} className="btn btn-ghost h-7 px-2 text-[12.5px] text-muted hover:text-ink">
                저장 기록과 비교
              </button>
            )}
          </div>
          <p className="mt-1.5 flex items-start gap-1 text-[11.5px] leading-relaxed text-faint">
            <Info size={11} className="mt-[2px] shrink-0" />
            {card.note}
          </p>
        </div>
      </div>
    </section>
  );
}
