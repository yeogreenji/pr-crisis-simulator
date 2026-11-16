import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileText,
  PencilLine,
  Printer,
  ShieldAlert,
} from "lucide-react";
import type { Analysis } from "../../types";
import { getIndustry } from "../../lib/industries";
import { Card, CopyButton, Eyebrow, SeverityTag, cx } from "../ui";
import { RevisionCards } from "../RevisionCards";
import { GoldenTimePlan } from "../GoldenTimePlan";

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
  onLoadToEditor,
  onLoadRevised,
  onExport,
  onPrint,
}: {
  analysis: Analysis;
  onLoadToEditor: (body: string) => void;
  onLoadRevised: () => void;
  onExport: () => void;
  onPrint: () => void;
}) {
  const [open, setOpen] = useState<string | null>(analysis.pressQa[0]?.id ?? null);
  const [engineOpen, setEngineOpen] = useState(false);
  const industry = getIndustry(analysis.industry);

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={14} className="text-accent" />
          <span className="text-[12px] font-semibold text-ink">응답 팩</span>
          <span className="chip bg-paper-deep text-muted">수정안 2종 · 질문 {analysis.pressQa.length}</span>
          <span className={cx("chip", analysis.mode === "ai" ? "bg-ok-soft text-ok" : "bg-paper-deep text-muted")}>
            {analysis.mode === "ai" ? "실시간 AI" : "로컬 규칙"}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={onExport} className="btn btn-outline h-8 px-2.5 text-[11px]">
            <Download size={12} /> Markdown
          </button>
          <button type="button" onClick={onPrint} className="btn btn-outline h-8 px-2.5 text-[11px]">
            <Printer size={12} /> 인쇄용 리포트
          </button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <Eyebrow>Revised statements</Eyebrow>
          <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em]">전체 수정 초안 2버전</h2>
        </div>
        <span className="text-[10.5px] text-muted">대괄호 [확인 필요] 값만 실제 수치·일정으로 바꿔 배포하세요.</span>
      </div>

      <RevisionCards revisions={analysis.revisions} mode={analysis.mode} onLoadToEditor={onLoadToEditor} />

      <Card className="overflow-hidden" data-testid="press-qa">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <Eyebrow>Press defense sheet</Eyebrow>
            <h3 className="mt-1 text-[14px] font-semibold tracking-tight">기자 압박 질문 · 모범 답변 · 금기 표현</h3>
            <p className="mt-1 text-[11px] text-muted">질문을 받은 순간 바로 읽을 수 있는 답변 방향과, 그 자리에서 피해야 할 말입니다.</p>
          </div>
          <span className="chip bg-paper-deep text-muted">{analysis.pressQa.length}문항</span>
        </div>

        <div className="divide-y divide-line">
          {analysis.pressQa.map((q, i) => {
            const isOpen = open === q.id;
            return (
              <div key={q.id}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : q.id)}
                  className="flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-[#fcfcfa]"
                >
                  <span className="num mt-[2px] shrink-0 text-[9.5px] text-faint">Q{i + 1}</span>
                  <span className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-ink">{q.question}</span>
                  {q.source === "ai" && <span className="chip hidden bg-ok-soft text-[9px] text-ok sm:inline-flex">AI</span>}
                  <SeverityTag level={q.severity} />
                  <ChevronDown
                    size={13}
                    className={cx("mt-[2px] shrink-0 text-faint transition-transform", isOpen && "rotate-180")}
                  />
                </button>
                {isOpen && (
                  <div className="animate-rise px-4 pb-3.5 pl-[42px]">
                    <div className="rounded-lg border border-line bg-[#fbfbf8] px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">답변 가이드</p>
                      <p className="mt-1 text-[11.5px] leading-[1.8] text-ink-2">
                        <Highlighted text={q.answerGuide} />
                      </p>
                    </div>
                    {q.avoid.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-start gap-1.5">
                        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-risk">
                          <ShieldAlert size={11} /> 피해야 할 말
                        </span>
                        {q.avoid.map((a) => (
                          <span key={a} className="chip bg-risk-soft text-[9.5px] text-risk">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[9.5px] text-faint">
                        {q.source === "ai" ? "AI 실시간 생성" : `${industry.short} 매뉴얼 · 확인 필요 값 포함`}
                      </span>
                      <CopyButton text={`${q.question}\n\n${q.answerGuide}${q.avoid.length ? `\n\n[피해야 할 말] ${q.avoid.join(", ")}` : ""}`} label="답변 복사" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <GoldenTimePlan steps={analysis.goldenTime} industryLabel={industry.short} />

      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setEngineOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-[#fcfcfa]"
        >
          <FileText size={13} className="text-muted" />
          <span className="text-[12px] font-semibold text-ink">엔진 자동 교체안 (참고)</span>
          <span className="chip bg-paper-deep text-[9.5px] text-muted">
            {analysis.stats.suggestedGain > 0 ? `-${analysis.stats.suggestedGain}점` : "반영됨"}
          </span>
          <span className="ml-auto text-[10px] text-faint">문장 X-ray 교체를 일괄 적용한 결과</span>
          <ChevronDown size={13} className={cx("shrink-0 text-faint transition-transform", engineOpen && "rotate-180")} />
        </button>
        {engineOpen && (
          <div className="animate-rise border-t border-line">
            <div className="max-h-[320px] overflow-y-auto px-4 py-4">
              <div className="whitespace-pre-wrap text-[12px] leading-[1.9] text-ink-2 [word-break:keep-all]">
                <Highlighted text={analysis.revisedDraft} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-[#fbfbf8] px-4 py-2.5">
              <p className="flex min-w-0 flex-1 items-start gap-1.5 text-[10px] leading-relaxed text-muted">
                <AlertTriangle size={11} className="mt-[1px] shrink-0" />
                위 두 버전과 달리 문장 교체만 적용한 원본 구조입니다. 비교용으로만 쓰세요.
              </p>
              <CopyButton text={analysis.revisedDraft} label="복사" />
              <button type="button" onClick={onLoadRevised} className="btn btn-outline h-7 px-2 text-[10.5px]">
                <PencilLine size={11} /> 에디터로
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
