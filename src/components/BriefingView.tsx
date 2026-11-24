import { ArrowRight, Check, FileWarning, Lock, Printer, ShieldAlert } from "lucide-react";
import type { SharePayload } from "../lib/share";
import { cx } from "./ui";

const TONE: Record<string, { bg: string; color: string; border: string }> = {
  ok: { bg: "#e8f4ee", color: "#17694c", border: "rgba(22,113,79,0.25)" },
  info: { bg: "#eef2f8", color: "#2f5f8a", border: "rgba(47,95,138,0.25)" },
  warn: { bg: "#fbf2df", color: "#96620d", border: "rgba(150,98,13,0.25)" },
  risk: { bg: "#fbeceb", color: "#b02a22", border: "rgba(176,42,34,0.25)" },
};

function SectionHead({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div className="mb-2 flex items-end gap-2 border-b border-line pb-1.5">
      <span className="num text-[10.5px] font-semibold tracking-[0.12em] text-faint">{n}</span>
      <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {note && <span className="ml-auto text-[11px] text-faint">{note}</span>}
    </div>
  );
}

export function BriefingView({ brief, error }: { brief: SharePayload | null; error?: string }) {
  if (!brief) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col items-center justify-center px-4">
        <div className="card w-full px-5 py-7 text-center" data-testid="briefing-error">
          <FileWarning size={26} className="mx-auto text-warn" />
          <h1 className="display mt-3 text-[19px] text-ink">브리핑을 열지 못했습니다</h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            {error ?? "링크가 잘렸거나 이전 버전에서 만들어졌습니다. 보낸 사람에게 링크를 다시 요청하세요."}
          </p>
          <a href="#" className="btn btn-outline mt-4 h-8 px-3 text-[12.5px]">
            PRISM 열기 <ArrowRight size={12} />
          </a>
        </div>
      </div>
    );
  }

  const tone = TONE[brief.tone] ?? TONE.info;
  const created = new Date(brief.at);
  const stamp = Number.isNaN(created.getTime())
    ? brief.at
    : created.toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-paper">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-ink text-white print:hidden" data-testid="briefing-bar">
        <div className="mx-auto flex w-full max-w-[880px] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-5">
          <span className="text-[12px] font-semibold tracking-[0.18em]">PRISM</span>
          <span className="hidden h-4 w-px bg-white/20 sm:block" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Executive briefing</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-white/20 px-2 py-[3px] text-[10.5px] font-medium text-white/80">
            <Lock size={9} /> 읽기 전용
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn h-7 border border-white/20 bg-white/[0.06] px-2 text-[11.5px] text-white hover:bg-white/15"
            data-testid="briefing-print"
          >
            <Printer size={11} /> 인쇄·PDF
          </button>
          <a href="#" className="btn h-7 border border-white bg-white px-2 text-[11.5px] text-ink hover:bg-white/90" data-testid="briefing-exit">
            PRISM 열기
          </a>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[880px] px-3 pb-16 pt-5 sm:px-5" data-testid="briefing-view">
        <div className="border-b-2 border-ink pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">Executive briefing · 내부 검토용</span>
            <span className="chip border border-ink/20 bg-ink px-1.5 py-0 text-[10.5px] font-semibold text-white">대외비</span>
            <span className="ml-auto text-[11px] text-faint">{stamp}</span>
          </div>
          <h1 className="display mt-2 text-[23px] leading-[1.3] tracking-[-0.03em] text-ink sm:text-[30px]">{brief.hl}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
            <span className="font-semibold text-ink-2">{brief.br}</span>
            {brief.ct && (
              <>
                <span className="text-line-strong">/</span>
                <span>{brief.ct}</span>
              </>
            )}
            <span className="text-line-strong">/</span>
            <span>{brief.ind}</span>
            {brief.note && (
              <>
                <span className="text-line-strong">/</span>
                <span className="text-faint">{brief.note}</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="card px-3.5 py-3">
            <div className="eyebrow">Risk index</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="num text-[34px] font-semibold leading-none" style={{ color: tone.color }}>
                {brief.sc}
              </span>
              <span className="text-[11.5px] text-faint">/100</span>
              <span className="chip ml-auto px-1.5 py-0" style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}>
                {brief.band}
              </span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {brief.ax.map(([label, value]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-[52px] shrink-0 truncate text-[11px] text-muted">{label}</span>
                  <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#ecece7]">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, value))}%`, background: value >= 65 ? "#b02a22" : value >= 45 ? "#96620d" : "#2f5f8a" }} />
                  </div>
                  <span className="num w-6 shrink-0 text-right text-[11px] font-semibold text-ink-2">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-line bg-[#fbfbf8] px-2.5 py-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">선택한 입장</div>
              <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-ink">{brief.stl}</p>
              <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
                <ShieldAlert size={10} className="text-warn" /> 위험도 {brief.rk}
              </div>
            </div>
          </div>

          <div className="card px-3.5 py-3">
            <SectionHead n="00" title="상황 요약" note="원문 입력이 아닌 브리핑용 요약" />
            <p className="whitespace-pre-wrap text-[13px] leading-[1.75] text-ink-2">{brief.su}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {brief.ac.map((phase) => (
                <div key={phase.w} className="rounded-lg border border-line bg-[#fcfcfa] px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="chip bg-ink px-1.5 py-0 text-[10.5px] text-white">{phase.w}</span>
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-ink">{phase.t}</div>
                  <ul className="mt-1 space-y-0.5">
                    {phase.i.map((item) => (
                      <li key={item} className="flex gap-1 text-[11px] leading-snug text-muted">
                        <Check size={9} className="mt-[3px] shrink-0 text-faint" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {brief.inv && (
          <div className="mt-3">
            <SectionHead n="INV" title="사건 조사 — 확인된 것과 확인할 것" note={brief.inv.n} />
            <div className="card px-3.5 py-3" data-testid="briefing-investigation">
              <p className="text-[12.5px] leading-[1.7] text-ink-2">{brief.inv.s}</p>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">핵심 쟁점</div>
                  <ol className="mt-1 space-y-1">
                    {brief.inv.is.map(([side, title], i) => (
                      <li key={`${side}-${i}`} className="flex gap-1.5 text-[11.5px] leading-relaxed text-ink-2">
                        <span className="rounded bg-paper-deep px-1 py-[1px] text-[10px] font-semibold text-muted">{side}</span>
                        <span className="min-w-0 flex-1">{title}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">발표 전 확인 대기</div>
                  <ul className="mt-1 space-y-1">
                    {brief.inv.ck.map((item) => (
                      <li key={item} className="flex gap-1.5 text-[11.5px] leading-relaxed text-muted">
                        <span className="mt-[1px] text-faint">☐</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5">
          <SectionHead n="01" title="4채널 실행 문안" note="배포 전 [확인 필요] 값만 채우세요" />
          <div className="grid gap-2.5 lg:grid-cols-2">
            {brief.ok.map((s) => (
              <div key={s.t} className="card px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="chip border border-line bg-paper-deep px-1.5 py-0 text-[10.5px] text-muted">{s.c}</span>
                  <span className="text-[11.5px] text-faint">① 대외 문안</span>
                </div>
                <div className="mt-1 text-[12.5px] font-semibold leading-snug text-ink">{s.t}</div>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-[1.7] text-ink-2">{s.b}</p>
              </div>
            ))}

            <div className="card px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="chip border border-line bg-paper-deep px-1.5 py-0 text-[10.5px] text-muted">기자 응대</span>
                <span className="text-[11.5px] text-faint">② Q&amp;A</span>
              </div>
              <div className="mt-1.5 space-y-1.5">
                {brief.pr.map((row) => (
                  <div key={row.q} className="rounded-lg border border-line bg-[#fcfcfa] px-2.5 py-1.5">
                    <p className="text-[11.5px] font-semibold leading-snug text-ink">Q. {row.q}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">A. {row.a}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="chip border border-warn/25 bg-warn-soft px-1.5 py-0 text-[10.5px] text-warn">사내</span>
                <span className="text-[11.5px] text-faint">③ 임직원 공지</span>
              </div>
              <div className="mt-1 text-[12.5px] font-semibold leading-snug text-ink">{brief.inn.t}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-accent-deep">{brief.inn.l}</p>
              <p className="mt-1 whitespace-pre-wrap text-[12px] leading-[1.7] text-ink-2">{brief.inn.b}</p>
            </div>

            <div className="card px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="chip border border-line bg-paper-deep px-1.5 py-0 text-[10.5px] text-muted">SNS</span>
                <span className="text-[11.5px] text-faint">④ 공식 계정</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[12px] leading-[1.7] text-ink-2">{brief.so.s}</p>
              {brief.so.p && (
                <p className="mt-1 border-t border-line pt-1 text-[11.5px] leading-relaxed text-muted">
                  <span className="font-semibold text-ink-2">고정 댓글</span> · {brief.so.p}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            <SectionHead n="02" title="유관기관·이해관계자 접점" />
            <div className="card divide-y divide-line">
              {brief.sk.map((s) => (
                <div key={s.w} className="px-3 py-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[12.5px] font-semibold text-ink">{s.w}</span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-2">{s.a}</p>
                  {s.l && <p className="mt-0.5 text-[11px] leading-relaxed text-muted">“{s.l}”</p>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionHead n="03" title="이 유형에서 반복되는 실수" />
            <ul className="card space-y-1.5 px-3 py-2.5">
              {brief.wo.map((w) => (
                <li key={w} className="flex gap-1.5 text-[11.5px] leading-relaxed text-ink-2">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-warn/70" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
            <div className={cx("mt-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed")} style={{ background: tone.bg, color: tone.color, borderColor: tone.border }}>
              이 브리핑은 PRISM이 만든 읽기 전용 문서입니다. 원본 대응 패키지의 수정·내보내기는 작성자 계정에서만 가능합니다.
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-[11px] text-faint">
          <span>PRISM · Crisis communication briefing · #{brief.at.slice(0, 10)}</span>
          <span>문의는 원본 작성자({brief.br})에게</span>
        </div>
      </div>
    </div>
  );
}
