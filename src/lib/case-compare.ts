import type { CaseType, CrisisCase, IndustryId } from "../types";
import { verifiedCases } from "./cases";
import { getProtocol } from "./issue-protocols";

/**
 * 모범 사례 vs 실패 사례 대조.
 *
 * 두 사례의 원문(대응·타임라인·결과)에서 같은 축의 문장을 뽑아 좌우로 놓습니다.
 * 평가 문장을 새로 만들지 않고, 사례에 적힌 문장만 인용하거나 ‘해당 조치 없음’으로 표시합니다.
 *
 * 검수된 모범 사례가 드문 유형에서는 같은 유형·인접 유형·같은 업종 순으로 짝을 찾고,
 * 그래도 짝이 없으면 ‘실패 사례 vs 이 유형의 표준’으로 비교 기준을 바꿉니다. (사례를 만들어내지 않습니다)
 */

export interface CompareCell {
  hit: boolean;
  /** 사례 원문에서 뽑은 문장 (없으면 빈 문자열) */
  text: string;
}

export interface CompareRow {
  label: string;
  /** 이 축이 무엇을 보는지 */
  hint: string;
  /** 좋고 나쁨을 가르는 축이 아니라 참고용인지 (예: 법적 대응은 상황에 따라 정답이 다름) */
  neutral?: boolean;
  good: CompareCell;
  bad: CompareCell;
  /** 모범만 했는지 / 실패만 했는지 / 둘 다 / 둘 다 안 함 */
  gap: "good-only" | "bad-only" | "both" | "neither";
}

export type CompareBasis = "type" | "family" | "industry";

export interface PairCompare {
  mode: "pair";
  good: CrisisCase;
  bad: CrisisCase;
  basis: CompareBasis;
  rows: CompareRow[];
  /** 모범만 실행한 축 (한눈에 보는 차이) */
  gaps: string[];
}

export interface StandardCompare {
  mode: "standard";
  bad: CrisisCase;
  basis: CompareBasis;
  /** 실패 사례에서 확인되지 않은 축 */
  missing: { label: string; hint: string }[];
  /** 이 유형의 표준 프로토콜이 반드시 넣으라고 하는 것 */
  facts: string[];
  measures: string[];
  label: string;
}

export type CaseCompare = PairCompare | StandardCompare;

/** 부정·회피 표현이 들어간 문장은 ‘실행했다’로 세지 않습니다. (예: “공식 사과는 아님”) */
const NEGATION = /(사과는?\s?아[니님]|사과하지|하지\s?않|없(?:다|었|음|이)|아니|못했|거부|미흡|회피)/;

const AXES: { label: string; hint: string; re: RegExp; neutral?: boolean; not?: RegExp }[] = [
  {
    label: "사과·유감 표명",
    hint: "잘못을 인정하는 문장이 첫 대응에 있었는지",
    re: /사과|유감|애도|고개\s?숙|죄송/,
  },
  {
    label: "숫자·범위 공개",
    hint: "피해 규모·대상·기간을 구체 숫자로 밝혔는지",
    re: /(\d[\d,.]*\s?(?:명|건|원|%|대|개|곳|톤|병|시간|일|년|개월))|범위|규모|전수/,
    // 수사·재판 진행 문장은 기업이 숫자를 공개한 것이 아닙니다.
    not: /고발|기소|선고|판결|수사|처벌|벌금|구속/,
  },
  {
    label: "보상·구제",
    hint: "환불·배상·치료비 등 실제 구제책을 냈는지",
    re: /보상|배상|환불|구제|치료비|지원금|보상금|보증금/,
  },
  {
    label: "재발 방지",
    hint: "원인 조사·제도 개선·전수 점검을 약속하고 이행했는지",
    re: /재발|개선|전수\s?점검|인증|구축|교육|시스템\s?(개선|정비)/,
  },
  {
    label: "2차 피해 차단",
    hint: "중단·회수·차단 같은 즉시 조치가 있었는지",
    re: /중단|회수|판매\s?중지|차단|삭제|격리|대피|폐쇄|무효화/,
  },
  {
    label: "원인 공개·외부 검증",
    hint: "원인 조사 결과와 외부 검증을 공개했는지",
    re: /원인|조사|검증|감식|외부\s?(기관|전문가)|시험|감사/,
  },
  {
    label: "법적·강경 대응",
    hint: "고소·소송 등 강경 대응을 택했는지 — 상황에 따라 정답이 달라 참고용",
    re: /고소|소송|법적|수사|처벌|형사|가처분/,
    neutral: true,
  },
];

/** 위기 유형을 6개 계열로 묶어, 같은 유형 사례가 없을 때 비교 상대로 씁니다. */
const FAMILY: Record<CaseType, string> = {
  "product-safety": "safety",
  environment: "safety",
  "industrial-accident": "accident",
  disaster: "accident",
  labor: "accident",
  "data-breach": "digital",
  outage: "digital",
  financial: "money",
  pricing: "money",
  governance: "money",
  celebrity: "people",
  statement: "people",
  "owner-risk": "people",
  misconduct: "people",
  "false-claim": "claims",
  regulatory: "claims",
};

