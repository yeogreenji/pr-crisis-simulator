import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, FileText, Info, Printer, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import { countPlaceholders, type ReviewResult } from "../lib/package";
import { CopyButton, cx } from "./ui";

const scoreStyle = (score: number) => {
  if (score <= 34) return { color: "#059669", label: "낮음", bg: "#ecfdf5" };
  if (score <= 59) return { color: "#2563eb", label: "관리 가능", bg: "#eef4ff" };
  if (score <= 79) return { color: "#d97706", label: "주의", bg: "#fff8eb" };
  return { color: "#dc2626", label: "위험", bg: "#fef2f2" };
};

export function ReviewView({
  review,
  onEdit,
  onRetry,
  onNotice,
}: {
  review: ReviewResult;
  onEdit: () => void;
  onRetry: () => void;
  onNotice: (message: string) => void;
}) {
  const style = scoreStyle(review.score);
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="mx-auto w-full max-w-[900px] px-3 pb-20 sm:px-5">
      <div className="sticky top-0 z-30 -mx-3 mb-3 flex items-center gap-2 border-b border-line bg-paper/95 px-3 py-2 backdrop-blur print:hidden sm:-mx-5 sm:px-5">
        <button type="button" onClick={onEdit} className="btn btn-ghost h-8 px-2 text-[13px] text-muted hover:text-ink">
          <ArrowLeft size={13} /> 새 검수
        </button>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onRetry} className="btn btn-ghost h-8 px-2 text-[13px] text-muted hover:text-ink">
            <RotateCcw size={12} /> 다시 검수
          </button>
          <CopyButton
            text={review.rewrite}
            label="리라이트 복사"
            className="btn btn-outline h-8 px-2 text-[13px]"
          />
          <button type="button" onClick={() => window.print()} className="btn btn-outline h-8 px-2 text-[13px]">
            <Printer size={12} /> <span className="hidden sm:inline">인쇄</span>
          </button>
        </span>
      </div>

      <div className="animate-rise" data-testid="review-view">
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="chip border border-line bg-surface text-ink-2">입장문 검수</span>
          <span className={cx("chip", review.mode === "ai" ? "bg-ok-soft text-ok" : "bg-paper-deep text-muted")}>
            {review.mode === "ai" ? `실시간 AI${review.ai?.model ? ` · ${review.ai.model}` : ""}` : "매뉴얼 엔진"}
          </span>
          <span className="text-[12.5px] text-faint">{review.brand}</span>
        </div>

        <div className="card mt-2.5 overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
            <div className="flex items-baseline gap-1" style={{ color: style.color }}>
              <span className="num text-[34px] font-semibold leading-none tracking-[-0.04em]">{review.score}</span>
              <span className="text-[13px] opacity-70">/100</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-semibold" style={{ color: style.color }}>
                  위험도 {style.label}
                </span>
                <span className="text-[12.5px] text-faint">· 이 상태로 배포했을 때</span>
              </div>
              <p className="mt-1 text-[14px] font-medium leading-relaxed text-ink">{review.summary}</p>
            </div>
          </div>
          <div className="grid gap-1.5 border-t border-line bg-tint px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-5">
            {review.checklist.slice(0, 5).map((c) => (
              <div key={c.label} className="flex items-start gap-1.5">
                <span
                  className={cx(
                    "mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full",
                    c.ok ? "bg-ok-soft text-ok" : "bg-risk-soft text-risk",
                  )}
                >
                  {c.ok ? <Check size={9} strokeWidth={3.5} /> : <X size={9} strokeWidth={3.5} />}
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold leading-snug text-ink-2">{c.label}</div>
                  {!c.ok && c.hint && <div className="mt-0.5 text-[12px] leading-snug text-muted">{c.hint}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <section className="card mt-2.5 overflow-hidden" data-testid="review-findings">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
            <ShieldCheck size={13} className="text-risk" />
            <span className="text-[13px] font-semibold">위험 표현 {review.findings.length}곳</span>
            <span className="ml-auto text-[12.5px] text-faint">인용 → 고칠 문장 순서</span>
          </div>
          {review.findings.length === 0 ? (
            <div className="flex items-start gap-2 px-4 py-4 text-[13px] text-muted sm:px-5">
              <Info size={12} className="mt-[2px]" /> 치명적인 위험 표현은 없습니다. 아래 리라이트에서 수치·일정만 보강하세요.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {review.findings.map((f, i) => (
                <div key={`${f.quote}-${i}`} className="px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <span className="num mt-[1px] text-[12.5px] text-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="text-[13px] font-semibold text-risk">“{f.quote}”</span>
                      <span className="ml-1.5 rounded bg-paper-deep px-1 py-[1px] text-[11.5px] text-muted">{f.label}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-faint">{openIndex === i ? "접기" : "자세히"}</span>
                  </button>
                  {openIndex === i && (
                    <div className="mt-2 space-y-1.5 pl-5">
                      <p className="text-[13px] leading-relaxed text-muted">{f.why}</p>
                      <div className="flex items-start gap-2 rounded-lg border border-ok/20 bg-ok-soft px-2.5 py-1.5">
                        <span className="mt-[2px] text-[12px] font-semibold text-ok">이렇게</span>
                        <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-2">{f.fix}</span>
                        <CopyButton text={f.fix} label="복사" className="btn btn-ghost h-6 px-1 text-[12px]" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card mt-2.5 overflow-hidden" data-testid="review-rewrite">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
            <FileText size={13} className="text-ok" />
            <span className="text-[13px] font-semibold">바로 배포 가능한 리라이트</span>
            <span className="text-[12.5px] text-faint">대괄호 {countPlaceholders(review.rewrite)}곳</span>
            <CopyButton text={review.rewrite} label="전체 복사" className="btn btn-outline ml-auto h-7 px-2 text-[13px]" />
          </div>
          <div className="whitespace-pre-wrap px-4 py-4 text-[13px] leading-[1.8] text-ink-2 sm:px-5">{review.rewrite}</div>
        </section>

        {review.modeNote && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft px-3 py-2 text-[13px] leading-relaxed text-warn">
            <AlertTriangle size={12} className="mt-[2px] shrink-0" />
            <span>{review.modeNote}</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 px-1">
          <button type="button" onClick={onEdit} className="btn btn-outline h-8 px-3 text-[13px]">
            <ArrowLeft size={12} /> 다른 초안 검수
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(review.rewrite)
                .then(() => onNotice("리라이트를 복사했습니다."))
                .catch(() => onNotice("복사가 막혀 있습니다."));
            }}
            className="btn btn-primary h-8 px-3 text-[13px]"
          >
            <Sparkles size={12} /> 리라이트 복사
          </button>
          <span className="ml-auto text-[12.5px] text-faint">검수 결과는 저장되지 않습니다.</span>
        </div>
      </div>
    </div>
  );
}
