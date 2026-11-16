import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Gauge,
  Info,
  Megaphone,
  MessagesSquare,
  Newspaper,
  Printer,
  RotateCcw,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";
import {
  actionsToText,
  countPlaceholders,
  getStance,
  packageToText,
  statementToText,
  type ActionGroup,
  type QaScript,
  type ResponsePackage,
  type Statement,
} from "../lib/package";
import { ENTITY_PROFILES } from "../lib/profiles";
import { CopyButton, cx } from "./ui";

const RISK_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  높음: { bg: "#fbedea", color: "#c8352b", border: "rgba(200,53,43,0.25)" },
  보통: { bg: "#fdf4e3", color: "#a9660a", border: "rgba(169,102,10,0.25)" },
  낮음: { bg: "#e9f5ef", color: "#16714f", border: "rgba(22,113,79,0.25)" },
};

function BlockHeader({
  n,
  title,
  desc,
  icon: Icon,
  copy,
}: {
  n: string;
  title: string;
  desc: string;
  icon: typeof Target;
  copy?: string;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
      <span className="num mt-[1px] grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-[10px] font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className="text-muted" />
          <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        </div>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{desc}</p>
      </div>
      {copy && <CopyButton text={copy} label="블록 전체 복사" className="btn btn-outline h-7 shrink-0 px-2 text-[10.5px]" />}
    </div>
  );
}

