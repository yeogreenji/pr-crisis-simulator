/**
 * PRISM 실시간 AI 분석 백엔드 (Vercel 서버리스 함수)
 *
 * POST /api/analyze
 *   body: { brand, industry, issue, channels, draft, context?, apiKey? }
 *   - GEMINI_API_KEY 가 있으면 Google Gemini를, 없으면 OPENAI_API_KEY를 씁니다.
 *   - 두 서버 키가 모두 없을 때만 요청의 apiKey / x-api-key 헤더를 씁니다(sk-…=OpenAI, 그 외=Gemini).
 *   - Gemini는 responseMimeType: application/json, OpenAI는 response_format: json_object 로 같은 구조를 받습니다.
 *
 * GET /api/analyze  → 서버 상태(키 설정 여부·제공자·모델명)만 반환합니다. 키 값은 절대 내려보내지 않습니다.
 */

/** Node 런타임 환경변수 (타입 의존성 없이 읽습니다). */
const ENV: Record<string, string | undefined> =
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = (ENV.GEMINI_MODEL || "").trim() || "gemini-3.5-flash-lite";
const MAX_DRAFT_CHARS = 8_000;
const MIN_DRAFT_CHARS = 20;
const UPSTREAM_TIMEOUT_MS = 55_000;
const OPENAI_BASE = (ENV.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_URL = `${OPENAI_BASE}/chat/completions`;
/** GEMINI_BASE_URL은 검증 하네스가 모의 서버를 물릴 때만 씁니다. */
const GEMINI_BASE = (ENV.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");

type Provider = "gemini" | "openai";

/**
 * 개인 키는 앞자리로 제공자를 가립니다. OpenAI 키만 sk- 로 시작하고,
 * Gemini 키는 AIza… 또는 AQ.… 등으로 발급되므로 "sk-가 아니면 Gemini"로 봅니다.
 */
const isGeminiKey = (key: string): boolean => key.length > 0 && !key.startsWith("sk-");

const ALLOWED_INDUSTRIES = ["food", "retail", "consumer", "tech", "steel", "entertainment"];
const ALLOWED_CHANNELS = ["econ-press", "it-press", "office-community", "sns-x", "youtube", "consumer-cafe"];
const ALLOWED_ISSUES = [
  "service-outage",
  "product-safety",
  "pricing-change",
  "data-privacy",
  "people-org",
  "safety-accident",
  "executive-speech",
];

interface AnalyzeContext {
  industryLabel?: string;
  issueLabel?: string;
  channelLabels?: string[];
  stance?: string;
  regulators?: string[];
  laws?: string[];
  banned?: string[];
  timeline?: { window?: string; title?: string; items?: string[] }[];
  required?: string[];
  missing?: string[];
  riskyPhrases?: string[];
  score?: number;
}

interface AnalyzeRequest {
  brand?: unknown;
  industry?: unknown;
  issue?: unknown;
  channels?: unknown;
  draft?: unknown;
  context?: unknown;
  apiKey?: unknown;
}

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(chunk?: string): void;
}

interface CompletionInput {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  signal: AbortSignal;
}

interface CompletionSuccess {
  content: string;
  model: string;
  usage: unknown;
}

type CompletionOutcome =
  | { ok: true; value: CompletionSuccess }
  | { ok: false; status: number; error: string; message: string };

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  error?: { message?: string };
}

