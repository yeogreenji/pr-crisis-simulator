import { useState } from "react";
import { ArrowRight, Check, FileSearch, Gavel, Info, Landmark, ShieldQuestion, Users2 } from "lucide-react";
import type { IncidentInvestigation, InvestigationSide, InvestigationTeam } from "../lib/investigation";
import { investigationToText } from "../lib/investigation";
import { CASE_VERDICT_LABEL } from "../lib/cases";
import { CopyButton, cx } from "./ui";

const SIDE_STYLE: Record<InvestigationSide, string> = {
  언론: "border-accent/25 bg-accent-soft/70 text-accent-deep",
  여론: "border-warn/25 bg-warn-soft text-warn",
  규제: "border-risk/20 bg-risk-soft text-risk",
};

const TEAM_STYLE: Record<InvestigationTeam, string> = {
  PR: "bg-paper-deep text-ink-2",
  법무: "bg-risk-soft text-risk",
  운영: "bg-warn-soft text-warn",
  데이터: "bg-accent-soft text-accent-deep",
  총괄: "bg-ink text-white",
};

const VERDICT_STYLE: Record<string, string> = {
  exemplary: "bg-ok-soft text-ok",
  mixed: "bg-warn-soft text-warn",
  failure: "bg-risk-soft text-risk",
};

