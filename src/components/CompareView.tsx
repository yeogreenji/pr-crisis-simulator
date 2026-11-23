import { ArrowRight, Bookmark, Download, GitCompare, X } from "lucide-react";
import { RadarChart } from "./Charts";
import { CopyButton, cx } from "./ui";
import type { SimSnapshot } from "../lib/history";
import { comparePairText } from "../lib/history";

const A_COLOR = "#1e3a5f";
const B_COLOR = "#96620d";

const bandColor = (value: number) => (value >= 70 ? "#b02a22" : value >= 50 ? "#96620d" : value >= 35 ? "#2f5f8a" : "#17694c");

function Stat({ label, valueA, valueB, unit }: { label: string; valueA: number; valueB: number; unit?: string }) {
  const better = valueA === valueB ? "tie" : valueA < valueB ? "a" : "b";
  return (
    <div className="flex items-center gap-2 border-b border-line py-1.5 last:border-0">
      <span className="w-[92px] shrink-0 text-[12px] text-muted">{label}</span>
      <span className={cx("num flex-1 text-right text-[12.5px]", better === "a" ? "font-semibold text-ink" : "text-muted")}>
        {valueA}
        {unit}
      </span>
      <span className="text-[11px] text-faint">vs</span>
      <span className={cx("num flex-1 text-[12.5px]", better === "b" ? "font-semibold text-ink" : "text-muted")}>
        {valueB}
        {unit}
      </span>
    </div>
  );
}

