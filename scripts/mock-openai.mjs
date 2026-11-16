/**
 * 검증용 OpenAI 모의 서버. 실제 API를 호출하지 않고 스키마에 맞는 응답을 돌려줍니다.
 * OPENAI_BASE_URL=http://127.0.0.1:4191/v1 로 두면 api/analyze.ts가 이 서버를 봅니다.
 */
import http from "node:http";
import { buildPackageResult, REVIEW_RESULT } from "./mock-result.mjs";

const port = Number(process.env.PORT || 4191);

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
    const messages = parsed.messages || [];
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const user = messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n");
    const result = system.includes("입장문을 감수") ? REVIEW_RESULT : buildPackageResult(user);

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        model: parsed.model || "gpt-4o-mini",
        choices: [{ message: { content: JSON.stringify(result) } }],
        usage: { prompt_tokens: 1800, completion_tokens: 1400, total_tokens: 3200 },
      }),
    );
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[mock-openai] http://127.0.0.1:${port}/v1`);
});
