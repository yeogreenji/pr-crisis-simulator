import type { Severity } from "../types";
import type { ResponsePackage, ReviewResult, ReviewFinding, QaScript, StakeholderPlan, BannedPhrase, RoadmapPhase, ActionGroup, Statement } from "./package";
import { buildLocalReview } from "./package";
import { ENTITY_PROFILES, getProfile } from "./profiles";
import { getIndustry } from "./industries";
import type { CrisisCase } from "../types";
import { normalizeCase } from "./case-store";
import { findSimilarCases } from "./similar";
import { CASE_VERDICT_LABEL } from "./cases";

const BASE = import.meta.env.BASE_URL || "/";
export const ANALYZE_ENDPOINT = `${BASE.replace(/\/+$/, "")}/api/analyze`;

export type AiStatusCode =
  | "no_key"
  | "static"
  | "network"
  | "timeout"
  | "bad_response"
  | "fetch"
  | "too_long"
  | "server";

export class AiError extends Error {
  code: AiStatusCode;
  /** 기사 읽기 실패처럼 화면에 그대로 보여 줄 안내 */
  hint?: string;

  constructor(code: AiStatusCode, message: string, hint?: string) {
    super(message);
    this.code = code;
    this.hint = hint;
    this.name = "AiError";
  }
}

export interface ServerStatus {
  ok: boolean;
  serverKey: boolean;
  provider: string | null;
  model: string;
  urlFetch: boolean;
  message: string;
}

interface RawRecord {
  [key: string]: unknown;
}

const str = (value: unknown, max = 4_000): string =>
  typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, max) : "";

const strList = (value: unknown, maxItems = 8, maxChars = 400): string[] =>
  Array.isArray(value) ? value.map((v) => str(v, maxChars)).filter(Boolean).slice(0, maxItems) : [];

const level = (value: unknown, fallback: Severity = 2): Severity => {
  const n = typeof value === "number" ? Math.round(value) : Number.parseInt(String(value), 10);
  return n === 3 || n === 2 || n === 1 ? (n as Severity) : fallback;
};

const asRecord = (value: unknown): RawRecord | null => (value && typeof value === "object" ? (value as RawRecord) : null);

