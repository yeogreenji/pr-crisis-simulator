import type { CaseType, IndustryId } from "../types";
import { getIndustry } from "./industries";
import { getProtocol } from "./issue-protocols";
import { getStance, type Stance } from "./stances";

/**
 * 4채널 실행 문안 — ① 공식 입장문·보도자료(패키지 statements) ② 기자 Q&A·핵심 방어 논리
 * ③ 사내 임직원 공지문 ④ SNS 공식 계정 공지 + 댓글 대응 가이드.
 *
 * ①②는 패키지 본문에서 그대로 쓰고, ③④는 이 모듈이 입장·유형·조치에 맞춰 만듭니다.
 * AI가 연결되면 같은 필드를 AI가 덮어쓸 수 있고, 없으면 이 매뉴얼 문안이 그대로 나갑니다.
 */

export interface ChannelSource {
  brand: string;
  stance: Stance;
  stanceCustom?: string;
  eventLabel: string;
  situation: string;
  actions: { window: string; title: string; items: { text: string; owner: string }[] }[];
  qa: { question: string; answer: string; guide: string; avoid: string[] }[];
  banned: { phrase: string; why: string }[];
  statements: { title: string; body: string }[];
  stakeholders?: { who: string; when: string; action: string; line: string }[];
  watchouts?: string[];
  caseType?: CaseType;
  industry: IndustryId;
  grave?: boolean;
}

export interface DefensePoint {
  frame: string;
  line: string;
  proof: string;
  avoid: string;
}

export interface InternalNotice {
  title: string;
  lead: string;
  body: string;
  dos: string[];
  donts: string[];
  qa: { q: string; a: string }[];
}

export interface SocialKit {
  short: string;
  long: string;
  hashtags: string[];
  pinned: string;
  cards: { head: string; body: string }[];
  commentGuide: { pattern: string; tag: "안내" | "사실" | "공감" | "비공개"; reply: string }[];
  escalation: string[];
}

export interface ChannelKit {
  internal: InternalNotice;
  social: SocialKit;
  defense: DefensePoint[];
  bridge: string[];
  source: "local" | "ai";
}

const place = (label: string) => `[확인 필요: ${label}]`;

const clip = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

const INTERNAL_LEAD: Record<Stance, string> = {
  apology:
    "외부 고객 공지와 같은 시각에 사내 안내를 먼저 드립니다. 지금부터 모든 대외 문의는 공식 창구 한 곳에서만 받습니다.",
  facts:
    "확인된 사실과 사실과 다른 점을 정리해 외부에 알립니다. 임직원은 확인된 사실만 말하고, 확인되지 않은 부분은 추측하지 않습니다.",
  investigating:
    "확인 중인 사안입니다. 외부에는 ‘확인 중’과 ‘확인 결과 공개 시각’만 말하고, 원인·규모·책임은 추측하지 않습니다.",
  compensation:
    "피해 보상 기준을 먼저 공지합니다. 보상은 어떤 조건과도 연결하지 않으며, 현장에서 서명·게시물 삭제를 요구하지 않습니다.",
  silence:
    "공개 대응은 잠시 보류합니다. 외부 문의에는 ‘확인 후 회신’ 원칙으로만 답하고, 개인 SNS에 회사 입장을 쓰지 않습니다.",
  rebuttal:
    "사실과 다른 보도·주장에 대해 근거를 공개합니다. 감정적 표현 없이 자료와 사실관계만 말합니다.",
  custom: "경영진이 정한 입장을 그대로 유지합니다. 임의로 다른 설명을 덧붙이지 않습니다.",
};

