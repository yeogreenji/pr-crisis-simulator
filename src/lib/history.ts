import type { ResponsePackage } from "./package";
import { getStance } from "./stances";
import { buildScorecard, type AxisId } from "./scorecard";
import type { CaseType, IndustryId } from "../types";

/**
 * 시뮬레이션 기록 — 이 브라우저에만 저장합니다. 서버로 보내지 않습니다.
 * 전체 패키지를 매번 저장하면 용량이 커지므로, 비교에 필요한 요약(입장·점수·7축·문안 규모)만 남깁니다.
 */

const KEY = "prism.simHistory.v1";
const MAX_ITEMS = 24;

export interface SimSnapshot {
  id: string;
  createdAt: string;
  brand: string;
  stance: string;
  stanceCustom?: string;
  stanceShort: string;
  eventLabel: string;
  caseTypeLabel?: string;
  industryLabel: string;
  headline: string;
  situation: string;
  mode: "ai" | "local";
  overall: number;
  axes: { id: AxisId; label: string; short: string; value: number }[];
  stats: { statements: number; qa: number; actions: number; placeholders: number };
  tags: string[];
  /* 기록에서 같은 입력을 다시 재현하기 위한 필드 (없으면 재현 불가) */
  caseType?: CaseType;
  industry?: IndustryId;
  entities?: string[];
  situations?: string[];
  stage?: string;
  scale?: string;
}

const countPlaceholders = (text: string) => (text.match(/\[[^\]\n]{1,40}\]/g) ?? []).length;

export function snapshotOf(pkg: ResponsePackage): SimSnapshot {
  const stance = getStance(pkg.stance, pkg.stanceCustom);
  const card = buildScorecard(pkg);
  const items = pkg.actions.reduce((n, g) => n + g.items.length, 0);
  const placeholders = pkg.statements.reduce((n, s) => n + countPlaceholders(s.body), 0);
  return {
    id: pkg.id,
    createdAt: pkg.createdAt,
    brand: pkg.brand,
    stance: pkg.stance,
    stanceCustom: pkg.stanceCustom,
    stanceShort: pkg.stanceCustom && pkg.stance === "custom" ? pkg.stanceCustom.slice(0, 18) : stance.short,
    eventLabel: pkg.eventLabel,
    caseTypeLabel: pkg.caseTypeLabel,
    industryLabel: pkg.industryLabel,
    headline: pkg.headline,
    situation: pkg.situation.replace(/\s+/g, " ").trim().slice(0, 240),
    mode: pkg.mode,
    overall: card.overall,
    axes: card.axes.map((a) => ({ id: a.id, label: a.label, short: a.short, value: a.value })),
    stats: { statements: pkg.statements.length, qa: pkg.qa.length, actions: items, placeholders },
    tags: [pkg.caseTypeLabel, pkg.industryLabel].filter((v): v is string => Boolean(v)),
    caseType: pkg.caseType,
    industry: pkg.industry,
    entities: pkg.entities,
    situations: pkg.situations,
    stage: pkg.stage,
    scale: pkg.scale,
  };
}

function isSnapshot(value: unknown): value is SimSnapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<SimSnapshot>;
  return typeof row.id === "string" && typeof row.overall === "number" && Array.isArray(row.axes);
}

export function loadHistory(): SimSnapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSnapshot).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function persist(items: SimSnapshot[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* 저장 공간이 없으면 무시 */
  }
}

export function saveSnapshot(pkg: ResponsePackage): SimSnapshot[] {
  const snap = snapshotOf(pkg);
  const next = [snap, ...loadHistory().filter((s) => s.id !== snap.id)].slice(0, MAX_ITEMS);
  persist(next);
  return next;
}

export function removeSnapshot(id: string): SimSnapshot[] {
  const next = loadHistory().filter((s) => s.id !== id);
  persist(next);
  return next;
}

export function clearHistory(): SimSnapshot[] {
  persist([]);
  return [];
}

/** 같은 상황(입력 문장이 같음)에서 만든 기록만 골라 비교 후보로 보여 줍니다. */
export function sameSituationCandidates(items: SimSnapshot[], current: SimSnapshot): SimSnapshot[] {
  const key = current.situation.replace(/\s+/g, "").slice(0, 60);
  return items.filter((s) => s.id !== current.id && s.situation.replace(/\s+/g, "").slice(0, 60) === key);
}

export function comparePairText(a: SimSnapshot, b: SimSnapshot): string {
  const rows = a.axes.map((axis) => {
    const other = b.axes.find((x) => x.id === axis.id);
    return `- ${axis.label}: ${axis.value} vs ${other?.value ?? "-"} (${(other?.value ?? axis.value) - axis.value > 0 ? "+" : ""}${(other?.value ?? axis.value) - axis.value})`;
  });
  return [
    "[PRISM 입장 비교]",
    `A: ${a.brand} · ${a.stanceShort} · 종합 ${a.overall}/100`,
    `B: ${b.brand} · ${b.stanceShort} · 종합 ${b.overall}/100`,
    ...rows,
  ].join("\n");
}
