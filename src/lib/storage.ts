import type { Analysis, LlmConfig, RunRecord } from "../types";
import { GRADE_LABELS } from "./presets";

const RUNS_KEY = "prism.runs.v2";
const API_KEY = "prism.api.v2";

export const toRecord = (a: Analysis): RunRecord => ({
  id: a.id,
  createdAt: a.createdAt,
  brand: a.brand,
  issue: a.issue,
  issueLabel: a.issueLabel,
  industry: a.industry,
  industryLabel: a.industryLabel,
  channels: a.channels,
  score: a.score,
  gradeLabel: a.grade.label,
  text: a.text,
  scenario: a.scenario,
  mediaDesk: a.mediaDesk,
  mediaOutlet: a.mediaOutlet,
  stats: a.stats,
  breakdown: a.breakdown,
  channelTones: a.channelForecasts.map((c) => ({ id: c.id, label: c.label, negativity: c.negativity })),
  summaryLine: a.summaryLine,
  topIssues: a.spans.slice(0, 3).map((s) => s.label),
  engine: a.engine,
});

export function loadRuns(): RunRecord[] {
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RunRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => typeof r?.score === "number" && typeof r?.id === "string").slice(0, 24);
  } catch {
    return [];
  }
}

export function persistRuns(runs: RunRecord[]) {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, 24)));
  } catch {
    /* 저장 공간이 없으면 조용히 넘어갑니다 */
  }
}

export function addRun(runs: RunRecord[], a: Analysis): RunRecord[] {
  const next = [toRecord(a), ...runs.filter((r) => r.id !== a.id)].slice(0, 24);
  persistRuns(next);
  return next;
}

export function removeRun(runs: RunRecord[], id: string): RunRecord[] {
  const next = runs.filter((r) => r.id !== id);
  persistRuns(next);
  return next;
}

export function clearRuns(): RunRecord[] {
  persistRuns([]);
  return [];
}

export const gradeLabelFor = (score: number) =>
  (GRADE_LABELS.find((g) => score <= g.max) ?? GRADE_LABELS[GRADE_LABELS.length - 1]).label;

const DEFAULT_API: LlmConfig = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
  enabled: false,
};

export function loadApiConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(API_KEY);
    if (!raw) return DEFAULT_API;
    const parsed = JSON.parse(raw) as Partial<LlmConfig>;
    return { ...DEFAULT_API, ...parsed };
  } catch {
    return DEFAULT_API;
  }
}

export function persistApiConfig(config: LlmConfig) {
  try {
    localStorage.setItem(API_KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}
