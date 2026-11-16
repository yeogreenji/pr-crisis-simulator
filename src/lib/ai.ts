import type {
  Analysis,
  ChannelId,
  ChannelSimulation,
  FactCheck,
  GoldenTimeStep,
  Headline,
  PressQaItem,
  Reaction,
  RevisionVariant,
  Severity,
  ToneKind,
} from "../types";
import { getChannel } from "./presets";
import { getIndustry as getIndustryData } from "./industries";
import { ACCENTS, HANDLES } from "./sentiment";

/** 실시간 AI 백엔드 주소. 정적 호스팅(GitHub Pages)에서는 호출이 404로 끝나고 로컬 모드로 남습니다. */
const BASE = import.meta.env.BASE_URL || "/";
export const AI_ENDPOINT = `${BASE.replace(/\/+$/, "")}/api/analyze`;

export type AiStatusCode =
  | "no_key"
  | "static"
  | "network"
  | "timeout"
  | "bad_response"
  | "too_long"
  | "server";

export class AiError extends Error {
  code: AiStatusCode;

  constructor(code: AiStatusCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AiError";
  }
}

export interface AiServerStatus {
  ok: boolean;
  serverKey: boolean;
  model: string;
  message: string;
}

export interface AiRequest {
  brand: string;
  industry: string;
  issue: string;
  channels: string[];
  draft: string;
  context: Record<string, unknown>;
}

export interface AiMetaResult {
  model: string;
  latencyMs?: number;
  score?: number;
  comment?: string;
}

export interface AiPayloadResult {
  analysis: Analysis;
  meta: AiMetaResult;
}

interface RawAiPayload {
  score?: unknown;
  comment?: unknown;
  headlines?: unknown;
  factChecks?: unknown;
  revisions?: unknown;
  channelSimulations?: unknown;
  pressQa?: unknown;
  goldenTime?: unknown;
}

const hash = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const clampSeverity = (value: unknown, fallback: Severity = 2): Severity => {
  const n = typeof value === "number" ? Math.round(value) : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return n === 3 || n === 2 || n === 1 ? (n as Severity) : fallback;
};

const TONES: ToneKind[] = ["분노", "냉소", "질문", "연대", "지지", "우려"];
const toneOf = (value: unknown): ToneKind =>
  typeof value === "string" && (TONES as string[]).includes(value.trim()) ? (value.trim() as ToneKind) : "질문";

const text = (value: unknown, max = 8_000): string =>
  typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, max) : "";

