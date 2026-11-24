import type { CaseType, CaseVerdict, IndustryId, Severity } from "../types";
import { getIndustry } from "./industries";
import { getProtocol, SCALE_META, STAGE_META, type CompanyScale, type ProtocolStage } from "./issue-protocols";
import { ENTITY_PROFILES, type EntityId } from "./profiles";
import { findSimilarCases } from "./similar";

/**
 * 사건 조사(Incident Investigation) — 대응 문안을 쓰기 전에 여는 조사 파일.
 *
 * 목적:
 * - 입력이 한 줄이어도 "무슨 사건이고, 어디를 먼저 확인해야 하는지"를 실무 언어로 먼저 세운다.
 * - 업종 매뉴얼의 규제기관·법령·점검 질문·증거 항목을 화면 위로 끌어올린다(지금까지는 매뉴얼 모달에만 있었다).
 * - 확인된 것과 확인되지 않은 것을 갈라 두고, 체크리스트로 닫게 한다. 대외 문안의 [확인 필요] 값과 같은 출처를 쓴다.
 *
 * 원칙: 데이터에 없는 사실·수치·기관명은 만들지 않는다. 확산 패턴은 유형별 일반 경로이며, 특정 사건의 사실로 단정하지 않는다.
 */

export type InvestigationSide = "언론" | "여론" | "규제";
export type InvestigationTeam = "PR" | "법무" | "운영" | "데이터" | "총괄";

export interface InvestigationIssue {
  side: InvestigationSide;
  /** 쟁점 이름 (없으면 문장만 표시) */
  title?: string;
  /** 기자가 던질 질문·여론이 붙는 지점 한 문장 */
  detail: string;
}

export interface InvestigationCheck {
  id: string;
  team: InvestigationTeam;
  /** 내부에서 확인할 항목 */
  item: string;
  /** 기자가 물을 형태의 질문 */
  question: string;
  why: string;
  severity: Severity;
}

export interface InvestigationContext {
  kind: "regulator" | "law";
  name: string;
  note: string;
}

export interface InvestigationPrecedent {
  /** 연결할 사례 id (AI가 만든 참고 사례면 비어 있음) */
  caseId: string;
  company: string;
  title: string;
  date: string;
  verdict: CaseVerdict;
  takeaway: string;
  reason: string;
}

export interface IncidentInvestigation {
  /** 조사 파일 번호 — 화면 표지용 (INV-YYMMDD) */
  fileNo: string;
  /** 사건 개요: 무엇이 촉발점이고 어느 단계인지 */
  summary: string;
  /** 촉발 요인 한 줄 */
  trigger: string;
  /** 배경 — 업종 원칙·기업 유형·단계/규모 */
  background: string[];
  /** 규제기관·관련 법령 */
  context: InvestigationContext[];
  /** 핵심 쟁점 및 여론·보도 포인트 */
  issues: InvestigationIssue[];
  /** 실무 팩트체크 리스트 */
  checks: InvestigationCheck[];
  /** 확보해야 할 증거 */
  evidence: string[];
  /** 이 유형이 커지는 경로 (3단계) */
  pattern: string[];
  precedent?: InvestigationPrecedent;
  source: "local" | "ai";
}

export interface InvestigationInput {
  situation: string;
  brand: string;
  industry: IndustryId;
  caseType?: CaseType;
  caseTypeLabel?: string;
  entities: EntityId[];
  stage?: ProtocolStage;
  scale?: CompanyScale;
  createdAt?: string;
}

/* ------------------------------------------------------------------ */
/* 확산 경로 — 유형별 일반 패턴 (특정 사건의 사실이 아님)               */
/* ------------------------------------------------------------------ */

const DEFAULT_PATTERN = [
  "1차 보도·커뮤니티 캡처가 돌며 ‘확인해 달라’는 요구가 붙습니다.",
  "규제기관·이해관계자 질의가 공식 창구로 몰리고, 답변 시각이 기록됩니다.",
  "확인 일정을 넘기면 ‘늦장·축소’ 프레임으로 굳고 2차 보도가 이어집니다.",
];

