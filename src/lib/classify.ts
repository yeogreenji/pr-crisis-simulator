import type { CaseType, IndustryId } from "../types";

/**
 * 위기 문장 분류기.
 *
 * 이전 버전은 키워드가 하나만 걸려도 업종을 갈아치워, "항공사 반려동물 사고"가
 * '공장·사고' 키워드 때문에 철강/중대재해로 분류되는 일이 잦았습니다.
 * 여기서는 ①도메인 고유 키워드에 높은 가중치 ②일반 명사는 낮은 가중치
 * ③최소 점수(3점) 이상일 때만 업종을 확정합니다.
 */

interface WeightedRule {
  re: RegExp;
  /** 3 = 그 업종에서만 쓰는 고유어, 2 = 강한 단서, 1 = 보조 단서 */
  w: 1 | 2 | 3;
}

const INDUSTRY_RULES: Record<IndustryId, WeightedRule[]> = {
  food: [
    { re: /식품|식당|외식|음식|급식/g, w: 2 },
    { re: /식중독|식약처|식품의약품안전처|유통기한|소비기한|원재료|알레르기/g, w: 3 },
    { re: /이물|중금속|잔류|위생|부적합|회수|리콜/g, w: 1 },
    { re: /만두|라면|과자|음료|커피|베이커리|도시락|반찬|정육|수산|농산|납품/g, w: 2 },
  ],
  retail: [
    { re: /택배|배송|물류|이커머스|커머스|편의점|마트|백화점|면세점/g, w: 2 },
    { re: /항공사|항공|기내|운항|결항|수하물|위탁수하물|공항|반려동물/g, w: 2 },
    { re: /입점|수수료|정산|쿠폰|멤버십|재고|매장|판촉|주문|환불/g, w: 1 },
    { re: /쿠팡|티몬|위메프|이마트|홈플러스|롯데마트|GS25|CU|대한항공|아시아나/g, w: 3 },
  ],
  consumer: [
    { re: /화장품|생활용품|가전|매트리스|침대|샴푸|유아용품/g, w: 3 },
    { re: /제품|품질|성분|부작용|피부|파손|불량|AS|보증|교체/g, w: 1 },
    { re: /리뷰|사용감|색상|사이즈|향|발화|소손/g, w: 2 },
  ],
  tech: [
    { re: /개인정보|해킹|랜섬|데이터센터|서버|클라우드|가상자산|코인|펀드|자산운용|5G|통신사|삼성전자|SK하이닉스|네이버|카카오|배달의민족/g, w: 3 },
    { re: /플랫폼|앱|업데이트|API|계정|비밀번호|보안|통신|요금제|온라인/g, w: 2 },
    { re: /장애|접속|중단|복구|유출|침해/g, w: 1 },
  ],
  steel: [
    { re: /철강|제철|(?<![가-힣])고로(?![가-힣])|제강|압연|포스코|현대제철|제련소|월성|원전|발전소/g, w: 3 },
    { re: /중공업|조선(?:소|해양|기자재)|화력|협력업체|하청|중대재해|산재|끼임|추락|카드뮴/g, w: 2 },
    { re: /공장|설비|근로자/g, w: 1 },
  ],
  entertainment: [
    { re: /연예인|아티스트|아이돌|팬덤|소속사|전속계약|SM엔터|하이브|YG|JYP|카카오엔터/g, w: 3 },
    { re: /배우|가수|콘서트|앨범|드라마|방송|유튜버|크리에이터|인플루언서/g, w: 2 },
    { re: /사생활|열애|표절|컴백|팬/g, w: 1 },
  ],
  construction: [
    { re: /건설|시공|붕괴|아파트|철근|콘크리트|감리|부실시공|타워크레인|지하차도|제방|삼성물산/g, w: 3 },
    { re: /공사|입주|분양|하자|재건축|재개발|하도급|도로|현장/g, w: 1 },
    { re: /GS건설|현대산업개발|포스코이앤씨|대우건설/g, w: 3 },
  ],
  pharma: [
    { re: /의약품|제약|임상|백신|의료기기|임플란트|처방|복용|약국|약사/g, w: 3 },
    { re: /불순물|함량|리베이트|병원|메르스|감염병|환자/g, w: 1 },
    { re: /부작용|이상반응|치료제|바이오|허가/g, w: 2 },
  ],
};

