import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import type { LlmConfig } from "../types";
import { testLlmConnection } from "../lib/llm";
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
  const [testState, setTestState] = useState<{ status: "idle" | "loading" | "ok" | "error"; message?: string }>({
    status: "idle",
  });

  useEffect(() => {
    if (open) {
      setDraft(config);
      setTestState({ status: "idle" });
    }
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
            <div className="eyebrow">Optional</div>
            <h2 className="mt-1 text-[15px] font-semibold tracking-tight">LLM 정밀 분석</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              내장 엔진 결과에 LLM의 헤드라인·취재 질문을 더합니다. 비워 두어도 모든 기능이 동작합니다.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-paper-deep hover:text-ink" aria-label="닫기">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center justify-between rounded-lg border border-line bg-[#fcfcfa] px-3 py-2.5">
            <div>
              <div className="text-[11.5px] font-semibold text-ink">분석 시 LLM 사용</div>
              <div className="text-[10px] text-muted">꺼두면 내장 엔진만으로 분석합니다.</div>
            </div>
            <Toggle checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} label="LLM 사용" />
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold text-ink-2">제공자</span>
            <div className="seg w-full">
              {[
                ["openai", "OpenAI 호환"],
                ["anthropic", "Anthropic"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  data-active={draft.provider === id}
                  className="seg-item flex-1"
                  onClick={() => setDraft({ ...draft, provider: id as LlmConfig["provider"] })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-ink-2">모델</span>
            <input
              className="field"
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder={draft.provider === "openai" ? "gpt-4o-mini" : "claude-3-5-haiku-latest"}
              spellCheck={false}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink-2">
              <KeyRound size={11} /> API 키
            </span>
            <span className="relative block">
              <input
                className="field pr-9 font-mono text-[12px]"
                type={show ? "text" : "password"}
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder="sk-..."
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
              키는 이 브라우저의 로컬 저장소에만 보관되며 서버로 전송되지 않습니다. 브라우저에서 API를 직접 호출하므로
              제공자의 CORS 정책에 따라 실패할 수 있고, 그때도 내장 엔진 결과가 그대로 표시됩니다.
            </p>
          </div>

          {testState.status !== "idle" && (
            <div
              className={cx(
                "rounded-lg border px-3 py-2 text-[10.5px] leading-relaxed",
                testState.status === "ok" && "border-ok/25 bg-ok-soft text-ok",
                testState.status === "error" && "border-risk/20 bg-risk-soft text-risk",
                testState.status === "loading" && "border-line bg-[#fcfcfa] text-muted",
              )}
            >
              {testState.status === "loading" && "연결 확인 중…"}
              {testState.status === "ok" && `연결 성공 · ${testState.message}`}
              {testState.status === "error" && `연결 실패 · ${testState.message}`}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-[#fbfbf8] px-5 py-3.5">
          <button
            type="button"
            className="btn btn-outline h-8 px-3 text-[11.5px]"
            disabled={testState.status === "loading" || !draft.apiKey.trim()}
            onClick={async () => {
              setTestState({ status: "loading" });
              try {
                const msg = await testLlmConnection(draft);
                setTestState({ status: "ok", message: msg });
              } catch (e) {
                setTestState({ status: "error", message: e instanceof Error ? e.message : "알 수 없는 오류" });
              }
            }}
          >
            {testState.status === "loading" ? <Loader2 size={12} className="animate-spin" /> : null}
            연결 확인
          </button>

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