const textList = (value: unknown, maxItems = 6, maxChars = 300): string[] =>
  Array.isArray(value)
    ? value
        .map((v) => text(v, maxChars))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const normalizeQuestion = (q: string) => q.replace(/[\s?？.·,:：'"“”‘’]/g, "").toLowerCase();

function decorateReaction(channelId: string, index: number, body: string, tone: ToneKind): Reaction {
  const seed = hash(`${channelId}-${index}-${body}`);
  const handles = HANDLES[channelId as ChannelId] ?? ["@현장_관찰자"];
  const handle = handles[seed % handles.length];
  return {
    id: `${channelId}-ai-${index}`,
    handle,
    initials: handle.replace(/^@/, "").slice(0, 2).toUpperCase(),
    accent: ACCENTS[seed % ACCENTS.length],
    time: `${(seed % 40) + 2}분 전`,
    text: body,
    tone,
    likes: (seed % 620) + 11,
    replies: (seed % 38) + 2,
    badge: "AI 시뮬레이션",
  };
}

function parseRevisions(base: Analysis, raw: unknown): RevisionVariant[] {
  const items = Array.isArray(raw) ? raw : [];
  const byId = new Map<string, RevisionVariant>();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = row.id === "authority" ? "authority" : row.id === "empathy" ? "empathy" : null;
    if (!id) continue;
    const body = text(row.body, 8_000);
    if (body.length < 40) continue;
    byId.set(id, {
      id,
      label: text(row.label, 40) || (id === "empathy" ? "공감·수습 우선형" : "팩트·원칙 명확형"),
      audience: text(row.audience, 40) || (id === "empathy" ? "소비자·커뮤니티" : "언론·기관"),
      body,
      changes: textList(row.changes, 6, 200),
    });
  }
  return (["empathy", "authority"] as const).map((id) => {
    const found = byId.get(id);
    const fallback = base.revisions.find((r) => r.id === id);
    if (!found) return fallback as RevisionVariant;
    return { ...found, changes: found.changes.length ? found.changes : (fallback?.changes ?? []) };
  });
}

function parseChannelSimulations(base: Analysis, raw: unknown): ChannelSimulation[] {
  const items = Array.isArray(raw) ? raw : [];
  const byChannel = new Map<string, ChannelSimulation>();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.channel === "string" ? row.channel : "";
    if (!base.channels.includes(id as ChannelId)) continue;
    const reactions = (Array.isArray(row.reactions) ? row.reactions : [])
      .map((r, i) => {
        if (typeof r === "string") {
          const body = text(r, 400);
          return body ? decorateReaction(id, i, body, "질문") : null;
        }
        if (!r || typeof r !== "object") return null;
        const rr = r as Record<string, unknown>;
        const body = text(rr.text, 400);
        return body ? decorateReaction(id, i, body, toneOf(rr.tone)) : null;
      })
      .filter((r): r is Reaction => Boolean(r))
      .slice(0, 3);
    const triggers = textList(row.triggers, 4, 200);
    if (reactions.length === 0 && triggers.length === 0) continue;
    byChannel.set(id, {
      id: id as ChannelId,
      label: getChannel(id as ChannelId).label,
      reactions,
      triggers,
      source: "ai",
    });
  }

  return base.channels.map((id) => {
    const ai = byChannel.get(id);
    const local = base.channelSimulations.find((c) => c.id === id);
    if (!ai) return local as ChannelSimulation;
    return {
      ...ai,
      reactions: ai.reactions.length ? ai.reactions : (local?.reactions ?? []),
      triggers: ai.triggers.length ? ai.triggers : (local?.triggers ?? []),
    };
  });
}

function parsePressQa(base: Analysis, raw: unknown): PressQaItem[] {
  const items = Array.isArray(raw) ? raw : [];
  const out: PressQaItem[] = [];
  for (const [i, item] of items.entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const question = text(row.question, 240);
    const answerGuide = text(row.answerGuide ?? row.answer ?? row.guide, 1_200);
    if (question.length < 4 || answerGuide.length < 4) continue;
    out.push({
      id: `ai-pq-${i}`,
      question,
      answerGuide,
      avoid: textList(row.avoid, 4, 80),
      severity: clampSeverity(row.severity, i < 2 ? 3 : 2),
      source: "ai",
    });
    if (out.length >= 6) break;
  }

  const seen = new Set(out.map((q) => normalizeQuestion(q.question)));
  for (const local of base.pressQa) {
    const key = normalizeQuestion(local.question);
    if (seen.has(key)) continue;
    const covered = [...seen].some((s) => s.includes(key) || key.includes(s));
    if (covered) continue;
    out.push(local);
    seen.add(key);
    if (out.length >= 10) break;
  }
  return out.sort((a, b) => b.severity - a.severity);
}

function parseGoldenTime(base: Analysis, raw: unknown): GoldenTimeStep[] {
  const items = Array.isArray(raw) ? raw : [];
  const parsed: GoldenTimeStep[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const windowLabel = text(row.window, 20);
    const list = textList(row.items, 6, 240);
    if (!windowLabel || list.length === 0) continue;
    parsed.push({
      window: windowLabel,
      title: text(row.title, 80) || `${windowLabel} 실행 항목`,
      items: list,
    });
  }
  if (parsed.length === 0) return base.goldenTime;

  const slots = ["1시간", "6시간", "24시간"];
  return slots.map((slot, index) => {
    const found =
      parsed.find((p) => p.window.replace(/\s/g, "") === slot) ??
      parsed.find((p) => p.window.includes(slot.replace("시간", ""))) ??
      parsed[index];
    const fallback = base.goldenTime[index];
    if (!found) return fallback as GoldenTimeStep;
    return { ...found, window: slot };
  });
}

