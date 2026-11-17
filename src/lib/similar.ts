import type { CaseType, CrisisCase, IndustryId } from "../types";
import { verifiedCases } from "./cases";

/** 상황 문장에서 위기 유형을 추정하는 키워드 표 */
const TYPE_PATTERNS: Record<CaseType, RegExp> = {
  "product-safety": /이물|식중독|중금속|잔류|회수|리콜|부작용|결함|발화|독성|오염|부적합|기준치/,
  "false-claim": /허위|과장|표시|광고|조작|리뷰|원산지|효능|효과/,
  "data-breach": /개인정보|유출|해킹|랜섬|침해|계정|노출/,
  outage: /장애|먹통|접속|서버|중단|마비|복구/,
  "industrial-accident": /사망|끼임|추락|폭발|화재|중대재해|붕괴|산재|사고/,
  disaster: /태풍|침수|지진|폭우|홍수|재난/,
  "owner-risk": /회장|오너|총수|갑질|폭언|폭행|일가/,
  labor: /노조|파업|해고|임금|파견|하청|근로/,
  celebrity: /연예인|아티스트|배우|가수|아이돌|팬|소속사|음주|열애|학폭/,
  financial: /정산|횡령|배임|환불|결제|자금|부도|지급/,
  governance: /경영권|주주|분쟁|지배구조|이사회|인수/,
  misconduct: /비위|부정|비리|담합|뇌물|리베이트/,
  statement: /발언|막말|논란|사과문|SNS|게시물/,
  environment: /누출|배출|민원|주민|환경|소음|분진/,
  regulatory: /과징금|제재|조사|고발|처분|영업정지|검찰|공정위/,
};

export function inferTypes(text: string): CaseType[] {
  return (Object.keys(TYPE_PATTERNS) as CaseType[]).filter((t) => TYPE_PATTERNS[t].test(text));
}

export interface SimilarCase {
  case: CrisisCase;
  score: number;
  reasons: string[];
}

/** 같은 업종·같은 유형·겹치는 키워드가 많은 사례를 점수로 정렬해 돌려줍니다. */
export function findSimilarCases(
  text: string,
  industry: IndustryId,
  opts: { limit?: number; industries?: IndustryId[] } = {},
): SimilarCase[] {
  const types = inferTypes(text);
  const result: SimilarCase[] = [];
  for (const c of verifiedCases()) {
    let score = 0;
    const reasons: string[] = [];
    if (c.industry === industry) {
      score += 4;
      reasons.push("같은 업종");
    } else if (opts.industries?.includes(c.industry)) {
      score += 2;
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
    if (score >= 5) result.push({ case: c, score, reasons });
  }
  result.sort((a, b) => b.score - a.score || b.case.date.localeCompare(a.case.date));
  return result.slice(0, opts.limit ?? 4);
}