export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = `당신은 한국 기업의 위기 커뮤니케이션을 실무에서 총괄하는 수석 PR 전략가입니다.
주어진 초안을 기자·이용자·규제기관의 시선에서 냉정하게 검토하고, 담당자가 오늘 바로 쓰고 답할 수 있는 실전 산출물을 만듭니다.

반드시 지킬 것:
- 초안과 제공된 업종 정보에 없는 사실·수치·기관명·인물명을 만들어내지 마세요. 필요한 값은 전부 [확인 필요: 항목] 형태로 표기합니다.
- 실존 인물의 실명·연락처·이메일·계정을 새로 만들지 마세요.
- "확인 중", "최선을 다하겠습니다" 같은 빈 문장으로 빈칸을 덮지 말고, 확인된 사실과 확인해야 할 항목을 구분하세요.
- 모든 문장은 한국어 실무 문체로, 보도자료·기자 답변에 그대로 쓸 수 있는 완성된 형태로 씁니다.
- 출력은 아래 스키마의 JSON 객체 하나뿐입니다. 코드블록, 설명, 인사말을 붙이지 마세요.

JSON 스키마:
{
  "score": 0~100 정수 (이 초안을 그대로 배포했을 때의 위기 위험도),
  "comment": "가장 큰 문제를 짚는 한 문장",
  "headlines": [
    {"tone": "critical" | "positive", "outlet": "예: 식품 전문지", "text": "실제 나올 법한 헤드라인", "note": "왜 이 제목이 성립하는지 한 줄"}
  ],
  "factChecks": [
    {"question": "기자가 물을 질문", "why": "왜 이 질문이 나오는지", "severity": 1|2|3}
  ],
  "revisions": [
    {
      "id": "empathy",
      "label": "공감·수습 우선형",
      "audience": "소비자·커뮤니티",
      "body": "완성된 전체 문안. 여러 문단, 제목·사과·고객 행동 안내·확인된 사실·남은 확인 항목·문의처 포함",
      "changes": ["핵심 변경 포인트 3~5개"]
    },
    {
      "id": "authority",
      "label": "팩트·원칙 명확형",
      "audience": "언론·기관",
      "body": "완성된 전체 문안. 번호로 나눈 사실관계·조치·규제 대응·일정·원칙",
      "changes": ["핵심 변경 포인트 3~5개"]
    }
  ],
  "channelSimulations": [
    {
      "channel": "제공된 채널 id 중 하나",
      "reactions": [{"text": "그 채널에서 실제로 달릴 법한 반응 2~3개", "tone": "분노|냉소|질문|연대|지지|우려"}],
      "triggers": ["이 초안에서 반응이 더 악화되는 구체적 트리거 2~3개"]
    }
  ],
  "pressQa": [
    {"question": "기자 압박 질문", "answerGuide": "바로 읽을 수 있는 모범 답변 (확인 필요 값은 [확인 필요: 항목])", "avoid": ["이 질문에 답할 때 피해야 할 말 2개"], "severity": 1|2|3}
  ],
  "goldenTime": [
    {"window": "1시간", "title": "이 시간에 끝내야 하는 일", "items": ["실행 체크리스트 3~5개"]},
    {"window": "6시간", "title": "...", "items": ["..."]},
    {"window": "24시간", "title": "...", "items": ["..."]}
  ]
}

분량 기준: headlines 5개(비판 3·긍정 2), factChecks 5개, revisions 정확히 2개(empathy·authority), channelSimulations는 제공된 채널마다 1개, pressQa 5개, goldenTime 정확히 3개(1시간·6시간·24시간).`;

const clean = (value: unknown, max = 2_000): string =>
  typeof value === "string" ? value.replace(/\u0000/g, "").slice(0, max).trim() : "";

const cleanList = (value: unknown, maxItems = 8, maxChars = 300): string[] =>
  Array.isArray(value)
    ? value
        .map((v) => clean(v, maxChars))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

function buildUserPrompt(input: {
  brand: string;
  industry: string;
  issue: string;
  channels: string[];
  draft: string;
  context: AnalyzeContext;
}): string {
  const c = input.context;
  const lines: string[] = [];

  lines.push(`브랜드: ${input.brand || "당사"}`);
  lines.push(`업종: ${c.industryLabel || input.industry}`);
  lines.push(`이슈 유형: ${c.issueLabel || input.issue}`);
  lines.push(
    `타깃 채널: ${(c.channelLabels && c.channelLabels.length ? c.channelLabels : input.channels).join(", ") || "지정 없음"}`,
  );
  if (typeof c.score === "number") lines.push(`내장 엔진 위험 점수: ${c.score}/100`);

  if (c.stance) lines.push(`\n[업종 대응 원칙]\n${c.stance}`);
  if (c.regulators?.length) lines.push(`\n[규제·법적 주체]\n- ${c.regulators.join("\n- ")}`);
  if (c.laws?.length) lines.push(`\n[관련 법령]\n- ${c.laws.join("\n- ")}`);
  if (c.banned?.length) lines.push(`\n[이 업종 금기 표현]\n- ${c.banned.join("\n- ")}`);
  if (c.required?.length) lines.push(`\n[필수 포함 요소]\n- ${c.required.join("\n- ")}`);
  if (c.timeline?.length) {
    lines.push(`\n[업종 골든타임 매뉴얼]`);
    for (const t of c.timeline.slice(0, 4)) {
      lines.push(`- ${t.window ?? ""} ${t.title ?? ""}: ${(t.items ?? []).slice(0, 5).join(" / ")}`);
    }
  }
  if (c.riskyPhrases?.length) lines.push(`\n[엔진이 감지한 위험 표현]\n- ${c.riskyPhrases.join("\n- ")}`);
  if (c.missing?.length) lines.push(`\n[초안에서 빠진 근거]\n- ${c.missing.join("\n- ")}`);

  lines.push(`\n[초안]\n${input.draft}`);
  lines.push(
    `\n위 초안을 기준으로 스키마에 맞는 JSON을 만들어 주세요. 채널 id는 ${input.channels.join(", ") || "없음"} 중에서만 쓰고, 각 채널의 reactions는 2~3개로 작성하세요.`,
  );
  return lines.join("\n");
}