export function CompareView({
  a,
  b,
  onClose,
  onOpen,
  onNotice,
}: {
  a: SimSnapshot;
  b: SimSnapshot;
  onClose: () => void;
  onOpen?: (id: string) => void;
  onNotice?: (message: string) => void;
}) {
  const rows = a.axes.map((axis) => {
    const other = b.axes.find((x) => x.id === axis.id);
    return { id: axis.id, label: axis.label, a: axis.value, b: other?.value ?? axis.value, delta: (other?.value ?? axis.value) - axis.value };
  });
  const overallDelta = b.overall - a.overall;
  const better = Math.abs(overallDelta) < 2 ? "tie" : overallDelta < 0 ? "b" : "a";
  const tradeoffs = rows
    .filter((r) => Math.abs(r.delta) >= 8)
    .map((r) => ({ ...r, lower: r.delta < 0 ? "B" : "A" }))
    .slice(0, 4);

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-ink/45 px-2 py-3 backdrop-blur-sm print:static print:bg-white print:p-0" role="dialog" aria-label="입장 비교">
      <div className="mx-auto w-full max-w-[1080px] rounded-2xl border border-line bg-paper shadow-[0_30px_80px_-40px_rgba(16,19,25,0.55)]">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-line bg-paper/95 px-4 py-2.5 backdrop-blur print:static">
          <GitCompare size={14} className="text-accent-deep" />
          <span className="text-[14px] font-semibold text-ink">같은 상황 · 다른 입장 비교</span>
          <span className="chip border border-line bg-white px-1.5 py-0 text-[11.5px] text-muted">{a.eventLabel}</span>
          <div className="ml-auto flex items-center gap-1">
            <CopyButton text={comparePairText(a, b)} label="비교 복사" className="btn btn-outline h-7 px-2 text-[12px]" />
            <button
              type="button"
              onClick={() => {
                const md = comparePairText(a, b);
                const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const el = document.createElement("a");
                el.href = url;
                el.download = `PRISM_입장비교_${new Date().toISOString().slice(0, 10)}.md`;
                el.click();
                setTimeout(() => URL.revokeObjectURL(url), 4_000);
                onNotice?.("입장 비교를 .md로 내려받았습니다.");
              }}
              className="btn btn-outline h-7 px-2 text-[12px] print:hidden"
            >
              <Download size={12} /> .md
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost h-7 px-2 text-[12px] text-muted hover:text-ink" aria-label="닫기">
              <X size={13} /> 닫기
            </button>
          </div>
        </div>

        <div className="grid gap-2 px-4 py-3 sm:grid-cols-2">
          {[a, b].map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className={cx(
                "rounded-xl border px-3 py-2.5",
                index === 0 ? "border-accent/30 bg-accent-soft/30" : "border-warn/25 bg-warn-soft/30",
              )}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="num chip px-1.5 py-0 text-[11.5px] font-semibold text-white" style={{ background: index === 0 ? A_COLOR : B_COLOR }}>
                  {index === 0 ? "A" : "B"}
                </span>
                <span className="text-[13px] font-semibold text-ink">{item.stanceShort}</span>
                {item.stanceCustom && <span className="text-[11.5px] text-faint">{item.stanceCustom.slice(0, 40)}</span>}
                <span className="ml-auto num text-[16px] font-semibold" style={{ color: bandColor(item.overall) }}>
                  {item.overall}
                  <span className="text-[11px] font-normal text-faint">/100</span>
                </span>
              </div>
              <p className="mt-1 text-[12.5px] font-medium leading-snug text-ink-2">{item.headline}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-faint">
                <span>{item.brand}</span>
                <span>{item.caseTypeLabel}</span>
                <span>{item.mode === "ai" ? "실시간 AI" : "매뉴얼"}</span>
                <span>{new Date(item.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {onOpen && (
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className="btn btn-outline mt-2 h-7 px-2 text-[12px] print:hidden"
                >
                  이 입장 패키지 열기 <ArrowRight size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-0 border-t border-line lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-center border-b border-line px-4 py-3 lg:border-b-0 lg:border-r print:border-0">
            <RadarChart
              axes={a.axes.map((axis) => ({ label: axis.label, short: axis.short }))}
              series={[
                { label: "A", color: A_COLOR, values: a.axes.map((x) => x.value) },
                { label: "B", color: B_COLOR, values: b.axes.map((x) => x.value), dashed: true },
              ]}
              size={260}
            />
            <div className="mt-1 flex items-center gap-3 text-[11.5px]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: A_COLOR }} /> A · {a.stanceShort}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: B_COLOR }} /> B · {b.stanceShort}
              </span>
            </div>
          </div>

          <div className="px-4 py-3 sm:px-5">
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[112px_minmax(0,1fr)_52px] items-center gap-2">
                  <span className="truncate text-[12px] font-medium text-ink-2">{row.label}</span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#ecece7]">
                        <div className="h-full rounded-full" style={{ width: `${row.a}%`, background: A_COLOR }} />
                      </div>
                      <span className="num w-6 text-right text-[11.5px] text-muted">{row.a}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#ecece7]">
                        <div className="h-full rounded-full" style={{ width: `${row.b}%`, background: B_COLOR }} />
                      </div>
                      <span className="num w-6 text-right text-[11.5px] text-muted">{row.b}</span>
                    </div>
                  </div>
                  <span
                    className={cx(
                      "num rounded px-1.5 py-0.5 text-center text-[11.5px] font-semibold",
                      row.delta === 0 ? "bg-paper-deep text-faint" : row.delta < 0 ? "bg-ok-soft text-ok" : "bg-risk-soft text-risk",
                    )}
                    title="B − A"
                  >
                    {row.delta > 0 ? "+" : ""}
                    {row.delta}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-white px-3 py-2">
                <span className="text-[11.5px] font-semibold text-muted">문안 규모</span>
                <Stat label="입장문" valueA={a.stats.statements} valueB={b.stats.statements} unit="종" />
                <Stat label="예상 질문" valueA={a.stats.qa} valueB={b.stats.qa} unit="개" />
                <Stat label="실행 항목" valueA={a.stats.actions} valueB={b.stats.actions} unit="개" />
                <Stat label="확인 필요" valueA={a.stats.placeholders} valueB={b.stats.placeholders} unit="곳" />
              </div>
              <div className="rounded-xl border border-line bg-[#fcfcfa] px-3 py-2">
                <span className="text-[11.5px] font-semibold text-muted">판정</span>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
                  종합 위험지수는{" "}
                  <span className="font-semibold">
                    {better === "tie"
                      ? "두 입장이 거의 같습니다"
                      : `${better === "a" ? a.stanceShort : b.stanceShort}가 ${Math.abs(overallDelta)}점 낮습니다`}
                  </span>
                  .
                </p>
                <ul className="mt-1 space-y-0.5">
                  {tradeoffs.length ? (
                    tradeoffs.map((t) => (
                      <li key={t.id} className="text-[11.5px] leading-snug text-muted">
                        · {t.label} — {t.lower === "B" ? b.stanceShort : a.stanceShort}가 {Math.abs(t.delta)}점 낮음
                      </li>
                    ))
                  ) : (
                    <li className="text-[11.5px] leading-snug text-muted">· 축별 차이가 크지 않습니다. 실행 가능성(예산·승인)으로 고르세요.</li>
                  )}
                </ul>
                <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
                  총점이 낮아도 비용·법적 축이 높으면 승인이 막힐 수 있습니다. 우선순위 축을 먼저 정하세요.
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-accent/20 bg-accent-soft/40 px-3 py-2 text-[11.5px] leading-relaxed text-accent-deep">
              <Bookmark size={11} className="mt-[3px] shrink-0" />
              <span>
                비교는 같은 규칙 엔진으로 계산해 입력·시점이 달라도 축을 그대로 견줄 수 있습니다. 기록은 이 브라우저에만
                저장되며 서버로 보내지 않습니다.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
