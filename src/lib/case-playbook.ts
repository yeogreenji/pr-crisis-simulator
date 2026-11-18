import type { CaseType, CrisisCase, IndustryId } from "../types";
import { findSimilarCases, type SimilarCase } from "./similar";

export interface PhaseDef {
  id: string;
  label: string;
  advice: string;
  re: RegExp;
}

/** 대응 문장을 키워드로 분류하는 8단계. 번호는 일반적인 실행 순서입니다. */
export const PHASES: PhaseDef[] = [
  { id: "contain", label: "확산 차단·중단·회수", advice: "피해가 더 번지지 않게 판매·가동·접속을 멈추거나 회수 범위를 먼저 정합니다.", re: /회수|리콜|중단|중지|차단|폐쇄|격리|판매 ?정지|작업 ?중|전량|폐기|철거/ },
  { id: "disclose", label: "공식 사과·입장 공개", advice: "확인된 사실과 모르는 것을 나눠 대표 명의로 공개합니다.", re: /사과|입장문|기자회견|공식 ?(입장|발표|공지)|공지|안내문|해명|성명|브리핑/ },
  { id: "investigate", label: "원인 조사·외부 검증", advice: "조사 주체·범위·결과 공개 일정을 약속합니다.", re: /조사|원인|점검|감사|검사|분석|진상|TF|위원회|시험|검증/ },
  { id: "remedy", label: "피해자 보상·지원", advice: "환불·보상·이주·지연 보상 등 구체 수단과 접수 창구를 밝힙니다.", re: /보상|환불|배상|지원|교환|위로|합의|피해자|재시공|대위변제|선지급/ },
  { id: "prevent", label: "재발 방지·제도 개선", advice: "말이 아니라 제품·공정·제도 변경으로 보여 줍니다.", re: /재발|방지|개선|도입|강화|확대|포장|시스템|안전|규정|보증|전환|투자/ },
  { id: "accountability", label: "책임 인정·경영진 조치", advice: "누가 책임지는지를 인사·징계·보수 반납 등으로 분명히 합니다.", re: /사퇴|사임|경질|해임|징계|퇴진|문책|반납|교체/ },
  { id: "legal", label: "법적·행정 절차 대응", advice: "소송·행정처분 대응이 공개 메시지와 어긋나지 않게 조율합니다.", re: /소송|가처분|취소소송|고발|이의|제소|집행정지|변호|행정/ },
  { id: "channel", label: "소통 채널 운영", advice: "창구를 하나로 정하고 주주·고객·직원에게 갱신 일정을 알립니다.", re: /방송|출연|SNS|홈페이지|설명회|간담회|주주|IR|소통|콜센터|고객센터|공지사항/ },
];

/** 가격·요금 인상 사례는 ‘확정 → 고지 → 보호 → 명분 → 협의’ 순서로 봅니다. */
export const PRICING_PHASES: PhaseDef[] = [
  { id: "pricing-scope", label: "적용 시점·대상 확정", advice: "신규·기존 고객 적용일과 인상 폭을 먼저 표로 확정합니다.", re: /인상|가격|요금|적용|신규|기존|유예|동결|시점|폭|요금제 개편/ },
  { id: "pricing-notice", label: "개별 고지·해지 창구", advice: "가입자에게 개별로 알리고, 해지·환불·위약금 창구를 함께 엽니다.", re: /고지|공지|안내|통지|메일|문자|앱|해지|환불|위약금|멤버십|광고형|가입자/ },
  { id: "pricing-protect", label: "기존 고객 보호·대안", advice: "유예·동결·할인과 저가 요금제로 선택권을 실제로 남깁니다.", re: /보호|유지|유예|동결|할인|대안|선택|면제|광고형|가족|연간/ },
  { id: "pricing-justify", label: "명분·비교 자료 공개", advice: "원가·투자 변화와 인상률을 비교한 수치를 공개합니다.", re: /원가|명분|비교|절감|혜택|투자|수치|자료|가격표|경쟁|절약/ },
  { id: "pricing-negotiate", label: "협의·조정", advice: "입점사·소상공인·규제기관과 협의해 차등·완화안을 냅니다.", re: /협의|상생|차등|조정|인하|수용|철회|검토|신고|공정위|방통위/ },
  { id: "pricing-prevent", label: "사과·가격 원칙 공개", advice: "사과에 그치지 않고 사전 고지·보호 원칙을 제도로 남깁니다.", re: /사과|입장|재발|방지|개선|원칙|공개|로드맵/ },
];

export function phasesFor(type?: CaseType): PhaseDef[] {
  return type === "pricing" ? PRICING_PHASES : PHASES;
}

export interface PhaseStat {
  phase: PhaseDef;
  /** 이 단계를 실행한 유사 사례 */
  doers: { c: CrisisCase; line: string }[];
  exemplaryDoers: number;
  /** 모범 사례의 절반 이상이 실행했는가 */
  core: boolean;
}

export interface CasePlaybook {
  cases: SimilarCase[];
  counts: { exemplary: number; mixed: number; failure: number };
  phases: PhaseStat[];
  pitfalls: { c: CrisisCase; text: string }[];
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** 비슷한 검수 완료 사례의 실제 대응을 집계해 단계별 순서와 근거를 만듭니다. */
export function buildCasePlaybook(
  text: string,
  industry: IndustryId,
  opts: { limit?: number; types?: CaseType[] } = {},
): CasePlaybook | null {
  const cases = findSimilarCases(text, industry, { limit: opts.limit ?? 8, types: opts.types });
  if (cases.length < 2) return null;
  const counts = { exemplary: 0, mixed: 0, failure: 0 };
  for (const s of cases) counts[s.case.verdict] += 1;

  const phases: PhaseStat[] = phasesFor(opts.types?.length === 1 ? opts.types[0] : undefined).map((phase) => {
    const doers: PhaseStat["doers"] = [];
    for (const { case: c } of cases) {
      const line = c.response.find((r) => phase.re.test(r));
      if (line) doers.push({ c, line });
    }
    doers.sort((a, b) => Number(b.c.verdict === "exemplary") - Number(a.c.verdict === "exemplary"));
    const exemplaryDoers = doers.filter((d) => d.c.verdict === "exemplary").length;
    const core = counts.exemplary > 0 ? exemplaryDoers / counts.exemplary >= 0.5 : doers.length / cases.length >= 0.5;
    return { phase, doers, exemplaryDoers, core };
  }).filter((p) => p.doers.length > 0);

  const pitfalls = cases
    .filter(({ case: c }) => c.verdict !== "exemplary" && c.lesson)
    .slice(0, 3)
    .map(({ case: c }) => ({ c, text: clip(c.lesson.split(/(?<=[.다])\s/)[0] || c.lesson, 150) }));

  return { cases, counts, phases, pitfalls };
}
