import { AlertCircle, FileWarning, Quote } from "lucide-react";
import type { Analysis } from "../../types";
import { getIndustry } from "../../lib/industries";
import { Card, Eyebrow, SectionHead, SeverityTag, cx } from "../ui";

export function PressTab({ analysis }: { analysis: Analysis }) {
  const critical = analysis.headlines.filter((h) => h.tone === "critical");
  const positive = analysis.headlines.filter((h) => h.tone === "positive");
  const industry = getIndustry(analysis.industry);
  const industryChecks = analysis.structureChecks.slice(6);
  const passed = industryChecks.filter((c) => c.ok).length;

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <Card className="p-4">
          <SectionHead
            eyebrow="Press angle"
            title="예상 헤드라인"
            desc="이 초안 그대로 배포될 때 실제로 나올 수 있는 제목입니다."
            action={<span className="num chip bg-paper-deep text-muted">{analysis.headlines.length}</span>}
          />

          <div className="mt-3.5 space-y-2">
            {critical.map((h, i) => (
              <article key={`c-${i}`} className="relative overflow-hidden rounded-[10px] border border-line bg-[#fcfcfa] py-3 pl-4 pr-3">
                <span className="absolute inset-y-0 left-0 w-[2.5px] bg-risk/65" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-risk-soft text-risk">비판 각도</span>
                  <span className="text-[10px] font-medium text-faint">{h.outlet}</span>
                  <span className="num ml-auto text-[10px] text-faint/70">0{i + 1}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] font-semibold leading-[1.55] tracking-[-0.015em] text-ink">{h.text}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{h.note}</p>
              </article>
            ))}

            <div className="flex items-center gap-2 pb-0.5 pt-1.5">
              <Eyebrow>대응이 성과를 냈을 때</Eyebrow>
              <div className="hairline flex-1" />
            </div>

            {positive.map((h, i) => (
              <article key={`p-${i}`} className="relative overflow-hidden rounded-[10px] border border-line bg-[#fcfcfa] py-3 pl-4 pr-3">
                <span className="absolute inset-y-0 left-0 w-[2.5px] bg-ok/60" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-ok-soft text-ok">긍정 프레임</span>
                  <span className="text-[10px] font-medium text-faint">{h.outlet}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] font-semibold leading-[1.55] tracking-[-0.015em] text-ink">{h.text}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{h.note}</p>
              </article>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionHead
            eyebrow="Fact-check"
            title="기자가 물을 질문"
            desc="답변 팩에서 미리 막아야 할 질문입니다."
            action={<span className="num chip bg-paper-deep text-muted">{analysis.factChecks.length}</span>}
          />
          <ol className="mt-3 divide-y divide-line">
            {analysis.factChecks.map((f, i) => (
              <li key={i} className="flex gap-3 py-3 first:pt-1 last:pb-0">
                <span
                  className={cx(
                    "num mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-semibold",
                    f.severity === 3 ? "bg-risk-soft text-risk" : "bg-paper-deep text-muted",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-ink">{f.question}</p>
                    <SeverityTag level={f.severity} />
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{f.why}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="space-y-3">
        <Card className="overflow-hidden">
          <div className="grid-paper border-b border-line bg-[#fbfbf8] px-4 py-3">
            <Eyebrow>기자 시선</Eyebrow>
          </div>
          <div className="p-4">
            <Quote size={18} className="text-accent/60" />
            <p className="mt-2 text-[12.5px] font-medium leading-[1.75] text-ink-2">{analysis.pressAngle}</p>
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <span className="h-1.5 w-1.5 rounded-full bg-risk" />
              <p className="text-[10.5px] text-muted">
                고위험 문장 {analysis.stats.criticalSpans}개 · 참고 문장{" "}
                {analysis.stats.riskySpans - analysis.stats.criticalSpans}개
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <SectionHead eyebrow="Evidence gap" title="빠진 근거" desc="기사가 나간 뒤에 채우면 늦습니다." />
          <div className="mt-3 space-y-2">
            {analysis.missing.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg bg-ok-soft px-3 py-2.5">
                <AlertCircle size={14} className="mt-[1px] shrink-0 text-ok" />
                <p className="text-[11.5px] leading-relaxed text-ok">
                  필수 근거가 모두 포함돼 있습니다. 수치의 출처만 확인하세요.
                </p>
              </div>
            ) : (
              analysis.missing.map((m) => (
                <div key={m.label} className="rounded-lg border border-line bg-[#fcfcfa] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
                      <FileWarning size={12} className={m.severity === 3 ? "text-risk" : m.severity === 2 ? "text-warn" : "text-muted"} />
                      {m.label}
                    </span>
                    <SeverityTag level={m.severity} />
                  </div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{m.detail}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>{industry.short} playbook</Eyebrow>
            <span
              className="num chip"
              style={{
                background: `${industry.accent}12`,
                color: industry.accent,
                border: `1px solid ${industry.accent}26`,
              }}
            >
              {passed}/{industryChecks.length}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-[1.7] text-ink-2">
            {industry.playbook.stance.split(". ")[0]}.
          </p>
          <ul className="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
            {industryChecks.map((c) => (
              <li key={c.label} className="flex items-center gap-1.5 text-[10.5px]">
                <span
                  className={cx("h-1.5 w-1.5 shrink-0 rounded-full", c.ok ? "bg-ok" : "bg-risk/70")}
                />
                <span className={c.ok ? "text-ink-2" : "font-medium text-ink"}>{c.label}</span>
                <span className="ml-auto text-[9px] text-faint">{c.ok ? "포함" : "빠짐"}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <Eyebrow className="mb-2">한 줄 정리</Eyebrow>
          <p className="text-[11.5px] leading-[1.8] text-ink-2">{analysis.summaryLine}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {analysis.spans.slice(0, 3).map((s) => (
              <span key={s.id} className="chip bg-risk-soft text-risk">
                “{s.text}”
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