const clip = (text: string, max = 88) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** 대응·타임라인만 봅니다. 결과(outcome) 문장은 평가 서술이라 ‘실행한 조치’로 세지 않습니다. */
function actionLines(c: CrisisCase): string[] {
  return [...c.response.filter(Boolean), ...c.timeline.map((t) => t.what).filter(Boolean)];
}

/** 같은 문장을 여러 축에 재사용하지 않도록, 이 사례에서 이미 쓴 문장은 뒤로 미룹니다. */
function cell(lines: string[], re: RegExp, used: Set<string>, not?: RegExp): CompareCell {
  const matches = lines.filter((line) => re.test(line) && !NEGATION.test(line) && !(not && not.test(line)));
  const fresh = matches.find((line) => !used.has(line));
  const found = fresh ?? matches[0];
  if (found) used.add(found);
  return found ? { hit: true, text: clip(found) } : { hit: false, text: "" };
}

const gapOf = (good: CompareCell, bad: CompareCell): CompareRow["gap"] =>
  good.hit && !bad.hit ? "good-only" : !good.hit && bad.hit ? "bad-only" : good.hit ? "both" : "neither";

const matches = (c: CrisisCase, type: CaseType, industry: IndustryId, basis: CompareBasis): boolean =>
  basis === "type" ? c.type === type : basis === "family" ? FAMILY[c.type] === FAMILY[type] : c.industry === industry;

/** 같은 단계 안에서는 같은 업종·최근 사례를 먼저 고릅니다. */
function best(list: CrisisCase[], type: CaseType, industry: IndustryId): CrisisCase {
  return [...list].sort((a, b) => {
    const sameType = Number(b.type === type) - Number(a.type === type);
    if (sameType !== 0) return sameType;
    const sameIndustry = Number(b.industry === industry) - Number(a.industry === industry);
    if (sameIndustry !== 0) return sameIndustry;
    return b.date.localeCompare(a.date);
  })[0];
}

export function findCaseCompare(type: CaseType | undefined, industry: IndustryId): CaseCompare | null {
  if (!type) return null;
  const pool = verifiedCases().filter((c) => c.verdict === "exemplary" || c.verdict === "failure");
  const exemplars = pool.filter((c) => c.verdict === "exemplary");
  const failures = pool.filter((c) => c.verdict === "failure");
  const tiers: CompareBasis[] = ["type", "family", "industry"];

  // 좌우 비교는 같은 위기 유형끼리만 합니다. 다른 유형을 붙이면 ‘이 사안의 모범’으로 오해됩니다.
  for (const basis of ["type"] as CompareBasis[]) {
    const goods = exemplars.filter((c) => matches(c, type, industry, basis));
    const bads = failures.filter((c) => matches(c, type, industry, basis));
    if (!goods.length || !bads.length) continue;
    const good = best(goods, type, industry);
    const bad = best(bads, type, industry);
    if (good.id === bad.id) continue;
    const goodLines = actionLines(good);
    const badLines = actionLines(bad);
    const usedGood = new Set<string>();
    const usedBad = new Set<string>();
    const rows: CompareRow[] = AXES.map((axis) => {
      const goodCell = cell(goodLines, axis.re, usedGood, axis.not);
      const badCell = cell(badLines, axis.re, usedBad, axis.not);
      return {
        label: axis.label,
        hint: axis.hint,
        neutral: axis.neutral,
        good: goodCell,
        bad: badCell,
        gap: gapOf(goodCell, badCell),
      };
    });
    return {
      mode: "pair",
      good,
      bad,
      basis,
      rows,
      gaps: rows.filter((r) => r.gap === "good-only" && !r.neutral).map((r) => r.label),
    };
  }

  // 짝이 없으면: 이 유형의 실패 사례를 표준 프로토콜과 비교합니다.
  for (const basis of tiers) {
    const bads = failures.filter((c) => matches(c, type, industry, basis));
    if (!bads.length) continue;
    const bad = best(bads, type, industry);
    const protocol = getProtocol(type);
    const badLines = actionLines(bad);
    const usedBad = new Set<string>();
    const missing = AXES.filter((axis) => !axis.neutral && !cell(badLines, axis.re, usedBad, axis.not).hit).map((axis) => ({
      label: axis.label,
      hint: axis.hint,
    }));
    return {
      mode: "standard",
      bad,
      basis,
      missing,
      facts: protocol?.facts.slice(0, 4) ?? [],
      measures: protocol?.measures.slice(0, 4) ?? [],
      label: protocol?.label ?? "이 유형",
    };
  }

  return null;
}
