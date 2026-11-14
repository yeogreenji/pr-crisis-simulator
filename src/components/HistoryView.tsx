import { ArrowLeft, ChevronsLeftRight, Clock3, History as HistoryIcon, Trash2 } from "lucide-react";
import type { RunRecord } from "../types";
import { getChannel } from "../lib/presets";
import { Card, DeltaChip, Eyebrow, Meter, ScoreBadge, cx, scoreColor } from "./ui";
import { timeAgo } from "./RiskRail";

export function HistoryView({
  runs,
  picked,
  onPick,
  onSelectRun,
  onDelete,
  onClear,
  onBack,
}: {
  runs: RunRecord[];
  picked: string[];
  onPick: (id: string) => void;
  onSelectRun: (r: RunRecord) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onBack: () => void;
}) {
  const a = runs.find((r) => r.id === picked[0]);
  const b = runs.find((r) => r.id === picked[1]);
  const ordered = [a, b].filter(Boolean).sort((x, y) => new Date(x!.createdAt).getTime() - new Date(y!.createdAt).getTime());
  const [older, newer] = ordered;

  const previousFor = (run: RunRecord) =>
    runs
      .filter((r) => r.brand === run.brand && new Date(r.createdAt).getTime() < new Date(run.createdAt).getTime())
      .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Simulation archive</Eyebrow>
          <h1 className="mt-1 flex items-center gap-2 text-[20px] font-semibold tracking-[-0.03em]">
            <HistoryIcon size={18} className="text-muted" />
            시뮬레이션 히스토리
          </h1>
          <p className="mt-1 text-[12px] text-muted">
            초안을 고쳐 다시 돌린 기록을 비교하면, 어떤 문장이 점수를 움직였는지 보입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="btn btn-ghost h-8 px-2.5 text-[11.5px]">
            <ArrowLeft size={12} /> 시뮬레이터
          </button>
          {runs.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="btn btn-outline h-8 px-2.5 text-[11.5px] text-muted hover:text-risk"
            >
              <Trash2 size={12} /> 전체 삭제
            </button>
          )}
        </div>
      </div>

      {runs.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-paper-deep text-muted">
            <HistoryIcon size={20} />
          </div>
          <p className="mt-4 text-[14px] font-semibold">아직 저장된 시뮬레이션이 없습니다</p>
          <p className="mt-1 max-w-[320px] text-[11.5px] leading-relaxed text-muted">
            시뮬레이터에서 초안을 분석하면 자동으로 기록됩니다. 두 번 이상 쌓이면 v1과 v2의 리스크 점수를 나란히 비교할 수 있습니다.
          </p>
          <button type="button" onClick={onBack} className="btn btn-primary mt-4 h-9 px-4 text-[12px]">
            초안 분석하러 가기
          </button>
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ChevronsLeftRight size={14} className="text-accent" />
                <h2 className="text-[13px] font-semibold">버전 비교</h2>
                <span className="text-[10.5px] text-muted">목록에서 두 개를 선택하세요</span>
              </div>
              <span className="text-[10px] text-faint">선택 {picked.length}/2</span>
            </div>

            {!older || !newer ? (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-line-strong bg-[#fcfcfa] px-4 py-6">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-paper-deep text-faint">
                  <ChevronsLeftRight size={16} />
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted">
                  비교할 시뮬레이션 두 개를 고르면
                  <br className="hidden sm:block" /> 리스크 점수·축별 변화·채널 톤 차이를 나란히 보여드립니다.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                  {[older, newer].map((r, i) => (
                    <div
                      key={r.id}
                      className={cx(
                        "rounded-lg border p-3",
                        i === 1 ? "border-accent/30 bg-accent-soft/40 sm:col-start-3" : "border-line bg-[#fcfcfa]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">
                          {i === 0 ? "기준 (v1)" : "비교 (v2)"}
                        </span>
                        <span className="text-[9.5px] text-faint">{new Date(r.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span className="num text-[28px] font-semibold leading-none" style={{ color: scoreColor(r.score) }}>
                          {r.score}
                        </span>
                        <span className="text-[10.5px] text-muted">{r.gradeLabel}</span>
                      </div>
                      <p className="mt-1 truncate text-[10.5px] text-muted">{r.summaryLine}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <span className="chip border border-line bg-surface text-[9.5px] text-ink-2">{r.issueLabel}</span>
                        <span className="chip border border-line bg-surface text-[9.5px] text-muted">채널 {r.channels.length}개</span>
                        {r.topIssues.slice(0, 2).map((issue) => (
                          <span key={issue} className="chip bg-risk-soft text-[9.5px] text-risk">
                            {issue}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-center gap-1 sm:col-start-2 sm:row-start-1 sm:flex-col">
                    <span className="hidden text-[10px] text-faint sm:block">→</span>
                    <DeltaChip delta={newer.score - older.score} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-line p-3">
                    <Eyebrow className="mb-2">지표 변화</Eyebrow>
                    <div className="space-y-2">
                      {[
                        ["리스크 지수", older.score, newer.score],
                        ["고위험 문장", older.stats.criticalSpans, newer.stats.criticalSpans],
                        ["리스크 문장", older.stats.riskySpans, newer.stats.riskySpans],
                        [
                          "평균 채널 톤",
                          Math.round(older.channelTones.reduce((acc, c) => acc + c.negativity, 0) / (older.channelTones.length || 1)),
                          Math.round(newer.channelTones.reduce((acc, c) => acc + c.negativity, 0) / (newer.channelTones.length || 1)),
                        ],
                      ].map(([label, x, y]) => (
                        <div key={String(label)} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-muted">{label}</span>
                          <span className="num text-ink-2">
                            {x} <span className="text-faint">→</span> <b>{y}</b>
                          </span>
                          <DeltaChip delta={(y as number) - (x as number)} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-line p-3">
                    <Eyebrow className="mb-2">축별 점수</Eyebrow>
                    <div className="space-y-2">
                      {older.breakdown.map((cat) => {
                        const other = newer.breakdown.find((c) => c.id === cat.id);
                        if (!other) return null;
                        return (
                          <div key={cat.id}>
                            <div className="mb-1 flex items-center justify-between text-[10.5px]">
                              <span className="text-muted">{cat.label}</span>
                              <span className="num text-ink-2">
                                {cat.score} <span className="text-faint">→</span> {other.score}
                              </span>
                            </div>
                            <div className="space-y-[3px]">
                              <Meter value={cat.score} height={3} color="#c3c7cf" />
                              <Meter value={other.score} height={3} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-line p-3">
                  <Eyebrow className="mb-2">채널 톤 변화</Eyebrow>
                  <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                    {older.channelTones.map((tone) => {
                      const next = newer.channelTones.find((t) => t.id === tone.id);
                      return (
                        <div key={tone.id} className="flex items-center gap-2 text-[10.5px]">
                          <span className="w-[86px] truncate text-muted">{getChannel(tone.id).label}</span>
                          <span className="num text-faint">{tone.negativity}</span>
                          <span className="text-[9px] text-faint">→</span>
                          <span className="num font-medium" style={{ color: scoreColor(next?.negativity ?? tone.negativity) }}>
                            {next ? next.negativity : "—"}
                          </span>
                          {next && <DeltaChip delta={next.negativity - tone.negativity} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-[11.5px] font-semibold text-ink-2">전체 기록</span>
              <span className="num text-[10px] text-faint">{runs.length}건 · 최대 24건 보관</span>
            </div>
            <ul className="divide-y divide-line">
              {runs.map((r) => {
                const prev = previousFor(r);
                const isPicked = picked.includes(r.id);
                return (
                  <li
                    key={r.id}
                    className={cx(
                      "flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 transition-colors sm:px-4",
                      isPicked ? "bg-accent-soft/50" : "hover:bg-[#fcfcfa]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onPick(r.id)}
                      aria-pressed={isPicked}
                      title="비교 대상으로 선택"
                      className={cx(
                        "grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
                        isPicked ? "border-accent bg-accent text-white" : "border-line-strong bg-white hover:border-accent/60",
                      )}
                    >
                      {isPicked && <span className="h-1.5 w-1.5 rounded-[1px] bg-white" />}
                    </button>

                    <ScoreBadge score={r.score} size="sm" />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[12px] font-semibold text-ink">{r.brand}</span>
                        <span className="chip bg-paper-deep text-[9.5px] text-muted">{r.issueLabel}</span>
                        {r.engine === "llm" && <span className="chip bg-accent-soft text-[9px] text-accent-deep">LLM</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-faint">{r.summaryLine}</p>
                    </div>

                    <div className="hidden items-center gap-1 text-[9.5px] text-faint sm:flex">
                      <Clock3 size={10} /> {timeAgo(r.createdAt)}
                    </div>
                    {prev && <DeltaChip delta={r.score - prev.score} />}

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onSelectRun(r)}
                        className="btn btn-ghost h-7 px-2 text-[10.5px] text-accent-deep"
                      >
                        불러오기
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(r.id)}
                        aria-label="기록 삭제"
                        className="grid h-7 w-7 place-items-center rounded-md text-faint transition-colors hover:bg-risk-soft hover:text-risk"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
