import { useEffect, useState } from "react";
import { ArrowRight, Check, Minus, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  FEATURE_LABEL,
  PLANS,
  PLAN_MATRIX,
  TRIAL_DAYS,
  annualSaving,
  formatWon,
  getPlan,
  monthlyEquivalent,
  perRun,
  trialDaysLeft,
  type BillingCycle,
  type FeatureKey,
  type PlanId,
  type PlanSpec,
  type PlanState,
} from "../lib/plans";
import { CopyButton, Toggle, cx } from "./ui";

type MatrixRow = { kind: "group"; label: string } | { kind: "row"; label: string; values: [string, string, string]; i: number };

function matrixRows(): MatrixRow[] {
  const flat: Array<{ kind: "group"; label: string } | { kind: "row"; label: string; values: [string, string, string]; i: number }> = [];
  let i = 0;
  for (const group of PLAN_MATRIX) {
    flat.push({ kind: "group", label: group.group });
    for (const row of group.rows) {
      flat.push({ kind: "row", label: row.label, values: row.values, i });
      i += 1;
    }
  }
  return flat;
}

function PriceLine({ spec, cycle }: { spec: PlanSpec; cycle: BillingCycle }) {
  const perMonth = cycle === "annual" ? monthlyEquivalent(spec) : spec.monthly;
  const unit = perRun(spec);
  return (
    <div className="border-y border-line-strong py-3">
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[29px] font-semibold leading-none tracking-[-0.03em] text-ink">
          {formatWon(perMonth)}
        </span>
        <span className="text-[12.5px] font-medium text-muted">/월</span>
      </div>
      <p className="num mt-1.5 text-[12px] leading-[1.55] text-muted">
        {cycle === "annual" ? `연 ${formatWon(spec.annual)} 결제` : "월 결제 · VAT 별도"}
        {cycle === "annual" && (
          <span className="block text-faint">{formatWon(annualSaving(spec))} 절약 · VAT 별도</span>
        )}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-accent-deep">
        {unit ? (
          <>
            건당 {formatWon(unit)} <span className="text-faint">/ {spec.runs} 기준</span>
          </>
        ) : (
          <>
            생성 무제한 <span className="text-faint">/ 건당 과금 없음</span>
          </>
        )}
      </p>
    </div>
  );
}