async function completeOpenAI(input: CompletionInput): Promise<CompletionOutcome> {
  const upstream = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
    signal: input.signal,
  });

  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => "");
    let detail = raw.slice(0, 240);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed?.error?.message) detail = parsed.error.message.slice(0, 240);
    } catch {
      /* 원문 유지 */
    }
    const hint =
      upstream.status === 401
        ? "API 키가 유효하지 않습니다."
        : upstream.status === 429
          ? "OpenAI 요청 한도에 걸렸습니다. 잠시 후 다시 시도하세요."
          : "AI 제공자 응답 오류입니다.";
    return { ok: false, status: upstream.status, error: "upstream_error", message: `${hint} ${detail}`.trim() };
  }

  const data = (await upstream.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    return { ok: false, status: 502, error: "empty_completion", message: "AI가 빈 응답을 보냈습니다." };
  }
  return { ok: true, value: { content, model: input.model, usage: data.usage ?? null } };
}

async function completeGemini(input: CompletionInput): Promise<CompletionOutcome> {
  const url = `${GEMINI_BASE}/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    temperature: input.temperature,
  };
  if (/^gemini-3\./.test(input.model)) {
    // Gemini 3.x는 thinking을 끌 수 없고 thinking 토큰이 maxOutputTokens에 포함됩니다.
    // 잘린 JSON을 받지 않도록 한도만 넓히고, thinkingConfig는 보내지 않습니다(모델별 지원 편차).
    generationConfig.maxOutputTokens = Math.min(65_536, input.maxTokens * 3 + 1_024);
  } else {
    generationConfig.maxOutputTokens = input.maxTokens;
    // 2.5 Flash는 thinkingBudget 0으로 추론을 끌 수 있습니다(2.5 Flash-Lite는 기본 꺼짐).
    if (/^gemini-2\.5-flash(?!-lite)/.test(input.model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.user }] }],
      generationConfig,
    }),
    signal: input.signal,
  });

  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => "");
    let detail = raw.slice(0, 240);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed?.error?.message) detail = parsed.error.message.slice(0, 240);
    } catch {
      /* 원문 유지 */
    }
    const hint =
      upstream.status === 404
        ? "Gemini 모델을 사용할 수 없습니다. GEMINI_MODEL을 확인하세요."
        : upstream.status === 400 || upstream.status === 401 || upstream.status === 403
          ? "Gemini API 키나 요청이 거부되었습니다."
          : upstream.status === 429
            ? "Gemini 요청 한도에 걸렸습니다. 잠시 후 다시 시도하세요."
            : "AI 제공자 응답 오류입니다.";
    return { ok: false, status: upstream.status, error: "upstream_error", message: `${hint} ${detail}`.trim() };
  }

  const data = (await upstream.json()) as GeminiResponse;
  const content = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => part.thought !== true)
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!content) {
    const reason = data.candidates?.[0]?.finishReason;
    return {
      ok: false,
      status: 502,
      error: "empty_completion",
      message: reason ? `Gemini가 응답을 만들지 못했습니다 (${reason}).` : "AI가 빈 응답을 보냈습니다.",
    };
  }
  const usage = data.usageMetadata
    ? {
        prompt_tokens: data.usageMetadata.promptTokenCount ?? 0,
        completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
        total_tokens: data.usageMetadata.totalTokenCount ?? 0,
      }
    : null;
  return { ok: true, value: { content, model: input.model, usage } };
}

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");
}

function headerValue(req: VercelRequest, name: string): string {
  const raw = req.headers[name] ?? req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0]?.trim() ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

function sanitizeContext(raw: unknown): AnalyzeContext {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  return {
    industryLabel: clean(r.industryLabel, 60) || undefined,
    issueLabel: clean(r.issueLabel, 60) || undefined,
    channelLabels: cleanList(r.channelLabels, 6, 40),
    stance: clean(r.stance, 600) || undefined,
    regulators: cleanList(r.regulators, 4, 120),
    laws: cleanList(r.laws, 4, 160),
    banned: cleanList(r.banned, 6, 160),
    timeline: Array.isArray(r.timeline)
      ? r.timeline.slice(0, 4).map((t) => {
          const row = (t ?? {}) as Record<string, unknown>;
          return {
            window: clean(row.window, 20),
            title: clean(row.title, 80),
            items: cleanList(row.items, 6, 200),
          };
        })
      : [],
    required: cleanList(r.required, 6, 200),
    missing: cleanList(r.missing, 8, 160),
    riskyPhrases: cleanList(r.riskyPhrases, 8, 120),
    score: typeof r.score === "number" && r.score >= 0 && r.score <= 100 ? Math.round(r.score) : undefined,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  const geminiEnvKey = (ENV.GEMINI_API_KEY ?? "").trim();
  const openaiEnvKey = (ENV.OPENAI_API_KEY ?? "").trim();
  const envProvider: Provider | null = geminiEnvKey ? "gemini" : openaiEnvKey ? "openai" : null;

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      model: envProvider === "gemini" ? GEMINI_MODEL : OPENAI_MODEL,
      provider: envProvider,
      serverKey: Boolean(envProvider),
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed", message: "POST 요청만 지원합니다." });
    return;
  }

  let body: AnalyzeRequest;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as AnalyzeRequest;
    if (!body || typeof body !== "object") throw new Error("empty");
  } catch {
    res.status(400).json({ error: "bad_request", message: "JSON 본문을 읽을 수 없습니다." });
    return;
  }

  const draft = clean(body.draft, MAX_DRAFT_CHARS + 1);
  if (typeof body.draft !== "string" || draft.length < MIN_DRAFT_CHARS) {
    res.status(400).json({
      error: "draft_too_short",
      message: `초안은 최소 ${MIN_DRAFT_CHARS}자 이상이어야 합니다.`,
    });
    return;
  }
  if (draft.length > MAX_DRAFT_CHARS) {
    res.status(413).json({
      error: "draft_too_long",
      message: `초안은 ${MAX_DRAFT_CHARS.toLocaleString("en-US")}자까지 분석할 수 있습니다.`,
    });
    return;
  }

  const headerKey = headerValue(req, "x-api-key");
  const bodyKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const requestKey = headerKey || bodyKey;
  // 서버 키가 1순위. 서버 키가 없을 때만 요청의 개인 키를 쓰고, 키 앞자리로 제공자를 가릅니다.
  const geminiKey = geminiEnvKey || (requestKey && isGeminiKey(requestKey) ? requestKey : "");
  const openaiKey = openaiEnvKey || (requestKey && !isGeminiKey(requestKey) ? requestKey : "");
  const provider: Provider | null = geminiKey ? "gemini" : openaiKey ? "openai" : null;
  const apiKey = geminiKey || openaiKey;
  if (!provider) {
    res.status(501).json({
      error: "no_key",
      message:
        "서버에 GEMINI_API_KEY나 OPENAI_API_KEY가 설정되지 않았습니다. 배포 환경변수를 추가하거나 설정에서 개인 키(Gemini 또는 sk-…)를 입력하세요.",
    });
    return;
  }
  const model = provider === "gemini" ? GEMINI_MODEL : OPENAI_MODEL;

  const industryId = typeof body.industry === "string" && ALLOWED_INDUSTRIES.includes(body.industry) ? body.industry : "tech";
  const issueId = typeof body.issue === "string" && ALLOWED_ISSUES.includes(body.issue) ? body.issue : "service-outage";
  const channels = Array.isArray(body.channels)
    ? body.channels.filter((c): c is string => typeof c === "string" && ALLOWED_CHANNELS.includes(c)).slice(0, 6)
    : [];
  const brand = clean(body.brand, 60) || "당사";
  const context = sanitizeContext(body.context);

  const userPrompt = buildUserPrompt({
    brand,
    industry: industryId,
    issue: issueId,
    channels,
    draft,
    context,
  });

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const outcome =
      provider === "gemini"
        ? await completeGemini({ apiKey, model, system: SYSTEM_PROMPT, user: userPrompt, maxTokens: 4096, temperature: 0.4, signal: controller.signal })
        : await completeOpenAI({ apiKey, model, system: SYSTEM_PROMPT, user: userPrompt, maxTokens: 4096, temperature: 0.35, signal: controller.signal });
    if (!outcome.ok) {
      res.status(502).json({ error: outcome.error, status: outcome.status, message: outcome.message });
      return;
    }

    const content = outcome.value.content;
    let result: unknown;
    try {
      result = JSON.parse(content.replace(/^```(?:json)?/i, "").replace(/```$/g, "").trim());
    } catch {
      res.status(502).json({ error: "bad_json", message: "AI 응답을 JSON으로 해석하지 못했습니다." });
      return;
    }

    res.status(200).json({
      ok: true,
      provider,
      model: outcome.value.model,
      latencyMs: Date.now() - startedAt,
      usage: outcome.value.usage,
      result,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    res.status(aborted ? 504 : 502).json({
      error: aborted ? "timeout" : "upstream_unreachable",
      message: aborted
        ? "AI 응답이 제한 시간을 넘겼습니다. 초안을 줄이거나 잠시 후 다시 시도하세요."
        : "AI 제공자에 연결하지 못했습니다.",
    });
  } finally {
    clearTimeout(timer);
  }
}