const EXTRA_DOS: Record<Stance, string[]> = {
  apology: [
    "현장·매장에서는 고객에게 먼저 사과하고, 접수 창구와 처리 절차를 안내합니다.",
    "보상 기준이 확정되기 전에는 금액을 약속하지 않습니다.",
  ],
  facts: [
    "자료를 인용할 때는 기준 시점과 출처를 함께 말합니다.",
    "‘일부’라는 표현 대신 확인된 범위를 숫자로 말합니다.",
  ],
  investigating: [
    "확인 결과 공개 시각을 약속했으므로, 그 시각 전까지 추측성 답변을 하지 않습니다.",
    "확인이 길어지면 중간 진행 상황을 같은 문장으로 공유합니다.",
  ],
  compensation: [
    "보상 대상에서 빠지는 고객이 생기지 않도록 예외 기준을 본사에서만 판단합니다.",
    "지급 현황은 정해진 주기로 공개합니다.",
  ],
  silence: [
    "문의가 들어오면 담당자·시각·내용을 기록하고 공식 창구로 넘깁니다.",
    "확산 지표(언급량·매체 수)를 하루 단위로 기록합니다.",
  ],
  rebuttal: [
    "근거 자료는 공개 가능한 형태로 정리된 것만 인용합니다.",
    "상대에 대한 감정적 표현·비하·조롱은 어떤 경우에도 쓰지 않습니다.",
  ],
  custom: [
    "정해진 입장 문장을 벗어나는 설명이 필요하면 PR 담당자에게 먼저 확인합니다.",
    "이전에 한 말과 다르게 들릴 수 있는 표현을 쓰지 않습니다.",
  ],
};

const SOCIAL_SHORT: Record<Stance, (brand: string, event: string) => string> = {
  apology: (brand, event) =>
    `${brand}입니다. ${event} 관련해 불편과 심려를 끼쳐 드린 점 고개 숙여 사과드립니다. 피해 접수와 보상 기준은 ${place("공지 시각")}까지 이 계정과 고객센터에 함께 올리겠습니다. 확인되는 내용은 바로 안내드리겠습니다.`,
  facts: (brand, event) =>
    `${brand}입니다. ${event} 관련 보도·게시물에 대해 확인된 사실과 사실과 다른 점을 정리해 안내드립니다. 근거 자료와 기준 시점은 함께 공개하며, 확인되지 않은 내용은 추측하지 않겠습니다. 전문은 프로필 링크에서 확인해 주세요.`,
  investigating: (brand, event) =>
    `${brand}입니다. ${event} 관련 내용을 확인하고 있습니다. 확인된 사실과 확인 중인 사항을 구분해 안내드리며, 확인 결과는 ${place("공개 시각")}까지 이 계정에 올리겠습니다. 그 전까지 추측성 내용은 말씀드리지 않겠습니다.`,
  compensation: (brand, event) =>
    `${brand}입니다. ${event} 관련 피해를 입으신 분들께 보상 기준을 먼저 안내드립니다. 원인 규명과 별개로 접수와 지급을 시작하며, 보상은 어떤 조건과도 연결하지 않습니다. 접수 방법은 프로필 링크의 공지를 봐 주세요.`,
  silence: (brand, event) =>
    `${brand}입니다. ${event} 관련 문의는 확인 후 회신드리겠습니다. 확인되는 범위에서 ${place("회신 시각")}까지 안내드리며, 확인되지 않은 내용은 말씀드리지 않겠습니다.`,
  rebuttal: (brand, event) =>
    `${brand}입니다. ${event} 관련 확산 중인 주장은 사실과 다릅니다. 확인된 사실관계와 근거 자료를 공개합니다. 정당한 비판은 받아들이고, 허위로 확인되는 내용에 한해 절차에 따라 대응하겠습니다.`,
  custom: (brand, event) =>
    `${brand}입니다. ${event} 관련 당사 입장을 안내드립니다. ${place("정한 입장 한 문장")} 확인된 사실과 조치도 함께 공개하겠습니다.`,
};

