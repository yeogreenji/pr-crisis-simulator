import { useEffect, useState } from "react";
import { ArrowRight, Check, Minus, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  FEATURE_LABEL,
  PLANS,
  TRIAL_DAYS,
  annualSaving,
  formatWon,
  getPlan,
  monthlyEquivalent,
  trialDaysLeft,
  type BillingCycle,
  type FeatureKey,
  type PlanId,
  type PlanSpec,
  type PlanState,
} from "../lib/plans";
import { CopyButton, Toggle, cx } from "./ui";

const COMPARE_ROWS: { label: string; starter: string; pro: string; enterprise: string }[] = [
  { label: "월 대응 패키지 생성", starter: "3건", pro: "100건", enterprise: "무제한" },
  { label: "공식 입장문·보도자료 2종", starter: "포함", pro: "포함", enterprise: "포함" },
  { label: "기자 Q&A·핵심 방어 논리", starter: "5문항", pro: "전체", enterprise: "전체" },
  { label: "4채널 문안(사내·SNS 포함)", starter: "—", pro: "포함", enterprise: "포함" },
  { label: "7축 위험 스코어카드", starter: "포함", pro: "포함", enterprise: "포함" },
  { label: "사건 조사 파일·실무 팩트체크", starter: "포함", pro: "포함", enterprise: "포함" },
  { label: "시나리오·입장 비교", starter: "—", pro: "무제한", enterprise: "무제한" },
  { label: "임원 보고서 Word·PDF", starter: "—", pro: "포함", enterprise: "포함" },
  { label: "임원·법무 공유 브리핑 링크", starter: "—", pro: "포함", enterprise: "포함" },
  { label: "사례 라이브러리", starter: "열람", pro: "열람 + 내 사례 등록", enterprise: "동일" },
  { label: "팀 워크스페이스", starter: "1인", pro: "3인", enterprise: "5인 이상" },
  { label: "SSO·감사 로그·API", starter: "—", pro: "—", enterprise: "포함" },
  { label: "전담 온보딩·대응 리허설·SLA", starter: "—", pro: "—", enterprise: "포함" },
];

