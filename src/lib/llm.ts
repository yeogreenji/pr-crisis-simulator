import type { Analysis, FactCheck, Headline, LlmConfig } from "../types";
import { getChannel } from "./presets";

const SYSTEM_PROMPT = `당신은 한국 기업의 위기 커뮤니케이션을 검토하는 수석 PR 전략가입니다.
초안을 기자·이용자 관점에서 냉정하게 비판하고, 실제 언론에 나갈 법한 헤드라인과 취재 질문을 만듭니다.
과장하지 말고, 초안에 없는 사실을 만들어내지 마세요. 확인이 필요한 값은 [확인 필요]로 표기하세요.
반드시 아래 JSON 형식만 출력합니다.

{
  "score": 0~100 정수,
  "comment": "초안의 가장 큰 문제를 한 문장으로",
  "headlines": [{"tone": "critical"|"positive", "text": "헤드라인", "note": "왜 이 제목이 성립하는지 한 줄"}],
  "factChecks": [{"question": "기자가 물을 질문", "why": "왜 이 질문이 나오는지"}]
}`;

function buildPrompt(a: Analysis): string {
  const channels = a.channels.map((c) => getChannel(c).label).join(", ");
  return `브랜드: ${a.brand}
이슈 유형: ${a.issueLabel}
타깃 채널: ${channels}
내장 엔진 점수: ${a.score}/100 (${a.grade.label})
감지된 위험 문장: ${a.spans.map((s) => `"${s.text}"(${s.label})`).join(", ") || "없음"}

[초안]
${a.text}

비판 헤드라인 3개, 긍정 프레임 헤드라인 2개, 날카로운 팩트체크 질문 4개를 만들어 주세요.`;
}

async function callOpenAI(config: LlmConfig, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI 응답 오류 (${res.status})`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("응답 본문이 비어 있습니다");
  return text;
}

async function callAnthropic(config: LlmConfig, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model || "claude-3-5-haiku-latest",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic 응답 오류 (${res.status})`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("응답 본문이 비어 있습니다");
  return text;
}

interface LlmPayload {
  score?: number;
  comment?: string;
  headlines?: { tone?: string; text?: string; note?: string }[];
  factChecks?: { question?: string; why?: string }[];
}

const parseJson = (raw: string): LlmPayload => {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned) as LlmPayload;
};

export interface LlmEnrichment {
  score?: number;
  comment?: string;
  headlines: Headline[];
  factChecks: FactCheck[];
}

export async function enrichWithLlm(config: LlmConfig, analysis: Analysis): Promise<LlmEnrichment> {
  const prompt = buildPrompt(analysis);
  const raw = config.provider === "anthropic" ? await callAnthropic(config, prompt) : await callOpenAI(config, prompt);
  const payload = parseJson(raw);

  const headlines: Headline[] = (payload.headlines ?? [])
    .filter((h) => typeof h?.text === "string" && h.text.trim().length > 4)
    .slice(0, 6)
    .map((h) => ({
      tone: h.tone === "positive" ? "positive" : "critical",
      outlet: "LLM 정밀 분석",
      text: h.text!.trim(),
      note: (h.note ?? "LLM이 제안한 각도입니다.").trim(),
    }));

  const factChecks: FactCheck[] = (payload.factChecks ?? [])
    .filter((f) => typeof f?.question === "string" && f.question.trim().length > 4)
    .slice(0, 6)
    .map((f, i) => ({
      question: f.question!.trim(),
      why: (f.why ?? "후속 취재에서 확인이 필요한 항목입니다.").trim(),
      severity: i < 2 ? 3 : 2,
    }));

  return {
    score: typeof payload.score === "number" && payload.score >= 0 && payload.score <= 100 ? payload.score : undefined,
    comment: typeof payload.comment === "string" ? payload.comment : undefined,
    headlines,
    factChecks,
  };
}

export async function testLlmConnection(config: LlmConfig): Promise<string> {
  if (!config.apiKey.trim()) throw new Error("API 키가 비어 있습니다");
  const ping = "연결 확인입니다. JSON으로 {\"ok\":true} 만 출력하세요.";
  const raw = config.provider === "anthropic" ? await callAnthropic(config, ping) : await callOpenAI(config, ping);
  return raw.slice(0, 120);
}