const SOCIAL_ESCALATION: Record<Stance, string[]> = {
  apology: [
    "보상 기준 공지가 늦어지면 이 게시물에 ‘기준 확정 시각’을 댓글로 먼저 알립니다.",
    "동일 문의가 50건을 넘으면 고정 댓글에 FAQ 링크를 추가합니다.",
    "피해 인증 게시물이 확산되면 개별 안내로 전환하고, 공개 답글은 최소화합니다.",
  ],
  facts: [
    "근거 자료에 이견이 제기되면 자료 원문과 산출 방식을 추가 공개합니다.",
    "정정 요청 대상 매체가 생기면 공지문에 반영하고 게시물을 갱신합니다.",
    "‘숫자 장난’ 프레임이 붙으면 기준 시점을 다시 명시합니다.",
  ],
  investigating: [
    "약속한 공개 시각 전에 진행 상황을 한 번 더 올려 ‘확인 중’이 핑계가 아님을 보입니다.",
    "확인 결과가 나오면 같은 게시물에 결과를 이어 붙이고 고정합니다.",
    "피해 주장이 구체적으로 나오면 개별 접수 창구로 전환합니다.",
  ],
  compensation: [
    "‘입막음’ 프레임이 붙으면 조건 없는 지급 원칙을 다시 한 문장으로 올립니다.",
    "대상에서 빠진 고객 민원이 나오면 기준을 넓혀 재공지합니다.",
    "지급 현황을 주 1회 공개해 이행을 보여 줍니다.",
  ],
  silence: [
    "유력 매체 보도·증거 공개·당국 요청 중 하나가 확인되면 준비된 문안으로 즉시 전환합니다.",
    "게시물 언급량이 급증하면 하루 단위 모니터링을 시간 단위로 바꿉니다.",
    "문의가 반복되는 계정에는 개별 회신으로 ‘확인 중’ 인상을 지웁니다.",
  ],
  rebuttal: [
    "반박 근거가 반박되면 즉시 재검토하고, 틀린 부분은 정정합니다.",
    "법적 절차 언급은 방침 수준으로만 유지하고 진행 상황은 결과가 나온 뒤 공개합니다.",
    "감정적 대응이 캡처되면 해당 답글을 삭제하고 사실만 남깁니다.",
  ],
  custom: [
    "입장과 다른 뉘앙스의 답글이 올라가면 삭제하고 정해진 문장으로 다시 답합니다.",
    "새 사실이 확인되면 입장 변경 여부를 PR 담당자가 판단해 공지합니다.",
    "현장·대리점 계정의 답변도 같은 문장으로 통일합니다.",
  ],
};

const COMMENT_GUIDE_BASE: { pattern: string; tag: "안내" | "사실" | "공감" | "비공개" }[] = [
  { pattern: "환불·보상은 언제부터인가요?", tag: "안내" },
  { pattern: "사과만 하고 끝인가요? 숫자는요?", tag: "사실" },
  { pattern: "책임자는 누구인가요?", tag: "사실" },
  { pattern: "기자입니다. 취재 가능할까요?", tag: "안내" },
  { pattern: "욕설·개인정보가 담긴 댓글", tag: "비공개" },
];

const DEFENSE_FRAME: Record<Stance, { frame: string; line: (brand: string, event: string) => string }[]> = {
  apology: [
    { frame: "사과의 진정성", line: (brand) => `원인과 책임은 ${brand}에 있습니다. 사과만 하고 끝내지 않겠습니다.` },
    { frame: "피해 회복 속도", line: () => "접수는 오늘부터 받고, 처리 현황도 공개하겠습니다." },
    { frame: "재발 방지", line: () => "같은 문제가 반복되지 않도록 절차와 점검 주기를 바꾸겠습니다." },
  ],
  facts: [
    { frame: "사실관계", line: () => "확인된 사실과 사실과 다른 점을 구분해 말씀드리겠습니다." },
    { frame: "근거의 신뢰", line: () => "자료의 기준 시점과 산출 방식을 함께 공개합니다." },
    { frame: "고객 조치", line: () => "사실 정리와 별개로 피해를 입으신 분들의 조치를 먼저 진행합니다." },
  ],
  investigating: [
    { frame: "확인 일정", line: () => "확인 결과는 약속한 시각에 공개하겠습니다." },
    { frame: "확인 범위", line: () => "확인된 사실과 확인 중인 사항을 구분해 알려드리고 있습니다." },
    { frame: "선제 조치", line: () => "확인을 기다리는 동안에도 피해를 줄이는 조치는 이미 시작했습니다." },
  ],
  compensation: [
    { frame: "보상의 조건 없음", line: () => "보상은 비밀유지·게시물 삭제·합의와 어떤 조건으로도 연결하지 않습니다." },
    { frame: "대상과 기준", line: () => "대상과 기준을 넓고 단순하게 잡아 빠지는 분이 없도록 하겠습니다." },
    { frame: "원인 조사 병행", line: () => "보상과 별개로 원인 조사도 같은 일정으로 진행합니다." },
  ],
  silence: [
    { frame: "침묵의 이유", line: () => "확인되지 않은 내용을 추측해 말하면 피해가 커질 수 있어 근거가 확인되는 시점에 입장을 냅니다." },
    { frame: "회신 원칙", line: () => "모든 문의에는 회신 예정 시각을 정해 답하고 있습니다." },
    { frame: "전환 조건", line: () => "보도·증거 수준이 기준을 넘으면 준비된 문안으로 바로 전환합니다." },
  ],
  rebuttal: [
    { frame: "근거 공개", line: () => "확인 가능한 근거 자료와 공개 위치를 먼저 제시하겠습니다." },
    { frame: "대응 범위", line: () => "허위로 확인되는 범위에 한해 절차에 따라 대응합니다." },
    { frame: "비판 수용", line: () => "정당한 비판과 지적은 겸허히 받아들이겠습니다." },
  ],
  custom: [
    { frame: "입장의 일관성", line: (brand) => `${brand}의 입장은 한 문장으로 유지합니다.` },
    { frame: "확인 범위", line: () => "인정하는 범위와 확인이 필요한 범위를 나눠 말씀드립니다." },
    { frame: "조치", line: () => "입장과 별개로 고객 조치는 이미 진행하고 있습니다." },
  ],
};