export function PricingModal({
  open,
  highlight,
  plan,
  onClose,
  onChoose,
}: {
  open: boolean;
  highlight?: FeatureKey;
  plan: PlanState;
  onClose: () => void;
  onChoose: (id: PlanId, cycle: BillingCycle) => void;
}) {
  const [cycle, setCycle] = useState<BillingCycle>(plan.cycle);
  const [inquiry, setInquiry] = useState(false);

  useEffect(() => {
    if (open) setCycle(plan.cycle);
  }, [open, plan.cycle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const proActive = plan.id === "pro";
  const pro = getPlan("pro");
  const enterprise = getPlan("enterprise");
  const inquiryDraft = [
    "[PRISM Enterprise 도입 문의]",
    `· 회사/팀: `,
    `· 담당자·연락처: `,
    `· 상담 희망 플랜: Enterprise (월 ${formatWon(enterprise.monthly)} · 연 ${formatWon(enterprise.annual)})`,
    `· 필요한 기능: 다중 브랜드·팀 계정 10인 이상, SSO·감사 로그, 브랜드 템플릿, 대응 리허설, 4시간 SLA`,
    `· 계약 형태: 연간 계약 · 세금계산서 · NDA`,
    `· 도입 희망 시점: `,
  ].join("\n");

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-slate-900/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="요금제"
    >
      <div className="mx-auto my-3 w-full max-w-[1080px] px-3 pb-10 sm:my-7 sm:px-5" data-testid="pricing-modal">
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-float">
          {/* ── 헤더 ── */}
          <header className="border-b border-line px-4 pb-4 pt-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  PRISM · B2B Plans
                </div>
                <h2 className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[26px]">
                  기업 위기 대응을 위한 월 구독
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  홍보팀·PR 대행사 기준 3단계. 플랜 차이는 생성 건수, 임원 보고서, 팀 공유에서 갈립니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="seg" role="group" aria-label="결제 주기">
                  <button
                    type="button"
                    data-testid="billing-monthly"
                    aria-pressed={cycle === "monthly"}
                    data-active={cycle === "monthly"}
                    className="seg-item"
                    onClick={() => setCycle("monthly")}
                  >
                    월 결제
                  </button>
                  <button
                    type="button"
                    data-testid="billing-annual"
                    aria-pressed={cycle === "annual"}
                    data-active={cycle === "annual"}
                    className="seg-item"
                    onClick={() => setCycle("annual")}
                  >
                    연 결제
                    <span className={cx("ml-1.5 text-[11.5px] font-semibold", cycle === "annual" ? "text-accent" : "text-faint")}>
                      2개월 무료
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  data-testid="pricing-close"
                  aria-label="요금제 닫기"
                  className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:bg-tint-2 hover:text-ink"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-tint px-3 py-2 text-[12.5px] leading-relaxed text-muted">
              결제 연동 전 데모입니다 — 플랜을 바꿔도 청구되지 않고, 이 브라우저에만 저장됩니다.
            </p>
          </header>

          <div className="px-3 py-3 sm:px-5 sm:py-4">
            {highlight && (
              <div
                className="mb-3 flex items-start gap-2 rounded-xl border border-accent/25 border-l-4 border-l-accent bg-accent-soft px-3 py-2.5 text-[13px] leading-relaxed text-accent-deep"
                data-testid="pricing-highlight"
              >
                <Sparkles size={13} className="mt-[2px] shrink-0" />
                <span>
                  <span className="font-semibold">{FEATURE_LABEL[highlight]}</span>은(는) Pro 플랜부터 포함됩니다. 아래에서
                  무료 체험을 켜면 바로 쓸 수 있습니다.
                </span>
              </div>
            )}

            {proActive && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ok/25 border-l-4 border-l-ok bg-ok-soft px-3 py-2.5 text-[13px] text-ok">
                <ShieldCheck size={13} />
                <span className="font-semibold">
                  Pro 체험 중{plan.demo ? ` · D-${trialDaysLeft(plan)}` : ""}
                </span>
                <span className="text-ok/80">
                  {plan.trialEndsAt ? `${new Date(plan.trialEndsAt).toLocaleDateString("ko-KR")}까지` : "결제 전 데모"} · 이
                  브라우저에만 저장됩니다
                </span>
                <button
                  type="button"
                  onClick={() => onChoose("starter", cycle)}
                  className="btn btn-outline ml-auto h-7 px-2 text-[12.5px]"
                  data-testid="plan-downgrade"
                >
                  무료 체험 끄기
                </button>
              </div>
            )}

            {/* ── 3개 플랜 ── */}
            <div className="plan-grid">
              {PLANS.map((spec) => {
                const isPro = spec.id === "pro";
                const isEnt = spec.id === "enterprise";
                const isCurrent = plan.id === spec.id;
                return (
                  <div
                    key={spec.id}
                    data-testid={`plan-card-${spec.id}`}
                    data-highlight={isPro ? "true" : undefined}
                    className={cx("plan-col", isPro && "plan-col-pro")}
                  >
                    <div className={cx("plan-bar", isPro && "plan-bar-pro", isEnt && "plan-bar-ent")} />
                    <div className={cx("flex flex-1 flex-col px-4 pb-4 pt-3.5 sm:px-5", isPro && "bg-gradient-to-b from-[#F7FAFF] via-white to-white")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">{spec.name}</h3>
                        {isCurrent && (
                          <span className="chip border border-line-strong bg-tint-2 px-2 py-0.5 text-[11px] text-muted">
                            현재
                          </span>
                        )}
                        {isPro && (
                          <span className="ml-auto rounded-full bg-accent px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em] text-white shadow-[0_1px_2px_rgba(29,78,216,0.35)]">
                            가장 많이 도입
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[13px] font-medium text-ink-2">{spec.tagline}</p>

                      <div className="mt-3">
                        <PriceLine spec={spec} cycle={cycle} />
                      </div>

                      <dl className="mt-3 grid grid-cols-[56px_minmax(0,1fr)] gap-y-1 text-[12.5px]">
                        <dt className="text-faint">대상</dt>
                        <dd className="font-medium leading-snug text-ink-2">{spec.audience}</dd>
                        <dt className="text-faint">월 생성</dt>
                        <dd className="num font-semibold text-ink-2">{spec.runs}</dd>
                        <dt className="text-faint">좌석</dt>
                        <dd className="font-medium text-ink-2">{spec.seats}</dd>
                      </dl>

                      <ul className="mt-3 flex-1 space-y-1.5 border-t border-line pt-3">
                        {spec.highlights.map((h) => (
                          <li key={h} className="flex gap-1.5 text-[13px] leading-snug text-ink-2">
                            <Check size={12} strokeWidth={2.8} className="mt-[3px] shrink-0 text-accent" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-4 border-t border-line pt-3">
                        {spec.id === "starter" && (
                          <button
                            type="button"
                            data-testid="plan-cta-starter"
                            onClick={() => onChoose("starter", cycle)}
                            className={cx("btn w-full py-2.5 text-[13px]", isCurrent ? "btn-outline text-muted" : "btn-outline")}
                          >
                            {isCurrent ? "현재 플랜" : "Starter 구독 시작"}
                          </button>
                        )}
                        {spec.id === "pro" && (
                          <>
                            <button
                              type="button"
                              data-testid="plan-cta-pro"
                              onClick={() => onChoose("pro", cycle)}
                              className="btn btn-accent w-full py-2.5 text-[13px]"
                            >
                              {proActive ? "Pro 체험 다시 시작" : `Pro ${TRIAL_DAYS}일 무료 체험`}
                              <ArrowRight size={13} />
                            </button>
                            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-line bg-tint px-2.5 py-2">
                              <span className="text-[12px] leading-snug text-muted">
                                Pro 무료 체험 활성화
                                <span className="block text-[11px] text-faint">결제 연동 전 데모 · 카드 등록 없음</span>
                              </span>
                              <Toggle
                                checked={proActive}
                                onChange={(v) => onChoose(v ? "pro" : "starter", cycle)}
                                label="Pro 무료 체험 활성화 (결제 연동 전 데모)"
                              />
                            </div>
                          </>
                        )}
                        {spec.id === "enterprise" && (
                          <button
                            type="button"
                            data-testid="plan-cta-enterprise"
                            onClick={() => setInquiry((v) => !v)}
                            className="btn btn-outline w-full py-2.5 text-[13px]"
                          >
                            {inquiry ? "문의 초안 닫기" : "Enterprise 도입 문의"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {inquiry && (
              <div className="mt-3 rounded-xl border border-line bg-tint px-3.5 py-3" data-testid="enterprise-inquiry">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">Enterprise 도입 문의 초안</span>
                  <CopyButton text={inquiryDraft} label="문의 초안 복사" className="btn btn-outline h-7 px-2 text-[12.5px]" />
                </div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-line bg-white px-3 py-2 text-[12px] leading-relaxed text-ink-2">
                  {inquiryDraft}
                </pre>
                <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
                  결제·계약 연동 전이라 접수 창구는 아직 열려 있지 않습니다. 초안을 복사해 담당자에게 직접 보내 주세요.
                </p>
              </div>
            )}

            {/* ── 구매 판단 근거 ── */}
            <div className="mt-4 grid grid-cols-1 overflow-hidden rounded-xl border border-line bg-white shadow-card sm:grid-cols-3">
              {[
                {
                  k: "건당 단가",
                  v: `Pro ${formatWon(perRun(pro) ?? 0)}`,
                  d: `${pro.runs} 기준 · 상시 체계를 월 비용으로`,
                },
                {
                  k: "연 결제",
                  v: `${formatWon(annualSaving(pro))} 절약`,
                  d: `Pro 연 ${formatWon(pro.annual)} · 2개월 무료`,
                },
                {
                  k: "도입 절차",
                  v: `${TRIAL_DAYS}일 무료 체험`,
                  d: "카드 등록 없이 전 기능 · 체험 후 선택",
                },
              ].map((cell, i) => (
                <div
                  key={cell.k}
                  className={cx("px-4 py-3", i > 0 && "border-t border-line sm:border-l sm:border-t-0")}
                >
                  <div className="eyebrow">{cell.k}</div>
                  <div className="num mt-1 text-[15px] font-semibold text-ink">{cell.v}</div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{cell.d}</p>
                </div>
              ))}
            </div>

            {/* ── 비교표 ── */}
            <div className="mt-4">
              <div className="flex flex-wrap items-end justify-between gap-2 pb-2">
                <div>
                  <div className="eyebrow">Compare · 구매 결정 포인트</div>
                  <h3 className="mt-1 text-[14px] font-bold tracking-[-0.01em] text-ink">플랜별 포함 범위</h3>
                </div>
                <span className="text-[12px] text-muted">가격은 VAT 별도</span>
              </div>
              <div className="mt-2 overflow-x-auto rounded-xl border border-line shadow-card">
                <table className="grid-table min-w-[560px]">
                  <thead>
                    <tr>
                      <th className="w-[38%]">구분</th>
                      <th className="w-[20%] text-center">Starter</th>
                      <th className="w-[21%] bg-accent-soft text-center text-accent-deep">Pro</th>
                      <th className="w-[21%] text-center">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows().map((row, idx) =>
                      row.kind === "group" ? (
                        <tr key={`g-${idx}`} className="bg-tint">
                          <td colSpan={4} className="eyebrow py-1.5 text-faint">
                            {row.label}
                          </td>
                        </tr>
                      ) : (
                        <tr key={`r-${row.i}`} data-testid={`plan-row-${row.i}`}>
                          <td className="text-ink-2">{row.label}</td>
                          {row.values.map((value, j) => (
                            <td
                              key={j}
                              className={cx(
                                "text-center",
                                j === 1 && "bg-accent-soft/45 font-semibold text-ink",
                                value === "—" ? "text-faint" : "text-ink-2",
                              )}
                            >
                              {value === "—" ? <Minus size={12} className="mx-auto text-faint" /> : value}
                            </td>
                          ))}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-3 border-t border-line pt-2 text-[12px] leading-relaxed text-faint">
              실제 결제(PG)는 아직 연결되어 있지 않습니다. Pro 체험 상태는 이 브라우저에만 저장되고, 체험 기간이 끝나면
              자동으로 Starter로 돌아갑니다. 문의: PRISM 운영팀.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
