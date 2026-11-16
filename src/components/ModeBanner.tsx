import { AlertTriangle, Loader2, Radio, RotateCw, Settings2, Sparkles } from "lucide-react";
import type { Analysis } from "../types";
import { cx } from "./ui";

export function ModeBanner({
  analysis,
  pending,
  aiEnabled,
  onRetry,
  onOpenSettings,
}: {
  analysis: Analysis;
  pending: boolean;
  aiEnabled: boolean;
  onRetry: () => void;
  onOpenSettings: () => void;
}) {
  const ai = analysis.mode === "ai";
  const latency = analysis.ai?.latencyMs
    ? analysis.ai.latencyMs >= 1000
      ? `${(analysis.ai.latencyMs / 1000).toFixed(1)}초`
      : `${analysis.ai.latencyMs}ms`
    : null;

  if (pending) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/25 bg-accent-soft px-3.5 py-2.5">
        <Loader2 size={14} className="animate-spin text-accent" />
        <span className="text-[11.5px] font-semibold text-accent-deep">실시간 AI 분석 중…</span>
        <span className="text-[10.5px] text-accent-deep/70">
          지금 보이는 결과는 로컬 규칙 모드입니다. AI가 문안·질문·골든타임을 다시 쓰면 자동으로 바뀝니다.
        </span>
      </div>
    );
  }

  if (!ai) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-paper-deep text-muted">
          <Radio size={12} />
        </span>
        <span className="text-[11.5px] font-semibold text-ink">로컬 규칙 모드</span>
        <span className="chip bg-paper-deep text-muted">업종 매뉴얼 엔진 v2.5</span>
        <span className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-muted">
          {analysis.modeNote ?? "실시간 AI를 사용하지 않고 내장 규칙으로 분석했습니다."}
        </span>
        {aiEnabled ? (
          <button type="button" onClick={onRetry} className="btn btn-outline h-7 px-2.5 text-[10.5px]">
            <RotateCw size={11} /> AI로 다시 분석
          </button>
        ) : (
          <button type="button" onClick={onOpenSettings} className="btn btn-outline h-7 px-2.5 text-[10.5px]">
            <Settings2 size={11} /> AI 켜기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ok/25 bg-ok-soft px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-ok text-white">
          <Sparkles size={12} />
        </span>
        <span className="text-[11.5px] font-semibold text-ok">실시간 AI 분석</span>
        <span className="chip bg-white/70 text-ok">{analysis.ai?.model ?? "gpt-4o-mini"}</span>
        {typeof analysis.ai?.score === "number" && (
          <span className="num chip bg-white/70 text-ok">AI 판단 {analysis.ai.score}/100</span>
        )}
        <span className="ml-auto text-[10px] text-ok/80">
          {latency ? `${latency} · ` : ""}
          {analysis.ai?.usedAt
            ? `${new Date(analysis.ai.usedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 생성`
            : ""}
        </span>
      </div>
      {analysis.ai?.comment && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-ok/90">
          <AlertTriangle size={11} className="mt-[2px] shrink-0" />
          {analysis.ai.comment}
        </p>
      )}
      <p className={cx("mt-1 text-[9.5px] text-ok/70")}>
        초안·수치·일정은 AI가 만들지 않습니다. [확인 필요] 항목은 담당자가 확정해야 합니다.
      </p>
    </div>
  );
}
