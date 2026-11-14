import { useState } from "react";
import { ChevronDown, ClipboardCheck, Download, FileText, PencilLine, Printer } from "lucide-react";
import type { Analysis } from "../../types";
import { Card, CopyButton, Eyebrow, SectionHead, cx } from "../ui";

function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <span key={i} className="num mx-0.5 rounded bg-warn-soft px-1 py-0.5 text-[10.5px] font-medium text-warn">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function ResponseTab({
  analysis,
  onLoadRevised,
  onExport,
  onPrint,
}: {
  analysis: Analysis;
  onLoadRevised: () => void;
  onExport: () => void;
  onPrint: () => void;
}) {
  const [open, setOpen] = useState<string | null>(analysis.qa[0]?.id ?? null);
  const ready = analysis.qa.filter((q) => q.status === "ready").length;

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={14} className="text-accent" />
          <span className="text-[12px] font-semibold text-ink">응답 팩</span>
          <span className="chip bg-paper-deep text-muted">
            준비 {ready}/{analysis.qa.length}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={onExport} className="btn btn-outline h-8 px-2.5 text-[11px]">
            <Download size={12} /> Markdown
          </button>
          <button type="button" onClick={onPrint} className="btn btn-outline h-8 px-2.5 text-[11px]">
            <Printer size={12} /> 인쇄용 리포트
          </button>
          <CopyButton text={analysis.revisedDraft} label="수정안 복사" className="btn btn-outline h-8 px-2.5 text-[11px] text-ink-2" />
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <SectionHead
              eyebrow="Q&A defense sheet"
              title="예상 질문 · 방어 답변"
              desc="확인 필요 값은 실제 수치로 교체해야 합니다."
            />
          </div>
          <div className="divide-y divide-line">
            {analysis.qa.map((q, i) => {
              const isOpen = open === q.id;
              return (
                <div key={q.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : q.id)}
                    className="flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-[#fcfcfa]"
                  >
                    <span className="num mt-[2px] text-[9.5px] text-faint">Q{i + 1}</span>
                    <span className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-ink">{q.question}</span>
                    <span
                      className={cx(
                        "chip shrink-0",
                        q.status === "ready" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
                      )}
                    >
                      {q.status === "ready" ? "준비됨" : "확인 필요"}
                    </span>
                    <ChevronDown
                      size={13}
                      className={cx("mt-[2px] shrink-0 text-faint transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                  {isOpen && (
                    <div className="animate-rise px-4 pb-3.5 pl-[42px]">
                      <p className="text-[11.5px] leading-[1.8] text-ink-2">
                        <Highlighted text={q.answer} />
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[9.5px] text-faint">{q.source}</span>
                        <CopyButton text={q.answer} label="답변 복사" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <Eyebrow>Revised statement</Eyebrow>
              <h3 className="mt-1 text-[14px] font-semibold tracking-tight">수정 1차안</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="num chip bg-ok-soft text-ok">
                {analysis.stats.suggestedGain > 0 ? `-${analysis.stats.suggestedGain}점` : "반영됨"}
              </span>
              <button
                type="button"
                onClick={onLoadRevised}
                className="btn btn-outline h-8 px-2.5 text-[11px]"
                title="수정안을 에디터로 보내 다시 분석"
              >
                <PencilLine size={12} /> 에디터로
              </button>
            </div>
          </div>

          <div className="max-h-[430px] flex-1 overflow-y-auto px-4 py-4">
            <div className="whitespace-pre-wrap text-[12.5px] leading-[1.95] text-ink-2 [word-break:keep-all]">
              <Highlighted text={analysis.revisedDraft} />
            </div>
          </div>

          <div className="border-t border-line bg-[#fbfbf8] px-4 py-2.5">
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
              <FileText size={11} className="mt-[1px] shrink-0" />
              사실·수치·일정은 초안에서 확인된 값만 유지했습니다. 대괄호 항목은 담당자가 확정해야 합니다.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