export function InvestigationBlock({
  inv,
  onOpenCase,
}: {
  inv: IncidentInvestigation;
  onOpenCase?: (id: string) => void;
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const total = inv.checks.length;
  const open = total - done.size;
  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="card overflow-hidden" data-testid="block-investigation">
      <div className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span className="mt-[1px] grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-white">
          <FileSearch size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-ink">사건 조사 — 확인된 것과 확인할 것</h2>
            <span className="num chip border border-line bg-white px-1.5 py-0 text-[11.5px] font-medium text-muted">
              {inv.fileNo}
            </span>
            <span
              className={cx(
                "chip px-1.5 py-0 text-[11.5px] font-semibold",
                open === 0 ? "bg-ok-soft text-ok" : "bg-paper-deep text-muted",
              )}
              data-testid="investigation-progress"
            >
              확인 {done.size}/{total}
              {open > 0 ? ` · 미확인 ${open}` : " · 모두 확인"}
            </span>
            {inv.source === "ai" && (
              <span className="chip border border-line bg-white px-1.5 py-0 text-[11.5px] text-faint">실시간 AI 조사</span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            문안을 쓰기 전에 여는 조사 파일입니다. 아래 체크 항목은 입장문의 [확인 필요] 값과 같은 출처를 쓰므로,
            하나씩 닫히면 그대로 배포 문안이 됩니다. 체크 상태는 이 브라우저에만 남습니다.
          </p>
        </div>
        <CopyButton text={investigationToText(inv)} label="조사 리스트 복사" className="btn btn-outline hidden h-7 shrink-0 px-2 text-[12.5px] sm:inline-flex" />
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]">
        {/* 사건 개요 및 배경 */}
        <div className="px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-1.5">
            <Info size={12} className="text-muted" />
            <span className="text-[12.5px] font-semibold text-ink">사건 개요 및 배경</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-[1.7] text-ink-2" data-testid="investigation-summary">
            {inv.summary}
          </p>
          {inv.trigger && (
            <div className="mt-2 rounded-lg border border-line bg-[#fcfcfa] px-2.5 py-1.5">
              <span className="text-[11.5px] font-semibold text-faint">촉발 요인</span>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{inv.trigger}</p>
            </div>
          )}
          <ul className="mt-2 space-y-1">
            {inv.background.map((line) => (
              <li key={line} className="flex gap-1.5 text-[12.5px] leading-relaxed text-muted">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-faint" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 핵심 쟁점 및 여론·보도 포인트 */}
        <div className="border-t border-line px-4 py-3.5 sm:px-5 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-1.5">
            <ShieldQuestion size={12} className="text-muted" />
            <span className="text-[12.5px] font-semibold text-ink">핵심 쟁점 및 여론·보도 포인트</span>
          </div>
          <ol className="mt-2 space-y-1.5" data-testid="investigation-issues">
            {inv.issues.map((issue, i) => (
              <li key={`${issue.side}-${i}`} className="rounded-lg border border-line bg-[#fcfcfa] px-2.5 py-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cx("chip shrink-0 border px-1.5 py-0 text-[11px] font-semibold", SIDE_STYLE[issue.side])}>
                    {issue.side}
                  </span>
                  {issue.title && <span className="text-[12.5px] font-semibold text-ink">{issue.title}</span>}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{issue.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* 규제 접점 · 관련 법령 */}
      {inv.context.length > 0 && (
        <div className="space-y-1.5 border-t border-line px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Landmark size={11} className="shrink-0 text-muted" />
            <span className="shrink-0 text-[11.5px] font-semibold text-muted">규제 접점</span>
            {inv.context
              .filter((c) => c.kind === "regulator")
              .map((c) => (
                <span
                  key={c.name}
                  title={c.note}
                  className="chip max-w-full truncate border border-line bg-white px-1.5 py-0 text-[11.5px] font-medium text-ink-2"
                >
                  {c.name}
                </span>
              ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Gavel size={11} className="shrink-0 text-muted" />
            <span className="shrink-0 text-[11.5px] font-semibold text-muted">관련 법령</span>
            {inv.context
              .filter((c) => c.kind === "law")
              .map((c) => (
                <span
                  key={c.name}
                  title={c.note}
                  className="chip max-w-full truncate border border-line bg-white px-1.5 py-0 text-[11.5px] font-medium text-ink-2"
                >
                  {c.name}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* 실무 팩트체크 리스트 */}
      <div className="border-t border-line" data-testid="investigation-checks">
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-1 pt-3 sm:px-5">
          <Users2 size={12} className="text-warn" />
          <span className="text-[12.5px] font-semibold text-ink">실무 팩트체크 — 대외 발표 전에 닫아야 하는 항목</span>
          <span className="text-[11.5px] text-faint">담당 팀까지 지정 · 체크하면 진행률이 올라갑니다</span>
        </div>
        <ul className="grid gap-1.5 px-4 pb-3 pt-1.5 sm:px-5 lg:grid-cols-2">
          {inv.checks.map((check) => {
            const checked = done.has(check.id);
            return (
              <li key={check.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  data-testid={`investigation-check-${check.id}`}
                  onClick={() => toggle(check.id)}
                  className={cx(
                    "group flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    checked ? "border-ok/30 bg-ok-soft/40" : "border-line bg-white hover:border-ink/25",
                  )}
                >
                  <span
                    className={cx(
                      "mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
                      checked
                        ? "border-ok bg-ok text-white"
                        : "border-line-strong bg-white text-transparent group-hover:border-ink/40",
                    )}
                  >
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cx(
                          "shrink-0 rounded px-1 py-[1px] text-[10.5px] font-semibold",
                          TEAM_STYLE[check.team],
                        )}
                      >
                        {check.team}
                      </span>
                      <span
                        className={cx(
                          "text-[12.5px] font-medium leading-snug",
                          checked ? "text-faint line-through" : "text-ink-2",
                        )}
                      >
                        {check.item}
                      </span>
                      {check.severity === 3 && !checked && (
                        <span className="shrink-0 rounded bg-risk-soft px-1 py-[1px] text-[10px] font-semibold text-risk">필수</span>
                      )}
                    </span>
                    <span className={cx("mt-0.5 block text-[11.5px] leading-relaxed", checked ? "text-faint" : "text-muted")}>
                      {check.why}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {inv.evidence.length > 0 && (
          <div className="mx-4 mb-3 rounded-lg border border-line bg-[#fcfcfa] px-2.5 py-2 sm:mx-5">
            <span className="text-[11.5px] font-semibold text-faint">확보해 둘 증거</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {inv.evidence.map((item) => (
                <span key={item} className="chip border border-line bg-white px-1.5 py-0 text-[11.5px] text-muted">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 pb-3 pt-2 sm:hidden">
          <span className="text-[11.5px] leading-relaxed text-faint">
            체크 상태는 이 브라우저에만 남습니다. 팀 공유는 ‘조사 리스트 복사’로 내보내세요.
          </span>
          <CopyButton
            text={investigationToText(inv)}
            label="조사 리스트 복사"
            className="btn btn-outline h-7 shrink-0 px-2 text-[12px] sm:hidden"
          />
        </div>
      </div>

      {/* 확산 경로 + 참고 사례 */}
      <div className="grid gap-0 border-t border-line bg-[#fbfbf8] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="px-4 py-3 sm:px-5">
          <span className="text-[11.5px] font-semibold text-faint">이 유형이 커지는 경로</span>
          <ol className="mt-1.5 space-y-1">
            {inv.pattern.map((step, i) => (
              <li key={step} className="flex gap-2 text-[12px] leading-relaxed text-ink-2">
                <span className="num mt-[1px] text-[11.5px] font-semibold text-faint">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="border-t border-line px-4 py-3 sm:px-5 lg:border-l lg:border-t-0">
          <span className="text-[11.5px] font-semibold text-faint">참고 맥락</span>
          {inv.precedent ? (
            <div className="mt-1.5 rounded-lg border border-line bg-white px-2.5 py-2" data-testid="investigation-precedent">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cx("chip px-1.5 py-0 text-[11px] font-semibold", VERDICT_STYLE[inv.precedent.verdict] ?? "bg-paper-deep text-muted")}>
                  {CASE_VERDICT_LABEL[inv.precedent.verdict] ?? "사례"}
                </span>
                <span className="text-[12px] text-faint">{inv.precedent.date}</span>
                {inv.precedent.reason && <span className="text-[11px] text-faint">{inv.precedent.reason}</span>}
              </div>
              {onOpenCase && inv.precedent.caseId ? (
                <button
                  type="button"
                  onClick={() => onOpenCase(inv.precedent!.caseId)}
                  className="mt-1 block text-left text-[12.5px] font-semibold leading-snug text-ink hover:underline"
                >
                  {inv.precedent.company} — {inv.precedent.title} <ArrowRight size={11} className="inline" />
                </button>
              ) : (
                <div className="mt-1 text-[12.5px] font-semibold leading-snug text-ink">
                  {inv.precedent.company} — {inv.precedent.title}
                </div>
              )}
              <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-muted">{inv.precedent.takeaway}</p>
            </div>
          ) : (
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              같은 유형의 검수 사례가 아직 없습니다. 사례를 억지로 붙이지 않고 위 확산 경로와 매뉴얼 기준으로 조사합니다.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
