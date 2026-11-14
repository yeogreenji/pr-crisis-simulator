import type { Channel, ChannelId, IssueCategory, IssueCategoryId, Preset, RiskCategory } from "../types";

export const ISSUE_CATEGORIES: IssueCategory[] = [
  {
    id: "service-outage",
    label: "서비스 장애·운영 사고",
    short: "서비스 장애",
    baseline: 4,
    description: "결제·접속·배송 등 운영 중단. 복구 시점과 피해 범위가 첫 질문입니다.",
    factChecks: [
      "최초 인지 시각과 고객 공지까지 걸린 시간은 몇 분인가?",
      "영향받은 계정·거래는 정확히 몇 건이며, 전수 집계인가?",
      "복구는 임시 우회 조치인가, 근본 수정인가?",
      "SLA 위반 여부와 보상 기준·충당금 계상 계획은?",
    ],
  },
  {
    id: "product-safety",
    label: "제품 안전·성분 논란",
    short: "제품 안전 논란",
    baseline: 9,
    description: "성분·품질·안전성 의혹. 검사 주체와 회수 범위가 신뢰를 가릅니다.",
    factChecks: [
      "문제 성분의 함량과 법정 기준치는 각각 얼마인가?",
      "전수 검사인가 샘플 검사인가, 검사 기관은 어디인가?",
      "회수·환불 범위와 비용 부담 주체는 누구인가?",
      "동일 라인에서 생산된 다른 제품의 안전성은 확인됐나?",
    ],
  },
  {
    id: "pricing-change",
    label: "요금·정책 변경",
    short: "요금제 개편",
    baseline: 7,
    description: "가격 인상·약관 변경. 사전 고지와 기존 고객 보호가 쟁점입니다.",
    factChecks: [
      "기존 약정 고객의 보호 조치와 적용 시점은?",
      "인상 폭의 근거가 되는 원가·서비스 변경 내역은?",
      "해지·위약금 면제 기준은 어떻게 되나?",
      "사전 고지 기간은 법정 기준과 약관을 충족하나?",
    ],
  },
  {
    id: "data-privacy",
    label: "개인정보·보안 사고",
    short: "개인정보 사고",
    baseline: 11,
    description: "유출·오접근 사고. 신고 기한과 2차 피해 안내가 법적 리스크입니다.",
    factChecks: [
      "유출된 항목과 규모, 최초 인지 시각은?",
      "개인정보보호법상 신고 기한을 지켰나?",
      "암호화·접근통제 상태와 2차 피해 가능성은?",
      "이용자가 지금 해야 할 조치는 무엇인가?",
    ],
  },
  {
    id: "people-org",
    label: "인사·조직 논란",
    short: "인사 논란",
    baseline: 6,
    description: "구조조정·승진·징계 논란. 절차와 대상자 통보가 핵심입니다.",
    factChecks: [
      "결정 주체와 의사결정 절차는 무엇이었나?",
      "대상자에게 어떤 방식으로, 언제 통보했나?",
      "구성원·노조 의견 수렴 과정이 있었나?",
      "후속 보상·재배치 계획은 확정됐나?",
    ],
  },
  {
    id: "safety-accident",
    label: "산업재해·안전사고",
    short: "안전사고",
    baseline: 13,
    description: "사망·중상 재해. 작업 중지, 유가족 지원, 원청 책임이 첫 문장입니다.",
    factChecks: [
      "사망·부상자는 몇 명이며 원청·협력사 소속은 어떻게 되나?",
      "사고 설비와 동일 공정의 작업 중지 범위는?",
      "고용노동부에 언제 보고하고 어떤 자료를 제출했나?",
      "동일 공정의 재발 방지 대책과 이행 일정은?",
    ],
  },
  {
    id: "executive-speech",
    label: "인물 발언·행동 논란",
    short: "인물 논란",
    baseline: 7,
    description: "임원·아티스트의 발언·행동 파문. 원문 맥락과 공식 입장 여부가 쟁점입니다.",
    factChecks: [
      "해당 발언·행동의 원문과 전체 맥락은?",
      "공식 입장인가, 개인 의견인가?",
      "당사자에 대한 후속 조치·징계·활동 계획은?",
      "이해관계자에게 사과를 전달하는 방식은?",
    ],
  },
];

export const CHANNELS: Channel[] = [
  {
    id: "econ-press",
    label: "경제지 기자",
    kind: "press",
    short: "경제지",
    negativityOffset: 2,
    weight: 1.15,
    note: "책임 소재·실적 영향·법적 노출을 먼저 확인합니다.",
  },
  {
    id: "it-press",
    label: "IT 전문지",
    kind: "press",
    short: "IT지",
    negativityOffset: 0,
    weight: 1,
    note: "기술적 원인 설명의 구체성과 재현 가능성을 따집니다.",
  },
  {
    id: "office-community",
    label: "직장인 커뮤니티",
    kind: "community",
    short: "직장인",
    negativityOffset: 9,
    weight: 1.1,
    note: "현업 담당자 경험담이 붙으면 확산 속도가 빨라집니다.",
  },
  {
    id: "sns-x",
    label: "SNS · X",
    kind: "social",
    short: "SNS",
    negativityOffset: 13,
    weight: 1.05,
    note: "짧은 문장이 밈으로 굳으면 통제가 어려워집니다.",
  },
  {
    id: "youtube",
    label: "유튜브 댓글",
    kind: "social",
    short: "유튜브",
    negativityOffset: 8,
    weight: 0.95,
    note: "요약·해설 영상이 붙으면 2차 확산이 발생합니다.",
  },
  {
    id: "consumer-cafe",
    label: "소비자 카페",
    kind: "community",
    short: "소비자",
    negativityOffset: 6,
    weight: 1,
    note: "환불 후기·인증샷이 쌓이며 실제 피해 체감이 커집니다.",
  },
];