const PATTERNS: Record<CaseType, string[]> = {
  "product-safety": [
    "이물·증상 사진 1건이 올라오면 같은 제품 피해 사례가 댓글로 붙습니다.",
    "회수 범위·로트가 특정되지 않으면 ‘전량 회수’ 요구와 판매 중단 압력으로 번집니다.",
    "당국 조사·행정처분과 유통채널 회수 확인이 기사화되며 2차 보도가 이어집니다.",
  ],
  "false-claim": [
    "광고·상세페이지 캡처가 ‘과장·허위’ 프레임으로 확산합니다.",
    "전문가·시민단체가 성분·수치 검증을 요구하고 공인기관 검사 결과가 쟁점이 됩니다.",
    "공정위·심의기구 신고와 표시광고법 위반 여부가 기사에 붙습니다.",
  ],
  "data-breach": [
    "유출 의심 계정·안내 문자 캡처가 돌며 ‘언제 알렸나’가 첫 질문이 됩니다.",
    "개인정보보호위원회 신고·조사 여부와 유출 항목(연락처·카드) 확인이 기사화됩니다.",
    "2차 피해(보이스피싱·명의도용) 사례가 나오면 보상·소송으로 확대됩니다.",
  ],
  outage: [
    "장애 시작·복구 시각 캡처가 커뮤니티에 모이며 보상 요구가 붙습니다.",
    "감독기관 보고 의무와 재발 방지 대책이 확인 대상이 됩니다.",
    "같은 장애가 반복되면 ‘관리 실패’ 프레임으로 굳고 이탈이 늘어납니다.",
  ],
  "industrial-accident": [
    "현장 사진·목격 진술이 확산하며 ‘왜 다쳤나’가 첫 문장이 됩니다.",
    "근로감독·중대재해처벌법 적용 여부가 핵심 쟁점으로 굳습니다.",
    "유가족·노조 요구와 2차 사고 보도가 이어지며 책임 공방으로 갑니다.",
  ],
  disaster: [
    "피해 규모 추정치가 먼저 돌고 지역 커뮤니티에 실시간 제보가 붙습니다.",
    "대피 안내·재난 문자의 시각과 범위가 ‘늦장 대응’ 논란으로 이어집니다.",
    "복구·보상 기준과 지자체 협의가 기사화되며 장기 의제가 됩니다.",
  ],
  "owner-risk": [
    "오너 발언·SNS 캡처가 인물 프레임으로 확산하며 회사 설명은 묻힙니다.",
    "사과문 형식(직접·대필·시점)이 그 자체로 기사가 됩니다.",
    "지배구조·승계·계열 지원 의혹으로 확장되면 감독당국과 주주가 붙습니다.",
  ],
  labor: [
    "노조 성명·현장 영상이 확산하며 ‘교섭 회피’ 프레임이 먼저 자리 잡습니다.",
    "노동당국 신고·부당노동행위 구제신청 여부가 확인 대상이 됩니다.",
    "파업·생산 차질이 고객 피해로 번지면 협력사·소비자 불만이 붙습니다.",
  ],
  celebrity: [
    "당사자·소속사 입장이 캡처로 확산하며 ‘해명 시점’이 쟁점이 됩니다.",
    "광고·출연 계약 해지와 작품 편성 변경이 확인 대상이 됩니다.",
    "추가 제보·폭로가 이어지며 팬덤과 비판 여론이 동시에 붙습니다.",
  ],
  financial: [
    "금리·수수료·사고 금액 숫자가 먼저 돌며 ‘고객 피해’ 프레임이 붙습니다.",
    "금융당국 검사·분쟁조정 신청, 약관 고지 준수 여부가 핵심이 됩니다.",
    "전산·내부통제 실패로 확장되면 제재·과태료와 이탈이 함께 옵니다.",
  ],
  governance: [
    "의결·계약 캡처가 ‘특혜·배임’ 프레임으로 확산합니다.",
    "공시 정확성·이사회 승인 절차와 거래소 조회공시 요구가 확인 대상입니다.",
    "소액주주·행동주의 펀드·고발로 확장되며 주가가 반응합니다.",
  ],
  misconduct: [
    "내부 제보·녹취가 확산하며 ‘조직 문제’ 프레임으로 커집니다.",
    "감사·징계 절차와 수사의뢰 여부가 첫 확인 대상입니다.",
    "2차 제보가 이어지며 피해 진술·집단 분쟁으로 확대됩니다.",
  ],
  statement: [
    "발언 원문 캡처가 돌며 ‘누가 언제 말했나’가 쟁점이 됩니다.",
    "맥락 없이 인용된 부분에 대한 정정 요구가 언론에 들어갑니다.",
    "반복 발언·내부 문건이 나오면 ‘조직의 입장’으로 확대됩니다.",
  ],
  environment: [
    "측정값·냄새·오염 제보가 지역 커뮤니티에서 결합합니다.",
    "환경당국·지자체 측정 결과와 배출 허가 기준 준수 여부가 핵심입니다.",
    "주민 소송·조업 중단 요구로 확대되며 지자체 협의가 기사화됩니다.",
  ],
  regulatory: [
    "제재·과징금 처분 사실이 보도되며 ‘고의성’ 여부가 쟁점이 됩니다.",
    "처분 사유서·이의신청 기한·과거 위반 이력이 확인 대상입니다.",
    "시정명령 이행 점검과 재발 시 영업정지 가능성이 기사에 붙습니다.",
  ],
  pricing: [
    "인상 공지 캡처가 돌며 ‘월 N원 = 연 N만원’ 환산이 확산합니다.",
    "경쟁사 비교표·해지 인증샷이 기사에 인용됩니다.",
    "소비자원·공정위 민원, 국회 질의로 확대되면 인상 철회 요구가 붙습니다.",
  ],
};

