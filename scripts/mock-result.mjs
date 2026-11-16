/**
 * 검증용 모의 AI 응답 (OpenAI·Gemini 모의 서버가 함께 씁니다).
 * 스키마는 api/analyze.ts의 SYSTEM_PACKAGE / SYSTEM_REVIEW와 같은 모양입니다.
 * 프롬프트에서 입장(stance)·유형(entities)을 읽어 결과를 바꿔, 프롬프트 반영 여부를 검증할 수 있게 했습니다.
 */

const LONG_PUBLIC = (label) =>
  [
    `모의 고객 공지 — ${label} 입장으로 작성한 전문입니다.`,
    "",
    "고객 여러분께 불편과 불안을 드린 점 사과드립니다. 지금 확인된 사실은 아래와 같습니다.",
    "- 발생 내용: 모의 상황 설명을 그대로 반영했습니다.",
    "- 조치: 판매 중지와 접수 창구를 열었습니다.",
    "",
    "지금 해 주실 일은 구매처 또는 고객센터로 연락해 환불을 접수하는 것입니다.",
    "보상 기준은 [확인 필요: 보상 범위]이며, 확정되는 대로 이 공지에 반영하겠습니다.",
    "",
    "문의: 고객센터 0000-0000",
    "모의브랜드 드림",
  ].join("\n");

const LONG_PRESS = (label, entity) =>
  [
    `[보도자료] 모의브랜드, 상황 관련 ${label} 입장`,
    "",
    "1. 사실관계",
    "- 모의 기사·설명에서 확인된 내용만 정리했습니다.",
    `- ${entity} 유형에 맞춘 절차를 함께 안내합니다.`,
    "",
    "2. 현재 조치",
    "- 판매 중지 및 접수 창구 운영",
    "- 관계 기관 신고·협의 진행",
    "",
    "3. 향후 일정",
    "- 확인 결과 공개: [확인 필요: 일시]",
    "- 보상 기준 발표: [확인 필요: 일시]",
    "",
    "4. 대응 원칙",
    "확인되지 않은 사실은 추정하지 않고, 확인된 범위만 공개하겠습니다.",
    "",
    "문의: 모의브랜드 커뮤니케이션팀",
  ].join("\n");

