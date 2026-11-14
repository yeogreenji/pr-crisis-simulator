import { ArrowRight, ChevronRight, ClipboardList, History, Info, TrendingDown, TrendingUp } from "lucide-react";
import type { Analysis, RunRecord } from "../types";
import { getChannel } from "../lib/presets";
import { RiskGauge } from "./RiskGauge";
import { Card, Eyebrow, Meter, ScoreBadge, cx, scoreColor } from "./ui";

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.round(hour / 24);
  return `${day}일 전`;
}

const placeholderCount = (text: string) => {
  const found = text.match(/\[[^\]]+\]/g) ?? [];
  return new Set(found).size;
};

export function RiskRail({
  analysis,
  baseline,
  runs,
  onOpenHistory,
  onSelectRun,
}: {
  analysis: Analysis | null;
  baseline: RunRecord | null;
  runs: RunRecord[];
  onOpenHistory: () => void;
  onSelectRun: (run: RunRecord) => void;
}) {
  if (!analysis) {
    return (
      <div className="space-y-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Eyebrow>Risk Index</Eyebrow>
            <span className="chip bg-paper-deep text-muted">대기</span>
          </div>
          <div className="relative mt-2 opacity-45">
            <RiskGauge score={0} grade={{ label: "대기", tone: "watch", color: "#9aa0aa", desc: "" }} />
          </div>
          <p className="mt-1 text-center text-[11.5px] leading-relaxed text-muted">
            초안을 입력하고 시뮬레이션을 실행하면
            <br />
            리스크 지수가 여기에 표시됩니다.
          </p>
        </Card>

        <Card className="p-4">
          <Eyebrow className="mb-2.5">이 화면에서 보는 것</Eyebrow>
          <ul className="space-y-2.5">
            {[
              ["리스크 지수", "근거·책임·감정·톤 4개 축을 합산한 0~100점"],
              ["채널 온도", "선택한 채널별 예상 부정 톤"],
              ["개선 여지", "문장 교체 후 도달 가능한 점수"],
            ].map(([title, desc]) => (
              <li key={title} className="flex gap-2.5">
                <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                <div>
                  <div className="text-[11.5px] font-semibold text-ink-2">{title}</div>
                  <div className="text-[10.5px] leading-relaxed text-muted">{desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <Eyebrow className="mb-2">최근 시뮬레이션</Eyebrow>
          {runs.length === 0 ? (
            <p className="text-[11px] text-muted">아직 기록이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {runs.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRun(r)}
                    className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-paper-deep/60"
                  >
                    <ScoreBadge score={r.score} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink-2">{r.brand}</span>
                    <span className="text-[9.5px] text-faint">{timeAgo(r.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onOpenHistory}
            className="mt-2.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-accent-deep hover:underline"
          >
            전체 히스토리 <ChevronRight size={11} />
          </button>
        </Card>
      </div>
    );
  }

  const delta = baseline ? analysis.score - baseline.score : null;
  const avgTone = Math.round(
    analysis.channelForecasts.reduce((acc, c) => acc + c.negativity, 0) / (analysis.channelForecasts.length || 1),
  );
  const needConfirm = placeholderCount(analysis.revisedDraft);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3.5">
          <Eyebrow>Risk Index</Eyebrow>
          <span
            className="chip"
            style={{
              background: `${analysis.grade.color}14`,
              color: analysis.grade.color,
              border: `1px solid ${analysis.grade.color}2e`,
            }}
          >
            {analysis.grade.label}
          </span>
        </div>

        <div className="px-3 pt-1">
          <RiskGauge score={analysis.score} grade={analysis.grade} />
        </div>

        <p className="px-5 pb-3 text-center text-[11px] leading-relaxed text-muted">{analysis.grade.desc}</p>

        <div className="mx-3 mb-3 grid grid-cols-2 divide-x divide-line rounded-lg border border-line bg-[#fbfbf8]">
          <div className="px-3 py-2.5">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint">교체안 적용</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="num text-[19px] font-semibold leading-none" style={{ color: scoreColor(analysis.stats.projectedScore) }}>
                {analysis.stats.projectedScore}
              </span>
              {analysis.stats.suggestedGain > 0 ? (
                <span className="num text-[10px] font-medium text-ok">
                  <TrendingDown size={10} className="inline" /> -{analysis.stats.suggestedGain}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-ok">정리 완료</span>
              )}
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint">지난 대비</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              {delta === null ? (
                <span className="text-[11px] font-medium text-muted">첫 기록</span>
              ) : (
                <>
                  <span
                    className="num text-[19px] font-semibold leading-none"
                    style={{ color: delta < 0 ? "#16714f" : delta > 0 ? "#c8352b" : "#6d7380" }}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                  <span className="text-[10px] text-faint">
                    {delta < 0 ? <TrendingDown size={10} className="inline" /> : <TrendingUp size={10} className="inline" />}
                    점
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {needConfirm > 0 && (
          <div className="mx-3 mb-3 flex items-start gap-2 rounded-lg border border-warn/20 bg-warn-soft px-2.5 py-2">
            <ClipboardList size={13} className="mt-[1px] shrink-0 text-warn" />
            <p className="text-[10.5px] leading-relaxed text-warn">
              수정안에 확인 필요 값 <b className="num">{needConfirm}개</b>. 실제 수치·일정으로 채워야 배포할 수 있습니다.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>리스크 구성</Eyebrow>
          <span className="text-[9.5px] text-faint">가중 합산</span>
        </div>
        <div className="space-y-3">
          {analysis.breakdown.map((b) => (
            <div key={b.id}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[11.5px] font-medium text-ink-2">{b.label}</span>
                <span className="num text-[11px] font-semibold" style={{ color: scoreColor(b.score) }}>
                  {b.score}
                </span>
              </div>
              <Meter value={b.score} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-1.5 border-t border-line pt-2.5 text-[10px] leading-relaxed text-faint">
          <Info size={11} className="mt-[1px] shrink-0" />
          {analysis.breakdown.reduce((acc, b) => (b.score > acc.score ? b : acc), analysis.breakdown[0]).hint}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <Eyebrow>채널 온도</Eyebrow>
          <span className="num text-[10px] text-faint">평균 {avgTone}</span>
        </div>
        <div className="space-y-2">
          {analysis.channelForecasts.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="w-[74px] shrink-0 truncate text-[10.5px] text-ink-2">{getChannel(c.id).label}</span>
              <div className="flex-1">
                <Meter value={c.negativity} height={3} />
              </div>
              <span className="num w-5 text-right text-[10px] font-medium" style={{ color: scoreColor(c.negativity) }}>
                {c.negativity}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow>히스토리</Eyebrow>
          <button type="button" onClick={onOpenHistory} className="text-[10px] font-semibold text-accent-deep hover:underline">
            전체
          </button>
        </div>
        <ul className="space-y-1.5">
          {runs.slice(0, 3).map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelectRun(r)}
                className={cx(
                  "flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-paper-deep/60",
                  r.id === analysis.id && "bg-paper-deep/50",
                )}
              >
                <ScoreBadge score={r.score} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-2">{r.brand}</span>
                <span className="text-[9px] text-faint">{timeAgo(r.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-[10px] text-faint">
          <History size={11} /> v1 → v2 비교는 히스토리에서
          <ArrowRight size={10} className="ml-auto" />
        </div>
      </Card>
    </div>
  );
}
