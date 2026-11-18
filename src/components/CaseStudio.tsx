import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Copy, Download, Loader2, Sparkles, Trash2, Upload, X } from "lucide-react";
import type { CaseStance, CaseType, CaseVerdict, CrisisCase, IndustryId } from "../types";
import { CANDIDATE_IDS, CASE_STANCE_LABEL, CASE_TYPE_LABEL, CASE_VERDICT_LABEL, CRISIS_CASES, refreshCases } from "../lib/cases";
import {
  CASE_TYPES,
  INDUSTRY_IDS,
  loadCustomCases,
  loadReviewState,
  normalizeCase,
  saveCustomCases,
  saveReviewState,
} from "../lib/case-store";
import { INDUSTRIES } from "../lib/industries";
import { AiError, describeAiError, requestCaseDraft } from "../lib/package-ai";
import { cx } from "./ui";

interface Form {
  id?: string;
  company: string;
  date: string;
  industry: IndustryId;
  type: CaseType;
  stance: CaseStance | "";
  verdict: CaseVerdict;
  title: string;
  trigger: string;
  scale: string;
  timeline: string;
  response: string;
  outcome: string;
  lesson: string;
  tags: string;
  sources: string;
  uncertain: string[];
}

const EMPTY: Form = {
  company: "",
  date: "",
  industry: "consumer",
  type: "product-safety",
  stance: "",
  verdict: "mixed",
  title: "",
  trigger: "",
  scale: "",
  timeline: "",
  response: "",
  outcome: "",
  lesson: "",
  tags: "",
  sources: "",
  uncertain: [],
};

