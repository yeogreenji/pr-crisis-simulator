import type { CaseType, CrisisCase, IndustryId } from "../types";
import { verifiedCases } from "./cases";
import { classifyCaseTypes } from "./classify";

/** 상황 문장에서 위기 유형을 추정합니다(가중치·우선순위 적용). */
export function inferTypes(text: string): CaseType[] {
  return classifyCaseTypes(text);
}

export interface SimilarCase {
  case: CrisisCase;
  score: number;
  reasons: string[];
}

export interface SimilarOptions {
  limit?: number;
  industries?: IndustryId[];
  /** 사용자가 직접 고른 유형이 있으면 추정 대신 이 목록을 씁니다. */
  types?: CaseType[];
  /** 더 엄격하게(기본값) — 유형이 다르거나 키워드가 전혀 안 맞으면 제외 */
  strict?: boolean;
  /** 점수 하한. 기본값은 유형 일치 + (같은 업종 또는 키워드 1개) */
  minScore?: number;
}

/**
 * 유사 사례 매칭 — ‘억지로 끌어오기’를 막는 것이 목적입니다.
 *
 * 이전 버전은 키워드가 맞지 않아도 같은 업종이면(4점) 사례를 붙여,
 * "가격 인상 이슈"에 산업재해·연예 사건이 섞이는 문제가 있었습니다.
 *
 * 규칙(기본 strict):
 * - 유형을 알면 그 유형의 사례만 후보가 됩니다.
 * - 유형 + (같은 업종 또는 태그 키워드 1개 이상)이어야 채택합니다.
 * - 유형을 모르면 같은 업종 + 키워드 1개 이상이어야 채택합니다.
 * - 조건을 만족하는 사례가 없으면 빈 배열을 돌려주고, 화면은 표준 프로토콜을 보여 줍니다.
 */
export function findSimilarCases(text: string, industry: IndustryId, opts: SimilarOptions = {}): SimilarCase[] {
  const types = opts.types ?? inferTypes(text);
  const limit = opts.limit ?? 4;
  const strict = opts.strict ?? true;
  const result: SimilarCase[] = [];
  const lowered = text.toLowerCase();

  for (const c of verifiedCases()) {
    let score = 0;
    const reasons: string[] = [];
    const typeMatch = types.includes(c.type);
    const industryMatch = c.industry === industry;
    const nearby = Boolean(opts.industries?.includes(c.industry));
    const tags = c.tags ?? [];
    const hits = tags.filter((tag) => tag.length >= 2 && lowered.includes(tag.toLowerCase()));

    if (types.length) {
      if (strict && !typeMatch) continue;
      if (typeMatch) {
        score += 6;
        reasons.push("같은 위기 유형");
      }
      // 유형이 맞아도 업종·키워드 단서가 전혀 없으면 붙이지 않습니다.
      if (strict && !industryMatch && hits.length === 0) continue;
    } else if (strict) {
      if (!industryMatch) continue;
      if (hits.length === 0) continue;
    }

    if (industryMatch) {
      score += 3;
      reasons.push("같은 업종");
    } else if (nearby) {
      score += 1;
      reasons.push("인접 업종");
    }
    if (hits.length) {
      score += Math.min(hits.length, 3) * 2;
      reasons.push(`키워드 ${hits.slice(0, 3).join("·")}`);
    }
    // 최근 사례를 아주 약하게 우선 (같은 점수대 정렬용)
    const year = Number.parseInt(c.date.slice(0, 4), 10);
    if (Number.isFinite(year)) score += Math.max(0, Math.min(0.9, (year - 2020) * 0.1));

    const floor = opts.minScore ?? (types.length ? 8 : 5);
    if (score < floor) continue;
    result.push({ case: c, score, reasons });
  }

  result.sort((a, b) => b.score - a.score || b.case.date.localeCompare(a.case.date));
  return result.slice(0, limit);
}

/** 06/07 블록이 실제로 같은 유형의 근거를 갖는지 확인할 때 씁니다. */
export function hasTypeEvidence(type: CaseType | undefined, industry: IndustryId, text: string): boolean {
  if (!type) return false;
  return findSimilarCases(text, industry, { types: [type], limit: 1 }).length > 0;
}
