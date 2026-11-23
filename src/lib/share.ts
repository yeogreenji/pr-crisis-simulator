/**
 * 임원·법무팀 공유 브리핑 링크.
 *
 * 서버 DB 없이, 현재 대응 패키지의 "임원 요약 + 4채널 문안"만 골라 JSON으로 줄이고
 * deflate-raw로 압축한 뒤 base64url로 URL 해시(`#share=...`)에 실어 보냅니다.
 * 원문 입력 전체·기사 URL·API 키·브라우저 저장 기록은 링크에 담지 않습니다.
 */

import type { ResponsePackage } from "./package";
import { getStance } from "./package";
import type { Scorecard } from "./scorecard";
import type { ChannelKit } from "./channels";

export const SHARE_VERSION = 1;

export interface ShareStatement {
  t: string; // 제목
  c: string; // 채널
  b: string; // 본문
}

export interface SharePayload {
  v: number;
  at: string;
  br: string;
  ev: string;
  hl: string;
  su: string;
  st: string;
  stl: string;
  ct: string;
  ind: string;
  rk: string;
  sc: number;
  band: string;
  tone: string;
  ax: [string, number][];
  ok: ShareStatement[];
  pr: { q: string; a: string }[];
  inn: { t: string; l: string; b: string };
  so: { s: string; p: string };
  ac: { w: string; t: string; i: string[] }[];
  sk: { w: string; a: string; l: string }[];
  wo: string[];
  note?: string;
}

const cut = (text: string, max: number) => {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

/** 링크에 담을 만큼만 추린 브리핑 본문 */
export function buildSharePayload(pkg: ResponsePackage, card: Scorecard, kit: ChannelKit): SharePayload {
  return {
    v: SHARE_VERSION,
    at: pkg.createdAt,
    br: pkg.brand || "당사",
    ev: pkg.caseTypeLabel ?? pkg.eventLabel,
    hl: cut(pkg.headline, 160),
    su: cut(pkg.situation, 520),
    st: pkg.stance,
    stl: pkg.stanceCustom?.trim() ? cut(pkg.stanceCustom, 90) : getStance(pkg.stance).label,
    ct: pkg.caseTypeLabel ?? "",
    ind: pkg.industryLabel,
    rk: pkg.risk,
    sc: card.overall,
    band: card.band.label,
    tone: card.band.tone,
    ax: card.axes.map((a) => [a.short, a.value] as [string, number]),
    ok: pkg.statements.map((s) => ({ t: s.title, c: s.channel, b: cut(s.body, 900) })),
    pr: pkg.qa.slice(0, 4).map((q) => ({ q: cut(q.question, 90), a: cut(q.answer, 220) })),
    inn: { t: kit.internal.title, l: kit.internal.lead, b: cut(kit.internal.body, 620) },
    so: { s: cut(kit.social.short, 320), p: cut(kit.social.pinned, 200) },
    ac: pkg.roadmap.slice(0, 3).map((p) => ({ w: p.window, t: p.title, i: p.items.slice(0, 4).map((x) => cut(x, 110)) })),
    sk: pkg.stakeholders.slice(0, 5).map((s) => ({ w: s.who, a: cut(s.action, 120), l: cut(s.line, 130) })),
    wo: pkg.watchouts.slice(0, 4).map((w) => cut(w, 120)),
    note: pkg.mode === "ai" ? "실시간 AI 생성" : "매뉴얼 엔진 생성",
  };
}

/* ---------------- 압축 · 인코딩 ---------------- */

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

const canCompress = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function";

/** JSON → deflate-raw → base64url. 압축 API가 없으면 원문 base64url로 떨어집니다. */
export async function encodeShare(payload: SharePayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (canCompress()) {
    try {
      const stream = new Blob([bytes.slice().buffer]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      const buf = await new Response(stream).arrayBuffer();
      return `1z${bytesToB64url(new Uint8Array(buf))}`;
    } catch {
      /* 아래 원문 인코딩으로 */
    }
  }
  return `1u${bytesToB64url(bytes)}`;
}

export async function decodeShare(token: string): Promise<SharePayload | null> {
  try {
    const compressed = token.startsWith("1z");
    const body = token.startsWith("1z") || token.startsWith("1u") ? token.slice(2) : token;
    const bytes = b64urlToBytes(body);
    let json: string;
    if (compressed) {
      if (!canCompress()) return null;
      const stream = new Blob([bytes.slice().buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      json = await new Response(stream).text();
    } else {
      json = new TextDecoder().decode(bytes);
    }
    const parsed = JSON.parse(json) as SharePayload;
    if (!parsed || parsed.v !== SHARE_VERSION || typeof parsed.br !== "string" || typeof parsed.sc !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 지금 탭의 주소를 기준으로 공유 URL을 만듭니다(해시 라우팅이라 서버 설정이 필요 없습니다). */
export function buildShareUrl(token: string): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}#share=${token}`;
}

export function readShareToken(hash = window.location.hash): string | null {
  const match = hash.match(/^#share=(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
