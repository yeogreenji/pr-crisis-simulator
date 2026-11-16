import { ArrowUpRight, Check, Copy } from "lucide-react";
import type { RevisionVariant } from "../types";
import { Card, CopyButton, cx } from "./ui";

const VARIANT_TAG: Record<RevisionVariant["id"], string> = {
  empathy: "V1",
  authority: "V2",
};

export function RevisionCards({
  revisions,
  mode,
  onLoadToEditor,
}: {
  revisions: RevisionVariant[];
  mode: "ai" | "local";
  onLoadToEditor: (body: string) => void;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {revisions.map((r) => (
        <Card key={r.id} className="flex min-w-0 flex-col overflow-hidden" data-testid="revision-card">
          <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="num grid h-5 w-5 place-items-center rounded-[6px] bg-ink text-[9.5px] font-bold text-white">
                  {VARIANT_TAG[r.id]}
                </span>
                <h3 className="truncate text-[13px] font-semibold tracking-tight text-ink">{r.label}</h3>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                <span className="chip bg-paper-deep px-1.5 py-0 text-[9.5px] text-ink-2">{r.audience}</span>
                <span>{mode === "ai" ? "AI 작성 · 확인 필요 값은 대괄호" : "규칙 기반 · 업종 매뉴얼 반영"}</span>
              </p>
            </div>
            <CopyButton text={r.body} label="복사" className="btn btn-outline h-7 shrink-0 px-2 text-[10.5px]" />
          </div>

          {r.changes.length > 0 && (
            <ul className="space-y-1 border-b border-line bg-[#fbfbf8] px-4 py-2.5">
              {r.changes.slice(0, 4).map((c, i) => (
                <li key={i} className="flex gap-1.5 text-[10.5px] leading-relaxed text-ink-2">
                  <Check size={11} className="mt-[3px] shrink-0 text-ok" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="max-h-[300px] flex-1 overflow-y-auto px-4 py-3">
            <div
              className="revision-body whitespace-pre-wrap text-[11.5px] leading-[1.9] text-ink-2 [word-break:keep-all]"
              data-revision={r.id}
            >
              {r.body}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-line bg-[#fbfbf8] px-4 py-2">
            <span className="flex items-center gap-1 text-[9.5px] text-faint">
              <Copy size={10} /> {r.body.length.toLocaleString()}자 · 복사 후 편집
            </span>
            <button
              type="button"
              onClick={() => onLoadToEditor(r.body)}
              className={cx("btn btn-ghost h-7 px-2 text-[10.5px] text-ink-2 hover:text-ink")}
            >
              에디터로 <ArrowUpRight size={11} />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
