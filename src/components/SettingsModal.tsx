import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, RefreshCw, Server, ShieldCheck, Trash2, X } from "lucide-react";
import type { LlmConfig } from "../types";
import { ANALYZE_ENDPOINT, checkServer, type ServerStatus } from "../lib/package-ai";
import { Toggle, cx } from "./ui";

export function SettingsModal({
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
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(config);
    setChecking(true);
    void checkServer().then((s) => {
      setStatus(s);
      setChecking(false);
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

  const healthy = status?.ok && status.serverKey;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="animate-rise relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(16,19,25,0.5)] sm:max-w-[520px] sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <div className="eyebrow">Realtime AI</div>
            <h2 className="mt-1 text-[15px] font-semibold tracking-tight">AI 연결 설정</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              <code className="num rounded bg-paper-deep px-1 py-[1px] text-[12.5px]">{ANALYZE_ENDPOINT}</code>가 Gemini(또는
              OpenAI)로 패키지를 다시 씁니다. 연결되지 않아도 매뉴얼 엔진으로 패키지가 나옵니다.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-paper-deep hover:text-ink" aria-label="닫기">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3.5 px-5 py-4">
          <div className="flex items-center justify-between rounded-lg border border-line bg-tint px-3 py-2.5">
            <div>
              <div className="text-[13px] font-semibold text-ink">패키지 만들 때 실시간 AI 사용</div>
              <div className="text-[12.5px] text-muted">꺼두면 매뉴얼 엔진만으로 즉시 생성합니다.</div>
            </div>
            <Toggle checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} label="실시간 AI 사용" />
          </div>

          <div
            className={cx(
              "flex items-start gap-2 rounded-lg border px-3 py-2.5",
              healthy ? "border-ok/25 bg-ok-soft" : status?.ok ? "border-warn/25 bg-warn-soft" : "border-line bg-tint",
            )}
          >
            {checking ? (
              <Loader2 size={13} className="mt-[1px] shrink-0 animate-spin text-muted" />
            ) : healthy ? (
              <CheckCircle2 size={13} className="mt-[1px] shrink-0 text-ok" />
            ) : (
              <Server size={13} className="mt-[1px] shrink-0 text-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">
                {checking ? "서버 상태 확인 중…" : healthy ? "서버 키 연결됨" : status?.ok ? "서버 키 없음 · 개인 키 필요" : "AI 백엔드 연결 안 됨"}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                {status?.message ?? "잠시만 기다려 주세요."}
              </p>
              {status?.ok && (
                <p className="mt-1 text-[12.5px] text-faint">
                  제공자 {status.provider ?? "없음"} · 모델 {status.model} · 기사 URL 읽기 {status.urlFetch ? "지원" : "미지원"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={async () => {
                setChecking(true);
                const s = await checkServer();
                setStatus(s);
                setChecking(false);
              }}
              className="btn btn-outline ml-auto h-7 shrink-0 px-2 text-[12.5px]"
            >
              <RefreshCw size={10} /> 다시 확인
            </button>
          </div>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
              <KeyRound size={11} /> 개인 AI 키 (선택 · Gemini AQ./AIza… 또는 OpenAI sk-…)
            </span>
            <span className="relative block">
              <input
                className="field pr-9 font-mono text-[13.5px]"
                type={show ? "text" : "password"}
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder="서버 키가 없을 때만 사용"
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
            <p className="text-[12.5px] leading-relaxed text-muted">
              서버에 GEMINI_API_KEY나 OPENAI_API_KEY가 있으면 개인 키는 쓰이지 않습니다. 개인 키는 이 브라우저에만 저장되고,
              이 사이트의 /api/analyze 프록시를 거쳐 해당 AI 제공자로 전달됩니다. 입력한 상황·기사 본문은 분석에만 쓰이고
              서버에 저장하지 않습니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-tint px-5 py-3.5">
          {config.apiKey && (
            <button
              type="button"
              onClick={() => {
                const cleared = { ...draft, apiKey: "", enabled: false };
                setDraft(cleared);
                onSave(cleared);
              }}
              className="btn btn-ghost h-8 px-2 text-[13px] text-muted hover:text-risk"
            >
              <Trash2 size={12} /> 키 삭제
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost h-8 px-3 text-[13px]">
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="btn btn-primary h-8 px-3.5 text-[13px]"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
