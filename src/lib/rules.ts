import type { RiskCategoryId, Severity } from "../types";

export interface RuleContext {
  brand: string;
  issueShort: string;
}

export interface RiskRule {
  id: string;
  pattern: RegExp;
  category: RiskCategoryId;
  severity: Severity;
  label: string;
  reason: string;
  /** 위험 구절을 문장 안에서 자연스럽게 대체하는 문구 */
  replace: (matched: string) => string;
  /** 문장 단위 추가 조건 */
  guard?: (sentence: string) => boolean;
}

export const RISK_RULES: RiskRule[] = [
  {
    id: "src-hedge",
    pattern: /관계자(?:들| 등)?(?:에|의) 따르면|관계자의 말에 따르면/g,
    category: "evidence",
    severity: 3,
    label: "출처 불명 표현",
    reason:
      "'관계자'는 회사가 책임질 수 없는 출처로 읽힙니다. 기자는 첫 문장에서 공식 확인 주체를 요구합니다.",
    replace: () => "회사가 확인한 바로는",
  },
  {
    id: "in-progress",
    pattern: /(확인|파악|조사|검토)\s*중/g,
    category: "evidence",
    severity: 2,
    label: "진행형 회피 표현",
    reason:
      "'확인 중'은 정보가 없다는 뜻으로 전달됩니다. 무엇을 언제까지 확인해 공유하는지 시한이 필요합니다.",
    replace: (m) => `${m.replace(/\s*중$/, "")}해 [완료 시각]까지 공유할 예정`,
  },
  {
    id: "vague-users",
    pattern: /(일부|다수|상당수|많은|여러)(?:의)?\s?(이용자|고객|사용자|소비자)/g,
    category: "evidence",
    severity: 3,
    label: "규모 없는 대상 표현",
    reason:
      "'일부 이용자'는 피해 규모를 감추려는 표현으로 읽힙니다. 전체 대비 숫자와 비율이 있어야 신뢰가 생깁니다.",
    replace: (m) => {
      const noun = m.match(/(이용자|고객|사용자|소비자)/)?.[1] ?? "고객";
      return `[전체 수]명 중 [영향 수]명의 ${noun}`;
    },
  },
  {
    id: "vague-timing",
    pattern: /(?<![가-힣])(?:곧|조만간|신속히|최대한 빠르게|가급적 빠른 시일 내에|빠른 시일 내)(?![가-힣])/g,
    category: "evidence",
    severity: 2,
    label: "모호한 시점",
    reason:
      "'곧·신속히'는 기사에 인용되지 않습니다. 날짜와 시각이 없으면 후속 보도에서 '약속 없는 약속'으로 다뤄집니다.",
    replace: () => "[날짜] [시각]에",
  },
  {
    id: "speculation",
    pattern: /가능성이 있다|것으로 보인다|것으로 추정된다|추정된다/g,
    category: "evidence",
    severity: 2,
    label: "추정·유보 표현",
    reason:
      "추정 표현은 확인된 사실과 추측을 섞어, 기사에서 '공식 확인 거부'로 재구성되기 쉽습니다.",
    replace: (m) => (m.includes("가능성") ? "가능성이 있어 추가 확인이 필요합니다" : "것으로 보여 추가 확인이 필요합니다"),
  },
  {
    id: "unverified-source",
    pattern: /(업계에 따르면|외신에 따르면|SNS에 따르면|커뮤니티에 따르면)/g,
    category: "evidence",
    severity: 2,
    label: "2차 출처 인용",
    reason: "남의 출처를 빌리면 회사가 확인한 사실인지 불분명해집니다.",
    replace: () => "당사가 확인한 자료에 따르면",
  },
  {
    id: "later-notice",
    pattern: /(추후|나중에|차후)\s?(안내|공지|말씀|발표)/g,
    category: "evidence",
    severity: 2,
    label: "시한 없는 후속 안내",
    reason: "'추후 안내'는 일정 공약이 아닙니다. 기자는 다음 기사의 꼬리표로 남깁니다.",
    replace: (m) => `[날짜]까지 ${m.match(/(안내|공지|말씀|발표)/)?.[1] ?? "안내"}`,
  },
  {
    id: "partial-restored",
    pattern: /(대부분|거의)\s?(복구|해결|정상화)/g,
    category: "evidence",
    severity: 2,
    label: "부분 복구의 모호한 범위",
    reason: "'대부분 복구'는 남은 피해자를 지웁니다. 남은 비율과 완료 시각을 밝혀야 합니다.",
    replace: (m) => `[복구 수]건([비율]%) ${m.match(/(복구|해결|정상화)/)?.[1] ?? "복구"}`,
  },

  {
    id: "compensation-promise",
    pattern:
      /(보상|배상|환불)(?:\s?(?:여부|기준|범위|규모))?(?:은|는|을|를)?\s?(?:내부\s?)?(검토|예정|하겠|드리겠|진행|논의)/g,
    category: "liability",
    severity: 3,
    label: "근거 없는 보상 약속",
    reason:
      "보상은 기준·범위·시점이 확정되기 전까지 약속이 아니라 법적 청구의 근거가 됩니다.",
    replace: () => "보상 기준과 범위를 [날짜]까지 확정",
  },
  {
    id: "blame-shift",
    pattern: /(외부 요인|외부 업체|불가항력)/g,
    category: "liability",
    severity: 3,
    label: "책임 회피 프레임",
    reason: "원인을 외부로 돌리는 문장은 사과의 효력을 없애고, 책임 공방 기사를 부릅니다.",
    replace: () => "[확인된 원인]",
  },
  {
    id: "absolute-promise",
    pattern: /(100%|전액|무조건|절대(?:로)?|반드시)/g,
    category: "liability",
    severity: 2,
    label: "확정적·절대 표현",
    reason: "전액·100% 같은 확정 표현은 이후 처리 범위가 달라질 때 신뢰 훼손으로 되돌아옵니다.",
    replace: (m) => (m === "전액" ? "[기준에 따른 금액]" : "[확인된 범위]"),
  },
  {
    id: "legal-exposure",
    pattern: /(법적 조치|소송|고소|고발|과태료|제재)/g,
    category: "liability",
    severity: 2,
    label: "법적 절차 언급",
    reason: "법적 절차를 먼저 꺼내면 협상 여지가 줄고, 기사 프레임이 '분쟁'으로 이동합니다.",
    replace: () => "[법무 검토를 거친 절차]",
  },
  {
    id: "scope-overclaim",
    pattern: /(전 직원|전 구성원|모든 고객|전체 고객)/g,
    category: "liability",
    severity: 2,
    label: "대상 범위 과장",
    reason: "범위를 넓게 약속하면 실제 적용 대상과 어긋나 2차 불만이 생깁니다.",
    replace: () => "[대상 범위]",
  },
  {
    id: "first-claim",
    pattern: /(업계 최초|세계 최초|국내 최초)(?:로)?/g,
    category: "liability",
    severity: 2,
    label: "검증 필요한 최초 주장",
    reason: "위기 상황의 '최초' 주장은 검증 대상이 되고, 사실이 아니면 논란의 초점이 됩니다.",
    replace: () => "검증을 거친",
  },
  {
    id: "prior-notice-missing",
    pattern: /(별도 안내 없이|사전 안내 없이|사전 고지 없이|고지 없이)/g,
    category: "liability",
    severity: 3,
    label: "사전 고지 누락 자인",
    reason:
      "사전 고지 없이 적용된다는 문장은 약관·전자상거래법 위반 소지로 바로 연결됩니다.",
    replace: () => "[N]일 전 사전 안내 후",
  },
  {
    id: "penalty-fee",
    pattern: /위약금/g,
    category: "liability",
    severity: 3,
    label: "위약금 부담 강조",
    reason: "고객 부담만 강조하면 '해지 못 하게 묶는 정책'으로 읽힙니다. 면제·예외 기준이 필요합니다.",
    replace: () => "비용",
  },

  {
    id: "minimizer",
    pattern: /(단순한?|사소한?|경미한?)\s?(오류|문제|실수|착오|지연)/g,
    category: "emotion",
    severity: 3,
    label: "축소 표현",
    reason: "'단순한 오류'는 고객이 겪은 피해를 축소하는 표현으로 읽혀 반발을 키웁니다.",
    replace: (m) => m.replace(/(단순한?|사소한?|경미한?)\s?/, ""),
  },
  {
    id: "user-blame",
    pattern: /오해의 소지(?:가)?/g,
    category: "emotion",
    severity: 2,
    label: "이용자 탓으로 읽히는 표현",
    reason: "'오해'라는 단어는 책임을 고객에게 옮깁니다. 안내 부족을 인정하는 문장이 안전합니다.",
    replace: () => "안내 부족이",
  },
  {
    id: "overblown-concern",
    pattern: /(과도한|지나친|부당한)\s?(우려|비판|논란|요구)/g,
    category: "emotion",
    severity: 3,
    label: "우려 깎아내리기",
    reason: "고객의 우려를 '과도하다'고 규정하는 순간, 모든 반응이 적대적으로 바뀝니다.",
    replace: (m) => m.match(/(우려|비판|논란|요구)/)?.[1] ?? "우려",
  },
  {
    id: "rumor-frame",
    pattern: /(루머|허위|악성|사실무근)/g,
    category: "emotion",
    severity: 3,
    label: "방어적 루머 프레임",
    reason: "'허위·루머' 프레임은 사실 관계보다 태도를 문제 삼게 만듭니다.",
    replace: () => "확인되지 않은 내용",
  },
  {
    id: "regret-only",
    pattern: /유감(?:을|의)?\s?(?:표|밝)[가-힣]*|안타깝게 생각합니다|안타깝습니다/g,
    category: "emotion",
    severity: 2,
    label: "'유감'으로 대체된 사과",
    reason: "'유감'은 책임을 인정하지 않는 표현으로 읽힙니다. 사과 주체와 대상이 필요합니다.",
    replace: () => "진심으로 사과드립니다",
  },
  {
    id: "inevitable",
    pattern: /불가피한 조치|불가피하[가-힣]*|어쩔 수 없[가-힣]*/g,
    category: "emotion",
    severity: 3,
    label: "불가피성 강조",
    reason: "고객이 체감하는 부담을 '불가피'로 정당화하면 공감이 사라집니다.",
    replace: (m) => (m.startsWith("불가피한 조치") ? "조치" : "조치입니다"),
  },
  {
    id: "weak-apology",
    pattern: /불편(?:을|함을)\s?(?:드려|끼쳐|드린)/g,
    category: "emotion",
    severity: 2,
    label: "불편만 언급한 사과",
    reason: "불편 사과만으로는 불안·손실을 인정하지 않은 것으로 읽힙니다. 대상과 범위를 명시하세요.",
    replace: (m) => m.replace(/^불편/, "불편과 불안"),
  },

  {
    id: "brag",
    pattern: /(업계 최고|최고 수준|혁신적|압도적|독보적|최상급)/g,
    category: "tone",
    severity: 2,
    label: "홍보성 최상급 표현",
    reason: "사과·해명문의 최상급 표현은 검증 대상이 되고, '홍보하러 나왔다'는 인상을 줍니다.",
    replace: () => "[시험 기관 검증]",
  },
  {
    id: "promo-tone",
    pattern:
      /(많은 관심[^.\n]{0,12}부탁드립니다|많은 관심(?:을)? 부탁드립니다|관심 부탁드립니다|성원 부탁드립니다)/g,
    category: "tone",
    severity: 2,
    label: "홍보 문체",
    reason: "위기 상황에서 관심·성원을 구하는 문장은 공지의 목적을 흐립니다.",
    replace: () => "추가 안내는 [공지 채널]을 통해 공유드리겠습니다",
  },
  {
    id: "evasive-decision",
    pattern: /(검토하겠|고려하겠|논의하겠|협의하겠)/g,
    category: "tone",
    severity: 2,
    label: "결정 회피 표현",
    reason: "'검토하겠다'는 결정을 미룬다는 뜻입니다. 담당자와 기한이 있어야 약속이 됩니다.",
    replace: () => "[날짜]까지 결정하겠",
  },
  {
    id: "weak-commit",
    pattern: /(최선을 다하겠|노력하겠|힘쓰겠)/g,
    category: "tone",
    severity: 2,
    label: "의지 표명에 그친 약속",
    reason: "'최선을 다하겠다'는 조치가 아닙니다. 무엇을 언제까지 바꾸는지가 필요합니다.",
    replace: () => "[구체 조치]를 [일정]까지 완료하겠",
  },
  {
    id: "passive-plan",
    pattern: /(조치가 취해질|이루어질 예정|진행될 예정)/g,
    category: "tone",
    severity: 1,
    label: "주체 없는 수동 표현",
    reason: "누가 하는지 없는 문장은 실행 책임을 흐립니다.",
    replace: () => "당사가 직접 진행합니다",
  },
  {
    id: "thanks-ending",
    pattern: /감사(?:합니다|드립니다)/g,
    category: "tone",
    severity: 1,
    label: "사과문 끝의 감사 인사",
    reason: "위기 공지의 마지막이 감사 인사면, 사과보다 마무리 인사가 강조됩니다.",
    replace: () => "진행 상황을 투명하게 공유하겠습니다",
  },
  {
    id: "exclamation",
    pattern: /[!]{1,}|ㅋ{2,}/g,
    category: "tone",
    severity: 1,
    label: "감정적 문장부호",
    reason: "공식 문서의 느낌표·구어체는 진정성을 떨어뜨립니다.",
    replace: (m) => (m.startsWith("!") ? "." : ""),
  },
];

export const RULE_BY_ID = new Map(RISK_RULES.map((r) => [r.id, r]));
