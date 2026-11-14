import type { Industry } from "../types";
import { CRISIS_CASES } from "../lib/cases";

const sev = (n: number) => (n === 3 ? "심각" : n === 2 ? "주의" : "참고");

export function PlaybookPrint({ industry }: { industry: Industry }) {
  const cases = CRISIS_CASES.filter((c) => c.industry === industry.id);
  const p = industry.playbook;

  return (
    <div className="print-playbook hidden bg-white text-ink print:block">
      <div className="mx-auto max-w-[760px] px-2 py-2">
        <header className="flex items-end justify-between border-b-2 border-ink pb-3">
          <div>
            <div className="text-[9pt] font-bold tracking-[0.28em]">PRISM</div>
            <div className="mt-1 text-[7.5pt] tracking-[0.1em] text-[#555]">INDUSTRY CRISIS PLAYBOOK</div>
          </div>
          <div className="text-right text-[7.5pt] text-[#555]">
            <div>{industry.label} 위기관리 매뉴얼</div>
            <div className="mt-0.5">{new Date().toLocaleDateString("ko-KR")}</div>
          </div>
        </header>

        <section className="mt-6">
          <div className="text-[7.5pt] font-semibold tracking-[0.14em] text-[#777]">{industry.label}</div>
          <h1 className="mt-1 text-[20pt] font-bold leading-tight tracking-[-0.02em]">
            {industry.tagline.split(" — ")[0]} 매뉴얼
          </h1>
          <p className="mt-2 text-[9pt] leading-relaxed text-[#444]">{p.stance}</p>
        </section>

        <section className="mt-5 break-inside-avoid">
          <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">1. 주요 위기 트리거</h2>
          <table className="mt-2 w-full text-[8pt]">
            <tbody>
              {p.triggers.map((t) => (
                <tr key={t.label} className="border-b border-[#eee] align-top">
                  <td className="w-[26%] py-1 pr-2 font-semibold">{t.label}</td>
                  <td className="w-[10%] py-1 pr-2 text-[#777]">{sev(t.severity)}</td>
                  <td className="py-1 text-[#444]">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-4 break-inside-avoid text-[8pt]">
          <div>
            <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">2. 규제·법적 주체</h2>
            <ul className="mt-2 space-y-1">
              {p.regulators.map((r) => (
                <li key={r.name}>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-[#666]"> — {r.role}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">3. 관련 법령</h2>
            <ul className="mt-2 space-y-1">
              {p.laws.map((l) => (
                <li key={l.name}>
                  <span className="font-semibold">{l.name}</span>
                  <span className="text-[#666]"> — {l.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-4">
          <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">4. 골든타임 타임라인</h2>
          <div className="mt-2 space-y-3">
            {p.timeline.map((step) => (
              <div key={step.window} className="break-inside-avoid border-l-2 border-[#ccc] pl-3">
                <div className="text-[8.5pt] font-bold">
                  {step.window} · {step.title}
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[8pt] text-[#333]">
                  {step.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-4 break-inside-avoid text-[8pt]">
          <div>
            <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">5. 절대 금기 표현</h2>
            <ul className="mt-2 space-y-1.5">
              {p.banned.map((b) => (
                <li key={b.phrase}>
                  <span className="font-semibold text-[#b02a21]">“{b.phrase}”</span>
                  <div className="text-[7.5pt] text-[#555]">{b.why} → {b.instead}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">6. 필수 포함 요소</h2>
            <ul className="mt-2 space-y-1.5">
              {p.required.map((r) => (
                <li key={r.label}>
                  <span className="font-semibold">{r.label}</span>
                  <div className="text-[7.5pt] text-[#555]">{r.desc}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-4 break-inside-avoid">
          <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">7. 이해관계자별 대응 톤</h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {p.stakeholders.map((s) => (
              <div key={s.who} className="break-inside-avoid border border-[#ddd] p-2">
                <div className="text-[8.5pt] font-bold">{s.who}</div>
                <div className="text-[7.5pt] text-[#666]">{s.tone}</div>
                <div className="mt-1 text-[7.5pt]">
                  <span className="font-semibold text-[#16714f]">할 것</span> {s.dos.join(" · ")}
                </div>
                <div className="mt-0.5 text-[7.5pt]">
                  <span className="font-semibold text-[#b02a21]">피할 것</span> {s.donts.join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-4 break-inside-avoid text-[8pt]">
          <div>
            <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">8. 증거·기록 확보</h2>
            <ul className="mt-2 list-disc space-y-0.5 pl-4">
              {p.evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">9. 특히 조심할 것</h2>
            <ul className="mt-2 list-disc space-y-0.5 pl-4">
              {p.watchouts.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-4 break-inside-avoid">
          <h2 className="border-b border-ink pb-1 text-[11pt] font-bold">10. 참고 사례 ({cases.length}건)</h2>
          <ul className="mt-2 space-y-1.5">
            {cases.map((c) => (
              <li key={c.id} className="text-[8pt]">
                <span className="font-semibold">{c.company}</span>
                <span className="text-[#666]"> · {c.date} · {c.title}</span>
                <div className="text-[7.5pt] text-[#555]">교훈: {c.lesson}</div>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-6 border-t border-[#ccc] pt-2 text-[7pt] text-[#777]">
          PRISM · 업종별 위기관리 매뉴얼 · 사례는 공개 보도·공식 자료로 확인한 실제 사건이며, 시뮬레이터의
          샘플 기업은 가상입니다. 배포 전 최신 법령·감독 기준을 확인하십시오.
        </footer>
      </div>
    </div>
  );
}
