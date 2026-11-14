import type { Analysis } from "../types";
import { getChannel } from "../lib/presets";

const sevLabel = (s: number) => (s === 3 ? "심각" : s === 2 ? "주의" : "참고");

export function PrintReport({ analysis }: { analysis: Analysis }) {
  return (
    <div
      className="hidden bg-white text-ink print:block"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    >
      <div className="mx-auto max-w-[760px] px-2 py-2">
        <header className="flex items-end justify-between border-b-2 border-ink pb-3">
          <div>
            <div className="text-[9pt] font-bold tracking-[0.28em]">PRISM</div>
            <div className="mt-1 text-[7.5pt] tracking-[0.1em] text-[#555]">PR CRISIS &amp; SENTIMENT SIMULATOR</div>
          </div>
          <div className="text-right text-[7.5pt] text-[#555]">
            <div>PR 리스크 시뮬레이션 리포트</div>
            <div className="mt-0.5">{new Date(analysis.createdAt).toLocaleString("ko-KR")}</div>
          </div>
        </header>

        <div className="mt-6">
          <div className="text-[7.5pt] font-semibold tracking-[0.14em] text-[#777]">{analysis.issueLabel}</div>
          <h1 className="mt-1 text-[21pt] font-bold leading-tight tracking-[-0.02em]">{analysis.brand}</h1>
          <p className="mt-2 text-[9pt] leading-relaxed text-[#444]">{analysis.summaryLine}</p>
        </div>

        <section className="mt-5 flex items-stretch gap-4 break-inside-avoid border border-[#ddd] p-4">
          <div className="border-r border-[#eee] pr-4 text-center">
            <div className="text-[7pt] font-semibold tracking-[0.12em] text-[#777]">RISK INDEX</div>
            <div className="mt-1 text-[34pt] font-bold leading-none" style={{ color: analysis.grade.color }}>
              {analysis.score}
            </div>
            <div className="mt-1 text-[8.5pt] font-semibold" style={{ color: analysis.grade.color }}>
              {analysis.grade.label}
            </div>
            <div className="mt-1 text-[7pt] text-[#777]">교체안 적용 시 {analysis.stats.projectedScore}점</div>
          </div>
          <div className="flex-1">
            <div className="text-[7.5pt] leading-relaxed text-[#444]">{analysis.grade.desc}</div>
            <table className="mt-2 w-full text-[8pt]">
              <thead>
                <tr className="text-left text-[7pt] text-[#777]">
                  <th className="pb-1 font-medium">구성 요소</th>
                  <th className="pb-1 font-medium">점수</th>
                  <th className="pb-1 font-medium">가중치</th>
                  <th className="pb-1 font-medium">메모</th>
                </tr>
              </thead>
              <tbody>
                {analysis.breakdown.map((b) => (
                  <tr key={b.id} className="border-t border-[#eee]">
                    <td className="py-1">{b.label}</td>
                    <td className="py-1 font-semibold">{b.score}</td>
                    <td className="py-1 text-[#555]">{Math.round(b.weight * 100)}%</td>
                    <td className="py-1 text-[7.5pt] text-[#777]">{b.hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 break-inside-avoid">
          <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">1. 예상 헤드라인</h2>
          <ul className="mt-2 space-y-1.5">
            {analysis.headlines.map((h, i) => (
              <li key={i} className="text-[8.5pt] leading-relaxed">
                <span className={h.tone === "critical" ? "font-semibold text-[#b02a21]" : "font-semibold text-[#16714f]"}>
                  [{h.tone === "critical" ? "비판" : "긍정"}]
                </span>{" "}
                <span className="font-semibold">{h.text}</span>
                <span className="text-[7.5pt] text-[#777]"> — {h.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 break-inside-avoid">
          <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">2. 팩트체크 질문</h2>
          <ol className="mt-2 space-y-1.5">
            {analysis.factChecks.map((f, i) => (
              <li key={i} className="text-[8.5pt] leading-relaxed">
                <span className="font-semibold">
                  {i + 1}. {f.question}
                </span>{" "}
                <span className="text-[7pt] text-[#777]">({sevLabel(f.severity)})</span>
                <div className="text-[7.5pt] text-[#666]">{f.why}</div>
              </li>
            ))}
          </ol>
        </section>

        {analysis.missing.length > 0 && (
          <section className="mt-4 break-inside-avoid">
            <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">3. 빠진 근거</h2>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[8pt]">
              {analysis.missing.map((m) => (
                <li key={m.label}>
                  <span className="font-semibold">{m.label}</span> — {m.detail}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-4 break-inside-avoid">
          <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">4. 채널별 여론</h2>
          <table className="mt-2 w-full text-[8pt]">
            <thead>
              <tr className="text-left text-[7pt] text-[#777]">
                <th className="pb-1 font-medium">채널</th>
                <th className="pb-1 font-medium">부정 톤</th>
                <th className="pb-1 font-medium">볼륨</th>
                <th className="pb-1 font-medium">주요 쟁점</th>
              </tr>
            </thead>
            <tbody>
              {analysis.channelForecasts.map((c) => (
                <tr key={c.id} className="border-t border-[#eee]">
                  <td className="py-1">{c.label}</td>
                  <td className="py-1 font-semibold">{c.negativity}</td>
                  <td className="py-1">{c.volume}</td>
                  <td className="py-1 text-[7.5pt] text-[#666]">{c.themes.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[8pt] leading-relaxed">
            <span className="font-semibold">
              바이럴 리스크 {analysis.viral.score}/100 · {analysis.viral.level}
            </span>{" "}
            (반감기 {analysis.viral.halfLife}) — {analysis.viral.drivers.join(" / ")}
          </p>
        </section>

        <section className="mt-4 break-inside-avoid">
          <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">5. 문장 X-ray</h2>
          {analysis.spans.length === 0 ? (
            <p className="mt-2 text-[8.5pt]">위험 문장이 감지되지 않았습니다.</p>
          ) : (
            <table className="mt-2 w-full text-[7.5pt]">
              <thead>
                <tr className="text-left text-[7pt] text-[#777]">
                  <th className="pb-1 font-medium">위험 구절</th>
                  <th className="pb-1 font-medium">항목</th>
                  <th className="pb-1 font-medium">심각도</th>
                  <th className="pb-1 font-medium">교체안</th>
                  <th className="pb-1 text-right font-medium">감소</th>
                </tr>
              </thead>
              <tbody>
                {analysis.spans.map((s) => (
                  <tr key={s.id} className="border-t border-[#eee]">
                    <td className="py-1 pr-2 font-medium">{s.text}</td>
                    <td className="py-1 pr-2 text-[#555]">{s.label}</td>
                    <td className="py-1 pr-2">{sevLabel(s.severity)}</td>
                    <td className="py-1 pr-2 text-[#555]">{s.replacement}</td>
                    <td className="py-1 text-right">-{s.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-4 break-inside-avoid">
          <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">6. 응답 팩 (Q&amp;A)</h2>
          <div className="mt-2 space-y-2">
            {analysis.qa.map((q, i) => (
              <div key={q.id} className="text-[8pt] leading-relaxed">
                <div className="font-semibold">
                  Q{i + 1}. {q.question}{" "}
                  <span className="text-[7pt] font-normal text-[#777]">({q.status === "ready" ? "준비됨" : "확인 필요"})</span>
                </div>
                <div className="text-[#444]">{q.answer}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 break-inside-avoid">
          <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">7. 수정 1차안</h2>
          <div className="mt-2 whitespace-pre-wrap border border-[#e5e5e5] bg-[#fafaf8] p-3 text-[8.5pt] leading-[1.8]">
            {analysis.revisedDraft}
          </div>
          <p className="mt-1.5 text-[7pt] text-[#777]">
            [대괄호] 항목은 실제 수치·일정으로 교체한 뒤 배포하세요. 모든 시나리오는 가상의 기업을 기준으로 합니다.
          </p>
        </section>

        <footer className="mt-6 flex items-center justify-between border-t border-[#ddd] pt-2 text-[7pt] text-[#777]">
          <span>PRISM — PR 위기관리·여론 시뮬레이터</span>
          <span>
            {getChannel(analysis.channels[0]).label} 외 {analysis.channels.length - 1}개 채널 · 엔진{" "}
            {analysis.engine === "llm" ? "LLM 보강" : "v2.4"}
          </span>
        </footer>
      </div>
    </div>
  );
}
