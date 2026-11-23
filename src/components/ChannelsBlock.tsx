import { useState } from "react";
import {
  ChevronDown,
  ClipboardList,
  Info,
  Lock,
  Megaphone,
  MessagesSquare,
  ShieldAlert,
  Smartphone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { CopyButton, cx } from "./ui";
import { usePlan } from "./PlanContext";
import {
  countPlaceholders,
  getStance,
  statementToText,
  type QaScript,
  type ResponsePackage,
  type Statement,
} from "../lib/package";
import type { ChannelKit } from "../lib/channels";
import { defenseToText, internalToText, socialToText } from "../lib/channels";

type TabId = "official" | "qa" | "internal" | "social";

const TABS: { id: TabId; n: string; label: string; short: string; icon: typeof Megaphone }[] = [
  { id: "official", n: "①", label: "공식 입장문·보도자료", short: "대외 문안 2종", icon: Megaphone },
  { id: "qa", n: "②", label: "기자 Q&A·핵심 방어 논리", short: "질문 대응", icon: MessagesSquare },
  { id: "internal", n: "③", label: "사내 임직원 공지문", short: "내부 커뮤니케이션", icon: Users },
  { id: "social", n: "④", label: "SNS 공지·댓글 대응", short: "인스타·X", icon: Smartphone },
];

const TAG_CLS: Record<string, string> = {
  안내: "bg-accent-soft text-accent-deep",
  사실: "bg-warn-soft text-warn",
  공감: "bg-ok-soft text-ok",
  비공개: "bg-paper-deep text-muted",
};

function StatementCard({ statement }: { statement: Statement }) {
  const placeholders = countPlaceholders(statement.body);
  return (
    <div className="flex flex-col rounded-xl border border-line bg-[#fcfcfa]" data-testid={`statement-${statement.id}`}>
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        {statement.id === "public" ? <Megaphone size={12} className="text-muted" /> : <ClipboardList size={12} className="text-muted" />}
        <span className="text-[13px] font-semibold text-ink">
          {statement.id === "public" ? "①" : "②"} {statement.label}
        </span>
        <span className="ml-auto text-[11.5px] text-faint">{statement.channel}</span>
      </div>
      <div className="flex flex-1 flex-col px-3 py-3">
        <div className="text-[13.5px] font-semibold leading-snug text-ink">{statement.title}</div>
        <div className="mt-2 flex-1 whitespace-pre-wrap text-[13px] leading-[1.75] text-ink-2" data-testid={`statement-body-${statement.id}`}>
          {statement.body}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <span className="text-[11.5px] text-faint">
          {statement.body.length.toLocaleString()}자 · 대괄호 {placeholders}곳
        </span>
        <CopyButton text={statementToText(statement)} label="이 입장문 복사" className="btn btn-outline ml-auto h-7 px-2 text-[12.5px]" />
      </div>
    </div>
  );
}

function QaItem({ item, index }: { item: QaScript; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="rounded-xl border border-line bg-[#fcfcfa]" data-testid="qa-item">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
      >
        <span className="num mt-[1px] text-[12px] font-semibold text-faint">Q{index + 1}</span>
        <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-ink">{item.question}</span>
        {item.level === 3 && <span className="chip bg-risk-soft px-1.5 py-0 text-[11px] text-risk">급함</span>}
        <ChevronDown size={13} className={cx("mt-[2px] shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      <div className={cx("border-t border-line px-3 pb-3 pt-2.5", open ? "block" : "hidden print:block")}>
        <div className="rounded-lg border border-line bg-white p-2.5">
          <div className="whitespace-pre-wrap text-[13px] leading-[1.7] text-ink-2" data-testid="qa-answer">
            {item.answer}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <CopyButton text={item.answer} label="답변 복사" className="btn btn-outline h-6 px-1.5 text-[12px]" />
          </div>
        </div>
        {item.guide && (
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            <span className="font-semibold text-ink-2">요령</span> · {item.guide}
          </p>
        )}
        {item.avoid.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-[11.5px] font-semibold text-risk">피할 말</span>
            {item.avoid.map((a) => (
              <span key={a} className="rounded bg-risk-soft px-1.5 py-[1px] text-[11.5px] text-risk">
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LockedChannel({
  slot,
  title,
  desc,
  preview,
  bullets,
  onUpgrade,
}: {
  slot: "internal" | "social";
  title: string;
  desc: string;
  preview: string;
  bullets: string[];
  onUpgrade: () => void;
}) {
  return (
    <div className="px-4 py-6 sm:px-5" data-testid={`channel-gate-${slot}`}>
      <div className="mx-auto max-w-[560px] rounded-lg border border-dashed border-line-strong bg-[#fbfbf8] px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-white">
            <Lock size={13} />
          </span>
          <div>
            <div className="text-[13.5px] font-semibold text-ink">{title}</div>
            <div className="text-[11.5px] text-faint">Pro 플랜 · 결제 연동 전 데모</div>
          </div>
          <span className="ml-auto rounded-full border border-ink/15 bg-ink px-2 py-[3px] text-[10px] font-semibold tracking-[0.1em] text-white">PRO</span>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{desc}</p>
        <div className="mt-2 rounded-md border border-line bg-white px-2.5 py-2">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">문안 미리보기</div>
          <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-muted">{preview}</p>
        </div>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {bullets.map((b) => (
            <li key={b} className="flex gap-1.5 text-[11.5px] leading-snug text-muted">
              <ShieldCheck size={11} className="mt-[2px] shrink-0 text-ok" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onUpgrade} data-testid={`channel-upgrade-${slot}`} className="btn btn-primary h-8 px-3 text-[12.5px]">
            Pro 14일 무료 체험 켜기
          </button>
          <span className="text-[11.5px] text-faint">카드 등록 없음 · 언제든 Starter로 전환</span>
        </div>
      </div>
    </div>
  );
}

export function ChannelsBlock({ pkg, kit }: { pkg: ResponsePackage; kit: ChannelKit }) {
  const [tab, setTab] = useState<TabId>("official");
  const { allows, openPricing } = usePlan();
  const channelsOpen = allows("channels");
  const stance = getStance(pkg.stance, pkg.stanceCustom);
  const placeholders = pkg.statements.reduce((n, s) => n + countPlaceholders(s.body), 0);

  const counts: Record<TabId, string> = {
    official: `${pkg.statements.length}종`,
    qa: `${pkg.qa.length}문항`,
    internal: channelsOpen ? (kit.source === "ai" ? "AI" : "매뉴얼") : "Pro",
    social: channelsOpen ? `${kit.social.commentGuide.length}유형` : "Pro",
  };

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const ActiveIcon = active.icon;

  return (
    <section className="card overflow-hidden" data-testid="block-channels">
      <div className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span className="num mt-[1px] grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-[12px] font-semibold text-white">
          02
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Megaphone size={13} className="text-muted" />
            <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-ink">4채널 실행 문안 — 오늘 그대로 배포</h2>
          </div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            대외 공지·기자 응대·사내 공지·SNS를 한 세트로 만들었습니다. 채널을 바꿔 확인하고 각 문안을 그대로 복사하세요.
          </p>
        </div>
        <span className="shrink-0 text-[11.5px] text-faint">대괄호 {placeholders}곳 채우면 배포 가능</span>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-[#fbfbf8] px-3 py-2 print:hidden sm:px-4" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`channel-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cx(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                on ? "border-ink bg-ink text-white" : "border-transparent text-muted hover:border-line hover:bg-white",
              )}
            >
              <span className={cx("num text-[11.5px]", on ? "text-white/70" : "text-faint")}>{t.n}</span>
              <Icon size={12} className={on ? "opacity-90" : "opacity-60"} />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(" ")[0]}</span>
              <span className={cx("rounded px-1 text-[11px]", on ? "bg-white/15 text-white/80" : "bg-paper-deep text-faint")}>
                {counts[t.id]}
              </span>
              {!channelsOpen && (t.id === "internal" || t.id === "social") && <Lock size={10} className="opacity-50" />}
            </button>
          );
        })}
      </div>

      {/* ① 공식 입장문·보도자료 */}
      <div
        data-print-panel
        data-testid="block-statements"
        className={cx(tab === "official" ? "block" : "hidden")}
      >
        <div className="grid gap-2 px-4 py-4 sm:px-5 lg:grid-cols-2">
          {pkg.statements.map((s) => (
            <StatementCard key={s.id} statement={s} />
          ))}
        </div>
        <div className="flex items-start gap-2 border-t border-line bg-paper/60 px-4 py-2.5 text-[12px] leading-relaxed text-muted sm:px-5">
          <Info size={11} className="mt-[2px] shrink-0" />
          <span>
            <span className="font-semibold text-ink-2">톤 체크</span> — {stance.rule}
          </span>
        </div>
      </div>

      {/* ② 기자 Q&A·방어 논리 */}
      <div data-print-panel data-testid="block-qa" className={cx(tab === "qa" ? "block" : "hidden")}>
        <div className="border-b border-line px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-accent-deep" />
            <span className="text-[13px] font-semibold text-ink">핵심 방어 논리 3축</span>
            <CopyButton
              text={defenseToText(kit.defense, kit.bridge)}
              label="방어 논리 복사"
              className="btn btn-outline ml-auto h-7 px-2 text-[12px]"
            />
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-3">
            {kit.defense.map((point, i) => (
              <div key={point.frame} className="rounded-xl border border-line bg-[#fcfcfa] px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="num text-[11.5px] font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[12.5px] font-semibold text-ink">{point.frame}</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">“{point.line}”</p>
                <p className="mt-1 text-[11.5px] leading-snug text-muted">근거 · {point.proof}</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-risk">피할 말 · {point.avoid}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-xl border border-line bg-white px-3 py-2">
            <span className="text-[12px] font-semibold text-ink">브릿지 문장 — 공격적 질문을 사실로 되돌리기</span>
            <ul className="mt-1 space-y-0.5">
              {kit.bridge.map((line) => (
                <li key={line} className="text-[12px] leading-relaxed text-muted">
                  · {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2 px-4 py-3.5 sm:px-5">
          {pkg.qa.map((q, i) => (
            <QaItem key={`${q.question}-${i}`} item={q} index={i} />
          ))}
        </div>

        <div className="border-t border-line bg-risk-soft/50 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-risk" />
            <span className="text-[13px] font-semibold text-risk">절대 쓰면 안 되는 금기 표현</span>
          </div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {pkg.banned.map((b) => (
              <div key={b.phrase} className="rounded-lg border border-risk/15 bg-white px-2.5 py-1.5">
                <div className="text-[12.5px] font-semibold text-risk">{b.phrase}</div>
                <div className="mt-0.5 text-[12px] leading-snug text-muted">{b.why}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ③ 사내 임직원 공지문 */}
      <div data-print-panel className={cx(tab === "internal" ? "block" : "hidden")}>
        {!channelsOpen && (
          <LockedChannel
            slot="internal"
            title="③ 사내 임직원 공지문"
            desc="외부 공지와 같은 시각에 나갈 사내 안내문, 임직원이 할 일·하면 안 되는 말, 예상 질문 답변이 한 세트로 준비됩니다."
            preview={kit.internal.lead}
            bullets={["사내 공지 전문 + 임직원 지침", "예상 질문·답변 세트", "외부 공유 금지 표시", "복사 버튼 한 번으로 배포"]}
            onUpgrade={() => openPricing("channels")}
          />
        )}
        {channelsOpen && (
        <div className="px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-ink">{kit.internal.title}</span>
            <span className="chip border border-warn/25 bg-warn-soft px-1.5 py-0 text-[11.5px] text-warn">외부 공유 금지</span>
            <span className="chip border border-line bg-white px-1.5 py-0 text-[11.5px] text-muted">임직원 대상</span>
            <CopyButton
              text={internalToText(kit.internal)}
              label="사내 공지 복사"
              className="btn btn-outline ml-auto h-7 px-2 text-[12.5px]"
            />
          </div>
          <p className="mt-1.5 rounded-lg border border-accent/20 bg-accent-soft/50 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-accent-deep">
            {kit.internal.lead}
          </p>
          <div className="mt-2 rounded-xl border border-line bg-[#fcfcfa] px-3 py-3">
            <div className="whitespace-pre-wrap text-[13px] leading-[1.75] text-ink-2">{kit.internal.body}</div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-ok/20 bg-ok-soft/40 px-3 py-2.5">
              <span className="text-[12px] font-semibold text-ok">임직원이 할 일</span>
              <ul className="mt-1 space-y-1">
                {kit.internal.dos.map((d) => (
                  <li key={d} className="flex gap-1.5 text-[12px] leading-relaxed text-ink-2">
                    <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-ok/70" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-risk/20 bg-risk-soft/40 px-3 py-2.5">
              <span className="text-[12px] font-semibold text-risk">하지 말아야 할 말·행동</span>
              <ul className="mt-1 space-y-1">
                {kit.internal.donts.map((d) => (
                  <li key={d} className="flex gap-1.5 text-[12px] leading-relaxed text-ink-2">
                    <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-risk/60" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-2 rounded-xl border border-line bg-white px-3 py-2.5">
            <span className="text-[12px] font-semibold text-ink">임직원이 물을 질문</span>
            <div className="mt-1 space-y-1.5">
              {kit.internal.qa.map((row) => (
                <div key={row.q} className="text-[12px] leading-relaxed">
                  <span className="font-medium text-ink-2">Q. {row.q}</span>
                  <p className="text-muted">A. {row.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ④ SNS */}
      <div data-print-panel className={cx(tab === "social" ? "block" : "hidden")}>
        {!channelsOpen && (
          <LockedChannel
            slot="social"
            title="④ SNS 공지·댓글 대응"
            desc="공식 계정 짧은 공지, 고정 댓글, 카드뉴스 4장, 예상 댓글별 답글까지 그대로 붙여 쓸 수 있게 만듭니다."
            preview={kit.social.short}
            bullets={["X·인스타 공지 문안", "예상 댓글 · 답글 가이드", "카드뉴스 4장 구성", "악화 시 운영 원칙"]}
            onUpgrade={() => openPricing("channels")}
          />
        )}
        {channelsOpen && (
        <div className="px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-ink">공식 계정 공지 — 짧은 문안</span>
            <span className="chip border border-line bg-white px-1.5 py-0 text-[11.5px] text-muted">{kit.social.short.length}자</span>
            <CopyButton
              text={kit.social.short}
              label="짧은 공지 복사"
              className="btn btn-outline ml-auto h-7 px-2 text-[12.5px]"
            />
          </div>
          <div className="mt-1.5 rounded-xl border border-line bg-[#fcfcfa] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11.5px] text-faint">
              <Smartphone size={11} /> X(스레드) · 인스타그램 공통
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.7] text-ink-2">{kit.social.short}</p>
            <p className="mt-1 text-[11.5px] text-accent-deep">{kit.social.hashtags.join(" ")}</p>
          </div>

          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-white px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-ink">인스타그램·블로그 캡션</span>
                <CopyButton text={kit.social.long} label="캡션 복사" className="btn btn-ghost ml-auto h-6 px-1 text-[11.5px]" />
              </div>
              <div className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-2">{kit.social.long}</div>
            </div>
            <div className="rounded-xl border border-line bg-white px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-ink">고정 댓글</span>
                <CopyButton text={kit.social.pinned} label="복사" className="btn btn-ghost ml-auto h-6 px-1 text-[11.5px]" />
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{kit.social.pinned}</p>
              <div className="mt-2 border-t border-line pt-2">
                <span className="text-[11.5px] font-semibold text-muted">카드뉴스 4장</span>
                <ol className="mt-1 space-y-0.5">
                  {kit.social.cards.map((c, i) => (
                    <li key={c.head} className="text-[11.5px] leading-snug text-muted">
                      {i + 1}. <span className="font-medium text-ink-2">{c.head}</span> — {c.body}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-2 rounded-xl border border-line bg-[#fcfcfa] px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <MessagesSquare size={12} className="text-muted" />
              <span className="text-[12.5px] font-semibold text-ink">예상 댓글 · 그대로 다는 답글</span>
              <CopyButton text={socialToText(kit.social)} label="전체 복사" className="btn btn-outline ml-auto h-6 px-1.5 text-[11.5px]" />
            </div>
            <div className="mt-1.5 space-y-1.5">
              {kit.social.commentGuide.map((row) => (
                <div key={row.pattern} className="rounded-lg border border-line bg-white px-2.5 py-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cx("chip px-1.5 py-0 text-[11px]", TAG_CLS[row.tag])}>{row.tag}</span>
                    <span className="text-[12px] font-medium text-ink-2">{row.pattern}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">→ {row.reply}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-line pt-2">
              <span className="text-[11.5px] font-semibold text-ink">악화 시 운영 원칙</span>
              <ul className="mt-1 space-y-0.5">
                {kit.social.escalation.map((e, i) => (
                  <li key={e} className="text-[11.5px] leading-relaxed text-muted">
                    {i + 1}. {e}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line bg-paper/60 px-4 py-2 text-[11.5px] text-faint sm:px-5">
        <ActiveIcon size={11} />
        <span>
          지금 보고 있는 채널 — {active.label} · {active.short}
        </span>
        <span className="ml-auto hidden print:hidden sm:inline">
          {channelsOpen ? "인쇄·PDF에는 4개 채널이 모두 들어갑니다" : "Pro에서 4개 채널이 모두 열리고 인쇄·PDF에 포함됩니다"}
        </span>
      </div>
    </section>
  );
}