const norm = (text: string) => text.replace(/\s+/g, " ");

/** 업종 점수. 같은 규칙이 여러 번 걸려도 최대 3회까지만 셉니다. */
export function industryScores(text: string): Record<IndustryId, number> {
  const t = norm(text);
  const out = {} as Record<IndustryId, number>;
  for (const id of Object.keys(INDUSTRY_RULES) as IndustryId[]) {
    let score = 0;
    let matchedRules = 0;
    for (const rule of INDUSTRY_RULES[id]) {
      const hits = (t.match(rule.re) ?? []).length;
      if (hits > 0) {
        matchedRules += 1;
        score += Math.min(hits, 3) * rule.w;
      }
    }
    out[id] = score + Math.min(matchedRules, 3) * 0.5;
  }
  return out;
}

/** 최소 3점 이상일 때만 업종을 확정하고, 아니면 fallback(기업 유형의 기본 업종). */
export function classifyIndustry(text: string, fallback: IndustryId): { industry: IndustryId; score: number; confident: boolean } {
  const scores = industryScores(text);
  let best: IndustryId = fallback;
  let bestScore = scores[fallback] ?? 0;
  for (const id of Object.keys(scores) as IndustryId[]) {
    if (scores[id] > bestScore) {
      bestScore = scores[id];
      best = id;
    }
  }
  return { industry: bestScore >= 3 ? best : fallback, score: bestScore, confident: bestScore >= 3 };
}

/* ------------------------------------------------------------------ */
/* 위기 유형                                                           */
/* ------------------------------------------------------------------ */

const TYPE_RULES: Record<CaseType, WeightedRule[]> = {
  "product-safety": [
    { re: /이물|식중독|결함|발화|소손|부작용|중금속|잔류|기준치\s?초과|부적합|라돈|유해/g, w: 2 },
    { re: /리콜|회수|판매\s?중지|안전성|위해|사고|숨(?:지|졌)|사망|부상/g, w: 1 },
  ],
  "false-claim": [
    { re: /허위|과장|표시광고|효능|원산지|가짜|조작된\s?리뷰/g, w: 2 },
    { re: /광고|리뷰|실적|수치/g, w: 1 },
  ],
  "data-breach": [
    { re: /개인정보|유출|해킹|랜섬|침해|계정\s?노출/g, w: 2 },
    { re: /비밀번호|주소|연락처|신용카드|결제\s?정보/g, w: 1 },
  ],
  outage: [
    { re: /장애|먹통|접속\s?불가|서비스\s?중단|마비|데이터센터\s?화재/g, w: 2 },
    { re: /서버|복구|오류|다운/g, w: 1 },
  ],
  "industrial-accident": [
    { re: /끼임|추락|산재|중대재해|근로자|작업\s?중|하청|파견|안전관리/g, w: 2 },
    { re: /공장|현장|설비|사망|부상|화재|폭발|붕괴/g, w: 1 },
  ],
  disaster: [
    { re: /태풍|침수|지진|폭우|홍수|재난|제방|지하차도|산불/g, w: 2 },
    { re: /감염병|메르스|팬데믹|집단감염|대피/g, w: 2 },
  ],
  "owner-risk": [
    { re: /오너|총수|일가|갑질|폭언|승계|부사장|회장/g, w: 2 },
    { re: /폭행|막말|권한\s?남용/g, w: 1 },
  ],
  labor: [
    { re: /노조|파업|해고|정리해고|과로사|교섭|단협|파견|하청/g, w: 2 },
    { re: /임금|근로|퇴직|복직|쟁의/g, w: 1 },
  ],
  celebrity: [
    { re: /연예인|아티스트|배우|가수|아이돌|소속사|팬덤|사생활|열애|전속/g, w: 2 },
    { re: /은퇴|음주|학폭|논란|팬/g, w: 1 },
  ],
  financial: [
    { re: /정산|횡령|배임|환매|부도|폐업|가상자산|코인|펀드|투자자|손실/g, w: 2 },
    { re: /자금|지급|결제|사기|먹튀/g, w: 1 },
  ],
  governance: [
    { re: /경영권|지배구조|공개매수|의결권|이사회|합병|인수전|자사주|내부자\s?거래/g, w: 2 },
    { re: /주주|인수|매각|주가|공시/g, w: 1 },
  ],
  misconduct: [
    { re: /횡령|배임|비위|비리|담합|뇌물|리베이트|셀프\s?리뷰|조작/g, w: 2 },
    { re: /부정|탈세|감사/g, w: 1 },
  ],
  statement: [
    { re: /발언|막말|포스터|홍보물|게시물|사과문|SNS/g, w: 2 },
    { re: /논란|광고|해명|입장문/g, w: 1 },
  ],
  environment: [
    { re: /누출|배출|오염|방사능|삼중수소|카드뮴|폐수|토양|분진|소음/g, w: 2 },
    { re: /환경|주민|민원|라돈/g, w: 1 },
  ],
  regulatory: [
    { re: /과징금|제재|처분|영업정지|시정명령|공정위|방통위|금감원|검찰|고발/g, w: 2 },
    { re: /조사|위반|행정/g, w: 1 },
  ],
};