function PriceLine({ spec, cycle }: { spec: PlanSpec; cycle: BillingCycle }) {
  if (spec.monthly === 0) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[30px] font-semibold leading-none tracking-[-0.04em] text-ink">무료</span>
        <span className="text-[12px] text-muted">영구</span>
      </div>
    );
  }
  const perMonth = cycle === "annual" ? monthlyEquivalent(spec) : spec.monthly;
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className="num text-[30px] font-semibold leading-none tracking-[-0.04em] text-ink">{formatWon(perMonth)}</span>
        <span className="text-[12.5px] text-muted">/월</span>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
        {cycle === "annual"
          ? `연 ${formatWon(spec.annual)} 결제 · 월 ${formatWon(spec.monthly)} 대비 ${formatWon(annualSaving(spec))} 절약`
          : `매월 결제 · VAT 별도 · 연 결제 시 ${formatWon(spec.annual)}`}
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
  const inquiryDraft = [
    "[PRISM Enterprise 도입 문의]",
    `· 회사/팀: `,
    `· 담당자·연락처: `,
    `· 상담 희망 플랜: Enterprise (월 ${formatWon(getPlan("enterprise").monthly)} · 연 ${formatWon(getPlan("enterprise").annual)})`,
    `· 필요한 기능: 팀 워크스페이스 ${getPlan("enterprise").seats}, SSO·감사 로그, 브랜드 템플릿, 대응 리허설`,
    `· 도입 희망 시점: `,
  ].join("\n");

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-ink/45 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="요금제">
      <div className="mx-auto my-4 w-full max-w-[1080px] px-3 pb-10 sm:my-8 sm:px-5" data-testid="pricing-modal">
        <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-float">
          <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-line bg-paper/95 px-4 py-4 backdrop-blur sm:px-6">
            <div className="min-w-0">
              <div className="eyebrow">PRISM · Plans</div>
              <h2 className="display mt-1.5 text-[22px] leading-tight tracking-[-0.03em] text-ink sm:text-[27px]">
                위기 대응을, 팀의 표준으로.
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                결제 연동 전 데모입니다. 지금 플랜을 바꿔도 청구되지 않습니다.
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
                  <span className={cx("ml-1 text-[11px]", cycle === "annual" ? "text-accent" : "text-faint")}>2개월 무료</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                data-testid="pricing-close"
                aria-label="요금제 닫기"
                className="btn btn-outline h-8 w-8 px-0"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-5">
            {highlight && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-accent/25 bg-accent-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-accent-deep" data-testid="pricing-highlight">
                <Sparkles size={13} className="mt-[2px] shrink-0" />
                <span>
                  <span className="font-semibold">{FEATURE_LABEL[highlight]}</span>은(는) Pro 플랜에 포함됩니다. 아래에서 무료 체험을 켜면 바로 쓸 수 있습니다.
                </span>
              </div>
            )}

            {proActive && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ok/25 bg-ok-soft px-3 py-2.5 text-[12.5px] text-ok">
                <ShieldCheck size={13} />
                <span className="font-semibold">
                  Pro 체험 중{plan.demo ? ` · D-${trialDaysLeft(plan)}` : ""}
                </span>
                <span className="text-ok/80">
                  {plan.trialEndsAt ? `${new Date(plan.trialEndsAt).toLocaleDateString("ko-KR")}까지` : "결제 전 데모"} · 이 브라우저에만 저장됩니다
                </span>
                <button
                  type="button"
                  onClick={() => onChoose("starter", cycle)}
                  className="btn btn-outline ml-auto h-7 px-2 text-[12px]"
                  data-testid="plan-downgrade"
                >
                  Starter로 전환
                </button>
              </div>
            )}

            <div className="grid gap-2.5 lg:grid-cols-3">
              {PLANS.map((spec) => {
                const isPro = spec.id === "pro";
                const isCurrent = plan.id === spec.id;
                return (
                  <div
                    key={spec.id}
                    data-testid={`plan-card-${spec.id}`}
                    className={cx(
                      "relative flex flex-col rounded-xl border bg-surface px-4 py-4",
                      isPro ? "border-ink/70 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.65)]" : "border-line",
                    )}
                  >
                    {isPro && (
                      <span className="absolute -top-2 right-3 rounded-full bg-ink px-2 py-[3px] text-[10.5px] font-semibold tracking-[0.08em] text-white">
                        가장 많이 선택
                      </span>
                    )}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">{spec.name}</span>
                      {isCurrent && (
                        <span className="rounded-full border border-line bg-paper-deep px-1.5 py-[1px] text-[10.5px] font-semibold text-muted">
                          현재
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted">{spec.tagline}</p>
                    <div className="mt-3">
                      <PriceLine spec={spec} cycle={cycle} />
                    </div>
                    <div className="mt-3 space-y-1 border-t border-line pt-3 text-[12px] text-muted">
                      <div className="flex justify-between gap-2">
                        <span>대상</span>
                        <span className="text-right font-medium text-ink-2">{spec.audience}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>월 생성</span>
                        <span className="font-medium text-ink-2">{spec.runs}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>좌석</span>
                        <span className="font-medium text-ink-2">{spec.seats}</span>
                      </div>
                    </div>
                    <ul className="mt-3 flex-1 space-y-1.5">
                      {spec.highlights.map((h) => (
                        <li key={h} className="flex gap-1.5 text-[12.5px] leading-snug text-ink-2">
                          <Check size={12} className={cx("mt-[3px] shrink-0", isPro ? "text-ink" : "text-ok")} />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4">
                      {spec.id === "starter" && (
                        <button
                          type="button"
                          data-testid="plan-cta-starter"
                          onClick={() => onChoose("starter", cycle)}
                          className={cx("btn w-full py-2 text-[13px]", isCurrent ? "btn-outline text-muted" : "btn-outline")}
                        >
                          {isCurrent ? "현재 플랜" : "Starter로 전환"}
                        </button>
                      )}
                      {spec.id === "pro" && (
                        <>
                          <button
                            type="button"
                            data-testid="plan-cta-pro"
                            onClick={() => onChoose("pro", cycle)}
                            className="btn btn-primary w-full py-2 text-[13px]"
                          >
                            {proActive ? "Pro 체험 다시 시작" : `Pro ${TRIAL_DAYS}일 무료 체험`}
                            <ArrowRight size={13} />
                          </button>
                          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-line bg-[#fbfbf8] px-2.5 py-2">
                            <span className="text-[11.5px] leading-snug text-muted">
                              Pro 무료 체험 활성화
                              <span className="block text-[10.5px] text-faint">결제 연동 전 데모 · 카드 등록 없음</span>
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
                          className="btn btn-outline w-full py-2 text-[13px]"
                        >
                          {inquiry ? "문의 초안 닫기" : "도입 문의"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {inquiry && (
              <div className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-3" data-testid="enterprise-inquiry">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-ink">Enterprise 도입 문의 초안</span>
                  <CopyButton text={inquiryDraft} label="문의 초안 복사" className="btn btn-outline h-7 px-2 text-[12px]" />
                </div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-line bg-[#fbfbf8] px-3 py-2 text-[11.5px] leading-relaxed text-ink-2">
                  {inquiryDraft}
                </pre>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
                  결제·계약 연동 전이라 접수 창구는 아직 열려 있지 않습니다. 초안을 복사해 담당자에게 직접 보내 주세요.
                </p>
              </div>
            )}

            <div className="mt-5">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="eyebrow">Compare</div>
                  <h3 className="mt-1 text-[14px] font-semibold tracking-[-0.02em] text-ink">플랜별 포함 범위</h3>
                </div>
                <span className="text-[11.5px] text-faint">가격은 VAT 별도</span>
              </div>
              <div className="mt-2 overflow-hidden rounded-xl border border-line bg-surface">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-[#fbfbf8] text-[11.5px] text-muted">
                      <th className="border-b border-line px-3 py-2 text-left font-semibold">기능</th>
                      <th className="w-[86px] border-b border-l border-line px-2 py-2 text-center font-semibold sm:w-[120px]">Starter</th>
                      <th className="w-[86px] border-b border-l border-line px-2 py-2 text-center font-semibold text-ink sm:w-[120px]">Pro</th>
                      <th className="w-[86px] border-b border-l border-line px-2 py-2 text-center font-semibold sm:w-[130px]">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_ROWS.map((row, i) => (
                      <tr key={row.label} data-testid={`plan-row-${i}`} className={i % 2 ? "bg-[#fcfcfa]" : ""}>
                        <td className="border-b border-line px-3 py-1.5 text-ink-2">{row.label}</td>
                        {[row.starter, row.pro, row.enterprise].map((value, j) => (
                          <td
                            key={j}
                            className={cx(
                              "border-b border-l border-line px-2 py-1.5 text-center",
                              j === 1 && "bg-accent-soft/40 font-medium text-ink",
                              value === "—" ? "text-faint" : "text-ink-2",
                            )}
                          >
                            {value === "—" ? <Minus size={12} className="mx-auto text-faint" /> : value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
              실제 결제(PG)는 아직 연결되어 있지 않습니다. Pro 체험 상태는 이 브라우저에만 저장되고, 체험 기간이 끝나면
              자동으로 Starter로 돌아갑니다. 문의: PRISM 운영팀.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