/** 서버 상태 — 정적 호스팅(GitHub Pages)에서는 404라서 로컬 모드로 남습니다. */
export async function checkServer(timeoutMs = 8_000): Promise<ServerStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ANALYZE_ENDPOINT, { method: "GET", signal: controller.signal, headers: { Accept: "application/json" } });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("json")) {
      return {
        ok: false,
        serverKey: false,
        provider: null,
        model: "gemini-3.5-flash-lite",
        urlFetch: false,
        message: !type.includes("json")
          ? "이 호스팅에는 AI 백엔드가 없습니다(정적 배포). 매뉴얼 엔진으로 동작합니다."
          : `AI 서버 응답 ${res.status}`,
      };
    }
    const data = (await res.json()) as RawRecord;
    const serverKey = data.serverKey === true;
    return {
      ok: true,
      serverKey,
      provider: typeof data.provider === "string" ? data.provider : null,
      model: typeof data.model === "string" ? data.model : "gemini-3.5-flash-lite",
      urlFetch: data.urlFetch === true,
      message: serverKey
        ? "서버 키로 실시간 AI가 연결되어 있습니다. 기사 URL도 서버가 직접 읽습니다."
        : "서버 키가 없습니다. 개인 키를 넣거나 매뉴얼 엔진으로 사용할 수 있습니다.",
    };
  } catch {
    return {
      ok: false,
      serverKey: false,
      provider: null,
      model: "gemini-3.5-flash-lite",
      urlFetch: false,
      message: "AI 서버에 연결하지 못했습니다. 정적 호스팅이거나 네트워크가 막혀 있습니다.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* 유형·업종 상세 지침 (프롬프트 보강)                                   */
/* ------------------------------------------------------------------ */

export function buildAiContext(pkg: ResponsePackage): Record<string, string> {
  const industry = getIndustry(pkg.industry);
  const p = industry.playbook;
  const playbook = [
    `대응 원칙: ${p.stance}`,
    `주요 트리거: ${p.triggers.slice(0, 3).map((t) => `${t.label}(${t.desc})`).join(" / ")}`,
    `규제 주체: ${p.regulators.slice(0, 3).map((r) => `${r.name} — ${r.role}`).join(" / ")}`,
    `관련 법령: ${p.laws.slice(0, 3).map((l) => `${l.name} — ${l.note}`).join(" / ")}`,
    `골든타임: ${p.timeline.map((t) => `${t.window} ${t.title}: ${t.items.slice(0, 2).join(", ")}`).join(" | ")}`,
    `금기 표현: ${p.banned.slice(0, 4).map((b) => `“${b.phrase}”→${b.instead}`).join(" / ")}`,
    `필수 요소: ${p.required.slice(0, 5).map((r) => r.label).join(", ")}`,
  ].join("\n");

  const entityDigest = pkg.entities
    .map((id) => {
      const profile = getProfile(id);
      return [
        `■ ${profile.label} — ${profile.frame}`,
        `법적 문구: ${profile.legal}`,
        `로드맵 통과 기준: ${profile.roadmap.map((r) => `${r.window}: ${r.gate}`).join(" | ")}`,
        `유관기관: ${profile.stakeholders.slice(0, 4).map((s) => `${s.who}(${s.when})`).join(", ")}`,
        `유형 금기: ${profile.banned.slice(0, 3).map((b) => b.phrase).join(", ")}`,
        `함정: ${profile.watchouts.slice(0, 2).join(" / ")}`,
      ].join("\n");
    })
    .join("\n\n");

  const similar = findSimilarCases(`${pkg.situation} ${pkg.eventLabel}`, pkg.industry, {
    limit: 5,
    types: pkg.caseType ? [pkg.caseType] : undefined,
  });
  const caseDigest = similar
    .map(({ case: c, reasons }, i) => {
      const lines = [
        `■ 사례 ${i + 1}. ${c.company} (${c.date}, ${CASE_VERDICT_LABEL[c.verdict]}${c.custom ? ", 사용자 직접 등록" : ""})`,
        `사건: ${c.title}`,
        `대응: ${c.response.slice(0, 3).join(" / ")}`,
        `교훈: ${c.lesson}`,
        `매칭 이유: ${reasons.join(" · ")}`,
      ];
      return lines.join("\n");
    })
    .join("\n\n");

  return {
    industryLabel: industry.label,
    playbook: playbook.slice(0, 3_000),
    entityDigest: entityDigest.slice(0, 2_500),
    caseTypeLabel: pkg.caseTypeLabel ?? (pkg.caseType ? pkg.caseType : "자동 판별 불가"),
    caseDigest: caseDigest.slice(0, 3_500),
  };
}

/* ------------------------------------------------------------------ */
/* 응답 병합                                                            */
/* ------------------------------------------------------------------ */

function mergeRoadmap(base: RoadmapPhase[], raw: unknown): RoadmapPhase[] {
  const items = Array.isArray(raw) ? raw : [];
  const slots = ["1시간", "6시간", "24시간"];
  return slots.map((slot, i) => {
    const row = asRecord(items[i]) ?? asRecord(items.find((v) => str(asRecord(v)?.window, 20).includes(slot.replace("시간", ""))));
    const fallback = base[i];
    if (!row) return fallback;
    const list = strList(row.items, 6, 260);
    if (!list.length) return fallback;
    return {
      window: slot,
      title: str(row.title, 80) || fallback.title,
      goal: str(row.goal, 300) || fallback.goal,
      gate: str(row.gate, 300) || fallback.gate,
      items: list,
    };
  });
}

function mergeActions(base: ActionGroup[], raw: unknown): ActionGroup[] {
  const items = Array.isArray(raw) ? raw : [];
  return base.map((fallback, i) => {
    const row = asRecord(items[i]);
    if (!row) return fallback;
    const list = (Array.isArray(row.items) ? row.items : [])
      .map((item) => {
        if (typeof item === "string") return { text: str(item, 300), owner: "" };
        const rec = asRecord(item);
        if (!rec) return null;
        const text = str(rec.text ?? rec.item, 300);
        return text ? { text, owner: str(rec.owner, 20) } : null;
      })
      .filter((v): v is { text: string; owner: string } => Boolean(v))
      .slice(0, 8);
    if (!list.length) return fallback;
    return { window: fallback.window, title: str(row.title, 80) || fallback.title, items: list };
  });
}

function mergeStatements(base: Statement[], raw: unknown): Statement[] {
  const items = Array.isArray(raw) ? raw : [];
  const byId = new Map<string, Statement>();
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const id = row.id === "press" ? "press" : row.id === "public" ? "public" : null;
    if (!id) continue;
    const body = str(row.body, 8_000);
    if (body.length < 120) continue;
    const fallback = base.find((s) => s.id === id);
    byId.set(id, {
      id,
      label: fallback?.label ?? (id === "public" ? "고객·커뮤니티 공지" : "언론 배포·기자 회신"),
      channel: fallback?.channel ?? "",
      title: str(row.title, 160) || fallback?.title || "",
      body,
    });
  }
  return base.map((s) => byId.get(s.id) ?? s);
}

function mergeQa(base: QaScript[], raw: unknown): QaScript[] {
  const items = Array.isArray(raw) ? raw : [];
  const out: QaScript[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const question = str(row.question, 260);
    const answer = str(row.answer ?? row.answerGuide ?? row.script, 1_600);
    if (question.length < 4 || answer.length < 10) continue;
    out.push({
      question,
      answer,
      guide: str(row.guide ?? row.why, 400),
      avoid: strList(row.avoid, 3, 80),
      level: level(row.severity, out.length < 2 ? 3 : 2),
      source: "ai",
    });
    if (out.length >= 7) break;
  }
  const seen = new Set(out.map((q) => q.question.replace(/[\s?？.·,:]/g, "")));
  for (const local of base) {
    if (out.length >= 5) break;
    const key = local.question.replace(/[\s?？.·,:]/g, "");
    if (seen.has(key)) continue;
    out.push(local);
    seen.add(key);
  }
  return out.sort((a, b) => b.level - a.level);
}

function mergeBanned(base: BannedPhrase[], raw: unknown): BannedPhrase[] {
  const items = Array.isArray(raw) ? raw : [];
  const out: BannedPhrase[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      const phrase = str(item, 120);
      if (phrase) out.push({ phrase, why: "이 상황에서 쓰면 프레임이 흔들리는 표현입니다." });
      continue;
    }
    const row = asRecord(item);
    if (!row) continue;
    const phrase = str(row.phrase ?? row.text, 140);
    if (!phrase) continue;
    out.push({ phrase, why: str(row.why ?? row.reason, 300) || "이 상황에서 쓰면 프레임이 흔들리는 표현입니다." });
  }
  if (out.length === 0) return base;
  const seen = new Set(out.map((b) => b.phrase));
  for (const local of base) {
    if (out.length >= 5) break;
    if (!seen.has(local.phrase)) {
      out.push(local);
      seen.add(local.phrase);
    }
  }
  return out.slice(0, 6);
}

