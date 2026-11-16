/**
 * 검증용 로컬 서버: dist 정적 파일 + /api/analyze 서버리스 핸들러를 한 프로세스로 띄웁니다.
 * Vercel에 배포되는 api/analyze.ts를 esbuild로 번들한 결과를 그대로 사용합니다.
 *
 * 사용:
 *   npx esbuild api/analyze.ts --bundle --format=esm --platform=node --outfile=.tmp/analyze.mjs
 *   PORT=4190 OPENAI_API_KEY=test OPENAI_BASE_URL=http://127.0.0.1:4191/v1 node scripts/serve-ai.mjs
 */
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const handler = (await import(process.env.ANALYZE_BUNDLE || "../.tmp/analyze.mjs")).default;
const port = Number(process.env.PORT || 4190);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) req.destroy();
    });
    req.on("end", () => resolve(raw));
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/api/analyze") {
    const adapter = {
      status(code) {
        res.statusCode = code;
        return adapter;
      },
      json(body) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(body));
      },
      setHeader(name, value) {
        res.setHeader(name, value);
      },
      end(chunk) {
        res.end(chunk);
      },
    };
    const body = req.method === "POST" ? await readBody(req) : undefined;
    try {
      await handler({ method: req.method, headers: req.headers, body }, adapter);
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "harness_error", message: String(error) }));
    }
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("<!doctype html><title>404</title>not found");
    return;
  }

  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, rel);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
  res.setHeader("Content-Type", MIME[extname(file)] || "application/octet-stream");
  createReadStream(file).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[serve-ai] http://127.0.0.1:${port}  key=${process.env.OPENAI_API_KEY ? "set" : "none"}`);
});
