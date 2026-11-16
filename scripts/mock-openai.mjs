/**
 * 검증용 OpenAI 모의 서버. 실제 API를 호출하지 않고 스키마에 맞는 응답을 돌려줍니다.
 * OPENAI_BASE_URL=http://127.0.0.1:4191/v1 로 두면 api/analyze.ts가 이 서버를 봅니다.
 */
import http from "node:http";

const port = Number(process.env.PORT || 4191);

const RESULT = {
  score: 81,
  comment: "사과는 있지만 회수 범위와 규모 수치가 없어 ‘확인 중’ 프레임이 그대로 남습니다.",
  headlines: [
    { tone: "critical", outlet: "식품 전문지", text: "모의 헤드라인 — 회수 범위 답 없이 ‘확인 중’만", note: "로트·채널이 빠지면 이 제목이 성립합니다." },
    { tone: "critical", outlet: "산업부", text: "모의 헤드라인 — 피해 규모 깜깜", note: "수치 부재." },
    { tone: "critical", outlet: "경제지", text: "모의 헤드라인 — 사과보다 해명", note: "책임 공방." },
    { tone: "positive", outlet: "식품 전문지", text: "모의 헤드라인 — 원인·일정 공개", note: "검증 결과 공개 시." },
    { tone: "positive", outlet: "산업부", text: "모의 헤드라인 — 전수 보상 기준", note: "보상 기준 확정 시." },
  ],
  factChecks: [
    { question: "모의 질문 — 회수 대상 로트는 어디까지인가?", why: "소비자가 자기 제품을 확인할 수 없습니다.", severity: 3 },
    { question: "모의 질문 — 최초 인지 시각은?", why: "지연 의혹 반박 근거가 없습니다.", severity: 3 },
    { question: "모의 질문 — 검사 기관은?", why: "안전성 주장의 근거가 없습니다.", severity: 2 },
    { question: "모의 질문 — 보상 기준은?", why: "분쟁으로 이어집니다.", severity: 2 },
    { question: "모의 질문 — 재발 방지 일정은?", why: "반복 리스크.", severity: 1 },
  ],
  revisions: [
    {
      id: "empathy",
      label: "공감·수습 우선형",
      audience: "소비자·커뮤니티",
      body:
        "모의푸드 만두 이물질 관련 사과 및 조치 안내\n\n고객 여러분께 불편과 불안을 드린 점 고개 숙여 사과드립니다.\n\n우선 구매하신 제품은 섭취하지 마시고 [확인 필요: 회수 로트]에 해당하는 경우 구매처로 반품해 주세요.\n\n확인된 사실만 말씀드리면, 현재 해당 라인의 판매를 중지했고 검사 결과를 기다리고 있습니다.\n\n문의: [고객센터·담당 채널]\n\n모의푸드 드림",
      changes: ["사과를 첫 문단으로 올렸습니다.", "고객 행동을 사과문 안에 넣었습니다.", "회수 로트는 [확인 필요]로 남겼습니다."],
    },
    {
      id: "authority",
      label: "팩트·원칙 명확형",
      audience: "언론·기관",
      body:
        "모의푸드 만두 이물질 관련 사실관계 및 대응 계획\n\n1. 사실관계\n- 발생·인지 시점: [확인 필요: 최초 인지 시각]\n- 영향 범위: [확인 필요: 회수 로트]\n\n2. 현재 조치\n- 해당 라인 판매 중지 및 회수 절차 착수\n- 식약처 신고 및 자진회수 협의\n\n3. 대응 원칙\n확인되지 않은 사실은 추정하지 않고, 확인된 범위만 공개합니다.\n\n문의: [고객센터·담당 채널]",
      changes: ["사실관계·조치·원칙을 번호로 분리했습니다.", "규제 대응 절차를 명시했습니다."],
    },
  ],
  channelSimulations: [
    {
      channel: "consumer-cafe",
      reactions: [
        { text: "모의 반응 — 우리 집 냉동실에도 있는데 로트 번호부터 알려주세요.", tone: "질문" },
        { text: "모의 반응 — 환불은 언제부터 되나요?", tone: "우려" },
      ],
      triggers: ["회수 로트가 공개되지 않으면 인증샷이 쏟아집니다.", "보상 기준이 없으면 환불 후기가 확산됩니다."],
    },
    {
      channel: "econ-press",
      reactions: [
        { text: "모의 반응 — 매출 영향과 충당금 계상 계획을 확인해야 합니다.", tone: "질문" },
        { text: "모의 반응 — ‘확인 중’만 반복하면 기사로 쓰기 어렵습니다.", tone: "냉소" },
      ],
      triggers: ["숫자가 없으면 추정치가 먼저 인용됩니다."],
    },
    {
      channel: "sns-x",
      reactions: [
        { text: "모의 반응 — 이 문장만 캡처되면 끝입니다.", tone: "냉소" },
        { text: "모의 반응 — 사과 대상이 누구인지 모르겠습니다.", tone: "분노" },
      ],
      triggers: ["짧은 방어 문장이 캡처되면 밈이 됩니다."],
    },
    {
      channel: "youtube",
      reactions: [{ text: "모의 반응 — 해설 영상 각이네요.", tone: "우려" }],
      triggers: ["요약 영상이 붙으면 48시간 뒤 2차 확산이 옵니다."],
    },
  ],
  pressQa: [
    {
      question: "모의 질문 — 회수 대상은 어느 로트까지입니까?",
      answerGuide: "제조번호 [확인 필요: 로트]와 유통기한 [확인 필요: 기한]이 대상입니다. [날짜]부터 구매처에서 환불을 접수합니다.",
      avoid: ["‘전량 회수’만 말하기", "‘문제 없다’는 단정"],
      severity: 3,
    },
    {
      question: "모의 질문 — 왜 공지가 늦었습니까?",
      answerGuide: "최초 인지 [확인 필요: 시각] 후 [확인 필요: 소요 시간] 안에 공지했습니다. 지연이 있었다면 사유를 함께 공개하겠습니다.",
      avoid: ["‘내부 사정’으로 뭉개기"],
      severity: 3,
    },
    {
      question: "모의 질문 — 보상 기준은?",
      answerGuide: "회수 제품 전액 환불과 [확인 필요: 추가 보상]을 [날짜]까지 적용합니다.",
      avoid: ["구체적 기준 없는 ‘최선’"],
      severity: 2,
    },
  ],
  goldenTime: [
    { window: "1시간", title: "판매 중지와 접수 창구", items: ["모든 채널 판매 중지", "접수 창구 단일화", "로트·출고처 확인 착수"] },
    { window: "6시간", title: "회수 범위 확정과 신고", items: ["회수 범위 확정", "식약처 신고", "검사 의뢰"] },
    { window: "24시간", title: "수치와 2차 유통", items: ["회수 진행률 공개", "가공·급식처 통보 확인"] },
  ],
};

const sample = {
  choices: [
    {
      message: {
        content: JSON.stringify(RESULT),
      },
    },
  ],
  usage: { prompt_tokens: 1200, completion_tokens: 900, total_tokens: 2100 },
};

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("{}");
    return;
  }
  let raw = "";
  req.on("data", (c) => {
    raw += c;
  });
  req.on("end", () => {
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const authorization = req.headers.authorization || "";
    if (!authorization.startsWith("Bearer ")) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { message: "missing api key" } }));
      return;
    }
    if (process.env.MOCK_FAIL === "1") {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { message: "mock upstream failure" } }));
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ...sample, model: parsed.model || "gpt-4o-mini" }));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[mock-openai] http://127.0.0.1:${port}/v1`);
});
