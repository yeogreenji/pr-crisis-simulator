/**
 * 검증용 기사 페이지 서버.
 * api/analyze.ts가 실제로 URL을 읽어 <title>·meta description·본문을 추출하는지 확인합니다.
 *   GET /article/recall  → 정상 기사 (article 태그 + 문단 6개)
 *   GET /article/empty   → 스크립트 렌더링 페이지처럼 본문이 거의 없음
 *   GET /article/slow    → 15초 지연(타임아웃 확인용)
 */
import http from "node:http";

const port = Number(process.env.PORT || 4199);

const ARTICLE = `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<title>모의 기사 — 냉동만두 이물질 논란 확산</title>
<meta property="og:title" content="모의 기사 — 냉동만두 이물질 논란 확산">
<meta property="og:description" content="소비자 커뮤니티에 이물질 사진이 확산되며 회수 범위 문의가 이어지고 있다.">
<meta name="description" content="소비자 커뮤니티에 이물질 사진이 확산되며 회수 범위 문의가 이어지고 있다.">
<script>window.__BOOT__={}</script>
<style>.hidden{display:none}</style>
</head>
<body>
<header><nav>구독 로그인 전체메뉴</nav></header>
<article>
<h1>모의 기사 — 냉동만두 이물질 논란 확산</h1>
<p>소비자 커뮤니티를 중심으로 냉동만두에서 이물질이 나왔다는 사진이 확산되고 있다. 게시글은 하루 만에 수백 건의 댓글을 기록했다.</p>
<p>서버가 직접 읽은 기사 본문입니다. 제조사는 아직 공식 입장을 내지 않았고, 판매 채널은 정상 운영 중이라고 밝혔다.</p>
<p>소비자들은 제조번호와 유통기한을 확인할 수 있는 공지가 필요하다고 요구하고 있다. 회수 범위가 공개되지 않으면 불안이 커질 수 있다.</p>
<p>전문가들은 첫 6시간 안에 판매 중지 여부와 접수 창구를 밝히는 것이 신뢰 회복의 출발점이라고 말했다.</p>
<p>제조사 관계자는 확인되는 대로 공식 채널을 통해 안내하겠다고 전했다. 다만 구체적인 일정은 밝히지 않았다.</p>
<p>해당 제품은 대형 마트와 온라인몰에서 판매되고 있어 영향 범위가 넓을 수 있다는 관측이 나온다.</p>
</article>
<footer>회사소개 이용약관 광고문의</footer>
</body></html>`;

const EMPTY = `<!doctype html><html><head><title>모의 빈 페이지</title></head><body><div id="root"></div><script>document.getElementById('root').innerHTML='...'</script></body></html>`;

/** 로그인·페이월 페이지처럼 본문은 없고 제목·요약(og)만 있는 경우 */
const PAYWALL = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<title>모의 유료 기사 — 서비스 장애 보상 논란</title>
<meta property="og:title" content="모의 유료 기사 — 서비스 장애 보상 논란">
<meta property="og:description" content="로그인 후 기사 전문을 볼 수 있습니다. 모의 서비스가 두 시간 멈추면서 보상 기준 논란이 커지고 있다는 요약입니다.">
</head><body><div id="paywall">구독자 전용 기사입니다. 로그인하세요.</div></body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/article/recall") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(ARTICLE);
    return;
  }
  if (url.pathname === "/article/paywall") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(PAYWALL);
    return;
  }
  if (url.pathname === "/article/empty") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(EMPTY);
    return;
  }
  if (url.pathname === "/article/slow") {
    setTimeout(() => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(ARTICLE);
    }, 15_000);
    return;
  }
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end("not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[mock-article] http://127.0.0.1:${port}/article/recall`);
});