const SOCIAL_TAG: Record<string, string> = {
  안내: "안내",
  사실: "사실",
  공감: "공감",
  비공개: "비공개",
};

function commentReplies(ctx: { brand: string; stance: Stance; event: string; actions: string[] }): SocialKit["commentGuide"] {
  const { brand, event, actions } = ctx;
  const lead = actions[0] ?? "확인되는 대로 안내드리겠습니다";
  return COMMENT_GUIDE_BASE.map((row) => {
    if (row.tag === "비공개") {
      return {
        ...row,
        reply: "개인정보·욕설·허위 사실이 담긴 댓글은 사전 고지 없이 숨김 처리합니다. 반복 게시는 신고 절차로 넘깁니다.",
      };
    }
    if (row.pattern.includes("기자")) {
      return { ...row, reply: `취재 문의는 ${brand} 커뮤니케이션팀(${place("연락처")})으로 부탁드립니다. 공식 자료를 드리겠습니다.` };
    }
    if (row.pattern.includes("환불") || row.pattern.includes("보상")) {
      return {
        ...row,
        reply: `접수는 ${place("접수 채널")}에서 받고 있습니다. 확인 후 개별 안내드리며, 처리 현황도 공개하겠습니다. ${lead}`,
      };
    }
    if (row.pattern.includes("책임")) {
      return { ...row, reply: `원인과 책임은 ${brand}에 있습니다. 조사 결과와 책임 범위도 같은 채널에 공개하겠습니다.` };
    }
    return {
      ...row,
      reply: `${event} 관련해 기준과 일정을 ${place("공지 시각")}까지 확정해 다시 안내드리겠습니다. 확인되지 않은 내용은 추측해 말하지 않겠습니다.`,
    };
  });
}

function buildSocial(ctx: ChannelSource, stanceShort: string, actions: string[]): SocialKit {
  const brand = ctx.brand;
  const event = ctx.eventLabel;
  const hashtags = [
    brand && brand !== "당사" ? `#${brand.replace(/\s/g, "")}` : "",
    "#공지",
    "#안내",
  ].filter(Boolean);

  const long = [
    `${brand} 공지`,
    "",
    SOCIAL_SHORT[ctx.stance](brand, event),
    "",
    "· 확인된 사실",
    `- ${clip(ctx.situation, 120)}`,
    "",
    "· 지금 하고 있는 일",
    ...actions.slice(0, 3).map((a) => `- ${clip(a, 90)}`),
    "",
    "· 문의",
    `- ${place("고객센터·문의 채널")} / 확인되는 내용은 이 계정에 계속 올립니다.`,
    "",
    hashtags.join(" "),
  ].join("\n");

  const cards = [
    { head: `${brand} 안내`, body: clip(event, 40) + " 관련 안내드립니다." },
    { head: "확인된 사실", body: clip(ctx.situation, 90) },
    { head: "지금 하고 있는 일", body: actions.slice(0, 2).map((a) => clip(a, 60)).join(" / ") || place("조치 항목") },
    { head: "문의·접수", body: `${place("접수 채널")} · ${place("처리 일정")}` },
  ];

  return {
    short: SOCIAL_SHORT[ctx.stance](brand, event),
    long,
    hashtags,
    pinned: `${brand} 공지입니다. 확인된 사실과 조치, 문의 창구를 이 게시물에 정리했습니다. 개별 문의는 ${place(
      "고객센터",
    )}로 주시면 순서대로 안내드립니다. (${stanceShort} 기준 문안)`,
    cards,
    commentGuide: commentReplies({ brand, stance: ctx.stance, event, actions }),
    escalation: SOCIAL_ESCALATION[ctx.stance],
  };
}

