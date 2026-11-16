import { ISSUE_CATEGORIES } from "../lib/presets";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock,
  ExternalLink,
  Filter,
  Layers,
  Play,
  Printer,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";
import type { CrisisCase, IndustryId } from "../types";
import { CRISIS_CASES, CASE_VERDICT_LABEL } from "../lib/cases";
import { INDUSTRIES, getIndustry } from "../lib/industries";
import { Card, Eyebrow, SectionHead, cx } from "./ui";
import { PlaybookPrint } from "./PlaybookPrint";

const VERDICT_STYLE: Record<CrisisCase["verdict"], string> = {
  exemplary: "bg-ok-soft text-ok border-ok/20",
  mixed: "bg-warn-soft text-warn border-warn/20",
  failure: "bg-risk-soft text-risk border-risk/20",
};

const SEV_COLOR = (n: number) => (n === 3 ? "#c8352b" : n === 2 ? "#a9660a" : "#2f5f8a");

function CaseCard({ item }: { item: CrisisCase }) {
  const [open, setOpen] = useState(false);
  const industry = getIndustry(item.industry);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
        <span className={cx("chip border", VERDICT_STYLE[item.verdict])}>{CASE_VERDICT_LABEL[item.verdict]}</span>
        <span
          className="chip"
          style={{ background: `${industry.accent}12`, color: industry.accent, border: `1px solid ${industry.accent}26` }}
        >
          {industry.label}
        </span>
        <span className="num ml-auto text-[10px] text-faint">
          {item.country} · {item.date}
        </span>
      </div>

      <div className="px-4 pb-3 pt-2">
        <div className="text-[10.5px] font-semibold text-muted">{item.company}</div>
        <h3 className="mt-0.5 text-[13.5px] font-semibold leading-[1.5] tracking-[-0.015em] text-ink">{item.title}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.trigger}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.scale.map((s) => (
            <span key={s} className="chip border border-line bg-[#fcfcfa] text-ink-2">
              {s}
            </span>
          ))}
        </div>

        <div className="mt-2.5 rounded-lg border border-line bg-[#fcfcfa] px-3 py-2">
          <div className="flex items-start gap-1.5">
            <Target size={12} className="mt-[2px] shrink-0 text-accent" />
            <p className="text-[11px] leading-[1.7] text-ink-2">
              <b className="font-semibold">교훈 </b>
              {item.lesson}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-accent-deep hover:underline"
        >
          {open ? "접기" : "타임라인·초기 대응·결과 보기"}
          <ChevronDown size={11} className={cx("transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="animate-rise space-y-3 border-t border-line bg-[#fbfbf8] px-4 py-3.5">
          <div>
            <Eyebrow className="mb-1.5">무슨 일이 있었나</Eyebrow>
            <ol className="space-y-1.5">
              {item.timeline.map((t) => (
                <li key={`${t.when}-${t.what}`} className="flex gap-2.5">
                  <span className="num mt-[1px] w-[64px] shrink-0 text-[9.5px] font-semibold text-muted">{t.when}</span>
                  <span className="text-[11px] leading-[1.7] text-ink-2">{t.what}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <Eyebrow className="mb-1.5">초기 대응</Eyebrow>
            <ul className="space-y-1">
              {item.response.map((r) => (
                <li key={r} className="flex gap-1.5 text-[11px] leading-[1.7] text-ink-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Eyebrow className="mb-1.5">결과</Eyebrow>
            <p className="text-[11px] leading-[1.8] text-ink-2">{item.outcome}</p>
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-line pt-2.5">
            {item.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[9.5px] font-medium text-ink-2 hover:border-accent/40 hover:text-accent-deep"
              >
                <ExternalLink size={9} />
                {s.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function PlaybookPanel({
  industryId,
  onSelectIndustry,
  onSimulate,
}: {
  industryId: IndustryId;
  onSelectIndustry: (id: IndustryId) => void;
  onSimulate: (id: IndustryId) => void;
}) {
  const industry = getIndustry(industryId);
  const p = industry.playbook;

  const print = () => {
    document.body.classList.add("printing-playbook");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing-playbook"), 1200);
  };

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-[#fbfbf8] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <BookOpen size={13} className="text-accent" />
              <Eyebrow>Industry playbook</Eyebrow>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={print} className="btn btn-outline h-7 px-2 text-[10.5px]">
                <Printer size={11} /> 인쇄
              </button>
              <button
                type="button"
                onClick={() => onSimulate(industryId)}
                className="btn btn-primary h-7 px-2 text-[10.5px]"
              >
                <Play size={11} /> 이 업종으로 실행
              </button>
            </div>
          </div>
          <h2 className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em]">{industry.label} 위기관리 매뉴얼</h2>
          <p className="mt-1 text-[11px] leading-[1.7] text-ink-2">{p.stance}</p>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
          {INDUSTRIES.map((i) => {
            const active = i.id === industryId;
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => onSelectIndustry(i.id)}
                className={cx(
                  "shrink-0 rounded-md px-2 py-1 text-[10.5px] font-semibold transition-colors",
                  active ? "bg-ink text-white" : "text-muted hover:bg-paper-deep hover:text-ink",
                )}
              >
                {i.short}
              </button>
            );
          })}
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-risk" />
              <Eyebrow>주요 위기 트리거</Eyebrow>
            </div>
            <ul className="space-y-1.5">
              {p.triggers.map((t) => (
                <li key={t.label} className="flex items-start gap-2 rounded-lg border border-line bg-[#fcfcfa] px-2.5 py-1.5">
                  <span
                    className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: SEV_COLOR(t.severity) }}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-ink">{t.label}</div>
                    <div className="text-[10px] leading-relaxed text-muted">{t.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <div>
              <Eyebrow className="mb-1.5">규제·법적 주체</Eyebrow>
              <ul className="space-y-1.5">
                {p.regulators.map((r) => (
                  <li key={r.name} className="text-[10.5px] leading-relaxed text-ink-2">
                    <b className="font-semibold text-ink">{r.name}</b>
                    <span className="text-muted"> — {r.role}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Eyebrow className="mb-1.5">관련 법령</Eyebrow>
              <ul className="space-y-1.5">
                {p.laws.map((l) => (
                  <li key={l.name} className="text-[10.5px] leading-relaxed text-ink-2">
                    <b className="font-semibold text-ink">{l.name}</b>
                    <span className="text-muted"> — {l.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Clock size={12} className="text-accent" />
              <Eyebrow>골든타임 타임라인</Eyebrow>
            </div>
            <div className="space-y-2">
              {p.timeline.map((step, idx) => (
                <div key={step.window} className="relative rounded-lg border border-line bg-surface px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="num grid h-5 min-w-5 place-items-center rounded bg-ink px-1.5 text-[9.5px] font-semibold text-white">
                      {step.window}
                    </span>
                    <span className="text-[11px] font-semibold text-ink">{step.title}</span>
                    <span className="num ml-auto text-[9px] text-faint">
                      {idx + 1}/{p.timeline.length}
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {step.items.map((it) => (
                      <li key={it} className="flex gap-1.5 text-[10.5px] leading-[1.7] text-ink-2">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-risk/20 bg-risk-soft/45 p-3">
              <Eyebrow className="mb-1.5 text-risk">절대 금기 표현</Eyebrow>
              <ul className="space-y-1.5">
                {p.banned.map((b) => (
                  <li key={b.phrase} className="text-[10.5px] leading-relaxed">
                    <span className="font-semibold text-risk">“{b.phrase}”</span>
                    <div className="text-[9.5px] text-muted">{b.why}</div>
                    <div className="text-[9.5px] text-ok">→ {b.instead}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-ok/20 bg-ok-soft/45 p-3">
              <Eyebrow className="mb-1.5 text-ok">필수 포함 요소</Eyebrow>
              <ul className="space-y-1.5">
                {p.required.map((r) => (
                  <li key={r.label} className="text-[10.5px] leading-relaxed">
                    <span className="font-semibold text-ink">{r.label}</span>
                    <div className="text-[9.5px] text-muted">{r.desc}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Users size={12} className="text-ink-2" />
              <Eyebrow>이해관계자별 대응 톤</Eyebrow>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {p.stakeholders.map((s) => (
                <div key={s.who} className="rounded-lg border border-line bg-[#fcfcfa] p-2.5">
                  <div className="text-[11px] font-semibold text-ink">{s.who}</div>
                  <div className="text-[9.5px] text-muted">{s.tone}</div>
                  <div className="mt-1 text-[9.5px] leading-relaxed text-ok">✓ {s.dos.join(" · ")}</div>
                  <div className="mt-0.5 text-[9.5px] leading-relaxed text-risk">✕ {s.donts.join(" · ")}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Eyebrow className="mb-1.5">증거·기록 확보</Eyebrow>
              <ul className="space-y-1">
                {p.evidence.map((e) => (
                  <li key={e} className="flex gap-1.5 text-[10.5px] leading-relaxed text-ink-2">
                    <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Eyebrow className="mb-1.5">특히 조심할 것</Eyebrow>
              <ul className="space-y-1">
                {p.watchouts.map((w) => (
                  <li key={w} className="flex gap-1.5 text-[10.5px] leading-relaxed text-ink-2">
                    <AlertTriangle size={10} className="mt-[2px] shrink-0 text-warn" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function LibraryView({
  industry,
  onIndustry,
  onSimulate,
}: {
  industry: IndustryId;
  onIndustry: (id: IndustryId) => void;
  onSimulate: (id: IndustryId) => void;
}) {
  const [filter, setFilter] = useState<IndustryId | null>(null);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [pane, setPane] = useState<"cases" | "playbook">("cases");

  const cases = useMemo(
    () => CRISIS_CASES.filter((c) =>
      (!filter || c.industry === filter) && (!region || c.country === region) &&
      query.trim().toLowerCase().split(/\s+/).every((term) =>
        [c.title, c.company, c.trigger, c.date, ...c.response].join(" ").toLowerCase().includes(term),
      ),
    ),
    [filter, query, region],
  );

  const counts = useMemo(() => {
    const map = new Map<IndustryId, number>();
    for (const c of CRISIS_CASES) map.set(c.industry, (map.get(c.industry) ?? 0) + 1);
    return map;
  }, []);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="grid-paper border-b border-line px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <Eyebrow>Case library · Playbook</Eyebrow>
              <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.03em] sm:text-[23px]">
                위기 사례 & 업종 매뉴얼
              </h1>
              <p className="mt-1 max-w-[640px] text-[11.5px] leading-[1.8] text-muted">
                실제 보도·공식 자료로 확인한 국내외 위기관리 사례 {CRISIS_CASES.length}건과, 업종별 골든타임
                타임라인·금기 표현·이해관계자 톤을 담은 6개 매뉴얼. 업종을 고르면 시뮬레이터의 점수·질문·수정안도
                함께 바뀝니다.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="chip border border-line bg-surface text-ink-2">
                <Layers size={11} /> 사례 {CRISIS_CASES.length}
              </span>
              <span className="chip border border-line bg-surface text-ink-2">
                <BookOpen size={11} /> 매뉴얼 {INDUSTRIES.length}
              </span>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_10rem]">
            <input className="field p-2 text-sm" aria-label="사례 키워드 검색" placeholder="회사·사건·대응 키워드로 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select className="field p-2 text-sm" aria-label="사례 지역" value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="">전체 지역</option><option value="KR">국내</option><option value="US">미국</option><option value="GLOBAL">글로벌</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-faint">
              <Filter size={10} /> 업종
            </span>
            <button
              type="button"
              onClick={() => setFilter(null)}
              className={cx(
                "rounded-lg border px-2 py-[5px] text-[10.5px] font-semibold transition-colors",
                filter === null
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              전체 {CRISIS_CASES.length}
            </button>
            {INDUSTRIES.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  setFilter(i.id);
                  onIndustry(i.id);
                }}
                className={cx(
                  "rounded-lg border px-2 py-[5px] text-[10.5px] font-semibold transition-colors",
                  filter === i.id
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-ink-2 hover:border-line-strong",
                )}
              >
                {i.label} {counts.get(i.id) ?? 0}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 border-b border-line px-2 py-1.5 lg:hidden">
          {[
            { id: "cases" as const, label: `사례 ${cases.length}`, icon: Layers },
            { id: "playbook" as const, label: "업종 매뉴얼", icon: BookOpen },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPane(t.id)}
              className={cx(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold",
                pane === t.id ? "bg-ink text-white" : "text-muted hover:bg-paper-deep hover:text-ink",
              )}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="font-semibold">사건 유형별 초동 체크리스트</h2>
        <p className="text-xs text-muted">업종 매뉴얼과 함께 쓰는 기자 문의·사실 확인용 체크리스트입니다.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {ISSUE_CATEGORIES.map((item) => <details key={item.id} className="rounded-lg border border-line p-2 text-sm">
            <summary className="cursor-pointer font-medium">{item.label}</summary>
            <ol className="list-decimal space-y-1 py-2 pl-5">
              {item.factChecks.map((question) => <li key={question}>{question}</li>)}
            </ol>
            <p className="text-xs text-muted">질문별 확인 담당과 회신 마감을 정하고, 확인된 내용으로 1차 답변을 준비하세요.</p>
          </details>)}
        </div>
      </Card>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className={cx(pane === "cases" ? "block" : "hidden", "space-y-2.5 lg:block")}>
          <div className="flex items-center justify-between px-0.5">
            <SectionHead
              title={filter ? `${getIndustry(filter).label} 사례` : "전체 사례"}
              desc="모범·혼합·실패로 구분해, 무엇이 통했고 무엇이 브랜드를 무너뜨렸는지 비교합니다."
            />
          </div>
          {cases.map((c) => (
            <CaseCard key={c.id} item={c} />
          ))}
          {cases.length === 0 && (
            <Card className="p-6 text-center text-[11.5px] text-muted">검색 조건과 일치하는 사례가 없습니다.</Card>
          )}
        </div>

        <div className={cx(pane === "playbook" ? "block" : "hidden", "lg:block")}>
          <div className="xl:sticky xl:top-[70px] xl:max-h-[calc(100vh-86px)] xl:overflow-y-auto xl:pr-1">
            <PlaybookPanel industryId={industry} onSelectIndustry={onIndustry} onSimulate={onSimulate} />
          </div>
        </div>
      </div>

      <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
        <ShieldAlert size={14} className="text-accent" />
        <p className="text-[11px] leading-relaxed text-ink-2">
          사례의 기업·기관은 실명이지만, 시뮬레이터의 샘플 기업은 모두 가상입니다. 수치·일자는 각 사례의 공개
          출처를 확인하세요.
        </p>
        <button
          type="button"
          onClick={() => onSimulate(industry)}
          className="btn btn-accent ml-auto h-8 px-3 text-[11.5px]"
        >
          {getIndustry(industry).short} 샘플로 분석하기
          <ArrowRight size={12} />
        </button>
      </Card>

      {createPortal(<PlaybookPrint industry={getIndustry(industry)} />, document.body)}
    </div>
  );
}
