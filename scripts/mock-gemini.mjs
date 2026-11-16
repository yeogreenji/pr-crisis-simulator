/**
 * 검증용 Google Gemini 모의 서버.
 * GEMINI_BASE_URL=http://127.0.0.1:4196 로 두면 api/analyze.ts가
 * /v1beta/models/{model}:generateContent?key=<Gemini 키> 로 이 서버를 봅니다.
 *
 * 시스템 프롬프트가 '입장문을 감수'이면 검수 결과를, 아니면 대응 패키지 결과를 돌려줍니다.
 * MOCK_CAPTURE=/path.json 을 주면 마지막 요청 본문(모델·generationConfig·프롬프트)을 남깁니다.
 */
import http from "node:http";
import { writeFileSync } from "node:fs";
import { buildPackageResult, REVIEW_RESULT } from "./mock-result.mjs";

const port = Number(process.env.PORT || 4196);
const capture = process.env.MOCK_CAPTURE || "";

const send = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  if (req.method !== "POST" || !url.pathname.includes(":generateContent")) {
    send(res, 404, { error: { message: "not a generateContent request" } });
    return;
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
  });
  req.on("end", () => {
    const key = url.searchParams.get("key") || "";
    if (!key || key.startsWith("sk-")) {
      send(res, 400, { error: { message: "API key not valid. Please pass a valid API key." } });
      return;
    }
    if (process.env.MOCK_FAIL === "1") {
      send(res, 500, { error: { message: "mock gemini upstream failure" } });
      return;
    }

    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const model = decodeURIComponent((url.pathname.split("/models/")[1] || "").split(":")[0]);
    const system = (body.systemInstruction?.parts || []).map((p) => p.text || "").join("\n");
    const user = (body.contents || []).map((c) => (c.parts || []).map((p) => p.text || "").join("\n")).join("\n");
    const result = system.includes("입장문을 감수") ? REVIEW_RESULT : buildPackageResult(user);

    if (capture) {
      writeFileSync(
        capture,
        JSON.stringify({ model, key: key.slice(0, 8), system, user, body }, null, 2),
        "utf-8",
      );
    }

    send(res, 200, {
      candidates: [
        {
          content: { parts: [{ text: JSON.stringify(result) }], role: "model" },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { promptTokenCount: 1800, candidatesTokenCount: 1400, totalTokenCount: 3200 },
      modelVersion: model,
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[mock-gemini] http://127.0.0.1:${port}/v1beta`);
});
