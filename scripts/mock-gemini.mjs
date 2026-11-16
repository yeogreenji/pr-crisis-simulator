/**
 * 검증용 Google Gemini 모의 서버.
 * GEMINI_BASE_URL=http://127.0.0.1:4196 로 두면 api/analyze.ts가
 * /v1beta/models/{model}:generateContent?key=<Gemini 키> 를 이 서버로 보냅니다.
 *
 * 실제 API를 호출하지 않고 같은 모의 산출물(scripts/mock-result.mjs)을 Gemini 응답 모양으로 돌려줍니다.
 * MOCK_CAPTURE=/path.json 을 주면 마지막 요청 본문(모델·generationConfig)을 그 파일에 남겨 계약을 검증할 수 있습니다.
 */
import http from "node:http";
import { writeFileSync } from "node:fs";
import { RESULT } from "./mock-result.mjs";

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
    // Gemini 키는 AIza…·AQ.… 등으로 발급됩니다. OpenAI 키(sk-)나 빈 값만 거부합니다.
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
    if (capture) {
      writeFileSync(
        capture,
        JSON.stringify({ model, key: key.slice(0, 8), body }, null, 2),
        "utf-8",
      );
    }

    send(res, 200, {
      candidates: [
        {
          content: { parts: [{ text: JSON.stringify(RESULT) }], role: "model" },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 900, totalTokenCount: 2100 },
      modelVersion: model,
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[mock-gemini] http://127.0.0.1:${port}/v1beta`);
});