/** AI 원본 응답을 앱의 Analysis에 합칩니다. 형식이 어긋난 필드는 로컬 결과를 유지합니다. */
export function mergeAiPayload(base: Analysis, payload: RawAiPayload, meta: AiMetaResult): Analysis {
  const headlines: Headline[] = Array.isArray(payload.headlines)
    ? payload.headlines
        .map((h) => {
          if (!h || typeof h !== "object") return null;
          const row = h as Record<string, unknown>;
          const body = text(row.text, 220);
          if (body.length < 6) return null;
          return {
            tone: row.tone === "positive" ? ("positive" as const) : ("critical" as const),
            outlet: text(row.outlet, 40) || "AI 실시간 분석",
            text: body,
            note: text(row.note, 260) || "AI가 제안한 각도입니다.",
          };
        })
        .filter((h): h is Headline => Boolean(h))
        .slice(0, 6)
    : [];

  const factChecks: FactCheck[] = Array.isArray(payload.factChecks)
    ? payload.factChecks
        .map((f, i) => {
          if (!f || typeof f !== "object") return null;
          const row = f as Record<string, unknown>;
          const question = text(row.question, 240);
          if (question.length < 6) return null;
          return {
            question,
            why: text(row.why, 260) || "후속 취재에서 확인이 필요한 항목입니다.",
            severity: clampSeverity(row.severity, i < 2 ? 3 : 2),
          };
        })
        .filter((f): f is FactCheck => Boolean(f))
        .slice(0, 6)
    : [];

  const score =
    typeof payload.score === "number" && payload.score >= 0 && payload.score <= 100
      ? Math.round(payload.score)
      : typeof payload.score === "string" && /^\d+$/.test(payload.score)
        ? Math.min(100, Number.parseInt(payload.score, 10))
        : undefined;

  return {
    ...base,
    mode: "ai",
    modeNote: undefined,
    engine: "llm",
    source: "llm",
    headlines: headlines.length ? headlines : base.headlines,
    factChecks: factChecks.length ? factChecks : base.factChecks,
    revisions: parseRevisions(base, payload.revisions),
    channelSimulations: parseChannelSimulations(base, payload.channelSimulations),
    pressQa: parsePressQa(base, payload.pressQa),
    goldenTime: parseGoldenTime(base, payload.goldenTime),
    ai: {
      model: meta.model,
      usedAt: new Date().toISOString(),
      latencyMs: meta.latencyMs,
      score,
      comment: text(payload.comment, 400) || meta.comment,
    },
  };
}