const toForm = (c: CrisisCase): Form => ({
  id: c.id,
  company: c.company,
  date: c.date,
  industry: c.industry,
  type: c.type,
  stance: c.stance ?? "",
  verdict: c.verdict,
  title: c.title,
  trigger: c.trigger,
  scale: c.scale.join("\n"),
  timeline: c.timeline.map((t) => `${t.when} | ${t.what}`).join("\n"),
  response: c.response.join("\n"),
  outcome: c.outcome,
  lesson: c.lesson,
  tags: (c.tags ?? []).join(", "),
  sources: c.sources.map((s) => `${s.label} | ${s.url}`).join("\n"),
  uncertain: c.uncertain ?? [],
});

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function fromForm(f: Form, status: "verified" | "draft"): CrisisCase | null {
  return normalizeCase({
    id: f.id,
    company: f.company,
    date: f.date,
    industry: f.industry,
    type: f.type,
    stance: f.stance || undefined,
    verdict: f.verdict,
    title: f.title,
    trigger: f.trigger,
    scale: lines(f.scale),
    timeline: lines(f.timeline).map((l) => {
      const [when, ...rest] = l.split("|");
      return rest.length ? { when: when.trim(), what: rest.join("|").trim() } : { when: "", what: l };
    }),
    response: lines(f.response),
    outcome: f.outcome,
    lesson: f.lesson,
    tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    sources: lines(f.sources).map((l) => {
      const idx = l.lastIndexOf("|");
      return idx >= 0 ? { label: l.slice(0, idx).trim(), url: l.slice(idx + 1).trim() } : { label: l, url: l };
    }),
    status,
    uncertain: f.uncertain,
  });
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      {hint && <span className="ml-1.5 text-[12px] text-faint">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function CaseStudio({
  onBack,
  aiReady,
  apiKey,
  notify,
  onChanged,
}: {
  onBack: () => void;
  aiReady: boolean;
  apiKey?: string;
  notify: (message: string) => void;
  onChanged: () => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [confirmed, setConfirmed] = useState(false);
  const [importText, setImportText] = useState("");
  const [rev, setRev] = useState(0);

  const customs = useMemo(() => CRISIS_CASES.filter((c) => c.custom), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const candidates = useMemo(() => CRISIS_CASES.filter((c) => CANDIDATE_IDS.has(c.id)), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const review = loadReviewState();
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const touch = () => {
    refreshCases();
    setRev((n) => n + 1);
    onChanged();
  };

  const makeDraft = async () => {
    setBusy(true);
    setError(null);
    try {
      const { draft } = await requestCaseDraft(input, { apiKey });
      setForm(toForm(draft));
      setConfirmed(false);
      notify("AI 초안을 만들었습니다. 아래 내용을 출처와 대조해 검수해 주세요.");
    } catch (e) {
      setError(e instanceof AiError ? e.hint ?? describeAiError(e) : "초안을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const save = (status: "verified" | "draft") => {
    const next = fromForm(form, status);
    if (!next) {
      setError("회사명·제목은 필수입니다.");
      return;
    }
    if (status === "verified" && next.sources.length === 0) {
      setError("검수 완료로 저장하려면 출처 URL이 1개 이상 필요합니다.");
      return;
    }
    const all = loadCustomCases().filter((c) => c.id !== next.id);
    saveCustomCases([{ ...next, custom: true }, ...all]);
    touch();
    setError(null);
    setForm(EMPTY);
    setConfirmed(false);
    setInput("");
    notify(status === "verified" ? "검수 완료 사례로 저장했습니다. 유사 사례 계산에 반영됩니다." : "검토 대기 초안으로 저장했습니다.");
  };

  const removeCustom = (id: string) => {
    saveCustomCases(loadCustomCases().filter((c) => c.id !== id));
    touch();
  };

  const decide = (id: string, action: "approve" | "reject" | "reset") => {
    const state = loadReviewState();
    state.approved = state.approved.filter((x) => x !== id);
    state.rejected = state.rejected.filter((x) => x !== id);
    if (action === "approve") state.approved.push(id);
    if (action === "reject") state.rejected.push(id);
    saveReviewState(state);
    touch();
  };

  const exportable = useMemo(
    () => CRISIS_CASES.filter((c) => c.status !== "draft" && (c.custom || review.approved.includes(c.id))),
    [rev], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const exportJson = () =>
    JSON.stringify(exportable.map(({ custom: _c, status: _s, ...rest }) => rest), null, 2);

  const importJson = () => {
    try {
      const parsed = JSON.parse(importText) as unknown;
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const ok = arr.map((r) => normalizeCase({ ...(r as object), status: "draft" })).filter((c): c is CrisisCase => Boolean(c));
      if (!ok.length) throw new Error("empty");
      const existing = loadCustomCases();
      const ids = new Set(ok.map((c) => c.id));
      saveCustomCases([...ok.map((c) => ({ ...c, custom: true })), ...existing.filter((c) => !ids.has(c.id))]);
      setImportText("");
      touch();
      notify(`${ok.length}건을 검토 대기 초안으로 가져왔습니다.`);
    } catch {
      setError("JSON을 읽지 못했습니다. 사례 배열 형식인지 확인해 주세요.");
    }
  };

  const hasForm = Boolean(form.company || form.title || form.id);

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pb-20 pt-5 sm:px-6" data-testid="case-studio">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="btn btn-outline h-9 px-3 text-[13px]" data-testid="studio-back">
          <ArrowLeft size={14} /> 돌아가기
        </button>
        <div>
          <div className="eyebrow">Case Studio</div>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-ink">사례 등록 도구</h1>
        </div>
      </div>

      <section className="card mt-4 p-4">
        <h2 className="text-[15px] font-semibold text-ink">1. 기사 URL 또는 본문으로 초안 만들기</h2>
        <p className="mt-1 text-[13px] text-muted">
          AI가 기사에 있는 내용만으로 초안을 만들고, 확인되지 않은 항목은 비워 둡니다. 초안은 검수 전에는 유사 사례 계산에 쓰이지 않습니다.
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          className="field mt-3 resize-y text-[13.5px]"
          placeholder={"https://news.example.com/article/12345\n(URL 여러 개와 메모를 함께 붙여 넣어도 됩니다. 첫 URL의 본문을 읽습니다.)"}
          data-testid="studio-input"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={makeDraft}
            disabled={busy || !aiReady || input.trim().length < 8}
            className="btn btn-accent h-9 px-3 text-[13px] disabled:opacity-50"
            data-testid="studio-draft"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} AI 초안 만들기
          </button>
          {!aiReady && <span className="text-[12.5px] text-muted">AI가 연결되지 않아 직접 입력만 가능합니다.</span>}
          <button type="button" onClick={() => setForm({ ...EMPTY, company: " " })} className="btn btn-ghost h-9 px-3 text-[13px] text-muted">
            직접 입력
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800" role="alert">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
      </section>

      {hasForm && (
        <section className="card mt-4 p-4" data-testid="studio-form">
          <h2 className="text-[15px] font-semibold text-ink">2. 검수 후 저장</h2>
          {form.uncertain.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              <b>AI가 근거 부족으로 표시한 항목</b>
              <ul className="mt-1 list-disc pl-5">
                {form.uncertain.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="회사·브랜드">
              <input className="field" value={form.company.trim() ? form.company : ""} onChange={(e) => set("company", e.target.value)} data-testid="f-company" />
            </Field>
            <Field label="시기" hint="예: 2023-04 또는 2021-06~2022-01">
              <input className="field" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="업종">
              <select className="field" value={form.industry} onChange={(e) => set("industry", e.target.value as IndustryId)}>
                {INDUSTRY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {INDUSTRIES.find((i) => i.id === id)?.label ?? id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="위기 유형">
              <select className="field" value={form.type} onChange={(e) => set("type", e.target.value as CaseType)}>
                {CASE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CASE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="초기 입장" hint="기사로 확인될 때만">
              <select className="field" value={form.stance} onChange={(e) => set("stance", e.target.value as CaseStance | "")}>
                <option value="">미확인</option>
                {(Object.keys(CASE_STANCE_LABEL) as CaseStance[]).map((s) => (
                  <option key={s} value={s}>
                    {CASE_STANCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="평가">
              <select className="field" value={form.verdict} onChange={(e) => set("verdict", e.target.value as CaseVerdict)}>
                {(Object.keys(CASE_VERDICT_LABEL) as CaseVerdict[]).map((v) => (
                  <option key={v} value={v}>
                    {CASE_VERDICT_LABEL[v]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3 grid gap-3">
            <Field label="제목">
              <input className="field" value={form.title} onChange={(e) => set("title", e.target.value)} data-testid="f-title" />
            </Field>
            <Field label="발단">
              <textarea className="field" rows={2} value={form.trigger} onChange={(e) => set("trigger", e.target.value)} />
            </Field>
            <Field label="규모" hint="한 줄에 하나">
              <textarea className="field" rows={3} value={form.scale} onChange={(e) => set("scale", e.target.value)} />
            </Field>
            <Field label="타임라인" hint="한 줄에 하나 · 날짜 | 내용">
              <textarea className="field" rows={6} value={form.timeline} onChange={(e) => set("timeline", e.target.value)} />
            </Field>
            <Field label="실제 대응" hint="한 줄에 하나">
              <textarea className="field" rows={5} value={form.response} onChange={(e) => set("response", e.target.value)} />
            </Field>
            <Field label="결과">
              <textarea className="field" rows={3} value={form.outcome} onChange={(e) => set("outcome", e.target.value)} />
            </Field>
            <Field label="교훈">
              <textarea className="field" rows={3} value={form.lesson} onChange={(e) => set("lesson", e.target.value)} />
            </Field>
            <Field label="태그" hint="쉼표로 구분">
              <input className="field" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
            </Field>
            <Field label="출처" hint="한 줄에 하나 · 제목 | URL">
              <textarea className="field" rows={4} value={form.sources} onChange={(e) => set("sources", e.target.value)} data-testid="f-sources" />
            </Field>
          </div>
          <label className="mt-4 flex items-start gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" data-testid="f-confirm" />
            출처 기사를 직접 열어 위 내용(날짜·수치·대응)을 대조했습니다.
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => save("verified")}
              disabled={!confirmed}
              className="btn btn-accent h-9 px-3 text-[13px] disabled:opacity-50"
              data-testid="f-save-verified"
            >
              <Check size={14} /> 검수 완료로 저장
            </button>
            <button type="button" onClick={() => save("draft")} className="btn btn-outline h-9 px-3 text-[13px]" data-testid="f-save-draft">
              초안으로 저장
            </button>
            <button type="button" onClick={() => setForm(EMPTY)} className="btn btn-ghost h-9 px-3 text-[13px] text-muted">
              비우기
            </button>
          </div>
        </section>
      )}

      <section className="card mt-4 p-4" data-testid="studio-candidates">
        <h2 className="text-[15px] font-semibold text-ink">3. 자동 수집 후보 (검토 대기)</h2>
        <p className="mt-1 text-[13px] text-muted">매주 자동 수집이 쌓는 후보입니다. 출처를 열어 확인한 뒤 승인하면 라이브러리와 유사 사례 계산에 들어갑니다.</p>
        {candidates.length === 0 ? (
          <p className="mt-3 text-[13px] text-faint">아직 수집된 후보가 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {candidates.map((c) => {
              const approved = review.approved.includes(c.id);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-ink">{c.title}</div>
                    <div className="text-[12px] text-muted">
                      {c.company} · {c.date} · 출처 {c.sources.length}건
                      {c.sources[0] && (
                        <>
                          {" · "}
                          <a href={c.sources[0].url} target="_blank" rel="noreferrer" className="underline">
                            첫 출처 열기
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  {approved ? (
                    <button type="button" onClick={() => decide(c.id, "reset")} className="btn btn-ghost h-8 px-2 text-[12.5px]">
                      승인됨 · 되돌리기
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => decide(c.id, "approve")} className="btn btn-accent h-8 px-2 text-[12.5px]">
                        <Check size={12} /> 승인
                      </button>
                      <button type="button" onClick={() => decide(c.id, "reject")} className="btn btn-outline h-8 px-2 text-[12.5px]">
                        <X size={12} /> 반려
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card mt-4 p-4" data-testid="studio-mine">
        <h2 className="text-[15px] font-semibold text-ink">4. 내가 등록한 사례</h2>
        {customs.length === 0 ? (
          <p className="mt-2 text-[13px] text-faint">등록한 사례가 없습니다.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {customs.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className={cx("chip", c.status === "draft" ? "text-amber-800" : "text-emerald-800")}>
                  {c.status === "draft" ? "검토 대기" : "검수 완료"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{c.title}</span>
                <button
                  type="button"
                  onClick={() => {
                    setForm(toForm(c));
                    setConfirmed(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="btn btn-outline h-8 px-2 text-[12.5px]"
                >
                  수정
                </button>
                <button type="button" onClick={() => removeCustom(c.id)} aria-label="삭제" className="btn btn-ghost h-8 px-2 text-muted">
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-xl border border-line bg-surface p-3">
          <div className="text-[13px] font-semibold text-ink">내보내기·가져오기</div>
          <p className="mt-1 text-[12.5px] text-muted">
            등록·승인한 사례는 이 브라우저에만 저장됩니다. 팀 공용·영구 보관은 JSON을 내보내 저장소(src/data/cases)에 넣거나 서버 DB를 붙여야 합니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="studio-export-copy"
              disabled={exportable.length === 0}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exportJson());
                  notify(`검수 완료 ${exportable.length}건 JSON을 복사했습니다.`);
                } catch {
                  notify("복사가 막혀 있습니다. 파일 저장을 이용해 주세요.");
                }
              }}
              className="btn btn-outline h-8 px-2 text-[12.5px] disabled:opacity-50"
            >
              <Copy size={12} /> JSON 복사 ({exportable.length})
            </button>
            <button
              type="button"
              disabled={exportable.length === 0}
              onClick={() => download(`prism-cases-${new Date().toISOString().slice(0, 10)}.json`, exportJson())}
              className="btn btn-outline h-8 px-2 text-[12.5px] disabled:opacity-50"
            >
              <Download size={12} /> 파일 저장
            </button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={3}
            data-testid="studio-import"
            placeholder="사례 JSON 배열을 붙여 넣으면 검토 대기 초안으로 가져옵니다."
            className="field mt-2 text-[12.5px]"
          />
          <button type="button" data-testid="studio-import-btn" onClick={importJson} disabled={!importText.trim()} className="btn btn-outline mt-2 h-8 px-2 text-[12.5px] disabled:opacity-50">
            <Upload size={12} /> 가져오기
          </button>
        </div>
      </section>
    </div>
  );
}