export const RISK_CATEGORIES: RiskCategory[] = [
  {
    id: "evidence",
    label: "사실·근거 부족",
    short: "근거",
    weight: 0.31,
    hint: "수치·시점·출처가 비어 있으면 기자가 첫 문장에서 멈춥니다.",
  },
  {
    id: "liability",
    label: "책임·법적 노출",
    short: "책임",
    weight: 0.27,
    hint: "보상 약속, 책임 회피, 확정적 표현은 법무 검토 대상입니다.",
  },
  {
    id: "emotion",
    label: "감정·여론 자극",
    short: "감정",
    weight: 0.24,
    hint: "축소·남탓·방어 프레임은 확산을 키우는 연료가 됩니다.",
  },
  {
    id: "tone",
    label: "톤·신뢰도",
    short: "톤",
    weight: 0.18,
    hint: "홍보 문체와 결정 회피 표현은 사과의 진정성을 깎습니다.",
  },
];

export const GRADE_LABELS = [
  { max: 24, label: "안정", tone: "ok" as const, desc: "지금 문장으로 배포해도 치명적 결함은 적습니다." },
  { max: 44, label: "관찰", tone: "watch" as const, desc: "질문 몇 개로 흔들릴 수 있습니다. 수치·일정을 보강하세요." },
  { max: 64, label: "주의", tone: "warn" as const, desc: "비판 헤드라인이 성립합니다. 핵심 문장을 다시 쓰세요." },
  { max: 84, label: "경계", tone: "risk" as const, desc: "배포 시 2차 논란 가능성이 높습니다. 초안 재작성이 필요합니다." },
  { max: 100, label: "위험", tone: "risk" as const, desc: "현 문장은 사과가 아니라 방어로 읽힙니다. 즉시 교체하세요." },
];