function buildInternal(ctx: ChannelSource, stanceShort: string, actions: string[]): InternalNotice {
  const brand = ctx.brand;
  const protocol = getProtocol(ctx.caseType);
  const banned = ctx.banned.slice(0, 2);

  const dos = [
    "외부 문의·취재는 공식 창구 한 곳으로만 넘깁니다. 개인적으로 답하지 않습니다.",
    "개인 SNS·커뮤니티에 회사 입장, 사내 자료, 고객 정보를 올리지 않습니다.",
    "고객 응대는 배포된 스크립트 문장만 사용하고, 금액·일정은 임의로 약속하지 않습니다.",
    ...EXTRA_DOS[ctx.stance],
  ];
  const donts = [
    banned[0] ? `“${banned[0].phrase}”` : "“확인 중입니다”만 반복하기",
    banned[1] ? `“${banned[1].phrase}”` : "“최선을 다하겠습니다”로 끝내기",
    "“노코멘트”만 말하기 (→ “담당 부서에서 확인 후 안내드리겠습니다”로 답합니다)",
    "확인되지 않은 원인·피해 규모를 추측해 말하기",
  ];

  const body = [
    `제목: [사내 공지] ${brand} — ${ctx.eventLabel} 관련 임직원 안내 (외부 공유 금지)`,
    "",
    "임직원 여러분께,",
    "",
    INTERNAL_LEAD[ctx.stance],
    "",
    "■ 지금 확인된 사실",
    `- ${clip(ctx.situation, 220)}`,
    `- 대외 공지는 ${brand} 공식 채널(홈페이지·SNS·앱)에 같은 시각 게시했습니다.`,
    "",
    "■ 회사가 하고 있는 일",
    ...(actions.length ? actions.slice(0, 4).map((a) => `- ${a}`) : [`- ${place("조치 항목")}`]),
    ...(protocol ? [`- ${protocol.label} 기준 절차에 따라 진행 중입니다.`] : []),
    "",
    "■ 임직원이 지금 해야 할 일",
    ...dos.map((d) => `- ${d}`),
    "",
    "■ 하지 말아야 할 말",
    ...donts.map((d) => `- ${d}`),
    "",
    "■ 일정·문의",
    `- 사내 브리핑: ${place("일시·채널")}`,
    `- 문의 창구: ${place("PR·인사 담당")}`,
    `- 이 문서는 내부 공유용입니다. 캡처·외부 전달 금지.`,
    "",
    `${brand} 커뮤니케이션팀`,
  ].join("\n");

  const qa = [
    {
      q: "기자가 제 개인 번호로 전화했습니다. 어떻게 하나요?",
      a: `“확인 후 담당 부서에서 연락드리겠습니다”로 답하고, 성함·매체·문의 내용·시각을 기록해 PR 담당자에게 즉시 전달해 주세요. 임의로 답변하지 않습니다.`,
    },
    {
      q: "지인·가족이 사안을 물어봅니다.",
      a: `“회사 공식 채널에 올라온 내용이 전부”라고만 말씀해 주세요. 확인되지 않은 내용이나 내부 상황은 설명하지 않습니다. (현재 입장: ${stanceShort})`,
    },
    {
      q: "제 업무·일정은 어떻게 되나요?",
      a: `대응 기간에는 ${place("부서별 우선순위")} 기준으로 조정합니다. 변동 사항은 팀장을 통해 공지합니다.`,
    },
  ];

  return {
    title: `[사내 공지] ${brand} — ${ctx.eventLabel} 관련 임직원 안내`,
    lead: INTERNAL_LEAD[ctx.stance],
    body,
    dos,
    donts,
    qa,
  };
}