function mergeStakeholders(base: StakeholderPlan[], raw: unknown): StakeholderPlan[] {
  const items = Array.isArray(raw) ? raw : [];
  const out: StakeholderPlan[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const who = str(row.who ?? row.target, 80);
    const action = str(row.action ?? row.what, 300);
    if (!who || !action) continue;
    const key = who.replace(/\s/g, "").slice(0, 8);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      who,
      when: str(row.when, 20) || "6시간",
      action,
      line: str(row.line ?? row.script, 400),
    });
    if (out.length >= 7) break;
  }
  for (const local of base) {
    if (out.length >= 4) break;
    if (seen.has(local.who.replace(/\s/g, "").slice(0, 8))) continue;
    out.push(local);
    seen.add(local.who.replace(/\s/g, "").slice(0, 8));
  }
  return out;
}

function mergeOutlook(base: ResponsePackage["outlook"], raw: unknown): ResponsePackage["outlook"] {
  const row = asRecord(raw);
  if (!row) return base;
  const reactions = (Array.isArray(row.reactions) ? row.reactions : [])
    .map((item) => {
      const rec = asRecord(item);
      if (!rec) return null;
      const text = str(rec.text, 300);
      if (!text) return null;
      return { channel: str(rec.channel, 40) || "커뮤니티", text, tone: str(rec.tone, 10) || "질문" };
    })
    .filter((v): v is { channel: string; text: string; tone: string } => Boolean(v))
    .slice(0, 6);
  const triggers = strList(row.triggers, 4, 300);
  const escalation = strList(row.escalation ?? row.next, 4, 300);
  return {
    reactions: reactions.length ? reactions : base.reactions,
    triggers: triggers.length ? triggers : base.triggers,
    escalation: escalation.length ? escalation : base.escalation,
  };
}

export interface AiMeta {
  model: string;
  latencyMs?: number;
  provider?: string;
}