export const PRESETS: Preset[] = [
  {
    id: "hangyeol-dumpling",
    brand: "한결푸드",
    product: "한결 얇은피 만두",
    issue: "product-safety",
    industry: "food",
    label: "이물질 회수 입장문",
    tagline: "냉동만두 금속 이물 · 1차 해명",
    channels: ["econ-press", "consumer-cafe", "sns-x", "youtube"],
    draft: `한결푸드입니다.

최근 일부 온라인 커뮤니티에서 당사 냉동만두 제품에서 이물질이 발견되었다는 글과 사진이 확산되고 있습니다.
해당 제품은 단순한 포장 과정의 문제로, 제조 공정과는 무관한 것으로 파악하고 있습니다.
현재 정확한 원인과 영향받은 제품 범위는 확인 중입니다.
일부 제품에 한해 판매를 중단했으며, 전량 회수 여부는 내부 검토 후 안내드리겠습니다.
이용자 여러분께 불편을 드려 죄송합니다.
안전성에는 문제가 없으며, 다른 제품은 정상 판매 중입니다.
재발 방지에 최선을 다하겠습니다. 감사합니다.`,
  },
  {
    id: "maru-market",
    brand: "마루마켓",
    product: "마루마켓 11월 쇼핑페스타",
    issue: "service-outage",
    industry: "retail",
    label: "배송·환불 지연 공지",
    tagline: "행사 폭주 · 정산 지연 초안",
    channels: ["econ-press", "consumer-cafe", "sns-x", "office-community"],
    draft: `안녕하세요, 마루마켓입니다.

11월 11일 행사 이후 주문량이 폭증하면서 일부 고객의 배송과 환불 처리가 지연되고 있습니다.
현재 시스템 오류로 인해 순차적으로 처리 중이며, 정확한 영향 범위는 파악 중입니다.
일부 이용자에게는 안내 없이 주문이 취소될 수 있습니다.
환불은 추후 안내드리겠습니다.
입점 판매자 정산 역시 상황이 정리되는 대로 진행될 예정입니다.
불편을 드려 죄송합니다.
마루마켓은 고객을 최우선으로 생각합니다.`,
  },
  {
    id: "luna-ingredient",
    brand: "루나뷰티",
    product: "글로우 세럼",
    issue: "product-safety",
    industry: "consumer",
    label: "성분 논란 해명 보도자료",
    tagline: "전성분 표기 의혹 · 1차 해명",
    channels: ["econ-press", "consumer-cafe", "sns-x", "youtube"],
    draft: `루나뷰티는 자사 신제품 '글로우 세럼'의 전성분 표기와 관련한 논란에 대해 설명드립니다.

최근 일부 커뮤니티에서 해당 제품에 논란이 되는 성분이 포함된 것 아니냐는 의혹이 제기되었습니다.
당사는 해당 성분을 사용하지 않았으며, 이는 사실이 아닙니다.
다만 표기 과정에서 오해의 소지가 있었던 점은 인정합니다.
제품은 업계 최고 수준의 안전성 기준에 따라 제조되었습니다.
전 제품에 대한 전수 조사를 진행할 예정이며, 결과는 추후 안내하겠습니다.
소비자 여러분의 과도한 우려에 대해 안타깝게 생각합니다.
문의는 고객센터로 부탁드립니다.`,
  },
  {
    id: "orbital-outage",
    brand: "오비탈모빌리티",
    product: "오비탈 라이드",
    issue: "service-outage",
    industry: "tech",
    label: "서비스 장애 입장문",
    tagline: "결제 연동 오류 · 복구 공지 초안",
    channels: ["econ-press", "it-press", "office-community", "sns-x"],
    draft: `안녕하세요. 오비탈모빌리티입니다.

11월 12일 오전, 오비탈 라이드 앱의 결제 연동 과정에서 일부 이용자에게 오류가 발생했습니다.
관계자에 따르면 서버 부하로 인한 단순한 오류로, 현재 대부분 복구된 상태입니다.
정확한 원인은 확인 중이며, 영향받은 범위도 파악 중입니다.
이용자 여러분께 불편을 드려 죄송합니다.
보상 여부는 내부 검토 후 안내드리겠습니다.
재발 방지에 최선을 다하겠습니다.
곧 자세한 내용을 공지하겠습니다. 감사합니다.`,
  },
  {
    id: "hanbit-accident",
    brand: "한빛중공업",
    product: "제2제강공장",
    issue: "safety-accident",
    industry: "steel",
    label: "산업재해 사고 입장문",
    tagline: "협력업체 사망사고 · 1차 입장",
    channels: ["econ-press", "office-community", "youtube"],
    draft: `한빛중공업 입장문

11월 12일 오전, 당사 제2제강공장에서 협력업체 소속 근로자 1명이 설비 점검 중 사고로 사망하는 일이 발생했습니다.
고인에게 깊은 애도를 표하며 유가족께 위로의 말씀을 드립니다.
사고는 작업자의 부주의로 발생한 것으로 보고 있으며, 현재 정확한 경위를 확인 중입니다.
해당 설비는 잠시 가동을 멈췄다가 안전 점검 후 재가동할 예정입니다.
협력업체와 함께 재발 방지를 위해 최선을 다하겠습니다.
소속 근로자와 유가족에게 필요한 지원을 논의하겠습니다.`,
  },
  {
    id: "starlight-artist",
    brand: "스타라이트엔터테인먼트",
    product: "아티스트 리아",
    issue: "executive-speech",
    industry: "entertainment",
    label: "아티스트 논란 공식 입장",
    tagline: "온라인 의혹 · 1차 입장문",
    channels: ["sns-x", "youtube", "econ-press", "consumer-cafe"],
    draft: `스타라이트엔터테인먼트입니다.

최근 온라인에 게재된 당사 아티스트 관련 내용은 사실이 아닙니다.
해당 게시물은 악의적인 루머로, 법적 조치를 검토하고 있습니다.
아티스트의 사생활은 공적 영역이 아니며, 추측성 보도는 자제해 주시기 바랍니다.
예정된 활동은 차질 없이 진행됩니다.
팬 여러분께 심려를 끼쳐 죄송합니다.
추후 입장이 정리되는 대로 다시 알려드리겠습니다.`,
  },
  {
    id: "technova-pricing",
    brand: "테크노바",
    product: "테크노바 AI 어시스턴트",
    issue: "pricing-change",
    industry: "tech",
    label: "AI 요금제 개편 공지",
    tagline: "프로 플랜 인상 · 고객 공지",
    channels: ["it-press", "office-community", "sns-x", "consumer-cafe"],
    draft: `테크노바의 AI 어시스턴트 요금제가 12월 1일부터 개편됩니다.

이번 개편으로 프로 플랜의 월 요금이 인상됩니다.
기존 고객에게는 별도 안내 없이 신규 요금이 적용될 수 있습니다.
요금 인상은 서비스 품질 향상을 위한 불가피한 조치입니다.
해지 시 위약금이 발생할 수 있으니 유의 바랍니다.
새로운 요금제는 업계 최초로 도입되는 방식으로, 많은 관심과 성원 부탁드립니다.
세부 내용은 추후 공지하겠습니다.`,
  },
];

export const PRESETS_BY_INDUSTRY = (industry: Preset["industry"]) => PRESETS.filter((p) => p.industry === industry);

export const getIssue = (id: IssueCategoryId): IssueCategory =>
  ISSUE_CATEGORIES.find((i) => i.id === id) ?? ISSUE_CATEGORIES[0];

export const getChannel = (id: ChannelId): Channel =>
  CHANNELS.find((c) => c.id === id) ?? CHANNELS[0];