/** 동점일 때 더 구체적인 유형이 이기도록 하는 순서 */
const TYPE_PRIORITY: CaseType[] = [
  "data-breach",
  "outage",
  "industrial-accident",
  "product-safety",
  "disaster",
  "environment",
  "labor",
  "celebrity",
  "owner-risk",
  "financial",
  "governance",
  "misconduct",
  "regulatory",
  "statement",
  "false-claim",
];

export interface TypeScore {
  type: CaseType;
  score: number;
}

export function typeScores(text: string): TypeScore[] {
  const t = norm(text);
  const rows: TypeScore[] = (Object.keys(TYPE_RULES) as CaseType[]).map((type) => {
    let score = 0;
    for (const rule of TYPE_RULES[type]) {
      const hits = (t.match(rule.re) ?? []).length;
      if (hits > 0) score += Math.min(hits, 3) * rule.w;
    }
    return { type, score };
  });
  return rows
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type));
}

/** 점수가 높은 유형부터. 2점 미만은 '단서 한 개'로 보고 목록에서 뺍니다. */
export function classifyCaseTypes(text: string, minScore = 2): CaseType[] {
  return typeScores(text)
    .filter((r) => r.score >= minScore)
    .map((r) => r.type);
}

export function primaryCaseType(text: string, minScore = 2): CaseType | undefined {
  return classifyCaseTypes(text, minScore)[0];
}

/** 유형별 사건 라벨과 위험도 */
export const CASE_TYPE_EVENT: Record<CaseType, { label: string; risk: "높음" | "보통" | "낮음" }> = {
  "product-safety": { label: "제품·서비스 안전 문제", risk: "높음" },
  "false-claim": { label: "허위·과장 논란", risk: "보통" },
  "data-breach": { label: "개인정보 유출 의혹", risk: "높음" },
  outage: { label: "서비스 장애", risk: "보통" },
  "industrial-accident": { label: "중대재해·산업재해", risk: "높음" },
  disaster: { label: "재난·감염병 대응", risk: "높음" },
  "owner-risk": { label: "오너 리스크", risk: "높음" },
  labor: { label: "노사 갈등", risk: "높음" },
  celebrity: { label: "소속 인물 논란", risk: "높음" },
  financial: { label: "금융·정산 리스크", risk: "높음" },
  governance: { label: "경영권·지배구조 분쟁", risk: "높음" },
  misconduct: { label: "부정·비위 의혹", risk: "높음" },
  statement: { label: "발언·광고 논란", risk: "보통" },
  environment: { label: "환경·오염 논란", risk: "높음" },
  regulatory: { label: "규제·제재", risk: "높음" },
};

export function detectEvent(text: string): { label: string; risk: "높음" | "보통" | "낮음"; type?: CaseType } {
  const type = primaryCaseType(text);
  if (type) return { ...CASE_TYPE_EVENT[type], type };
  return { label: "위기 상황", risk: "보통" };
}