export function buildPackageResult(prompt = "") {
  const stance = /\[우리 입장\]\s*\n?\s*(apology|investigating|rebuttal)/.exec(prompt)?.[1] || "apology";
  const label = stance === "apology" ? "즉시 사과" : stance === "investigating" ? "확인 중" : "강경 반박";
  const entity = /상장사/.test(prompt) ? "상장사" : /IT·플랫폼/.test(prompt) ? "IT·플랫폼" : /소비재·식품/.test(prompt) ? "소비재·식품" : "일반";
  const fetched = /기사 원문 — 서버가 직접 읽음/.test(prompt);

  return {
    headline: `모의 진단 — ${entity} · ${label}${fetched ? " · 기사 원문 반영" : ""}`,
    risk: "높음",
    strategy: `모의 전략 — ${label} 원칙을 유지하고 확인 일정을 지킵니다.`,
    roadmap: [
      { window: "1시간", title: "모의 1시간 단계", goal: "사실과 범위를 확인합니다.", gate: "대외 문안 승인", items: ["상황실 소집", "사실 분류표", "창구 단일화"] },
      { window: "6시간", title: "모의 6시간 단계", goal: "공식 입장을 냅니다.", gate: "입장문 2종 게시", items: ["입장문 게시", "기자 답변 배포", "내부 공지"] },
      { window: "24시간~", title: "모의 24시간 단계", goal: "수습과 재발 방지를 증명합니다.", gate: "보상 기준 공표", items: ["보상 기준", "진행률 공개", "재발방지"] },
    ],
    actions: [
      {
        window: "1시간",
        title: "모의 즉시 조치",
        items: [
          { text: "모의 실행 항목 A — 판매 중지와 접수 창구 개설", owner: "공시" },
          { text: "모의 실행 항목 B — 확인된 사실 분류표 작성", owner: "법무" },
          { text: "모의 실행 항목 C — 외부 발언 금지 안내", owner: "인사" },
        ],
      },
      {
        window: "6시간",
        title: "모의 공식 대응",
        items: [
          { text: "모의 실행 항목 D — 입장문 2종 게시", owner: "홍보" },
          { text: "모의 실행 항목 E — 기자 답변 스크립트 배포", owner: "홍보" },
        ],
      },
      {
        window: "24시간~",
        title: "모의 수습",
        items: [
          { text: "모의 실행 항목 F — 보상 기준 확정", owner: "CS" },
          { text: "모의 실행 항목 G — 재발방지 일정 공개", owner: "해당부서" },
        ],
      },
    ],
    statements: [
      { id: "public", title: `모의 고객 공지 — ${label}`, body: LONG_PUBLIC(label) },
      { id: "press", title: `모의 보도자료 — ${label}`, body: LONG_PRESS(label, entity) },
    ],
    qa: [
      { question: "모의 질문 1 — 왜 늦게 알렸습니까?", answer: "최초 인지 시각은 [확인 필요: 시각]이며, 첫 공지는 [확인 필요: 시각]에 나갔습니다. 늦었다면 이유도 함께 공개하겠습니다.", guide: "기록으로 답합니다.", avoid: ["‘내부 사정’으로 뭉개기"], severity: 3 },
      { question: "모의 질문 2 — 피해 규모는?", answer: "현재 확인된 피해는 [확인 필요: 건수]이며, 집계 기준 시각은 [확인 필요: 시각]입니다.", guide: "수치와 기준 시각을 함께 답합니다.", avoid: ["근거 없는 ‘전량’"], severity: 3 },
      { question: "모의 질문 3 — 보상은?", answer: "보상 기준은 [날짜]까지 확정해 공지하고, 접수는 [채널]에서 받겠습니다.", guide: "기준·시점·창구를 함께 답합니다.", avoid: ["‘최선을 다하겠다’"], severity: 2 },
      { question: "모의 질문 4 — 재발 방지는?", answer: "재발방지 대책과 완료 일정을 [확인 필요: 일시]에 공개하겠습니다.", guide: "일정을 약속합니다.", avoid: ["막연한 약속"], severity: 2 },
      { question: "모의 질문 5 — 책임은?", answer: "원인과 책임은 당사에 있으며, 조사 결과에 따라 명확히 하겠습니다.", guide: "책임 주체를 회사로 둡니다.", avoid: ["개인에게 미루기"], severity: 2 },
    ],
    banned: [
      { phrase: "모의 금기 1 — “확인 중입니다”만 반복", why: "회피로 읽힙니다." },
      { phrase: "모의 금기 2 — “전혀 문제 없습니다”", why: "단정은 위험합니다." },
      { phrase: "모의 금기 3 — “최선을 다하겠습니다”", why: "조치가 아닙니다." },
      { phrase: "모의 금기 4 — 범위 없는 “전량 회수”", why: "확인 가능한 범위가 없습니다." },
      { phrase: "모의 금기 5 — “유감입니다”", why: "사과가 아닙니다." },
    ],
    stakeholders: [
      { who: "모의 유관기관 A", when: "1시간", action: "신고·협의 창구 확인", line: "확인된 범위와 조치 계획을 보고드리겠습니다." },
      { who: "모의 언론", when: "6시간", action: "보도자료 배포·개별 회신", line: "확인된 사실만 담아 배포했습니다." },
      { who: "모의 고객", when: "1시간", action: "공지·접수 창구 안내", line: "지금 하실 일을 먼저 알려드립니다." },
      { who: "모의 협력사", when: "6시간", action: "판매 중지·회수 통보", line: "판매를 잠시 보류해 주세요." },
    ],
    outlook: {
      reactions: [
        { channel: "소비자 커뮤니티", text: "모의 반응 — 보상 기준부터 알려주세요.", tone: "질문" },
        { channel: "X(트위터)", text: "모의 반응 — 캡처될 문장이 있네요.", tone: "냉소" },
        { channel: "유튜브", text: "모의 반응 — 정리 영상 각입니다.", tone: "우려" },
        { channel: "경제지", text: "모의 반응 — 수치와 일정을 확인해야 합니다.", tone: "질문" },
      ],
      triggers: ["모의 트리거 1 — 보상 공지가 늦어질 때", "모의 트리거 2 — 현장 발언이 다를 때", "모의 트리거 3 — 확인 일정을 넘길 때"],
      escalation: ["모의 다음 대응 1 — 보상 기준 조기 확정", "모의 다음 대응 2 — 접수 현황 공개", "모의 다음 대응 3 — 스크립트 재배포"],
    },
    watchouts: ["모의 함정 1 — 첫 문장이 방어적이면 전부 변명으로 읽힙니다.", "모의 함정 2 — 임직원 SNS가 먼저 나가면 통제력을 잃습니다.", "모의 함정 3 — 부서별 문안이 다르면 기사가 됩니다."],
  };
}

export const REVIEW_RESULT = {
  score: 78,
  summary: "모의 검수 — ‘확인 중’과 ‘단순한 문제’가 겹쳐 책임 회피로 읽힙니다.",
  findings: [
    { quote: "확인 중입니다", label: "진행형 회피", why: "정보가 없다는 뜻으로 읽힙니다.", fix: "확인해 [날짜]까지 공유하겠습니다", severity: 3 },
    { quote: "단순한 문제", label: "축소 표현", why: "피해를 축소하는 표현입니다.", fix: "고객이 겪은 불편", severity: 3 },
    { quote: "최선을 다하겠습니다", label: "의지 표명", why: "조치가 아닙니다.", fix: "[구체 조치]를 [일정]까지 완료하겠습니다", severity: 2 },
  ],
  rewrite:
    "모의 리라이트 — 고객 여러분께 불편과 불안을 드린 점 사과드립니다.\n\n확인된 사실은 다음과 같습니다. 해당 제품의 판매를 중지했고, [날짜]까지 확인 결과를 공개하겠습니다.\n\n보상 기준은 [날짜]까지 확정해 안내드리겠습니다.\n\n문의: 고객센터",
  checklist: [
    { label: "사과 주체와 대상", ok: true, hint: "" },
    { label: "피해 규모 수치", ok: false, hint: "확인된 건수와 기준 시각을 넣으세요." },
    { label: "확인·공개 일정", ok: false, hint: "날짜와 시각으로 약속하세요." },
    { label: "문의·접수 창구", ok: true, hint: "" },
    { label: "금기 표현 없음", ok: false, hint: "표시된 표현을 교체하세요." },
  ],
};

/** 이전 스크립트 호환용 (패키지 결과와 같은 모양) */
export const RESULT = buildPackageResult("[우리 입장]\napology");