/** 업종 매뉴얼에서 프롬프트용 컨텍스트를 뽑습니다. */
export function buildAiContext(a: Analysis): Record<string, unknown> {
  const industry = getIndustryData(a.industry);
  return {
    industryLabel: a.industryLabel,
    issueLabel: a.issueLabel,
    channelLabels: a.channels.map((c) => getChannel(c).label),
    stance: industry.playbook.stance,
    regulators: industry.playbook.regulators.slice(0, 3).map((r) => `${r.name} — ${r.role}`),
    laws: industry.playbook.laws.slice(0, 3).map((l) => `${l.name} — ${l.note}`),
    banned: industry.playbook.banned.slice(0, 5).map((b) => `“${b.phrase}” → ${b.instead} (${b.why})`),
    timeline: industry.playbook.timeline.slice(0, 4),
    required: industry.playbook.required.slice(0, 6).map((r) => `${r.label} — ${r.desc}`),
    missing: a.missing.slice(0, 8).map((m) => m.label),
    riskyPhrases: a.spans.slice(0, 8).map((s) => `“${s.text}” (${s.label})`),
    score: a.score,
  };
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return null;
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function checkAiServer(timeoutMs = 8_000): Promise<AiServerStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(AI_ENDPOINT, { method: "GET", signal: controller.signal, headers: { Accept: "application/json" } });
    const data = await readJson(res);
    if (!res.ok || !data) {
      return {
        ok: false,
        serverKey: false,
        model: "gpt-4o-mini",
        message: res.status === 404 ? "이 호스팅에는 AI 백엔드가 없습니다." : `AI 서버 응답 ${res.status}`,
      };
    }
    const serverKey = data.serverKey === true;
    return {
      ok: true,
      serverKey,
      model: typeof data.model === "string" ? data.model : "gpt-4o-mini",
      message: serverKey
        ? "서버 키로 실시간 AI 분석이 준비되어 있습니다."
        : "서버 키가 없습니다. 개인 키를 입력하면 이 브라우저에서만 사용합니다.",
    };
  } catch {
    return {
      ok: false,
      serverKey: false,
      model: "gpt-4o-mini",
      message: "AI 서버에 연결하지 못했습니다. 정적 호스팅이거나 네트워크가 막혀 있습니다.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function requestAiAnalysis(
  base: Analysis,
  options: { apiKey?: string; timeoutMs?: number } = {},
): Promise<AiPayloadResult> {
  const apiKey = options.apiKey?.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 75_000);

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({
        brand: base.brand,
        industry: base.industry,
        issue: base.issue,
        channels: base.channels,
        draft: base.text,
        context: buildAiContext(base),
        ...(apiKey ? { apiKey } : {}),
      }),
      signal: controller.signal,
    });

    const data = await readJson(res);
    if (!data) {
      // 정적 파일 서버는 POST를 404·405·501로 돌려보내고 HTML을 내려줍니다.
      const staticLike = res.status === 404 || res.status === 405 || res.status === 501;
      throw new AiError(
        staticLike ? "static" : "bad_response",
        staticLike
          ? "이 주소에는 AI 백엔드가 없습니다(정적 호스팅)."
          : `AI 서버가 JSON이 아닌 응답을 보냈습니다 (${res.status}).`,
      );
    }

    if (!res.ok || data.ok !== true) {
      const code = typeof data.error === "string" ? data.error : "";
      const message = typeof data.message === "string" ? data.message : `AI 서버 오류 (${res.status})`;
      if (res.status === 501 || code === "no_key") throw new AiError("no_key", message);
      if (res.status === 413 || code === "draft_too_long") throw new AiError("too_long", message);
      if (res.status === 504 || code === "timeout") throw new AiError("timeout", message);
      throw new AiError("server", message);
    }

    const result = (data.result ?? {}) as RawAiPayload;
    const meta: AiMetaResult = {
      model: typeof data.model === "string" ? data.model : "gpt-4o-mini",
      latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : undefined,
    };
    const merged = mergeAiPayload(base, result, meta);
    const hasDeliverables =
      merged.revisions.some((r) => r.id === "empathy" || r.id === "authority") &&
      (merged.pressQa.some((q) => q.source === "ai") || merged.channelSimulations.some((c) => c.source === "ai"));
    if (!hasDeliverables) {
      throw new AiError("bad_response", "AI 응답에 실전 산출물이 없습니다.");
    }
    return { analysis: merged, meta };
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiError("timeout", "AI 응답이 제한 시간을 넘겼습니다.");
    }
    throw new AiError("network", "AI 서버에 연결하지 못했습니다.");
  } finally {
    clearTimeout(timer);
  }
}

export function describeAiError(error: unknown): string {
  if (error instanceof AiError) {
    switch (error.code) {
      case "no_key":
        return "서버 키 미설정 — 설정에서 개인 키를 넣거나 Vercel에 GEMINI_API_KEY(또는 OPENAI_API_KEY)를 추가하세요.";
      case "static":
        return "정적 호스팅 모드 — AI 백엔드(/api/analyze)가 없어 로컬 규칙으로 분석했습니다.";
      case "too_long":
        return "초안이 8,000자를 넘어 AI 분석을 건너뛰었습니다.";
      case "timeout":
        return "AI 응답 시간 초과 — 로컬 규칙으로 분석했습니다.";
      case "bad_response":
        return "AI 응답 형식 오류 — 로컬 규칙으로 분석했습니다.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "알 수 없는 오류";
}