function buildDefense(ctx: ChannelSource, actions: string[]): DefensePoint[] {
  const protocol = getProtocol(ctx.caseType);
  const facts = protocol?.facts ?? [];
  const measures = protocol?.measures ?? [];
  const banned = ctx.banned;
  const frames = DEFENSE_FRAME[ctx.stance];

  return frames.map((f, i) => {
    const proof =
      i === 0
        ? facts[0] ?? "확인된 사실 1개 + 기준 시점 + 출처"
        : i === 1
          ? measures[0] ?? actions[0] ?? "이미 시작한 조치 1개와 담당"
          : facts[1] ?? "지급·공개 일정(날짜·시각)과 신청 창구";
    const avoid = banned[i % Math.max(1, banned.length)]?.phrase ?? "근거 없는 단정";
    return {
      frame: f.frame,
      line: f.line(ctx.brand, ctx.eventLabel),
      proof,
      avoid,
    };
  });
}

function buildBridge(ctx: ChannelSource): string[] {
  const event = ctx.eventLabel;
  return [
    `“${event} 관련해서는 확인된 사실부터 말씀드리면, …입니다.”`,
    `“그 지적은 별도로 확인하겠습니다. 지금 확인된 범위는 …이고, 나머지는 ${place("시각")}까지 공개합니다.”`,
    `“원인과 책임은 당사에 있습니다. 대신 지금 할 수 있는 조치부터 말씀드리겠습니다.”`,
    `“정확하지 않은 내용으로 답하면 오히려 피해가 커집니다. 확인 결과를 같은 채널에 먼저 올리겠습니다.”`,
  ];
}

export function buildChannelKit(src: ChannelSource): ChannelKit {
  const stance = getStance(src.stance, src.stanceCustom);
  const actions = [...(src.actions[0]?.items ?? []), ...(src.actions[1]?.items ?? [])]
    .map((i) => i.text)
    .filter(Boolean)
    .slice(0, 6);
  const industry = getIndustry(src.industry);
  const safeActions = actions.length
    ? actions
    : [`${industry.label} 기준 1차 조치 항목을 확인해 채웁니다`];

  return {
    internal: buildInternal(src, stance.short, safeActions),
    social: buildSocial(src, stance.short, safeActions),
    defense: buildDefense(src, safeActions),
    bridge: buildBridge(src),
    source: "local",
  };
}

export function internalToText(notice: InternalNotice): string {
  return `${notice.title}\n\n${notice.body}`;
}

export function socialToText(kit: SocialKit): string {
  return [
    "[짧은 공지 · X/스레드]",
    kit.short,
    "",
    "[인스타그램·블로그 캡션]",
    kit.long,
    "",
    "[고정 댓글]",
    kit.pinned,
    "",
    "[카드뉴스 4장]",
    ...kit.cards.map((c, i) => `${i + 1}. ${c.head} — ${c.body}`),
    "",
    "[예상 댓글 · 대응 가이드]",
    ...kit.commentGuide.map((c) => `- (${SOCIAL_TAG[c.tag]}) ${c.pattern}\n  → ${c.reply}`),
    "",
    "[악화 시 운영 원칙]",
    ...kit.escalation.map((e, i) => `${i + 1}. ${e}`),
  ].join("\n");
}

export function defenseToText(points: DefensePoint[], bridge: string[]): string {
  return [
    "[핵심 방어 논리]",
    ...points.map((p, i) => `${i + 1}. ${p.frame}\n- 쓸 문장: ${p.line}\n- 필요한 근거: ${p.proof}\n- 피할 말: ${p.avoid}`),
    "",
    "[브릿지 문장 — 공격적 질문을 사실로 되돌릴 때]",
    ...bridge.map((b) => `- ${b}`),
  ].join("\n");
}

