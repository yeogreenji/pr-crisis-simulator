import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Server, ShieldCheck, Trash2, X } from "lucide-react";
import type { LlmConfig } from "../types";
import { AI_ENDPOINT, checkAiServer } from "../lib/ai";
import { Toggle, cx } from "./ui";

export function ApiModal({
  open,
  config,
  onClose,
  onSave,
}: {
  open: boolean;
  config: LlmConfig;
  onClose: () => void;
  onSave: (c: LlmConfig) => void;
}) {
  const [draft, setDraft] = useState<LlmConfig>(config);
  const [show, setShow] = useState(false);
  const [testState, setTestState] = useState<{ status: "idle" | "loading" | "ok" | "warn" | "error"; message?: string }>({
    status: "idle",
  });

  useEffect(() => {
    if (!open) return;
    setDraft(config);
    setTestState({ status: "loading" });
    void checkAiServer().then((status) => {
      setTestState({
        status: status.ok ? (status.serverKey ? "ok" : "warn") : "error",
        message: status.message,
      });
    });
  }, [open, config]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="animate-rise relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(16,19,25,0.5)] sm:max-w-[520px] sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <div className="eyebrow">Realtime AI</div>
            <h2 className="mt-1 text-[15px] font-semibold tracking-tight">실시간 AI 분석</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              서버의 <code className="num rounded bg-paper-deep px-1 py-[1px] text-[10px]">{AI_ENDPOINT}</code>가
              gpt-4o-mini로 수정 초안 2종·채널 반응·기자 답변·골든타임을 다시 씁니다. 연결되지 않으면 로컬 규칙으로
              자동 전환되고, 위험 점수는 항상 내장 엔진이 계산합니다.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-paper-deep hover:text-ink" aria-label="닫기">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center justify-between rounded-lg border border-line bg-[#fcfcfa] px-3 py-2.5">
            <div>
              <div className="text-[11.5px] font-semibold text-ink">분석할 때 실시간 AI 사용</div>
              <div className="text-[10px] text-muted">꺼두면 내장 엔진만으로 끝납니다. (AI 호출 비용 없음)</div>
            </div>
            <Toggle checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} label="실시간 AI 사용" />
          </div>

          <div
            className={cx(
              "flex items-start gap-2 rounded-lg border px-3 py-2.5",
              testState.status === "ok" && "border-ok/25 bg-ok-soft",
              testState.status === "warn" && "border-warn/25 bg-warn-soft",
              testState.status === "error" && "border-risk/20 bg-risk-soft",
              (testState.status === "idle" || testState.status === "loading") && "border-line bg-[#fcfcfa]",
            )}
          >
            {testState.status === "loading" ? (
              <Loader2 size={13} className="mt-[1px] shrink-0 animate-spin text-muted" />
            ) : testState.status === "ok" ? (
              <CheckCircle2 size={13} className="mt-[1px] shrink-0 text-ok" />
            ) : (
              <Server size={13} className="mt-[1px] shrink-0 text-muted" />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-ink">
                {testState.status === "ok"
                  ? "서버 키 연결됨"
                  : testState.status === "warn"
                    ? "서버 키 없음"
                    : testState.status === "error"
                      ? "AI 백엔드 연결 안 됨"
                      : "서버 상태 확인 중…"}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                {testState.message ?? "잠시만 기다려 주세요."}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setTestState({ status: "loading" });
                const status = await checkAiServer();
                setTestState({ status: status.ok ? (status.serverKey ? "ok" : "warn") : "error", message: status.message });
              }}
              className="btn btn-outline ml-auto h-7 shrink-0 px-2 text-[10px]"
            >
              다시 확인
            </button>
          </div>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink-2">
              <KeyRound size={11} /> 개인 OpenAI 키 (선택)
            </span>
            <span className="relative block">
              <input
                className="field pr-9 font-mono text-[12px]"
                type={show ? "text" : "password"}
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder="서버 키가 없을 때만 사용 (sk-...)"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink"
                aria-label={show ? "키 가리기" : "키 보기"}
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </span>
          </label>

          <div className="flex items-start gap-2 rounded-lg border border-line bg-paper/60 px-3 py-2.5">
            <ShieldCheck size={13} className="mt-[1px] shrink-0 text-ok" />
            <p className="text-[10px] leading-relaxed text-muted">
              서버에 OPENAI_API_KEY가 있으면 개인 키는 쓰이지 않습니다. 개인 키는 이 브라우저 로컬 저장소에만 보관되고,
              이 사이트의 <code className="num">/api/analyze</code> 프록시를 거쳐 OpenAI로 전달됩니다. 초안은 분석에만
              쓰이며 서버에 저장하지 않습니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-[#fbfbf8] px-5 py-3.5">
          {config.apiKey && (
            <button
              type="button"
              onClick={() => {
                const cleared = { ...draft, apiKey: "", enabled: false };
                setDraft(cleared);
                onSave(cleared);
              }}
              className="btn btn-ghost h-8 px-2 text-[11px] text-muted hover:text-risk"
            >
              <Trash2 size={12} /> 키 삭제
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost h-8 px-3 text-[11.5px]">
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="btn btn-primary h-8 px-3.5 text-[11.5px]"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
