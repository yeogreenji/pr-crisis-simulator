import { ArrowRight, Check, ChevronLeft, MoveRight, ScanText, ShieldAlert, Sparkles, X } from "lucide-react";
import type { Analysis, RiskSpan } from "../../types";
import { Card, Eyebrow, SectionHead, SeverityTag, cx, scoreColor } from "../ui";

function sentenceAround(text: string, start: number, end: number) {
  let from = start;
  while (from > 0 && !/[.!?\n]/.test(text[from - 1] ?? "")) from -= 1;
  let to = end;
  while (to < text.length && !/[.!?\n]/.test(text[to] ?? "")) to += 1;
  while (from < text.length && /\s/.test(text[from] ?? "")) from += 1;
  const sentence = text.slice(from, to).trim();
  return { sentence, from };
}

export function XrayTab({
  analysis,
  selectedId,
  onSelect,
  onApply,
  onApplyAll,
  stale,
}: {
  analysis: Analysis;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onApply: (span: RiskSpan) => void;
  onApplyAll: () => void;
  stale: boolean;
}) {
  const spans = [...analysis.spans].sort((a, b) => a.start - b.start);
  const selected = spans.find((s) => s.id === selectedId) ?? null;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s) => {
    if (s.start > cursor) nodes.push(analysis.text.slice(cursor, s.start));
    nodes.push(
      <span
        key={s.id}
        role="button"
        tabIndex={0}
        data-sev={s.severity}
        data-active={selectedId === s.id}
        className="mark-risk"
        onClick={() => onSelect(selectedId === s.id ? null : s.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(s.id);
          }
        }}
      >
        {s.text}
      </span>,
    );
    cursor = s.end;
  });
  nodes.push(analysis.text.slice(cursor));

  const checks = analysis.structureChecks;
  const industryChecks = checks.slice(6);
  const industryPassed = industryChecks.filter((c) => c.ok).length;
  const placeholders = Array.from(new Set(analysis.revisedDraft.match(/\[[^\]]+\]/g) ?? []));

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">현재</div>
          <span className="num text-[24px] font-semibold leading-none" style={{ color: scoreColor(analysis.score) }}>
            {analysis.score}
          </span>
          {analysis.stats.suggestedGain > 0 ? (
            <>
              <ArrowRight size={14} className="text-faint" />
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">교체안</div>
              <span className="num text-[24px] font-semibold leading-none" style={{ color: scoreColor(analysis.stats.projectedScore) }}>
                {analysis.stats.projectedScore}
              </span>
              <span className="num chip bg-ok-soft text-ok">-{analysis.stats.suggestedGain}점</span>
            </>
          ) : (
            <span className="chip bg-ok-soft text-ok">교체할 위험 문장 없음</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="mr-1 hidden items-center gap-2 sm:flex">
            {[
              ["참고", "#eef0ff", "#2f5f8a"],
              ["주의", "#fdf0d8", "#a9660a"],
              ["심각", "#fbe3df", "#c8352b"],
            ].map(([label, bg, fg]) => (
              <span
                key={label}
                className="rounded px-1.5 py-[2px] text-[9px] font-medium"
                style={{ background: bg, color: fg }}
              >
                {label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onApplyAll}
            disabled={stale || analysis.stats.suggestedGain === 0}
            className="btn btn-accent h-8 px-3 text-[11.5px] disabled:opacity-50"
            title={stale ? "초안이 수정되었습니다. 다시 분석한 뒤 적용하세요." : "모든 교체안을 한 번에 반영"}
          >
            <Sparkles size={13} />
            전체 교체안 적용
          </button>
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-[#fbfbf8] px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <ScanText size={13} className="text-muted" />
                <span className="text-[11.5px] font-semibold text-ink-2">문장 X-ray</span>
              </div>
              <span className="num text-[10px] text-faint">위험 문장 {spans.length}개</span>
            </div>
            <div className="max-h-[520px] overflow-y-auto px-4 py-4">
              <div className="whitespace-pre-wrap text-[13px] leading-[2.05] text-ink-2 [word-break:keep-all]">
                {nodes}
              </div>
            </div>
            {stale && (
              <div className="border-t border-warn/20 bg-warn-soft px-4 py-2 text-[10.5px] text-warn">
                초안이 수정되었습니다. 다시 분석하면 하이라이트가 갱신됩니다.
              </div>
            )}
          </Card>

          <Card className="p-4">
            <SectionHead
              eyebrow="Structure"
              title="문서 골격 점검"
              desc={`기본 6항목 + ${analysis.industryLabel} 필수 항목 ${industryChecks.length}개. 비어 있으면 기사화됩니다.`}
              action={
                <span className="num chip bg-paper-deep text-muted">
                  {checks.filter((c) => c.ok).length}/{checks.length}
                </span>
              }
            />
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {checks.map((c, idx) => (
                <div
                  key={c.label}
                  className={cx(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10.5px] font-medium leading-tight",
                    c.ok
                      ? idx >= 6
                        ? "border-accent/25 bg-accent-soft text-accent-deep"
                        : "border-ok/20 bg-ok-soft text-ok"
                      : "border-line bg-[#fcfcfa] text-muted",
                  )}
                  title={c.hint ?? undefined}
                >
                  {c.ok ? <Check size={11} className="shrink-0" /> : <X size={11} className="shrink-0 text-risk/70" />}
                  <span className="min-w-0 flex-1">{c.label}</span>
                  <span className="shrink-0 text-[9px] opacity-70">{c.ok ? "확인" : "빠짐"}</span>
                </div>
              ))}
            </div>
            {industryChecks.length > 0 && (
              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                <span className="font-semibold text-accent-deep">{analysis.industryLabel}</span> 필수 항목{" "}
                {industryPassed}/{industryChecks.length} 충족 · 파란 칸이 업종 매뉴얼에서 요구하는 항목입니다.
              </p>
            )}
            {placeholders.length > 0 && (
              <div className="mt-3 rounded-lg border border-warn/20 bg-warn-soft/70 p-2.5">
                <div className="mb-1.5 text-[10px] font-semibold text-warn">수정안에서 직접 채워야 할 값</div>
                <div className="flex flex-wrap gap-1">
                  {placeholders.map((p) => (
                    <span key={p} className="num chip border border-warn/25 bg-white/70 text-[9.5px] text-warn">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div>
          {selected ? (
            <Card className="animate-rise overflow-hidden xl:sticky xl:top-[72px]">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert size={13} className="text-risk" />
                  <Eyebrow>선택한 위험 구절</Eyebrow>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(null)}
                  className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted hover:bg-paper-deep hover:text-ink"
                >
                  <ChevronLeft size={11} /> 목록
                </button>
              </div>

              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <SeverityTag level={selected.severity} />
                  <span className="chip border border-line bg-surface text-ink-2">{selected.label}</span>
                </div>

                <p className="rounded-lg bg-risk-soft/70 px-3 py-2 text-[12.5px] font-semibold text-risk">
                  “{selected.text}”
                </p>

                <p className="text-[11.5px] leading-[1.75] text-muted">{selected.reason}</p>

                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">이렇게 바꾸면</div>
                  {(() => {
                    const { sentence, from } = sentenceAround(analysis.text, selected.start, selected.end);
                    const rel = selected.start - from;
                    const before = sentence;
                    const after = `${sentence.slice(0, rel)}${selected.replacement}${sentence.slice(rel + selected.text.length)}`;
                    return (
                      <div className="space-y-1.5">
                        <div className="rounded-lg border border-line bg-[#fcfcfa] px-2.5 py-2 text-[11.5px] leading-relaxed text-muted">
                          {before.slice(0, rel)}
                          <span className="rounded bg-risk-soft px-0.5 text-risk line-through decoration-risk/40">{selected.text}</span>
                          {before.slice(rel + selected.text.length)}
                        </div>
                        <div className="flex justify-center">
                          <MoveRight size={12} className="text-faint" />
                        </div>
                        <div className="rounded-lg border border-ok/25 bg-ok-soft px-2.5 py-2 text-[11.5px] leading-relaxed text-ink-2">
                          {after.slice(0, rel)}
                          <span className="rounded bg-white/80 px-0.5 font-semibold text-ok">{selected.replacement}</span>
                          {after.slice(rel + selected.replacement.length)}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                  <span className="text-[10.5px] text-muted">전체 점수 감소</span>
                  <span className="num chip bg-ok-soft text-ok">-{selected.delta}점</span>
                </div>

                <button
                  type="button"
                  onClick={() => onApply(selected)}
                  disabled={stale}
                  className="btn btn-primary h-9 w-full text-[12px] disabled:opacity-50"
                >
                  이 문장에 적용하고 재분석
                  <ArrowRight size={13} />
                </button>
                <p className="text-center text-[9.5px] leading-relaxed text-faint">
                  적용하면 초안이 바뀌고 점수가 다시 계산됩니다.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="flex h-full flex-col overflow-hidden xl:sticky xl:top-[72px]">
              <div className="border-b border-line px-4 py-3">
                <Eyebrow>Risk sentences</Eyebrow>
                <p className="mt-1 text-[11px] text-muted">문장을 누르면 교체안을 확인할 수 있습니다.</p>
              </div>
              <div className="max-h-[520px] flex-1 overflow-y-auto p-2">
                {spans.length === 0 ? (
                  <div className="space-y-3 p-3">
                    <div className="rounded-lg border border-ok/20 bg-ok-soft px-3 py-2.5">
                      <p className="text-[11.5px] font-semibold text-ok">위험 문장이 감지되지 않았습니다</p>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-ok/80">
                        표현 리스크는 정리됐습니다. 남은 일은 대괄호 값을 실제 수치·일정으로 채우는 것입니다.
                      </p>
                    </div>
                    <div>
                      <div className="eyebrow mb-1.5">다음 단계</div>
                      <ol className="space-y-1.5">
                        {[
                          "확인 필요 값 채우기",
                          "기자 질문에 대한 답변 점검",
                          "응답 팩에서 수정안 내보내기",
                        ].map((step, i) => (
                          <li key={step} className="flex gap-2 text-[10.5px] leading-relaxed text-muted">
                            <span className="num mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded bg-paper-deep text-[8.5px] text-muted">
                              {i + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {[...spans]
                      .sort((a, b) => b.severity - a.severity || b.delta - a.delta)
                      .map((s, i) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(s.id)}
                            className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-paper-deep/60"
                          >
                            <span className="num w-4 shrink-0 text-[9px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: s.severity === 3 ? "#c8352b" : s.severity === 2 ? "#a9660a" : "#2f5f8a" }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11.5px] font-medium text-ink">“{s.text}”</span>
                              <span className="block truncate text-[9.5px] text-muted">{s.label}</span>
                            </span>
                            <span className="num text-[10px] font-semibold text-ok">-{s.delta}</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-line bg-[#fbfbf8] px-4 py-2.5 text-[10px] leading-relaxed text-faint">
                교체안은 사실을 지어내지 않습니다. <span className="num">[대괄호]</span> 값은 직접 채워야 합니다.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
