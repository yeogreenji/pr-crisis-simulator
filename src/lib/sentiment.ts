import type { ChannelId, IssueCategoryId, ToneKind } from "../types";

export interface TemplateVars {
  brand: string;
  product: string;
  phrase: string;
  issueShort: string;
}

export interface CommentTemplate {
  text: (v: TemplateVars) => string;
  tone: ToneKind;
  badge?: string;
}

export const COMMENT_TEMPLATES: Record<ChannelId, CommentTemplate[]> = {
  "econ-press": [
    {
      text: () => "SLA 위반 여부와 보상 충당금 계상 계획, 실적 공시 전에 확인이 필요합니다.",
      tone: "질문",
      badge: "취재 메모",
    },
    {
      text: () => "장애 시간대와 매출 영향 추정치를 주지 않으면 기사에 쓸 수 없습니다.",
      tone: "질문",
      badge: "취재 메모",
    },
    {
      text: (v) => `'${v.phrase}'라는 표현만으로는 규모를 특정할 수 없습니다. 추가 취재 요청드립니다.`,
      tone: "냉소",
      badge: "취재 메모",
    },
    {
      text: () => "책임 소재가 외부인지 내부인지에 따라 다음 분기 리스크 공시가 달라집니다.",
      tone: "우려",
      badge: "취재 메모",
    },
  ],
  "it-press": [
    {
      text: () => "원인이 트래픽인지 배포인지 '확인 중'이라는 답은 기술적으로 불충분합니다.",
      tone: "질문",
      badge: "IT 전문지",
    },
    {
      text: () => "재현 조건과 로그 범위를 밝혀야 후속 기사가 가능합니다.",
      tone: "우려",
      badge: "IT 전문지",
    },
    {
      text: () => "복구가 우회 조치라면 같은 장애가 재발할 가능성이 남습니다.",
      tone: "우려",
      badge: "테크 데스크",
    },
    {
      text: (v) => `${v.brand} 기술 블로그에 포스트모템이 올라올지가 관건입니다.`,
      tone: "질문",
      badge: "IT 전문지",
    },
  ],
  "office-community": [
    {
      text: () => "또 '확인 중'이네. 그 사이 결제 두 번 된 사람은 고객센터 연결도 안 된다던데.",
      tone: "분노",
      badge: "블라인드 · IT",
    },
    {
      text: (v) => `'${v.phrase}' 이 문장, 지난번에도 똑같이 봤다. 템플릿 돌려쓰나.`,
      tone: "냉소",
      badge: "블라인드 · 서비스",
    },
    {
      text: () => "현업 담당자는 또 주말에 복구하겠네. 결정은 위에서 해놓고.",
      tone: "연대",
      badge: "블라인드 · 개발",
    },
    {
      text: () => "복구는 언제 끝난 거고 보상 기준은 언제 공지함? 순서가 이상한데.",
      tone: "질문",
      badge: "직장인 커뮤니티",
    },
    {
      text: (v) => `${v.brand} 면접 볼 때 이 리스크 관리 이야기 나오겠다.`,
      tone: "냉소",
      badge: "블라인드 · 기획",
    },
  ],
  "sns-x": [
    {
      text: (v) => `'${v.phrase}' ㅋㅋㅋ 세 번째 본 문장`,
      tone: "냉소",
    },
    {
      text: () => "결제 두 번 됐는데 환불은 '검토 중'? 오늘 안에 답 달라.",
      tone: "분노",
    },
    {
      text: (v) => `이거 캡처해서 계속 씀. '${v.phrase}'`,
      tone: "냉소",
    },
    {
      text: () => "사과문에 숫자가 하나도 없음. 이게 제일 무섭다.",
      tone: "우려",
    },
    {
      text: (v) => `${v.brand} 고객센터 40분 기다렸는데 상담사도 모른다고 함.`,
      tone: "분노",
    },
  ],
  youtube: [
    {
      text: () => "영상에서 안 다룬 부분: 영향받은 사람이 정확히 몇 명인지.",
      tone: "질문",
    },
    {
      text: (v) => `'${v.phrase}' 이 한 문장으로 10분짜리 영상 나오겠다.`,
      tone: "냉소",
    },
    {
      text: () => "광고는 이렇게까지 안 하더니.",
      tone: "냉소",
    },
    {
      text: () => "저도 같은 증상이었는데 앱에서 아무 안내도 없었어요.",
      tone: "연대",
    },
    {
      text: () => "구독자가 만든 요약 영상이 더 정확한 상황.",
      tone: "냉소",
    },
  ],
  "consumer-cafe": [
    {
      text: () => "환불 받으신 분 있나요? 저는 아직 '검토 중'이라고만...",
      tone: "우려",
    },
    {
      text: () => "저도 같은 증상. 고객센터는 연결이 안 되고 챗봇만 돌아요.",
      tone: "연대",
    },
    {
      text: () => "이번 주에 결제한 사람들 보상은 어떻게 되는지 궁금합니다.",
      tone: "질문",
    },
    {
      text: (v) => `${v.product} 계속 써도 되는 건가요? 불안해서 못 쓰겠어요.`,
      tone: "우려",
    },
    {
      text: () => "카페에 후기 올라오는 거 보면 실제 피해가 더 많아 보임.",
      tone: "우려",
    },
  ],
};

export const HANDLES: Record<ChannelId, string[]> = {
  "econ-press": ["산업부 기자", "증권부 기자", "경제지 데스크"],
  "it-press": ["IT 전문지 기자", "테크 에디터", "플랫폼 담당"],
  "office-community": ["결제두번", "야근중_김", "ops_pm", "주말출근", "배포요정"],
  "sns-x": ["@minji_ops", "@night_deploy", "@product_watch", "@cap_this", "@user_204"],
  youtube: ["@구독자A", "@테크리뷰어", "@일상기록", "@소비자B"],
  "consumer-cafe": ["카페지기", "환불대기중", "구매자C", "리뷰어D", "절약러"],
};

export const ACCENTS = ["#2B45E0", "#C8352B", "#A9660A", "#16714F", "#6B4FBB", "#1E6E8C"];

export const ISSUE_THEMES: Record<IssueCategoryId, string[]> = {
  "service-outage": ["복구 시점", "보상 기준", "재발 방지", "공지 지연"],
  "product-safety": ["성분 함량", "검사 기관", "회수·환불", "전성분 표기"],
  "pricing-change": ["인상 폭", "사전 고지", "약정 보호", "해지 조건"],
  "data-privacy": ["유출 규모", "신고 시점", "2차 피해", "접근 통제"],
  "people-org": ["절차 공정성", "대상자 통보", "보상 수준", "노사 협의"],
  "executive-speech": ["발언 원문", "공식 입장", "징계 여부", "사과 방식"],
};

export const CHANNEL_THEMES: Record<ChannelId, string[]> = {
  "econ-press": ["책임 소재", "실적 영향"],
  "it-press": ["기술적 원인", "재현 가능성"],
  "office-community": ["현업 피로", "내부 공지"],
  "sns-x": ["밈화", "캡처 확산"],
  youtube: ["요약 영상", "2차 해설"],
  "consumer-cafe": ["환불 후기", "실사용 피해"],
};

export const VOLUME_LABEL = ["낮음", "보통", "높음", "매우 높음"] as const;
