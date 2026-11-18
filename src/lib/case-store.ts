import type { CaseStance, CaseType, CaseVerdict, CrisisCase, IndustryId } from "../types";

const CUSTOM_KEY = "prism.cases.custom.v1";
const REVIEW_KEY = "prism.cases.review.v1";

export const INDUSTRY_IDS: IndustryId[] = ["food", "retail", "consumer", "tech", "steel", "entertainment", "construction", "pharma"];
export const CASE_TYPES: CaseType[] = [
  "product-safety", "false-claim", "data-breach", "outage", "industrial-accident", "disaster", "owner-risk",
  "labor", "celebrity", "financial", "governance", "misconduct", "statement", "environment", "regulatory", "pricing",
];
const STANCES: CaseStance[] = ["apology", "investigating", "rebuttal", "silence"];
const VERDICTS: CaseVerdict[] = ["exemplary", "mixed", "failure"];

const text = (v: unknown, max = 1_200): string => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");
const list = (v: unknown, n = 12, max = 400): string[] =>
  Array.isArray(v) ? v.map((x) => text(x, max)).filter(Boolean).slice(0, n) : [];

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** AI 초안·가져온 JSON을 CrisisCase로 정리합니다. 필수 값이 비어 있으면 null. */
export function normalizeCase(raw: unknown, fallbackId?: string): CrisisCase | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const industry = INDUSTRY_IDS.find((i) => i === r.industry);
  const type = CASE_TYPES.find((t) => t === r.type);
  const company = text(r.company, 80);
  const title = text(r.title, 200);
  if (!industry || !type || !company || !title) return null;
  const date = text(r.date, 30) || "";
  const timeline = (Array.isArray(r.timeline) ? r.timeline : [])
    .map((t) => {
      const row = (t ?? {}) as Record<string, unknown>;
      return { when: text(row.when, 40), what: text(row.what, 600) };
    })
    .filter((t) => t.what)
    .slice(0, 14);
  const sources = (Array.isArray(r.sources) ? r.sources : [])
    .map((s) => {
      const row = (s ?? {}) as Record<string, unknown>;
      return { label: text(row.label, 160), url: text(row.url, 500) };
    })
    .filter((s) => /^https?:\/\//i.test(s.url))
    .slice(0, 12)
    .map((s) => ({ ...s, label: s.label || s.url }));
  const id = text(r.id, 80) || fallbackId || `${slug(company)}-${date.slice(0, 4) || "x"}-${Date.now().toString(36).slice(-4)}`;
  return {
    id,
    industry,
    type,
    stance: STANCES.find((s) => s === r.stance),
    tags: list(r.tags, 10, 30),
    company,
    country: r.country === "US" || r.country === "GLOBAL" ? r.country : "KR",
    date,
    title,
    trigger: text(r.trigger, 800),
    scale: list(r.scale, 8, 300),
    timeline,
    response: list(r.response, 10, 500),
    outcome: text(r.outcome, 1_200),
    lesson: text(r.lesson, 1_200),
    verdict: VERDICTS.find((v) => v === r.verdict) ?? "mixed",
    sources,
    status: r.status === "draft" ? "draft" : "verified",
    uncertain: list(r.uncertain, 8, 200),
  };
}

export function loadCustomCases(): CrisisCase[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]") as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => normalizeCase(c)).filter((c): c is CrisisCase => Boolean(c)).map((c) => ({ ...c, custom: true }));
  } catch {
    return [];
  }
}

export function saveCustomCases(cases: CrisisCase[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(cases.map(({ custom: _c, ...rest }) => rest)));
  } catch {
    /* 저장 공간이 없으면 조용히 넘어갑니다 */
  }
}

export interface ReviewState {
  approved: string[];
  rejected: string[];
}

export function loadReviewState(): ReviewState {
  try {
    const parsed = JSON.parse(localStorage.getItem(REVIEW_KEY) ?? "{}") as Partial<ReviewState>;
    return {
      approved: Array.isArray(parsed.approved) ? parsed.approved.filter((x) => typeof x === "string") : [],
      rejected: Array.isArray(parsed.rejected) ? parsed.rejected.filter((x) => typeof x === "string") : [],
    };
  } catch {
    return { approved: [], rejected: [] };
  }
}

export function saveReviewState(state: ReviewState) {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(state));
  } catch {
    /* 무시 */
  }
}
