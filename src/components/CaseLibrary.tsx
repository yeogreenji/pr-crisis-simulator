import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Search, X } from "lucide-react";
import { INDUSTRIES } from "../lib/industries";
import { CRISIS_CASES, CASE_STANCE_LABEL, CASE_TYPE_LABEL, CASE_VERDICT_LABEL } from "../lib/cases";
import type { CaseStance, CaseType, CaseVerdict, CrisisCase, IndustryId } from "../types";
import { cx } from "./ui";

const VERDICT_STYLE: Record<CaseVerdict, string> = {
  exemplary: "bg-ok-soft text-ok",
  mixed: "bg-warn-soft text-warn",
  failure: "bg-risk-soft text-risk",
};

type SortKey = "recent" | "old" | "title";

function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
        active ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink-2 hover:border-ink/40",
      )}
    >
      {children}
      {count !== undefined && <span className={cx("num text-[11px]", active ? "text-white/70" : "text-faint")}>{count}</span>}
    </button>
  );
}

function CaseDetail({ c }: { c: CrisisCase }) {
  const industry = INDUSTRIES.find((i) => i.id === c.industry);
  return (
    <div className="animate-rise" data-testid="case-detail">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cx("chip px-2 py-0.5 text-[12px]", VERDICT_STYLE[c.verdict])}>{CASE_VERDICT_LABEL[c.verdict]}</span>
        <span className="chip border border-line bg-surface px-2 py-0.5 text-[12px] text-ink-2">{industry?.label}</span>
        <span className="chip border border-line bg-surface px-2 py-0.5 text-[12px] text-ink-2">{CASE_TYPE_LABEL[c.type]}</span>
        {c.stance && <span className="chip border border-line bg-surface px-2 py-0.5 text-[12px] text-muted">초기 입장 · {CASE_STANCE_LABEL[c.stance]}</span>}
        {c.status === "draft" && <span className="chip border border-amber-300 bg-amber-50 px-2 py-0.5 text-[12px] text-amber-900">검토 대기 · 출처 확인 전</span>}
      </div>
      <h3 className="mt-2.5 text-[19px] font-semibold leading-snug tracking-[-0.03em] text-ink">{c.title}</h3>
      <p className="mt-1 text-[13px] text-faint">
        {c.company} · {c.date} · {c.country === "KR" ? "국내" : c.country === "US" ? "미국" : "해외"}
      </p>

      <section className="mt-4">
        <div className="eyebrow">발단</div>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{c.trigger}</p>
        {c.scale.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {c.scale.map((s) => (
              <li key={s} className="rounded-lg bg-paper-deep px-2.5 py-1 text-[12.5px] text-ink-2">
                {s}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <div className="eyebrow">타임라인</div>
        <ol className="mt-2 space-y-0">
          {c.timeline.map((t, i) => (
            <li key={`${t.when}-${i}`} className="relative grid grid-cols-[84px_1fr] gap-3 pb-3 last:pb-0">
              <span className="num pt-[1px] text-[12.5px] font-semibold text-ink">{t.when}</span>
              <span className="relative border-l border-line-strong pl-3 text-[14px] leading-relaxed text-ink-2">
                <span className="absolute -left-[4.5px] top-[7px] h-2 w-2 rounded-full bg-ink/70" />
                {t.what}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-5">
        <div className="eyebrow">기업의 대응</div>
        <ul className="mt-2 space-y-1.5">
          {c.response.map((r) => (
            <li key={r} className="flex gap-2 text-[14px] leading-relaxed text-ink-2">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink/50" />
              {r}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5">
        <div className="eyebrow">결과</div>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{c.outcome}</p>
      </section>

      <section className="mt-5 rounded-xl border border-ink/10 bg-[#fcfcfa] px-4 py-3">
        <div className="eyebrow">교훈</div>
        <p className="mt-1 text-[14px] leading-relaxed text-ink">{c.lesson}</p>
      </section>

      {c.tags && c.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <span key={t} className="text-[12px] text-faint">
              #{t}
            </span>
          ))}
        </div>
      )}

      <section className="mt-5 border-t border-line pt-3">
        <div className="eyebrow">출처 {c.sources.length}건</div>
        <ul className="mt-2 space-y-1.5">
          {c.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 text-[13px] leading-snug text-accent hover:underline">
                <ExternalLink size={12} className="mt-[3px] shrink-0" />
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function CaseLibrary({ onBack, initialCaseId, onOpenStudio }: { onBack: () => void; initialCaseId?: string; onOpenStudio?: () => void }) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState<IndustryId | "all">("all");
  const [type, setType] = useState<CaseType | "all">("all");
  const [verdict, setVerdict] = useState<CaseVerdict | "all">("all");
  const [stance, setStance] = useState<CaseStance | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<string | null>(initialCaseId ?? null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const typeCounts = useMemo(() => {
    const m = new Map<CaseType, number>();
    for (const c of CRISIS_CASES) m.set(c.type, (m.get(c.type) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = CRISIS_CASES.filter((c) => {
      if (industry !== "all" && c.industry !== industry) return false;
      if (type !== "all" && c.type !== type) return false;
      if (verdict !== "all" && c.verdict !== verdict) return false;
      if (stance !== "all" && c.stance !== stance) return false;
      if (!q) return true;
      const hay = [c.title, c.company, c.trigger, c.lesson, c.outcome, ...(c.tags ?? [])].join(" ").toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
    const key = (c: CrisisCase) => c.date.slice(0, 7);
    if (sort === "recent") list.sort((a, b) => key(b).localeCompare(key(a)));
    if (sort === "old") list.sort((a, b) => key(a).localeCompare(key(b)));
    if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    return list;
  }, [query, industry, type, verdict, stance, sort]);

  const selectedCase = CRISIS_CASES.find((c) => c.id === selected) ?? null;
  const filterActive = industry !== "all" || type !== "all" || verdict !== "all" || stance !== "all" || query !== "";

  const reset = () => {
    setQuery("");
    setIndustry("all");
    setType("all");
    setVerdict("all");
    setStance("all");
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-20 pt-5 sm:px-6" data-testid="case-library">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="btn btn-outline h-9 px-3 text-[13px]" data-testid="library-back">
          <ArrowLeft size={14} /> 돌아가기
        </button>
        <div className="min-w-0">
          <div className="eyebrow">Case Library</div>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-ink">위기 사례 라이브러리</h1>
        </div>
        <span className="ml-auto text-[13px] text-muted">
          전체 <b className="num text-ink">{CRISIS_CASES.length}</b>건 · 검수 완료 <b className="num text-ink">{CRISIS_CASES.filter((c) => c.status !== "draft").length}</b>건
        </span>
        {onOpenStudio && (
          <button type="button" onClick={onOpenStudio} className="btn btn-outline h-9 px-3 text-[13px]" data-testid="open-studio">
            사례 등록
          </button>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <label className="flex items-center gap-2 rounded-xl border border-line-strong bg-white px-3 py-2.5 focus-within:border-ink">
          <Search size={16} className="text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="회사명, 사건, 키워드로 검색 (예: 회수, 개인정보, 사과문)"
            className="w-full bg-transparent text-[14.5px] outline-none placeholder:text-faint"
            data-testid="library-search"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="text-faint hover:text-ink">
              <X size={15} />
            </button>
          )}
        </label>

        <div className="mt-3 space-y-2.5">
          <div>
            <div className="mb-1.5 text-[12px] font-semibold text-muted">업종</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={industry === "all"} onClick={() => setIndustry("all")} count={CRISIS_CASES.length}>
                전체
              </Chip>
              {INDUSTRIES.map((i) => (
                <Chip key={i.id} active={industry === i.id} onClick={() => setIndustry(i.id)} count={CRISIS_CASES.filter((c) => c.industry === i.id).length}>
                  {i.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-semibold text-muted">위기 유형</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={type === "all"} onClick={() => setType("all")}>
                전체
              </Chip>
              {typeCounts.map(([t, n]) => (
                <Chip key={t} active={type === t} onClick={() => setType(t)} count={n}>
                  {CASE_TYPE_LABEL[t]}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[12px] font-semibold text-muted">대응 평가</div>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={verdict === "all"} onClick={() => setVerdict("all")}>
                  전체
                </Chip>
                {(Object.keys(CASE_VERDICT_LABEL) as CaseVerdict[]).map((v) => (
                  <Chip key={v} active={verdict === v} onClick={() => setVerdict(v)}>
                    {CASE_VERDICT_LABEL[v]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[12px] font-semibold text-muted">초기 입장</div>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={stance === "all"} onClick={() => setStance("all")}>
                  전체
                </Chip>
                {(Object.keys(CASE_STANCE_LABEL) as CaseStance[]).map((s) => (
                  <Chip key={s} active={stance === s} onClick={() => setStance(s)}>
                    {CASE_STANCE_LABEL[s]}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-semibold text-ink" data-testid="library-count">
          {filtered.length}건
        </span>
        {filterActive && (
          <button type="button" onClick={reset} className="text-[13px] text-accent hover:underline">
            필터 초기화
          </button>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[13px] text-muted">
          정렬
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-line-strong bg-white px-2 py-1.5 text-[13px] text-ink">
            <option value="recent">최신순</option>
            <option value="old">오래된 순</option>
            <option value="title">제목순</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <div className="space-y-2.5">
          {filtered.map((c) => {
            const open = selected === c.id;
            return (
              <div key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(open ? null : c.id);
                    if (!open && window.innerWidth >= 1024) detailRef.current?.scrollTo({ top: 0 });
                  }}
                  data-testid={`case-card-${c.id}`}
                  className={cx(
                    "w-full rounded-xl border bg-surface p-3.5 text-left transition-colors",
                    open ? "border-ink shadow-[0_8px_24px_-18px_rgba(16,19,25,0.5)]" : "border-line hover:border-ink/40",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cx("chip px-2 py-0.5 text-[11.5px]", VERDICT_STYLE[c.verdict])}>{CASE_VERDICT_LABEL[c.verdict]}</span>
                    <span className="text-[12.5px] text-faint">
                      {INDUSTRIES.find((i) => i.id === c.industry)?.short} · {CASE_TYPE_LABEL[c.type]} · {c.date}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">{c.title}</div>
                  <div className="mt-1 text-[13px] text-muted">{c.company}</div>
                  <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{c.trigger}</p>
                </button>
                {open && (
                  <div className="mt-2 rounded-xl border border-line bg-surface p-4 lg:hidden">
                    <CaseDetail c={c} />
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-line-strong bg-surface px-4 py-10 text-center text-[14px] text-muted">
              조건에 맞는 사례가 없습니다.
              <button type="button" onClick={reset} className="ml-1 text-accent hover:underline">
                필터 초기화
              </button>
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <div ref={detailRef} className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-5">
            {selectedCase ? (
              <CaseDetail c={selectedCase} />
            ) : (
              <div className="py-16 text-center text-[14px] text-muted">왼쪽에서 사례를 선택하면 타임라인·대응·교훈·출처가 여기에 표시됩니다.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
