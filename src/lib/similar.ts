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
  /** 같은 업종만 맞아도 후보로 볼지 (유형을 못 정한 경우) */
  minScore?: number;
}

/**
 * 같은 업종·같은 유형·겹치는 키워드가 많은 사례를 점수로 정렬해 돌려줍니다.
 * 유형이 정해지면 유형 일치(5점)가 최소 기준이 되어, 모든 유형에서 최소 3건이 잡힙니다.
 */
export function findSimilarCases(text: string, industry: IndustryId, opts: SimilarOptions = {}): SimilarCase[] {
  const types = opts.types ?? inferTypes(text);
  const limit = opts.limit ?? 4;
  const threshold = opts.minScore ?? (types.length ? 5 : 4);
  const result: SimilarCase[] = [];
  for (const c of verifiedCases()) {
    let score = 0;
    const reasons: string[] = [];
    if (c.industry === industry) {
      score += 4;
      reasons.push("같은 업종");
    } else if (opts.industries?.includes(c.industry)) {
      score += 2;
      reasons.push("인접 업종");
    }
    if (types.includes(c.type)) {
      score += 5;
      reasons.push("같은 위기 유형");
    }
    const hit = (c.tags ?? []).filter((tag) => text.includes(tag));
    if (hit.length) {
      score += Math.min(hit.length, 3) * 2;
      reasons.push(`키워드 ${hit.slice(0, 3).join("·")}`);
    }
    if (score >= threshold) result.push({ case: c, score, reasons });
  }
  result.sort((a, b) => b.score - a.score || b.case.date.localeCompare(a.case.date));
  return result.slice(0, limit);
}
