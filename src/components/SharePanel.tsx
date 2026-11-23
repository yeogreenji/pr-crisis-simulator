import { useState } from "react";
import { Check, Copy, ExternalLink, Info, Link2, ShieldCheck, X } from "lucide-react";
import { cx } from "./ui";

export function SharePanel({
  open,
  url,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  url: string;
  loading: boolean;
  error?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="공유 링크">
      <div className="w-full max-w-[560px] overflow-hidden rounded-t-2xl border border-line bg-paper shadow-float sm:rounded-2xl" data-testid="share-panel">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5">
          <div>
            <div className="eyebrow">Share · read-only</div>
            <h2 className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.02em] text-ink">
              <Link2 size={14} className="text-muted" /> 임원·법무팀 공유 링크
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              로그인 없이 열리는 읽기 전용 브리핑입니다. 수정·재생성 버튼은 링크에 포함되지 않습니다.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" data-testid="share-close" className="btn btn-outline h-8 w-8 shrink-0 px-0">
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-4">
          {loading && (
            <div className="rounded-xl border border-line bg-surface px-3 py-6 text-center text-[12.5px] text-muted" data-testid="share-loading">
              브리핑을 압축해 링크를 만드는 중…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-risk/25 bg-risk-soft px-3 py-3 text-[12.5px] leading-relaxed text-risk" data-testid="share-error">
              {error}
            </div>
          )}

          {!loading && !error && url && (
            <>
              <div className="rounded-xl border border-line bg-surface p-2">
                <textarea
                  readOnly
                  value={url}
                  data-testid="share-url"
                  aria-label="공유 링크"
                  rows={3}
                  className="w-full resize-none break-all bg-transparent px-1.5 py-1 font-mono text-[11.5px] leading-relaxed text-ink-2 outline-none"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid="share-copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className={cx("btn h-8 px-3 text-[12.5px]", copied ? "border border-ok bg-ok-soft text-ok" : "btn-primary")}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "복사됨" : "링크 복사"}
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="share-preview"
                  className="btn btn-outline h-8 px-3 text-[12.5px]"
                >
                  <ExternalLink size={12} /> 브리핑 미리 보기
                </a>
                <span className="num ml-auto text-[11px] text-faint">{url.length.toLocaleString()}자</span>
              </div>
            </>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-ok/20 bg-ok-soft/40 px-3 py-2">
              <div className="flex items-center gap-1 text-[11.5px] font-semibold text-ok">
                <ShieldCheck size={11} /> 링크에 담기는 것
              </div>
              <ul className="mt-1 space-y-0.5 text-[11.5px] leading-relaxed text-ink-2">
                <li>· 임원 요약 · 종합 위험지수 7축</li>
                <li>· 4채널 문안(입장문·Q&A·사내·SNS)</li>
                <li>· 1·6·24시간 실행 순서 · 유관기관 접점</li>
              </ul>
            </div>
            <div className="rounded-xl border border-line bg-surface px-3 py-2">
              <div className="flex items-center gap-1 text-[11.5px] font-semibold text-muted">
                <Info size={11} /> 담기지 않는 것
              </div>
              <ul className="mt-1 space-y-0.5 text-[11.5px] leading-relaxed text-muted">
                <li>· 입력 원문 전체 · 기사 URL</li>
                <li>· API 키 · 브라우저 저장 기록</li>
                <li>· 다른 시나리오·비교 결과</li>
              </ul>
            </div>
          </div>

          <p className="mt-3 rounded-lg border border-warn/25 bg-warn-soft px-2.5 py-2 text-[11.5px] leading-relaxed text-warn">
            링크를 아는 사람은 누구나 열 수 있습니다. 대외비 사안이면 사내 보안 정책에 맞는 채널로만 전달하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
