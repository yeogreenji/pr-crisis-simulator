import { useState } from "react";
import { BookOpen, ChevronRight, Landmark, Scale, ShieldAlert, Siren, X } from "lucide-react";
import { ENTITY_PROFILES } from "../lib/profiles";
import { INDUSTRIES } from "../lib/industries";
import { CRISIS_CASES } from "../lib/cases";
import { STANCES } from "../lib/stances";
import type { IndustryId } from "../types";
import { cx } from "./ui";

type Tab = "entity" | "stance" | "industry" | "cases";

export function ManualModal({
  open,
  onClose,
  initialEntity,
  onOpenLibrary,
}: {
  open: boolean;
  onClose: () => void;
  initialEntity?: string;
  onOpenLibrary?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("entity");
  const [entityId, setEntityId] = useState(initialEntity ?? ENTITY_PROFILES[0].id);
  const [industryId, setIndustryId] = useState<IndustryId>("food");
  if (!open) return null;

  const entity = ENTITY_PROFILES.find((p) => p.id === entityId) ?? ENTITY_PROFILES[0];
  const industry = INDUSTRIES.find((i) => i.id === industryId) ?? INDUSTRIES[0];
  
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        data-testid="manual-modal"
        className="animate-rise relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(16,19,25,0.5)] sm:max-w-[880px] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <div className="eyebrow">Reference</div>
            <h2 className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
              <BookOpen size={14} /> 참고 매뉴얼
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted">상황 유형별 기본 매뉴얼과 업종별 규제·실제 사례입니다.</p>
          </div>
          <button type="button" onClick={onClose} data-testid="manual-close" className="rounded-md p-1 text-muted hover:bg-paper-deep hover:text-ink" aria-label="닫기">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-line px-3 py-2 sm:px-5">
          {(
            [
              { id: "entity", label: "상황 유형 매뉴얼" },
              { id: "stance", label: "대응 대안" },
              { id: "industry", label: "업종 매뉴얼" },
              { id: "cases", label: "실제 사례" },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`manual-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cx(
                "rounded-lg px-2.5 py-1.5 text-[13px] font-semibold",
                tab === t.id ? "bg-ink text-white" : "text-muted hover:bg-paper-deep hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {tab === "entity" && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {ENTITY_PROFILES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setEntityId(p.id)}
                    className={cx(
                      "rounded-full border px-2.5 py-1 text-[12.5px] font-medium",
                      entityId === p.id ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink-2",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-line bg-[#fcfcfa] px-3 py-2.5">
                <div className="text-[13.5px] font-semibold text-ink">{entity.label}</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{entity.tagline}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-faint">{entity.frame}</p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {entity.roadmap.map((r, i) => (
                  <div key={r.window} className="rounded-xl border border-line p-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="num text-[13px] text-faint">{"①②③"[i]}</span>
                      <span className="chip bg-ink px-1.5 py-0 text-[11px] text-white">{r.window}</span>
                      <span className="text-[12px] font-semibold text-ink">{r.title}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-muted">{r.goal}</p>
                    <ul className="mt-1 space-y-0.5">
                      {r.items.map((item) => (
                        <li key={item} className="flex gap-1 text-[12px] leading-snug text-ink-2">
                          <span className="mt-[5px] h-0.5 w-0.5 shrink-0 rounded-full bg-ink/40" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-1.5 rounded bg-white px-1.5 py-1 text-[11px] leading-snug text-faint">
                      통과 기준 · {r.gate}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-line p-2.5">
                  <div className="flex items-center gap-1 text-[12px] font-semibold text-ink-2">
                    <Landmark size={11} /> 유관기관·이해관계자
                  </div>
                  <ul className="mt-1 space-y-1">
                    {entity.stakeholders.map((s) => (
                      <li key={s.who} className="text-[12px] leading-snug text-muted">
                        <span className="font-semibold text-ink-2">{s.who}</span> ({s.when}) — {s.action}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-line p-2.5">
                  <div className="flex items-center gap-1 text-[12px] font-semibold text-risk">
                    <ShieldAlert size={11} /> 금기 표현·함정
                  </div>
                  <ul className="mt-1 space-y-1">
                    {entity.banned.map((b) => (
                      <li key={b.phrase} className="text-[12px] leading-snug text-muted">
                        <span className="font-semibold text-risk">{b.phrase}</span> — {b.why}
                      </li>
                    ))}
                  </ul>
                  <ul className="mt-1.5 space-y-0.5">
                    {entity.watchouts.map((w) => (
                      <li key={w} className="text-[11.5px] leading-snug text-faint">
                        · {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {tab === "stance" && (
            <>
              <p className="text-[12.5px] leading-relaxed text-muted">
                같은 상황이라도 어떤 대안을 고르느냐에 따라 입장문·기자 답변·체크리스트·여론 전망이 전부 달라집니다.
                아래 6가지가 실무에서 반복되는 기본형이고, 어디에도 딱 맞지 않으면 ‘직접 입력’으로 현장 판단을 적습니다.
              </p>
              <div className="mt-2 space-y-2">
                {STANCES.map((s) => (
                  <div key={s.id} className="rounded-xl border border-line bg-white px-3 py-2.5" data-testid={`manual-stance-${s.id}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.accent }} />
                      <span className="text-[13px] font-semibold text-ink">{s.label}</span>
                      <span className="chip border border-line bg-surface px-1.5 py-0 text-[11.5px] text-muted">{s.short}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{s.desc}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">
                      <span className="font-semibold text-ink-2">고르는 상황</span> — {s.bestFor}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-warn">주의 — {s.caution}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-faint">원칙 — {s.rule}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "industry" && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {INDUSTRIES.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setIndustryId(i.id)}
                    className={cx(
                      "rounded-full border px-2.5 py-1 text-[12.5px] font-medium",
                      industryId === i.id ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink-2",
                    )}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-line bg-[#fcfcfa] px-3 py-2.5">
                <div className="text-[13.5px] font-semibold text-ink">{industry.tagline}</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{industry.description}</p>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-line p-2.5">
                  <div className="flex items-center gap-1 text-[12px] font-semibold text-ink-2">
                    <Landmark size={11} /> 규제 주체
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {industry.playbook.regulators.map((r) => (
                      <li key={r.name} className="text-[12px] leading-snug text-muted">
                        <span className="font-semibold text-ink-2">{r.name}</span> — {r.role}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-line p-2.5">
                  <div className="flex items-center gap-1 text-[12px] font-semibold text-ink-2">
                    <Scale size={11} /> 관련 법령
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {industry.playbook.laws.map((l) => (
                      <li key={l.name} className="text-[12px] leading-snug text-muted">
                        <span className="font-semibold text-ink-2">{l.name}</span> — {l.note}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-2 rounded-xl border border-line p-2.5">
                <div className="text-[12px] font-semibold text-ink-2">골든타임 타임라인</div>
                <div className="mt-1 grid gap-1.5 sm:grid-cols-3">
                  {industry.playbook.timeline.map((t) => (
                    <div key={t.window} className="rounded-lg bg-[#fcfcfa] px-2 py-1.5">
                      <div className="text-[11.5px] font-semibold text-ink">{t.window} · {t.title}</div>
                      <ul className="mt-0.5 space-y-0.5">
                        {t.items.slice(0, 4).map((item) => (
                          <li key={item} className="text-[11.5px] leading-snug text-muted">· {item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 rounded-xl border border-risk/20 bg-risk-soft/40 p-2.5">
                <div className="flex items-center gap-1 text-[12px] font-semibold text-risk">
                  <Siren size={11} /> 이 업종 금기 표현
                </div>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  {industry.playbook.banned.map((b) => (
                    <div key={b.phrase} className="text-[12px] leading-snug text-muted">
                      <span className="font-semibold text-risk">“{b.phrase}”</span> → {b.instead}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "cases" && (
            <div className="rounded-xl border border-line bg-[#fcfcfa] px-4 py-8 text-center">
              <p className="text-[14px] font-semibold text-ink">실제 사례 {CRISIS_CASES.length}건은 전용 화면에서 볼 수 있습니다.</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">검색, 업종·유형·평가별 필터, 타임라인과 출처 전체를 한 화면에 보여 줍니다.</p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLibrary?.();
                }}
                className="btn btn-primary mt-4 h-9 px-4 text-[13px]"
              >
                사례 라이브러리 열기
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line bg-[#fbfbf8] px-4 py-2.5 sm:px-5">
          <span className="flex items-center gap-1 text-[12px] text-faint">
            <ChevronRight size={10} /> 매뉴얼은 패키지 생성 시 자동으로 반영됩니다.
          </span>
          <button type="button" onClick={onClose} className="btn btn-primary ml-auto h-8 px-3 text-[13px]">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