export function mergePackage(
  base: ResponsePackage,
  raw: unknown,
  meta: AiMeta,
  source?: ResponsePackage["fetch"],
): ResponsePackage {
  const row = asRecord(raw) ?? {};
  const risk = row.risk === "높음" || row.risk === "보통" || row.risk === "낮음" ? row.risk : base.risk;
  const merged: ResponsePackage = {
    ...base,
    mode: "ai",
    headline: str(row.headline, 300) || base.headline,
    strategy: str(row.strategy, 300) || base.strategy,
    risk,
    roadmap: mergeRoadmap(base.roadmap, row.roadmap),
    actions: mergeActions(base.actions, row.actions),
    statements: mergeStatements(base.statements, row.statements),
    qa: mergeQa(base.qa, row.qa),
    banned: mergeBanned(base.banned, row.banned),
    stakeholders: mergeStakeholders(base.stakeholders, row.stakeholders),
    outlook: mergeOutlook(base.outlook, row.outlook),
    watchouts: strList(row.watchouts, 4, 300).length ? strList(row.watchouts, 4, 300) : base.watchouts,
    fetch: source ?? base.fetch,
    ai: { model: meta.model, latencyMs: meta.latencyMs, provider: meta.provider },
  };
  return merged;
}

/* ------------------------------------------------------------------ */
/* 요청                                                                */
/* ------------------------------------------------------------------ */

interface RequestOptions {
  apiKey?: string;
  timeoutMs?: number;
  onStage?: (stage: string) => void;
}

async function post(body: RawRecord, options: RequestOptions): Promise<RawRecord> {
  const apiKey = options.apiKey?.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 80_000);
  try {
    const res = await fetch(ANALYZE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({ ...body, ...(apiKey ? { apiKey } : {}) }),
      signal: controller.signal,
    });
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("json")) {
      const staticLike = res.status === 404 || res.status === 405 || res.status === 501;
      throw new AiError(
        staticLike ? "static" : "bad_response",
        staticLike ? "이 주소에는 AI 백엔드가 없습니다(정적 호스팅)." : `AI 서버가 JSON이 아닌 응답을 보냈습니다 (${res.status}).`,
      );
    }
    const data = (await res.json()) as RawRecord;
    if (!res.ok || data.ok !== true) {
      const code = typeof data.error === "string" ? data.error : "";
      const message = typeof data.message === "string" ? data.message : `AI 서버 오류 (${res.status})`;
      if (res.status === 501 || code === "no_key") throw new AiError("no_key", message);
      if (code === "fetch_failed") throw new AiError("fetch", message, message);
      if (code === "input_too_long") throw new AiError("too_long", message);
      if (res.status === 504 || code === "timeout") throw new AiError("timeout", message);
      throw new AiError("server", message);
    }
    return data;
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new AiError("timeout", "AI 응답이 제한 시간을 넘겼습니다.");
    throw new AiError("network", "AI 서버에 연결하지 못했습니다.");
  } finally {
    clearTimeout(timer);
  }
}

export async function requestPackage(base: ResponsePackage, options: RequestOptions = {}): Promise<ResponsePackage> {
  options.onStage?.("상황과 기사 원문을 정리하는 중");
  const data = await post(
    {
      mode: "package",
      situation: base.situation,
      brand: base.brand,
      stance: base.stance,
      entities: base.entities,
      context: buildAiContext(base),
    },
    options,
  );
  options.onStage?.("입장문·답변 문안을 다듬는 중");
  const sourceRow = asRecord(data.source);
  const source: ResponsePackage["fetch"] = sourceRow && typeof sourceRow.url === "string"
    ? {
        url: String(sourceRow.url),
        title: str(sourceRow.title, 200),
        chars: typeof sourceRow.chars === "number" ? sourceRow.chars : 0,
        ok: sourceRow.ok === true,
        note: str(sourceRow.note, 200) || undefined,
      }
    : undefined;
  const merged = mergePackage(
    base,
    data.result,
    {
      model: str(data.model, 60) || "AI",
      latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : undefined,
      provider: str(data.provider, 20) || undefined,
    },
    source,
  );
  const completeStatements = merged.statements.filter((s) => s.body.length >= 120).length;
  if (completeStatements < 2 || merged.qa.length < 4) {
    throw new AiError("bad_response", "AI 응답에 대응 패키지 핵심 문안이 부족합니다.");
  }
  return merged;
}