function Overview({ pkg }: { pkg: ResponsePackage }) {
  return (
    <section className="card overflow-hidden" data-testid="overview">
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 pb-1 pt-4 sm:px-5">
        <div>
          <div className="eyebrow">Response system</div>
          <h2 className="mt-1 text-[14px] font-semibold tracking-[-0.02em]">전체 대응 시스템 — 1시간 → 6시간 → 24시간</h2>
        </div>
        <span className="text-[10px] text-faint">각 단계의 ‘통과 기준’을 넘겨야 다음으로 갑니다</span>
      </div>
      <div className="grid gap-2 px-4 pb-4 pt-3 sm:px-5 lg:grid-cols-3">
        {pkg.roadmap.map((phase, i) => (
          <div key={phase.window} className="relative rounded-xl border border-line bg-[#fcfcfa] p-3">
            <div className="flex items-center gap-1.5">
              <span className="num text-[13px] font-semibold text-faint">{"①②③"[i]}</span>
              <span className="chip bg-ink px-2 py-0.5 text-[9.5px] text-white">{phase.window}</span>
              <span className="ml-auto text-[9.5px] font-medium text-muted">{i === 0 ? "지금" : i === 1 ? "오늘 안" : "이후"}</span>
            </div>
            <div className="mt-1.5 text-[12.5px] font-semibold text-ink">{phase.title}</div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{phase.goal}</p>
            <ul className="mt-2 space-y-1">
              {phase.items.map((item) => (
                <li key={item} className="flex gap-1.5 text-[10.5px] leading-relaxed text-ink-2">
                  <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-ink/40" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2.5 rounded-lg border border-line bg-white px-2 py-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-faint">통과 기준</span>
              <p className="mt-0.5 text-[10px] leading-snug text-ink-2">{phase.gate}</p>
            </div>
            {i < pkg.roadmap.length - 1 && (
              <ArrowRight size={12} className="absolute -right-[7px] top-1/2 hidden -translate-y-1/2 text-line-strong lg:block" />
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-paper/60 px-4 py-2.5 sm:px-5">
        <span className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wide text-faint">
          <Users size={11} /> 동시에 움직일 곳
        </span>
        {pkg.stakeholders.slice(0, 6).map((s) => (
          <span key={s.who} className="chip border border-line bg-white text-[10px] text-ink-2">
            {s.who}
            <span className="text-[8.5px] text-faint">{s.when}</span>
          </span>
        ))}
        <span className="ml-auto text-[9.5px] text-faint">→ 블록 04에서 대상별 할 일·첫 문장</span>
      </div>
    </section>
  );
}

function ActionsBlock({ groups }: { groups: ActionGroup[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const toggle = (key: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="card overflow-hidden" data-testid="block-actions">
      <BlockHeader
        n="01"
        title="지금 당장 할 일 — 골든타임 체크리스트"
        desc={`1시간 → 6시간 → 24시간 순서. 담당까지 적혀 있으니 그대로 지시하면 됩니다. (${done.size}/${total} 완료)`}
        icon={ClipboardList}
        copy={actionsToText(groups)}
      />
      <div className="grid gap-0 lg:grid-cols-3">
        {groups.map((group, i) => (
          <div
            key={group.window}
            className={cx(
              "px-4 py-3.5 sm:px-5",
              i > 0 && "border-t border-line lg:border-l lg:border-t-0",
              i === 0 && "bg-[#fdfcf9]",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  "chip px-2 py-0.5 text-[9.5px]",
                  i === 0 ? "bg-risk text-white" : i === 1 ? "bg-warn text-white" : "bg-ink text-white",
                )}
              >
                {group.window} 내
              </span>
              <span className="text-[11.5px] font-semibold text-ink">{group.title}</span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {group.items.map((item, idx) => {
                const key = `${group.window}-${idx}`;
                const checked = done.has(key);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(key)}
                      className="group flex w-full items-start gap-2 text-left"
                    >
                      <span
                        className={cx(
                          "mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
                          checked ? "border-ok bg-ok text-white" : "border-line-strong bg-white text-transparent group-hover:border-ink/40",
                        )}
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cx(
                            "block text-[11px] leading-[1.55]",
                            checked ? "text-faint line-through" : "text-ink-2",
                          )}
                        >
                          {item.text}
                        </span>
                        {item.owner && (
                          <span className="mt-0.5 inline-block rounded bg-paper-deep px-1 py-[1px] text-[8.5px] font-semibold text-muted">
                            {item.owner}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatementCard({ statement }: { statement: Statement }) {
  const placeholders = countPlaceholders(statement.body);
  return (
    <div className="flex flex-col rounded-xl border border-line bg-[#fcfcfa]" data-testid={`statement-${statement.id}`}>
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        {statement.id === "public" ? <Megaphone size={12} className="text-muted" /> : <Newspaper size={12} className="text-muted" />}
        <span className="text-[11px] font-semibold text-ink">
          {statement.id === "public" ? "①" : "②"} {statement.label}
        </span>
        <span className="ml-auto text-[9px] text-faint">{statement.channel}</span>
      </div>
      <div className="flex flex-1 flex-col px-3 py-3">
        <div className="text-[12px] font-semibold leading-snug text-ink">{statement.title}</div>
        <div
          className="mt-2 flex-1 whitespace-pre-wrap text-[11px] leading-[1.75] text-ink-2"
          data-testid={`statement-body-${statement.id}`}
        >
          {statement.body}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <span className="text-[9px] text-faint">
          {statement.body.length.toLocaleString()}자 · 대괄호 {placeholders}곳
        </span>
        <CopyButton text={statementToText(statement)} label="이 입장문 복사" className="btn btn-outline ml-auto h-7 px-2 text-[10.5px]" />
      </div>
    </div>
  );
}

function StatementsBlock({ pkg }: { pkg: ResponsePackage }) {
  const placeholders = pkg.statements.reduce((n, s) => n + countPlaceholders(s.body), 0);
  return (
    <section className="card overflow-hidden" data-testid="block-statements">
      <BlockHeader
        n="02"
        title="바로 올릴 공식 입장문 2종"
        desc={`고객 공지용과 언론 배포용을 따로 만들었습니다. 대괄호 ${placeholders}곳만 실제 값으로 채우면 그대로 배포할 수 있습니다.`}
        icon={Megaphone}
        copy={pkg.statements.map(statementToText).join("\n\n──────────\n\n")}
      />
      <div className="grid gap-2 px-4 py-4 sm:px-5 lg:grid-cols-2">
        {pkg.statements.map((s) => (
          <StatementCard key={s.id} statement={s} />
        ))}
      </div>
      <div className="flex items-start gap-2 border-t border-line bg-paper/60 px-4 py-2.5 text-[10px] leading-relaxed text-muted sm:px-5">
        <Info size={11} className="mt-[2px] shrink-0" />
        <span>
          <span className="font-semibold text-ink-2">톤 체크</span> — {getStance(pkg.stance).rule}
        </span>
      </div>
    </section>
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
        <span className="num mt-[1px] text-[10px] font-semibold text-faint">Q{index + 1}</span>
        <span className="min-w-0 flex-1 text-[11.5px] font-semibold leading-snug text-ink">{item.question}</span>
        {item.level === 3 && <span className="chip bg-risk-soft px-1.5 py-0 text-[8.5px] text-risk">급함</span>}
        <ChevronDown size={13} className={cx("mt-[2px] shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-line px-3 pb-3 pt-2.5">
          <div className="rounded-lg border border-line bg-white p-2.5">
            <div className="whitespace-pre-wrap text-[11px] leading-[1.7] text-ink-2" data-testid="qa-answer">
              {item.answer}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <CopyButton text={item.answer} label="답변 복사" className="btn btn-outline h-6 px-1.5 text-[10px]" />
            </div>
          </div>
          {item.guide && (
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              <span className="font-semibold text-ink-2">요령</span> · {item.guide}
            </p>
          )}
          {item.avoid.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[9px] font-semibold text-risk">피할 말</span>
              {item.avoid.map((a) => (
                <span key={a} className="rounded bg-risk-soft px-1.5 py-[1px] text-[9px] text-risk">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QaBlock({ pkg }: { pkg: ResponsePackage }) {
  return (
    <section className="card overflow-hidden" data-testid="block-qa">
      <BlockHeader
        n="03"
        title={`기자·커뮤니티 압박 질문 ${pkg.qa.length}개와 답변 스크립트`}
        desc="질문을 누르면 그대로 읽거나 복붙할 답변이 나옵니다. 아래 금기 표현은 이 상황에서 절대 쓰지 마세요."
        icon={MessagesSquare}
        copy={pkg.qa.map((q, i) => `${i + 1}. ${q.question}\n→ ${q.answer}`).join("\n\n")}
      />
      <div className="space-y-2 px-4 py-3.5 sm:px-5">
        {pkg.qa.slice(0, 6).map((q, i) => (
          <QaItem key={`${q.question}-${i}`} item={q} index={i} />
        ))}
      </div>
      <div className="border-t border-line bg-risk-soft/50 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1.5">
          <ShieldAlert size={12} className="text-risk" />
          <span className="text-[11px] font-semibold text-risk">절대 쓰면 안 되는 금기 표현</span>
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {pkg.banned.map((b) => (
            <div key={b.phrase} className="rounded-lg border border-risk/15 bg-white px-2.5 py-1.5">
              <div className="text-[10.5px] font-semibold text-risk">{b.phrase}</div>
              <div className="mt-0.5 text-[9.5px] leading-snug text-muted">{b.why}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StakeholdersBlock({ pkg }: { pkg: ResponsePackage }) {
  return (
    <section className="card overflow-hidden" data-testid="block-stakeholders">
      <BlockHeader
        n="04"
        title="유관기관·이해관계자 대응"
        desc="누구에게 언제 무엇을 말할지, 전화·메일 첫 문장까지 준비했습니다. 순서대로 접점을 잡으세요."
        icon={Users}
        copy={pkg.stakeholders
          .map((s) => `${s.who} (${s.when})\n- 할 일: ${s.action}\n- 첫 문장: “${s.line}”`)
          .join("\n\n")}
      />
      <div className="divide-y divide-line">
        {pkg.stakeholders.map((s) => (
          <div key={`${s.who}-${s.when}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[168px_minmax(0,1fr)] sm:px-5">
            <div className="flex items-start gap-2 sm:block">
              <div className="text-[11.5px] font-semibold text-ink">{s.who}</div>
              <span className="chip mt-1 border border-line bg-paper-deep px-1.5 py-0 text-[8.5px] text-muted">
                {s.when} 내
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] leading-relaxed text-ink-2">{s.action}</p>
              {s.line && (
                <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-line bg-[#fcfcfa] px-2.5 py-1.5">
                  <span className="mt-[2px] text-[9px] font-semibold text-faint">첫 문장</span>
                  <span className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-ink-2">“{s.line}”</span>
                  <CopyButton text={s.line} label="복사" className="btn btn-ghost h-6 shrink-0 px-1 text-[9.5px]" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OutlookBlock({ pkg }: { pkg: ResponsePackage }) {
  return (
    <section className="card overflow-hidden" data-testid="block-outlook">
      <BlockHeader
        n="05"
        title="예상 여론 반응과 악화 시 다음 대응"
        desc="이 입장을 냈을 때 실제로 나올 반응입니다. 아래 트리거가 보이면 다음 대응으로 바로 넘어가세요."
        icon={Gauge}
        copy={[
          ...pkg.outlook.reactions.map((r) => `[${r.channel}] ${r.text}`),
          "",
          "악화 트리거",
          ...pkg.outlook.triggers.map((t) => `- ${t}`),
          "",
          "다음 대응",
          ...pkg.outlook.escalation.map((t, i) => `${i + 1}. ${t}`),
        ].join("\n")}
      />
      <div className="grid gap-2 px-4 py-3.5 sm:grid-cols-2 sm:px-5">
        {pkg.outlook.reactions.map((r) => (
          <div key={r.channel + r.text} className="rounded-xl border border-line bg-[#fcfcfa] px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-semibold text-muted">{r.channel}</span>
              <span className="rounded-full bg-white px-1.5 py-[1px] text-[8.5px] text-faint">{r.tone}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{r.text}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-0 border-t border-line sm:grid-cols-2">
        <div className="px-4 py-3.5 sm:border-r sm:border-line sm:px-5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-warn" />
            <span className="text-[10.5px] font-semibold text-warn">악화 트리거</span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {pkg.outlook.triggers.map((t, i) => (
              <li key={t} className="flex gap-2 text-[10.5px] leading-relaxed text-ink-2">
                <span className="num mt-[1px] text-[9px] font-semibold text-warn">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-line px-4 py-3.5 sm:border-t-0 sm:px-5">
          <div className="flex items-center gap-1.5">
            <RotateCcw size={12} className="text-ink-2" />
            <span className="text-[10.5px] font-semibold text-ink-2">악화 시 다음 대응</span>
          </div>
          <ol className="mt-2 space-y-1.5">
            {pkg.outlook.escalation.map((t, i) => (
              <li key={t} className="flex gap-2 text-[10.5px] leading-relaxed text-ink-2">
                <span className="num mt-[1px] text-[9px] font-semibold text-faint">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function PackageView({
  pkg,
  onEdit,
  onRegenerate,
  onOpenManual,
  onNotice,
}: {
  pkg: ResponsePackage;
  onEdit: () => void;
  onRegenerate: () => void;
  onOpenManual: () => void;
  onNotice: (message: string) => void;
}) {
  const stance = getStance(pkg.stance);
  const risk = RISK_STYLE[pkg.risk] ?? RISK_STYLE["보통"];
  const entityLabels = useMemo(
    () => pkg.entities.map((id) => ENTITY_PROFILES.find((p) => p.id === id)?.short ?? id),
    [pkg.entities],
  );
  const placeholders = pkg.statements.reduce((n, s) => n + countPlaceholders(s.body), 0);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(packageToText(pkg));
      onNotice("대응 패키지 전체를 복사했습니다.");
    } catch {
      onNotice("복사가 막혀 있습니다. 브라우저 권한을 확인해 주세요.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[960px] px-3 pb-20 pt-0 sm:px-5">
      <div className="sticky top-0 z-30 -mx-3 mb-3 flex items-center gap-2 border-b border-line bg-paper/95 px-3 py-2 backdrop-blur print:hidden sm:-mx-5 sm:px-5">
        <button type="button" onClick={onEdit} className="btn btn-ghost h-8 px-2 text-[11px] text-muted hover:text-ink">
          <ArrowLeft size={13} /> 새 상황
        </button>
        <span className="hidden text-[10px] text-faint sm:inline">|</span>
        <span className="hidden truncate text-[10.5px] text-muted sm:inline">{pkg.brand} · {pkg.eventLabel}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onRegenerate} className="btn btn-ghost h-8 px-2 text-[10.5px] text-muted hover:text-ink">
            <RotateCcw size={12} /> 다시 만들기
          </button>
          <button
            type="button"
            onClick={copyAll}
            data-testid="copy-all"
            className="btn btn-outline h-8 px-2 text-[10.5px]"
          >
            <Copy size={12} /> <span className="hidden sm:inline">전체 복사</span>
          </button>
          <button type="button" onClick={() => window.print()} className="btn btn-outline h-8 px-2 text-[10.5px]">
            <Printer size={12} /> <span className="hidden sm:inline">인쇄</span>
          </button>
        </div>
      </div>

      <div className="animate-rise" data-testid="package-view">
        <div className="px-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="chip"
              style={{ background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}
            >
              위험도 {pkg.risk}
            </span>
            <span className="chip border border-line bg-surface text-ink-2">{stance.short}</span>
            {entityLabels.map((label) => (
              <span key={label} className="chip border border-line bg-surface text-muted">
                {label}
              </span>
            ))}
            <span className="chip border border-line bg-surface text-muted">{pkg.industryLabel}</span>
            <span
              className={cx(
                "chip",
                pkg.mode === "ai" ? "bg-ok-soft text-ok" : "bg-paper-deep text-muted",
              )}
            >
              {pkg.mode === "ai" ? `실시간 AI${pkg.ai?.model ? ` · ${pkg.ai.model}` : ""}` : "매뉴얼 엔진"}
            </span>
          </div>

          <h1 className="mt-2.5 text-[20px] font-semibold leading-[1.28] tracking-[-0.035em] text-ink sm:text-[27px]">
            {pkg.headline}
          </h1>

          <div className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="eyebrow">상황</span>
              {pkg.fetch?.ok && pkg.fetch.url && (
                <a
                  href={pkg.fetch.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-1 text-[9.5px] text-accent hover:underline"
                >
                  기사 원문 {pkg.fetch.title ? `· ${pkg.fetch.title.slice(0, 34)}` : ""} ({pkg.fetch.chars.toLocaleString()}자 읽음)
                </a>
              )}
            </div>
            {pkg.fetch?.ok && pkg.fetch.title && (
              <p className="mt-1.5 text-[12px] font-semibold leading-snug text-ink">{pkg.fetch.title}</p>
            )}
            <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-[1.7] text-ink-2">
              {pkg.fetch
                ? pkg.situation.replace(pkg.fetch.url, "").trim() || (pkg.fetch.ok ? "기사 본문을 서버가 직접 읽어 분석했습니다." : "기사 링크로 접수된 상황입니다.")
                : pkg.situation}
            </p>
            {pkg.fetch && !pkg.fetch.ok && (
              <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-warn/25 bg-warn-soft px-2 py-1.5 text-[10px] leading-relaxed text-warn">
                <Info size={11} className="mt-[2px] shrink-0" />
                <span>기사 본문을 읽지 못해({pkg.fetch.note ?? "접근 제한"}) 입력한 설명과 매뉴얼로 만들었습니다.</span>
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-faint">
              <span>{pkg.brand}</span>
              <span>{new Date(pkg.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <span>대괄호 {placeholders}곳만 채우면 배포 가능</span>
              {pkg.ai?.latencyMs && <span>{(pkg.ai.latencyMs / 1000).toFixed(1)}초</span>}
            </div>
          </div>

          {pkg.modeNote && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft px-3 py-2 text-[10.5px] leading-relaxed text-warn">
              <Info size={12} className="mt-[2px] shrink-0" />
              <span>{pkg.modeNote}</span>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-2.5">
          <Overview pkg={pkg} />

          <div className="flex items-center gap-2 px-1 pt-1">
            <span className="eyebrow">실행 순서</span>
            <div className="hairline flex-1" />
            <span className="text-[9.5px] text-faint">위에서 아래로 그대로</span>
          </div>

          <ActionsBlock groups={pkg.actions} />
          <StatementsBlock pkg={pkg} />
          <QaBlock pkg={pkg} />
          <StakeholdersBlock pkg={pkg} />
          <OutlookBlock pkg={pkg} />
        </div>

        <div className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-3">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-warn" />
            <span className="text-[10.5px] font-semibold text-ink-2">이 유형에서만 생기는 함정</span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {pkg.watchouts.map((w) => (
              <li key={w} className="flex gap-1.5 text-[10.5px] leading-relaxed text-muted">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-warn/60" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1">
          <button type="button" onClick={onOpenManual} className="btn btn-ghost h-8 px-2 text-[10.5px] text-muted hover:text-ink">
            <BookOpen size={12} /> 참고 매뉴얼·실제 사례 보기
          </button>
          <span className="text-[9.5px] leading-relaxed text-faint">
            확인되지 않은 사실은 만들지 않습니다. [확인 필요] 값은 담당자가 확인해 채우세요.
          </span>
        </div>
      </div>
    </div>
  );
}

export function PackageSkeleton({ stage, note }: { stage: string; note: string }) {
  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-20 pt-6 sm:px-6">
      <div className="card p-5 sm:p-7">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-accent" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="text-[12px] font-semibold text-ink">대응 패키지를 만드는 중</span>
          <span className="ml-auto text-[10px] text-faint">보통 20~40초</span>
        </div>
        <p className="mt-2 text-[11.5px] text-muted">{stage}</p>
        <p className="mt-0.5 text-[10px] text-faint">{note}</p>
        <div className="mt-4 space-y-2">
          {["전체 대응 시스템 정리", "골든타임 체크리스트", "입장문 2종 작성", "압박 질문·답변 스크립트", "유관기관·악화 시나리오"].map((label, i) => (
            <div key={label} className="flex items-center gap-2.5 rounded-lg border border-line bg-[#fcfcfa] px-3 py-2">
              <span className="num text-[9px] text-faint">{`0${i + 1}`}</span>
              <span className="text-[11px] text-ink-2">{label}</span>
              <span className="skeleton-sweep ml-auto h-2 w-16 rounded bg-paper-deep" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-24 p-3">
            <div className="skeleton-sweep h-2 w-20 rounded bg-paper-deep" />
            <div className="skeleton-sweep mt-2 h-2 w-full rounded bg-paper-deep" />
            <div className="skeleton-sweep mt-1.5 h-2 w-3/4 rounded bg-paper-deep" />
          </div>
        ))}
      </div>
    </div>
  );
}