export function channelKitToText(kit: ChannelKit): string {
  return [internalToText(kit.internal), "", "──────────", "", socialToText(kit.social), "", "──────────", "", defenseToText(kit.defense, kit.bridge)].join("\n");
}

/** AI가 돌려준 채널 문안을 검증해 병합합니다. 형식이 어긋나면 매뉴얼 문안을 유지합니다. */
export function mergeChannelKit(base: ChannelKit, raw: unknown): ChannelKit {
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const pick = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");
  const list = (v: unknown, maxItems: number, maxChars: number) =>
    Array.isArray(v) ? v.map((x) => pick(x, maxChars)).filter(Boolean).slice(0, maxItems) : [];

  const internalRow = (r.internal ?? {}) as Record<string, unknown>;
  const socialRow = (r.social ?? {}) as Record<string, unknown>;
  const internalBody = pick(internalRow.body, 4_000);
  const socialShort = pick(socialRow.short, 400);

  const defenseRaw = Array.isArray(r.defense) ? r.defense : [];
  const defense: DefensePoint[] = defenseRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const line = pick(row.line, 300);
      const frame = pick(row.frame, 60);
      if (!line || !frame) return null;
      return { frame, line, proof: pick(row.proof, 300), avoid: pick(row.avoid, 200) };
    })
    .filter((v): v is DefensePoint => Boolean(v))
    .slice(0, 4);

  const commentRaw = Array.isArray(socialRow.commentGuide) ? socialRow.commentGuide : [];
  const commentGuide: SocialKit["commentGuide"] = commentRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const reply = pick(row.reply, 400);
      const pattern = pick(row.pattern, 120);
      if (!reply || !pattern) return null;
      const tagRaw = pick(row.tag, 10);
      const tag: SocialKit["commentGuide"][number]["tag"] =
        tagRaw === "사실" || tagRaw === "공감" || tagRaw === "비공개" ? tagRaw : "안내";
      return { pattern, tag, reply };
    })
    .filter((v): v is SocialKit["commentGuide"][number] => Boolean(v))
    .slice(0, 6);

  const internalQa = Array.isArray(internalRow.qa)
    ? internalRow.qa
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const q = pick(row.q ?? row.question, 200);
          const a = pick(row.a ?? row.answer, 600);
          return q && a ? { q, a } : null;
        })
        .filter((v): v is { q: string; a: string } => Boolean(v))
        .slice(0, 4)
    : [];

  const cards = Array.isArray(socialRow.cards)
    ? socialRow.cards
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const head = pick(row.head, 40);
          const body = pick(row.body, 120);
          return head && body ? { head, body } : null;
        })
        .filter((v): v is { head: string; body: string } => Boolean(v))
        .slice(0, 5)
    : [];

  return {
    source: "ai",
    internal: {
      title: pick(internalRow.title, 160) || base.internal.title,
      lead: pick(internalRow.lead, 300) || base.internal.lead,
      body: internalBody.length >= 200 ? internalBody : base.internal.body,
      dos: list(internalRow.dos, 8, 200).length ? list(internalRow.dos, 8, 200) : base.internal.dos,
      donts: list(internalRow.donts, 8, 200).length ? list(internalRow.donts, 8, 200) : base.internal.donts,
      qa: internalQa.length ? internalQa : base.internal.qa,
    },
    social: {
      short: socialShort.length >= 30 ? socialShort : base.social.short,
      long: pick(socialRow.long, 2_000).length >= 60 ? pick(socialRow.long, 2_000) : base.social.long,
      hashtags: list(socialRow.hashtags, 6, 30).length ? list(socialRow.hashtags, 6, 30) : base.social.hashtags,
      pinned: pick(socialRow.pinned, 400) || base.social.pinned,
      cards: cards.length ? cards : base.social.cards,
      commentGuide: commentGuide.length ? commentGuide : base.social.commentGuide,
      escalation: list(socialRow.escalation, 4, 300).length ? list(socialRow.escalation, 4, 300) : base.social.escalation,
    },
    defense: defense.length >= 2 ? defense : base.defense,
    bridge: list(r.bridge, 5, 300).length ? list(r.bridge, 5, 300) : base.bridge,
  };
}