export function spreadPattern(type?: CaseType): string[] {
  return (type && PATTERNS[type]) || DEFAULT_PATTERN;
}

/* ------------------------------------------------------------------ */
/* 담당 팀 추정                                                        */
/* ------------------------------------------------------------------ */

const TEAM_RULES: { team: InvestigationTeam; re: RegExp }[] = [
  { team: "법무", re: /(약관|계약|법률|법령|규제|고지|개인정보|책임|공시|소송|동의|표시|광고|특약|제재|처분)/ },
  { team: "데이터", re: /(데이터|로그|시스템|서버|전산|접속|암호|유출|결제|정산|요금|통계|수치|금액|집계)/ },
  { team: "운영", re: /(회수|생산|공정|재고|배송|현장|점검|설비|안전|공급|매장|물류|제조|시설|위생|작업|환불|교환|섭취|접수)/ },
];

function teamFor(text: string): InvestigationTeam {
  for (const rule of TEAM_RULES) if (rule.re.test(text)) return rule.team;
  return "PR";
}

/* ------------------------------------------------------------------ */
/* 촉발 요인 매칭                                                      */
/* ------------------------------------------------------------------ */

function matchTrigger(text: string, triggers: { label: string; desc: string }[]): { label: string; desc: string } | null {
  let best: { label: string; desc: string } | null = null;
  let bestScore = 0;
  for (const trigger of triggers) {
    const words = trigger.label.split(/[·\s,/]+/).filter((w) => w.length >= 2);
    let score = 0;
    for (const word of words) {
      if (text.includes(word)) score += 2;
      else if (word.length >= 3 && text.includes(word.slice(0, 2))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = trigger;
    }
  }
  return bestScore >= 2 ? best : null;
}

const fileNo = (createdAt?: string) => {
  const date = createdAt ? new Date(createdAt) : new Date();
  const stamp = Number.isNaN(date.getTime()) ? new Date() : date;
  return `INV-${String(stamp.getFullYear()).slice(2)}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/* 로컬 조사 파일                                                      */
/* ------------------------------------------------------------------ */

export function buildInvestigation(input: InvestigationInput): IncidentInvestigation {
  const industry = getIndustry(input.industry);
  const playbook = industry.playbook;
  const protocol = getProtocol(input.caseType);
  const profile =
    ENTITY_PROFILES.find((p) => p.id === (input.entities[0] ?? "general")) ?? ENTITY_PROFILES[0];
  const brand = input.brand.trim() || "당사";
  const eventLabel = input.caseTypeLabel ?? protocol?.label ?? `${industry.label} 이슈`;
  const stage = input.stage ? STAGE_META[input.stage] : undefined;
  const scale = input.scale ? SCALE_META[input.scale] : undefined;
  const trigger = matchTrigger(input.situation, playbook.triggers);
  const regulator = playbook.regulators[0];
  const leadChecks = [...industry.checks].sort((a, b) => b.severity - a.severity);

  // 업종 매뉴얼의 촉발 요인과 맞지 않아도, 입력이 충분히 길면 입력의 첫 문장을 촉발 요인으로 씁니다.
  const firstLine = (() => {
    const clean = input.situation.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    const cut = clean.split(/(?:\.\s|\n)/)[0] || clean;
    return cut.length > 92 ? `${cut.slice(0, 90)}…` : cut;
  })();
  const hasInputTrigger = !trigger && firstLine.length >= 25;

  const summary = [
    `${brand}의 ${eventLabel} 사안입니다.`,
    trigger
      ? `촉발 요인은 ‘${trigger.label}’ — ${trigger.desc}`
      : hasInputTrigger
        ? `촉발 요인은 아래 입력 요지와 같고, ${industry.themes.slice(0, 3).join(" · ")} 관련 여부부터 확인해야 합니다.`
        : `입력에 촉발 요인이 적히지 않았습니다. ${industry.themes.slice(0, 3).join(" · ")} 관련 여부부터 확인해야 합니다.`,
    regulator ? `${regulator.name} 접점이 예상됩니다.` : "",
    stage ? `현재 ‘${stage.label}’ 단계로 보고 있습니다.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const triggerLine = trigger
    ? `${trigger.label} — ${trigger.desc}`
    : hasInputTrigger
      ? `입력 요지 — “${firstLine}”`
      : `${industry.themes.slice(0, 3).join(" · ")} 관련 여부 확인 필요`;

  const background = [
    `${industry.label} 원칙 — ${playbook.stance}`,
    `기업 유형 — ${profile.frame}`,
    ...(stage ? [`단계 — ${stage.note}`] : []),
    ...(scale ? [`규모 — ${scale.note}`] : []),
  ];

  const context: InvestigationContext[] = [
    ...playbook.regulators.slice(0, 3).map((r) => ({ kind: "regulator" as const, name: r.name, note: r.role })),
    ...playbook.laws.slice(0, 2).map((l) => ({ kind: "law" as const, name: l.name, note: l.note })),
  ];

  const issues: InvestigationIssue[] = [
    ...(protocol?.mediaPoints ?? []).slice(0, 3).map((point) => ({ side: "언론" as const, detail: point })),
    ...playbook.watchouts.slice(0, protocol?.mediaPoints?.length ? 2 : 3).map((point) => ({ side: "여론" as const, detail: point })),
  ];

  const checks: InvestigationCheck[] = leadChecks.map((c) => ({
    id: c.id,
    team: teamFor(`${c.label} ${c.detail}${c.question}`),
    item: c.label,
    question: c.question,
    why: c.why,
    severity: c.severity,
  }));
  // 유형별 법적 문구가 있으면 법무 확인 항목으로 한 줄 더 붙입니다(업종 점검과 겹치지 않는 항목).
  if (protocol) {
    checks.push({
      id: "protocol-legal",
      team: "법무",
      item: "입장문 법적 문구 · 실제 조치 일치",
      question: `입장문에 쓴 “${profile.legal}”가 실제 조치·계약 조건과 같나?`,
      why: "문구가 실제 조건과 다르면 이후 보상·소송에서 불리한 근거가 됩니다. 승인 전에 문안과 현장 조치를 나란히 놓고 대조하세요.",
      severity: 2,
    });
  }

  let precedent: InvestigationPrecedent | undefined;
  const similar = findSimilarCases(`${input.situation} ${eventLabel}`, input.industry, {
    limit: 1,
    types: input.caseType ? [input.caseType] : undefined,
  })[0];
  if (similar) {
    precedent = {
      caseId: similar.case.id,
      company: similar.case.company,
      title: similar.case.title,
      date: similar.case.date,
      verdict: similar.case.verdict,
      takeaway: similar.case.lesson,
      reason: similar.reasons.join(" · "),
    };
  }

  return {
    fileNo: fileNo(input.createdAt),
    summary,
    trigger: triggerLine,
    background,
    context,
    issues,
    checks,
    evidence: playbook.evidence.slice(0, 4),
    pattern: spreadPattern(input.caseType),
    precedent,
    source: "local",
  };
}

/** 조사 리스트를 복사·내보내기용 텍스트로 만듭니다. */
export function investigationToText(inv: IncidentInvestigation): string {
  const lines = [
    `[사건 조사 ${inv.fileNo}]`,
    inv.summary,
    "",
    "■ 핵심 쟁점 및 여론·보도 포인트",
    ...inv.issues.map((i, n) => `${n + 1}. [${i.side}] ${i.title ? `${i.title} — ` : ""}${i.detail}`),
    "",
    "■ 실무 팩트체크 리스트",
    ...inv.checks.map((c) => `□ [${c.team}] ${c.item} — ${c.why}`),
    "",
    "■ 확보할 증거",
    ...inv.evidence.map((e) => `- ${e}`),
  ];
  if (inv.pattern.length) {
    lines.push("", "■ 이 유형이 커지는 경로", ...inv.pattern.map((p, i) => `${i + 1}. ${p}`));
  }
  if (inv.precedent) {
    lines.push("", `■ 참고 사례 — ${inv.precedent.company} (${inv.precedent.date})`, inv.precedent.takeaway);
  }
  return lines.join("\n");
}