function mergeReview(base: ReviewResult, raw: unknown, meta: AiMeta): ReviewResult {
  const row = asRecord(raw) ?? {};
  const findings: ReviewFinding[] = (Array.isArray(row.findings) ? row.findings : [])
    .map((item) => {
      const rec = asRecord(item);
      if (!rec) return null;
      const quote = str(rec.quote, 200);
      if (!quote) return null;
      return {
        quote,
        label: str(rec.label, 60) || "위험 표현",
        why: str(rec.why, 400),
        fix: str(rec.fix, 400),
        level: level(rec.severity),
      };
    })
    .filter((v): v is ReviewFinding => Boolean(v))
    .slice(0, 8);
  const checklist = (Array.isArray(row.checklist) ? row.checklist : [])
    .map((item) => {
      const rec = asRecord(item);
      if (!rec) return null;
      const label = str(rec.label, 120);
      if (!label) return null;
      return { label, ok: rec.ok === true, hint: str(rec.hint, 300) };
    })
    .filter((v): v is { label: string; ok: boolean; hint: string } => Boolean(v))
    .slice(0, 8);
  const rewrite = str(row.rewrite, 8_000);
  const score = typeof row.score === "number" ? Math.max(0, Math.min(100, Math.round(row.score))) : base.score;
  return {
    ...base,
    mode: "ai",
    score,
    summary: str(row.summary, 400) || base.summary,
    findings: findings.length ? findings : base.findings,
    rewrite: rewrite.length >= 120 ? rewrite : base.rewrite,
    checklist: checklist.length ? checklist : base.checklist,
    ai: { model: meta.model, latencyMs: meta.latencyMs, provider: meta.provider },
  };
}

export async function requestReview(draft: string, brand: string, options: RequestOptions = {}): Promise<ReviewResult> {
  const base = buildLocalReview(draft, brand);
  if (draft.trim().length < 20) return base;
  options.onStage?.("초안의 위험 표현을 짚는 중");
  const data = await post({ mode: "review", draft, brand }, options);
  return mergeReview(base, data.result, {
    model: str(data.model, 60) || "AI",
    latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : undefined,
    provider: str(data.provider, 20) || undefined,
  });
}

export function describeAiError(error: unknown): string {
  if (error instanceof AiError) {
    switch (error.code) {
      case "no_key":
        return "서버 키 없음 — 설정에서 개인 키를 넣거나 Vercel에 GEMINI_API_KEY를 추가하세요. 지금은 매뉴얼 엔진 결과를 보여 드립니다.";
      case "static":
        return "정적 배포라 AI 백엔드가 없습니다. 매뉴얼 엔진으로 만든 패키지입니다.";
      case "timeout":
        return "AI 응답 시간 초과 — 매뉴얼 엔진 결과로 먼저 보여 드립니다.";
      case "bad_response":
        return "AI 응답 형식이 어긋나 매뉴얼 엔진 결과로 보여 드립니다.";
      case "fetch":
        return error.message;
      case "too_long":
        return "입력이 8,000자를 넘어 AI로 보내지 못했습니다.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "알 수 없는 오류";
}

export { buildLocalReview };
export const PROFILE_LABELS = ENTITY_PROFILES.map((p) => p.label);

/** 기사 URL·본문을 사례 카드 초안으로 바꿉니다. 결과는 반드시 사람이 검수해야 합니다. */
export async function requestCaseDraft(
  input: string,
  options: RequestOptions = {},
): Promise<{ draft: CrisisCase; source?: { url: string; title: string } }> {
  const data = await post({ mode: "case", situation: input }, options);
  const row = asRecord(data.result) ?? {};
  const sourceRow = asRecord(data.source);
  const urls = [...input.matchAll(/https?:\/\/[^\s<>"'）)\]]+/gi)].map((m) => m[0]);
  const sources = urls.slice(0, 6).map((url, i) => ({
    label: i === 0 && sourceRow?.url === url && str(sourceRow?.title, 160) ? str(sourceRow?.title, 160) : url,
    url,
  }));
  const draft = normalizeCase({ ...row, sources, status: "draft" }, undefined);
  if (!draft) throw new AiError("bad_response", "AI 초안에서 회사명·업종·유형·제목을 확인하지 못했습니다. 본문을 더 붙여 넣거나 직접 입력해 주세요.");
  return {
    draft,
    source: sourceRow && typeof sourceRow.url === "string" ? { url: String(sourceRow.url), title: str(sourceRow.title, 200) } : undefined,
  };
}
