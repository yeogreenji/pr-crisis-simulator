#!/usr/bin/env python3
"""PRISM 대응 패키지 재설계 검증.

- api/analyze.ts를 esbuild로 번들한 실제 핸들러를 띄워 계약을 검증합니다(모의 Gemini·OpenAI·기사 서버).
- 데스크톱/모바일 Playwright로 원클릭 입력 → 5블록 패키지 → 복사 → URL 읽기 → 로컬 폴백을 확인합니다.

준비:
  export PATH=/workspace/.tools/node-v22.12.0-linux-x64/bin:$PATH
  npm run build
  node_modules/.bin/esbuild api/analyze.ts --bundle --format=esm --platform=node --outfile=.tmp/analyze.mjs

실행:
  python3 scripts/verify_package.py

이 작업 환경의 Chromium은 시스템 라이브러리를 따로 봐야 합니다:
  export LD_LIBRARY_PATH=/workspace/.libs/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"
TMP = ROOT / ".tmp"
NODE = os.environ.get("NODE_BIN", "node")

checks: list[tuple[str, bool, str]] = []
console_errors: list[str] = []


VERBOSE = os.environ.get("VERIFY_VERBOSE") == "1"
START = time.time()


def check(name: str, cond: bool, detail: str = "") -> None:
    checks.append((name, bool(cond), detail))
    if VERBOSE:
        mark = "PASS" if cond else "FAIL"
        print(f"[{mark}] {time.time() - START:6.1f}s {name}" + (f"  — {detail}" if detail and not cond else ""), flush=True)


def wait_port(port: int, timeout: float = 20.0) -> None:
    import socket

    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return
        except OSError:
            time.sleep(0.15)
    raise RuntimeError(f"port {port} did not open")


def spawn(script: str, port: int, extra_env: dict[str, str] | None = None) -> subprocess.Popen:
    env = {**os.environ, "PORT": str(port), **(extra_env or {})}
    log = open(TMP / f"{port}.log", "w")
    return subprocess.Popen([NODE, str(ROOT / "scripts" / script)], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)


def api(port: int, payload: dict | None = None, headers: dict | None = None) -> tuple[int, dict]:
    url = f"http://127.0.0.1:{port}/api/analyze"
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json", **(headers or {})},
        method="GET" if payload is None else "POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, json.loads(res.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") or "{}"
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, {"raw": body[:200]}


def attach(page) -> None:
    page.on(
        "console",
        lambda m: console_errors.append(f"[console:{m.type}] {m.text}")
        if m.type == "error" and "Failed to load resource" not in m.text
        else None,
    )
    page.on("pageerror", lambda e: console_errors.append(f"[pageerror] {e}"))


SITUATION = (
    "협력사 공장에서 납품한 원재료에서 기준치를 넘는 중금속이 검출됐다는 보도가 나갔습니다. "
    "완제품 3종에 이 원료를 썼고, 온라인 커뮤니티에 인증샷이 확산되고 있습니다."
)

DRAFT = (
    "한결푸드입니다.\n\n최근 일부 온라인 커뮤니티에서 당사 냉동만두 제품에서 이물질이 발견되었다는 글과 사진이 확산되고 있습니다.\n"
    "해당 제품은 단순한 포장 과정의 문제로, 제조 공정과는 무관한 것으로 파악하고 있습니다.\n"
    "현재 정확한 원인과 영향받은 제품 범위는 확인 중입니다.\n"
    "일부 제품에 한해 판매를 중단했으며, 전량 회수 여부는 내부 검토 후 안내드리겠습니다.\n"
    "이용자 여러분께 불편을 드려 죄송합니다.\n"
    "안전성에는 문제가 없으며, 다른 제품은 정상 판매 중입니다.\n"
    "재발 방지에 최선을 다하겠습니다. 감사합니다."
)

CASE_TITLE = "살충제 계란 파동"

CASE_TYPE_OPTIONS = [
    ("product-safety", "제품·식품 안전"),
    ("false-claim", "허위·과장·조작"),
    ("data-breach", "개인정보·보안"),
    ("outage", "서비스 장애"),
    ("industrial-accident", "산업재해·사고"),
    ("disaster", "재난·자연재해"),
    ("owner-risk", "오너·경영진 리스크"),
    ("labor", "노사·고용"),
    ("celebrity", "연예·인물"),
    ("financial", "정산·횡령·금융"),
    ("governance", "경영권·지배구조"),
    ("misconduct", "부정·비위"),
    ("statement", "발언·광고 논란"),
    ("environment", "환경·주민"),
    ("regulatory", "규제·제재"),
  ("pricing", "가격·요금 인상"),
]

AIRLINE_PET = (
    "항공사 기내 위탁 운송 중 반려동물이 숨지는 사고가 발생했습니다. "
    "보호자가 항공사 고객센터에 항의했고 커뮤니티에 글이 확산되고 있습니다."
)

IMPORT_CASE = {
    "id": "mock-import-2026",
    "industry": "tech",
    "type": "outage",
    "tags": ["장애", "복구"],
    "company": "모의수입",
    "country": "KR",
    "date": "2026-02",
    "title": "모의수입 — 가져오기 검증용 사례",
    "trigger": "모의 장애",
    "scale": [],
    "timeline": [{"when": "2026-02", "what": "모의 장애 발생"}],
    "response": ["모의 복구 공지"],
    "outcome": "모의 결과",
    "lesson": "모의 교훈",
    "verdict": "mixed",
    "sources": [{"label": "모의 출처", "url": "https://example.com/mock-import"}],
}

CUSTOM_CASE = {
    "id": "mock-air-pet-2026",
    "industry": "retail",
    "type": "product-safety",
    "stance": "apology",
    "tags": ["반려동물", "기내", "항공사"],
    "company": "모의항공",
    "country": "KR",
    "date": "2026-01",
    "title": "모의항공 반려동물 기내 사고 — 즉시 사과와 운송 중단",
    "trigger": "위탁 운송 중 반려동물 사망",
    "scale": ["모의 사례"],
    "timeline": [{"when": "2026-01", "what": "모의 사고 접수"}],
    "response": ["당일 대표 명의 사과", "전 노선 반려동물 위탁 운송 일시 중단", "원인 조사 외부 위탁"],
    "outcome": "모의 결과",
    "lesson": "모의 교훈 — 사고 당일 접수 창구와 재발방지 일정을 함께 공개한다.",
    "verdict": "mixed",
    "sources": [{"label": "모의 출처", "url": "https://example.com/mock-air-pet"}],
}


def make_package_payload(stance="apology", entities=None, situation=SITUATION) -> dict:
    return {
        "mode": "package",
        "situation": situation,
        "stance": stance,
        "brand": "한결푸드",
        "entities": entities or ["consumer"],
    }


def launch_page(p, **context_kwargs):
    """이 작업 환경은 메모리가 좁아 Chromium renderer가 간헐적으로 죽습니다. 3회까지 다시 띄웁니다."""
    last = None
    for _ in range(3):
        browser = None
        try:
            browser = p.chromium.launch(args=["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"])
            ctx = browser.new_context(**context_kwargs)
            page = ctx.new_page()
            return browser, ctx, page
        except Exception as exc:  # noqa: BLE001 - 재시도 후 마지막 오류를 올립니다
            last = exc
            try:
                if browser is not None:
                    browser.close()
            except Exception:
                pass
            time.sleep(1.5)
    raise last


def main() -> int:
    for path in (SHOTS, TMP):
        path.mkdir(parents=True, exist_ok=True)

    bundle = TMP / "analyze.mjs"
    esbuild = ROOT / "node_modules" / "esbuild" / "bin" / "esbuild"
    build = subprocess.run(
        [str(esbuild), "api/analyze.ts", "--bundle", "--format=esm", "--platform=node", "--target=node20", "--outfile=.tmp/analyze.mjs"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if build.returncode != 0:
        print("!! esbuild 실패:", build.stderr[:400])
        return 2
    if not bundle.exists():
        print("!! .tmp/analyze.mjs 번들을 만들지 못했습니다. esbuild를 확인하세요.")
        return 2

    procs: list[subprocess.Popen] = []
    servers: dict[int, subprocess.Popen] = {}

    def start(script: str, port: int, env: dict[str, str] | None = None) -> subprocess.Popen:
        proc = spawn(script, port, env)
        procs.append(proc)
        servers[port] = proc
        return proc

    try:
        start("mock-article.mjs", 4199)
        start("mock-gemini.mjs", 4196, {"MOCK_CAPTURE": str(TMP / "gemini-last.json")})
        start("mock-gemini.mjs", 4201, {"MOCK_503_TIMES": "1"})
        start("mock-gemini.mjs", 4202, {"MOCK_503_TIMES": "9"})
        start("mock-openai.mjs", 4191)
        start("mock-openai.mjs", 4193, {"MOCK_FAIL": "1"})
        start("serve-ai.mjs", 4190, {"OPENAI_API_KEY": "sk-test-harness", "OPENAI_BASE_URL": "http://127.0.0.1:4191/v1"})
        start("serve-ai.mjs", 4192, {"OPENAI_BASE_URL": "http://127.0.0.1:4191/v1"})
        start("serve-ai.mjs", 4194, {"OPENAI_API_KEY": "sk-test-harness", "OPENAI_BASE_URL": "http://127.0.0.1:4193/v1"})
        start(
            "serve-ai.mjs",
            4197,
            {"GEMINI_API_KEY": "AQ-test-harness-key", "GEMINI_BASE_URL": "http://127.0.0.1:4196", "PRISM_ALLOW_LOCAL_FETCH": "1"},
        )
        start(
            "serve-ai.mjs",
            4198,
            {"GEMINI_BASE_URL": "http://127.0.0.1:4196", "OPENAI_BASE_URL": "http://127.0.0.1:4191/v1", "PRISM_ALLOW_LOCAL_FETCH": "1"},
        )
        start(
            "serve-ai.mjs",
            4200,
            {"GEMINI_API_KEY": "AQ-test-harness-key", "GEMINI_BASE_URL": "http://127.0.0.1:4201", "PRISM_ALLOW_LOCAL_FETCH": "1"},
        )
        start(
            "serve-ai.mjs",
            4203,
            {"GEMINI_API_KEY": "AQ-test-harness-key", "GEMINI_BASE_URL": "http://127.0.0.1:4202", "PRISM_ALLOW_LOCAL_FETCH": "1"},
        )
        static = subprocess.Popen(
            [sys.executable, "-m", "http.server", "4195", "--bind", "127.0.0.1", "--directory", str(ROOT / "dist")],
            stdout=open(TMP / "static.log", "w"),
            stderr=subprocess.STDOUT,
        )
        procs.append(static)
        for port in (4190, 4191, 4192, 4193, 4194, 4195, 4196, 4197, 4198, 4199, 4200, 4201, 4202, 4203):
            wait_port(port)

        # ---------------- API 계약 ----------------
        status, body = api(4197)
        check(
            "API GET: Gemini 서버 상태·URL 읽기 지원",
            status == 200 and body.get("provider") == "gemini" and body.get("serverKey") is True and body.get("urlFetch") is True,
            f"{status} {body}",
        )

        status, body = api(4190)
        check(
            "API GET: OpenAI 경로 유지",
            status == 200 and body.get("provider") == "openai" and body.get("model") == "gpt-4o-mini",
            f"{status} {body}",
        )

        status, body = api(4197, make_package_payload())
        result = body.get("result") or {}
        check("API: 패키지 200", status == 200 and body.get("ok") is True, f"{status} {str(body)[:140]}")
        check(
            "API: 패키지 스키마(로드맵 3·액션 3·입장문 2·Q&A 5·금기 5)",
            len(result.get("roadmap", [])) == 3
            and len(result.get("actions", [])) == 3
            and len(result.get("statements", [])) == 2
            and len(result.get("qa", [])) == 5
            and len(result.get("banned", [])) == 5,
            f"roadmap={len(result.get('roadmap', []))} qa={len(result.get('qa', []))}",
        )

        captured = {}
        try:
            captured = json.loads((TMP / "gemini-last.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            captured = {}
        gen = (captured.get("body") or {}).get("generationConfig") or {}
        user_prompt = captured.get("user") or ""
        check(
            "Gemini 요청: JSON 모드·temperature 0.45·출력 한도",
            gen.get("responseMimeType") == "application/json" and gen.get("temperature") == 0.45 and gen.get("maxOutputTokens") == 7000 * 3 + 1024,
            json.dumps(gen, ensure_ascii=False)[:200],
        )
        check("Gemini 프롬프트: 상황·입장·유형 전달", "[우리 입장]" in user_prompt and "apology" in user_prompt and "소비재·식품" in user_prompt, user_prompt[:120])

        status, body = api(4197, make_package_payload(stance="rebuttal"))
        rebuttal_result = body.get("result") or {}
        check(
            "입장 반영: rebuttal 결과가 apology와 다름",
            status == 200 and "강경 반박" in str(rebuttal_result.get("headline", "")) and rebuttal_result.get("headline") != result.get("headline"),
            str(rebuttal_result.get("headline"))[:80],
        )

        status, body = api(4197, make_package_payload(stance="investigating", entities=["listed"]))
        listed_result = body.get("result") or {}
        prompt_after = ""
        try:
            prompt_after = json.loads((TMP / "gemini-last.json").read_text(encoding="utf-8")).get("user") or ""
        except (OSError, json.JSONDecodeError):
            prompt_after = ""
        check(
            "유형 반영: 상장사 선택 시 자본시장법·공시 절차 지시",
            "거래소 조회공시" in prompt_after and "자본시장법" in prompt_after and "블랙아웃" in prompt_after,
            prompt_after[-600:][:200],
        )
        check("유형 반영: 결과 라벨이 상장사", "상장사" in str(listed_result.get("headline", "")), str(listed_result.get("headline"))[:60])

        # 짧은 키워드 + 가격 인상 유형: 쟁점 확장 지침이 프롬프트에 들어가는지
        status, body = api(
            4197,
            {
                "mode": "package",
                "situation": "가격 인상 이슈",
                "stance": "investigating",
                "brand": "모의구독",
                "entities": ["general"],
                "caseType": "pricing",
                "stage": "breaking",
                "scale": "mid",
            },
        )
        pricing_prompt = ""
        try:
            pricing_prompt = json.loads((TMP / "gemini-last.json").read_text(encoding="utf-8")).get("user") or ""
        except (OSError, json.JSONDecodeError):
            pricing_prompt = ""
        check(
            "가격 인상: 5자 키워드도 200 + 유형 지침·단계·규모 전달",
            status == 200
            and "[이슈 유형 — 가격·요금 인상]" in pricing_prompt
            and "인상 시점·폭·적용 대상·기존 고객 적용일" in pricing_prompt
            and "[현재 단계]" in pricing_prompt
            and "[기업 규모]" in pricing_prompt,
            f"{status} {pricing_prompt[:240]}",
        )
        check(
            "가격 인상: 짧은 입력이면 쟁점 5축 확장 지시",
            "[짧은 입력 — 쟁점 확장 필요]" in pricing_prompt and "소비자 반발" in pricing_prompt and "경쟁사" in pricing_prompt,
            pricing_prompt[:260],
        )
        check(
            "가격 인상: 관련 사례가 없으면 사례 창작 금지",
            "[유사 사례]\n관련도 기준을 넘는 사례가 없습니다" in pricing_prompt,
            pricing_prompt[-300:],
        )

        # URL 읽기
        status, body = api(4197, make_package_payload(situation="http://127.0.0.1:4199/article/recall"))
        source = body.get("source") or {}
        check(
            "URL: 서버가 기사 본문을 직접 읽음",
            status == 200 and source.get("ok") is True and source.get("chars", 0) > 300 and "모의 기사" in str(source.get("title", "")),
            f"{status} {source}",
        )
        fetched_prompt = ""
        try:
            fetched_prompt = json.loads((TMP / "gemini-last.json").read_text(encoding="utf-8")).get("user") or ""
        except (OSError, json.JSONDecodeError):
            fetched_prompt = ""
        check(
            "URL: 읽은 본문이 프롬프트에 들어감",
            "서버가 직접 읽은 기사 본문" in fetched_prompt and "제조번호" in fetched_prompt,
            fetched_prompt[:160],
        )
        check("URL: 결과에 기사 반영 표시", "기사 원문 반영" in str((body.get("result") or {}).get("headline", "")), "")

        status, body = api(4197, make_package_payload(situation="http://127.0.0.1:4199/article/empty"))
        check(
            "URL: 본문을 못 읽으면 422 fetch_failed + 안내",
            status == 422 and body.get("error") == "fetch_failed" and "붙여넣" in str(body.get("message", "")),
            f"{status} {str(body)[:160]}",
        )

        status, body = api(4190, make_package_payload(situation="http://127.0.0.1:4199/article/recall"))
        check(
            "URL: 사설망 주소는 차단(SSRF)",
            status == 422 and body.get("error") == "fetch_failed",
            f"{status} {str(body)[:120]}",
        )

        status, body = api(
            4197,
            make_package_payload(
                situation="http://127.0.0.1:4199/none 기사 내용을 직접 붙여넣은 설명입니다. 협력사 원료에서 중금속이 검출됐다는 보도가 나갔고 확산 중입니다."
            ),
        )
        check(
            "URL: 읽기 실패해도 설명이 충분하면 분석 계속",
            status == 200 and (body.get("source") or {}).get("ok") is False,
            f"{status} {body.get('source')}",
        )

        # 사례 초안 모드
        status, body = api(4197, {"mode": "case", "situation": "http://127.0.0.1:4199/article/recall"})
        case_raw = body.get("result") or {}
        case_prompt = json.loads((TMP / "gemini-last.json").read_text(encoding="utf-8"))
        check(
            "API: 사례 초안 모드 200 — 스키마·기사 본문 전달",
            status == 200 and case_raw.get("company") == "모의식품" and "사례 카드 초안" in case_prompt.get("system", "") and "[기사 원문" in case_prompt.get("user", ""),
            f"{status} {str(body)[:140]}",
        )
        status, body = api(4197, {"mode": "case", "situation": "짧다"})
        check("API: 사례 초안 8자 미만 400", status == 400 and body.get("error") == "input_too_short", f"{status} {body.get('error')}")

        # 검수 모드
        status, body = api(4197, {"mode": "review", "draft": DRAFT, "brand": "한결푸드"})
        review_raw = body.get("result") or {}
        check(
            "API: 검수 모드 200 — 점수·지적·리라이트",
            status == 200 and isinstance(review_raw.get("score"), int) and len(review_raw.get("findings", [])) >= 3 and "모의 리라이트" in str(review_raw.get("rewrite", "")),
            f"{status} {str(review_raw)[:120]}",
        )

        status, body = api(4192, make_package_payload())
        check("API: 서버 키 없음 501 no_key", status == 501 and body.get("error") == "no_key", f"{status} {body.get('error')}")

        status, body = api(4194, make_package_payload())
        check("API: 제공자 5xx → 502", status == 502 and body.get("error") == "upstream_error", f"{status} {body.get('error')}")

        # Gemini 503 재시도
        status, body = api(4200, make_package_payload())
        check(
            "API: Gemini 503 → 짧은 백오프 1회 재시도 후 200",
            status == 200 and body.get("ok") is True and body.get("attempts") == 2 and body.get("provider") == "gemini",
            f"{status} attempts={body.get('attempts')} {str(body)[:120]}",
        )
        status, body = api(4203, make_package_payload())
        check(
            "API: 503 지속 시 502 + '자동 재시도' 안내(무한 재시도 없음)",
            status == 502 and body.get("attempts") == 2 and "자동 재시도" in str(body.get("message", "")),
            f"{status} attempts={body.get('attempts')} {str(body.get('message'))[:100]}",
        )

        status, body = api(4197, {"mode": "package", "situation": "짧음", "stance": "apology"})
        check("API: 4자 미만 400", status == 400 and body.get("error") == "input_too_short", f"{status} {body.get('error')}")

        status, body = api(4197, {"mode": "review", "draft": "짧음"})
        check("API: 검수 20자 미만 400", status == 400 and body.get("error") == "input_too_short", f"{status} {body.get('error')}")

        status, body = api(4197, {"mode": "package", "situation": "가" * 8001, "stance": "apology"})
        check("API: 8,000자 초과 413", status == 413 and body.get("error") == "input_too_long", f"{status} {body.get('error')}")

        status, body = api(4198, {**make_package_payload(), "apiKey": "AQ.real-user-gemini-key-0001"})
        check("API: 개인 AQ. 키 → Gemini", status == 200 and body.get("provider") == "gemini", f"{status} {body.get('provider')}")

        status, body = api(4198, {**make_package_payload(), "apiKey": "sk-personal-key"})
        check("API: 개인 sk- 키 → OpenAI 호환", status == 200 and body.get("provider") == "openai", f"{status} {body.get('provider')}")

        # 브라우저 단계 전에 API 전용 서버를 내려 프로세스/스레드 한도를 확보합니다.
        for port in (4190, 4191, 4192, 4193, 4194, 4198, 4200, 4201, 4202, 4203):
            proc = servers.pop(port, None)
            if proc is not None:
                proc.terminate()
        time.sleep(0.5)

        # ---------------- 데스크톱: 실시간 AI ----------------
        with sync_playwright() as p:
            browser, ctx, page = launch_page(
                p,
                viewport={"width": 1440, "height": 980},
                locale="ko-KR",
                permissions=["clipboard-read", "clipboard-write"],
            )
            attach(page)
            page.goto("http://127.0.0.1:4197/", wait_until="networkidle")
            page.wait_for_timeout(500)

            check("첫 화면: 단일 입력 카드", page.locator("[data-testid='situation-input']").count() == 1)
            check("첫 화면: 입장 3개", page.locator("[data-testid^='stance-']").count() == 3)
            check("첫 화면: 유형 칩 6개", page.locator("[data-testid^='entity-']").count() == 6)
            check(
                "첫 화면: 업종·이슈 유형 기본값이 '자동 판별'",
                page.input_value("[data-testid='industry-select']") == "auto"
                and page.input_value("[data-testid='type-select']") == "auto"
                and page.locator("[data-testid='industry-select'] option").count() == 9
                and page.locator("[data-testid='type-select'] option").count() == 17,
                f"industry={page.input_value('[data-testid=industry-select]')} type={page.input_value('[data-testid=type-select]')}",
            )
            check("첫 화면: 빈 입력이면 버튼 비활성", page.locator("[data-testid='submit']").is_disabled())
            page.screenshot(path=str(SHOTS / "31-compose-desktop.png"))

            page.click("button:has-text('AI 설정')")
            page.wait_for_timeout(900)
            check("설정 모달: 서버 키 연결됨", "서버 키 연결됨" in page.inner_text("body"))
            page.get_by_role("button", name="취소").click()
            page.wait_for_timeout(250)

            page.fill("[data-testid='situation-input']", SITUATION)
            page.click("[data-testid='stance-apology']")
            page.click("[data-testid='entity-consumer']")
            page.fill("input[aria-label='브랜드명']", "한결푸드")
            page.click("[data-testid='submit']")
            page.wait_for_selector("[data-testid='package-view']", timeout=40000)
            page.wait_for_timeout(400)

            body_text = page.locator("[data-testid='package-view']").inner_text()
            check("결과: 5개 블록 + 전체 시스템", all(page.locator(f"[data-testid='{k}']").count() == 1 for k in ["overview", "block-actions", "block-statements", "block-qa", "block-stakeholders", "block-outlook"]))
            check("결과: 위험도·입장·유형 칩", "위험도 높음" in body_text and "즉시 사과" in body_text and "소비재" in body_text)
            check("결과: 유사 사례 06·대응 순서 07 동시 출력", page.locator("[data-testid='block-similar']").count() == 1 and page.locator("[data-testid='block-playbook']").count() == 1)
            check("결과: 유사 사례에 자동 판별 유형 표시", "자동 판별" in page.locator("[data-testid='block-similar']").inner_text())
            check("결과: 유사 사례 대응 순서 블록", page.locator("[data-testid='block-playbook']").count() == 1 and page.locator("[data-testid^='playbook-phase-']").count() >= 3, str(page.locator("[data-testid^='playbook-phase-']").count()))
            check("결과: 대응 순서에 근거 사례 표시", "건에서 실행" in page.locator("[data-testid='block-playbook']").inner_text())
            check("결과: 실시간 AI 표시", "실시간 AI" in body_text)
            check("결과: 입장문 2종", page.locator("[data-testid^='statement-body-']").count() == 2)
            check("결과: Q&A 5개 이상", page.locator("[data-testid='qa-item']").count() >= 5, str(page.locator("[data-testid='qa-item']").count()))
            check("결과: 유관기관 4곳 이상", page.locator("[data-testid='block-stakeholders']").inner_text().count("모의") >= 4)
            check("결과: 악화 트리거·다음 대응", "모의 트리거" in page.locator("[data-testid='block-outlook']").inner_text())

            # ── 직접 등록 사례가 AI 프롬프트로 전달되는지 ──
            page.evaluate("c => localStorage.setItem('prism.cases.custom.v1', JSON.stringify([c]))", CUSTOM_CASE)
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(600)
            page.fill("[data-testid='situation-input']", AIRLINE_PET)
            page.select_option("[data-testid='industry-select']", "retail")
            page.select_option("[data-testid='type-select']", "product-safety")
            page.fill("input[aria-label='브랜드명']", "모의항공")
            page.click("[data-testid='submit']")
            page.wait_for_selector("[data-testid='package-view']", timeout=40000)
            page.wait_for_timeout(400)
            airline_text = page.locator("[data-testid='package-view']").inner_text()
            check("직접 선택: 업종·유형 칩에 '직접 선택' 표시", "직접 선택" in airline_text and "유통·물류·이커머스" in airline_text and "제품·식품 안전" in airline_text)
            check("직접 선택: 06·07 블록 유지", page.locator("[data-testid='block-similar']").count() == 1 and page.locator("[data-testid='block-playbook']").count() == 1)
            try:
                captured = json.loads((TMP / "gemini-last.json").read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                captured = {}
            prompt = captured.get("user") or ""
            check("AI 프롬프트: 직접 등록 사례 제목·교훈 포함", "[유사 사례" in prompt and "모의항공" in prompt and "모의 교훈" in prompt, prompt[-500:][:220])
            check("AI 프롬프트: 직접 고른 업종·이슈 유형 전달", "[업종]\n유통·물류·이커머스" in prompt and "[이슈 유형]\n제품·식품 안전" in prompt, prompt[:260])
            page.screenshot(path=str(SHOTS / "38-manual-select.png"))

            # ── 자동 판별: 항공사 반려동물 사고가 철강/중대재해로 가지 않는지 ──
            page.click("button:has-text('새 상황')")
            page.wait_for_timeout(300)
            page.select_option("[data-testid='industry-select']", "auto")
            page.select_option("[data-testid='type-select']", "auto")
            page.fill("[data-testid='situation-input']", AIRLINE_PET)
            page.click("[data-testid='submit']")
            page.wait_for_selector("[data-testid='package-view']", timeout=40000)
            page.wait_for_timeout(300)
            auto_text = page.locator("[data-testid='package-view']").inner_text()
            check(
                "자동 판별: 항공·반려동물 사고 → 유통·물류 + 제품·식품 안전",
                "유통·물류·이커머스" in auto_text and "제품·식품 안전" in auto_text and "직접 선택" not in auto_text,
                auto_text[:220],
            )
            check("자동 판별: 철강·중대재해 오분류 없음", "철강·제조·중공업" not in auto_text and "중대재해·산업재해" not in auto_text, auto_text[:220])
            check("자동 판별: 06·07 블록 유지", page.locator("[data-testid='block-similar']").count() == 1 and page.locator("[data-testid='block-playbook']").count() == 1)

            page.click("[data-testid='statement-public'] button:has-text('이 입장문 복사')")
            page.wait_for_timeout(400)
            clip = page.evaluate("navigator.clipboard.readText()")
            check("복사: 입장문 원클릭", "모의 고객 공지" in clip and len(clip) > 200, clip[:60])

            page.click("[data-testid='qa-item']:nth-child(2) button")
            page.wait_for_timeout(200)
            page.click("[data-testid='qa-item']:nth-child(2) button:has-text('답변 복사')")
            page.wait_for_timeout(300)
            clip = page.evaluate("navigator.clipboard.readText()")
            check("복사: Q&A 답변", "확인된 피해" in clip, clip[:60])

            page.click("[data-testid='copy-all']")
            page.wait_for_timeout(300)
            clip = page.evaluate("navigator.clipboard.readText()")
            check("복사: 패키지 전체", "PRISM 대응 패키지" in clip and "전체 대응 시스템" in clip and "유관기관" in clip, str(len(clip)))
            page.click("[data-testid='copy-markdown']")
            page.wait_for_timeout(300)
            md = page.evaluate("navigator.clipboard.readText()")
            check("복사: 팀 공유용 Markdown", md.startswith("# ") and "## 01. 골든타임 체크리스트" in md and "| 단계 | 목표 |" in md, md[:120])
            page.screenshot(path=str(SHOTS / "32-package-desktop.png"))

            page.locator("button:has-text('참고 매뉴얼')").first.click()
            page.wait_for_timeout(300)
            check("매뉴얼 모달: 3탭", page.get_by_text("상황 유형 매뉴얼").count() > 0 and page.get_by_text("업종 매뉴얼").count() > 0)
            page.click("[data-testid='manual-tab-cases']")
            page.wait_for_timeout(300)
            check("매뉴얼 모달: 사례 라이브러리 안내", "사례 라이브러리 열기" in page.inner_text("[data-testid='manual-modal']"))
            page.click("button:has-text('사례 라이브러리 열기')")
            page.wait_for_timeout(400)
            check("사례 라이브러리: 목록·검색", page.locator("[data-testid^='case-card-']").count() >= 20)
            page.fill("[data-testid='library-search']", CASE_TITLE[:6])
            page.wait_for_timeout(200)
            check("사례 라이브러리: 검색 필터", page.locator("[data-testid^='case-card-']").count() >= 1)
            page.locator("[data-testid^='case-card-']").first.click()
            page.wait_for_timeout(300)
            check("사례 라이브러리: 상세에 출처 표시", "출처" in page.inner_text("[data-testid='case-detail']"))
            page.click("[data-testid='open-studio']")
            page.wait_for_timeout(300)
            check("사례 등록: 화면 열림", page.locator("[data-testid='case-studio']").count() == 1)
            page.fill("[data-testid='studio-input']", "http://127.0.0.1:4199/article/recall")
            page.click("[data-testid='studio-draft']")
            page.wait_for_selector("[data-testid='studio-form']", timeout=30000)
            check("사례 등록: AI 초안이 폼에 채워짐", page.input_value("[data-testid='f-company']") == "모의식품" and "근거 부족" in page.inner_text("[data-testid='studio-form']"))
            check("사례 등록: 출처 URL이 입력한 주소로 고정", "127.0.0.1:4199/article/recall" in page.input_value("[data-testid='f-sources']"))
            check("사례 등록: 대조 확인 전 ‘검수 완료’ 저장 비활성", page.locator("[data-testid='f-save-verified']").is_disabled())
            page.check("[data-testid='f-confirm']")
            page.click("[data-testid='f-save-verified']")
            page.wait_for_timeout(300)
            check("사례 등록: 저장 후 내 목록에 표시", "원료 중금속 검출로 전량 회수" in page.inner_text("[data-testid='studio-mine']") and "검수 완료" in page.inner_text("[data-testid='studio-mine']"))

            page.click("[data-testid='studio-export-copy']")
            page.wait_for_timeout(400)
            exported = page.evaluate("navigator.clipboard.readText()")
            check("사례 JSON 내보내기: 등록 사례 포함", "모의식품" in exported and "product-safety" in exported, exported[:100])
            page.fill("[data-testid='studio-import']", json.dumps([IMPORT_CASE], ensure_ascii=False))
            page.click("[data-testid='studio-import-btn']")
            page.wait_for_timeout(500)
            studio_text = page.inner_text("[data-testid='case-studio']")
            check("사례 JSON 가져오기: 검토 대기 초안으로 추가", "모의수입" in studio_text and "검토 대기" in studio_text, studio_text[:160])
            page.click("[data-testid='studio-back']")
            page.wait_for_timeout(300)
            page.fill("[data-testid='library-search']", "모의식품")
            page.wait_for_timeout(200)
            check("사례 등록: 라이브러리에 즉시 반영", page.locator("[data-testid^='case-card-']").count() == 1)
            page.click("[data-testid='library-back']")
            page.wait_for_timeout(300)

            page.click("button:has-text('새 상황')")
            page.wait_for_timeout(300)
            check("최근 패키지 목록", page.get_by_text("최근 만든 패키지").count() > 0)
            page.locator("[data-testid='recent-item']").first.click()
            page.wait_for_timeout(600)
            check("최근 패키지 재열기", page.locator("[data-testid='package-view']").count() == 1)

            # URL만 넣는 흐름
            page.click("button:has-text('새 상황')")
            page.wait_for_timeout(300)
            page.fill("[data-testid='situation-input']", "http://127.0.0.1:4199/article/recall")
            page.click("[data-testid='submit']")
            page.wait_for_selector("[data-testid='package-view']", timeout=40000)
            page.wait_for_timeout(300)
            url_text = page.inner_text("[data-testid='package-view']")
            check("URL 흐름: 기사 원문 표시", "기사 원문" in url_text and "읽음" in url_text, url_text[:120])
            page.screenshot(path=str(SHOTS / "33-url-package.png"))

            # 읽기 실패 안내
            page.click("button:has-text('새 상황')")
            page.wait_for_timeout(300)
            page.fill("[data-testid='situation-input']", "http://127.0.0.1:4199/article/empty")
            page.click("[data-testid='submit']")
            page.wait_for_timeout(3500)
            check("URL 실패: 안내 후 입력 화면 유지", page.locator("[data-testid='situation-input']").count() == 1 and "붙여넣" in page.inner_text("body"))

            ctx.close()
            browser.close()

        # ---------------- 정적 배포(로컬 엔진) ----------------
        with sync_playwright() as p:
            browser, ctx, page = launch_page(
                p,
                viewport={"width": 1440, "height": 980},
                locale="ko-KR",
                permissions=["clipboard-read", "clipboard-write"],
            )
            attach(page)
            page.goto("http://127.0.0.1:4195/", wait_until="networkidle")
            page.wait_for_timeout(600)
            check("정적 모드: 매뉴얼 엔진 안내", "매뉴얼 엔진" in page.inner_text("body"))

            filled = False
            for attempt in range(3):
                try:
                    page.wait_for_selector("[data-testid='situation-input']", timeout=8000)
                    page.fill("[data-testid='situation-input']", SITUATION, timeout=8000)
                    filled = True
                    break
                except Exception:
                    if attempt == 2:
                        print("!! static page body:", page.inner_text("body")[:600].replace("\n", " | "))
                        print("!! console:", " / ".join(console_errors[-4:]))
                        page.screenshot(path=str(SHOTS / "static-fail.png"))
                        raise
                    page.reload(wait_until="networkidle")
                    page.wait_for_timeout(1200)
            check("정적 모드: 입력창 사용 가능", filled)
            page.click("[data-testid='stance-apology']")
            page.click("[data-testid='entity-consumer']")
            page.fill("input[aria-label='브랜드명']", "한결푸드")
            page.click("[data-testid='submit']")
            page.wait_for_selector("[data-testid='package-view']", timeout=15000)
            page.wait_for_timeout(300)
            apology_text = page.locator("[data-testid='statement-body-public']").inner_text()
            apology_actions = page.locator("[data-testid='block-actions']").inner_text()
            check("로컬: 사과 입장 문안", "사과드립니다" in apology_text and "섭취" in apology_text)
            check("로컬: 소비재 유형 반영(회수·로트)", "로트" in apology_actions or "제조번호" in apology_actions)
            check("로컬 모드 배지", "매뉴얼 엔진" in page.inner_text("[data-testid='package-view']"))

            page.click("button:has-text('새 상황')")
            page.wait_for_timeout(300)
            page.fill("[data-testid='situation-input']", "거래소 공시 전에 내부 직원이 자사주를 거래했다는 의혹 보도가 나갔습니다. 주가가 급락하고 있습니다.")
            page.click("[data-testid='stance-rebuttal']")
            page.click("[data-testid='entity-general']")
            page.click("[data-testid='entity-listed']")
            page.click("[data-testid='entity-platform']")
            page.fill("input[aria-label='브랜드명']", "모의상장사")
            page.click("[data-testid='submit']")
            page.wait_for_selector("[data-testid='package-view']", timeout=15000)
            page.wait_for_timeout(300)
            rebuttal_text = page.locator("[data-testid='statement-body-public']").inner_text()
            rebuttal_actions = page.locator("[data-testid='block-actions']").inner_text()
            stakeholders = page.locator("[data-testid='block-stakeholders']").inner_text()
            check("로컬: 반박 입장 문안이 사과와 다름", "사실과 다릅니다" in rebuttal_text and "사과드립니다" not in rebuttal_text, rebuttal_text[:80])
            check("로컬: 상장사 유형 반영", "거래소" in rebuttal_actions and "공시" in rebuttal_actions, rebuttal_actions[:80])
            check("로컬: 상장사 유관기관", "거래소" in stakeholders and "주주" in stakeholders, stakeholders[:80])
            merged_text = page.locator("[data-testid='statement-body-public']").inner_text()
            merged_actions = page.locator("[data-testid='block-actions']").inner_text()
            check("로컬: 보조 유형(IT·플랫폼)이 입장문에 반영", "개별 통지" in merged_text, merged_text[:80])
            check("로컬: 보조 유형이 유관기관에 반영", "개인정보보호위원회" in stakeholders or "개보위" in stakeholders, stakeholders[:120])
            check("로컬: 보조 유형이 체크리스트에 반영", "72시간" in merged_actions, merged_actions[:80])
            page.screenshot(path=str(SHOTS / "34-local-listed.png"))

            # 중대재해(사망) 사안 — 애도 문구·서명이 일반 사과문과 달라야 함
            page.click("button:has-text('새 상황')")
            page.wait_for_timeout(300)
            page.fill("[data-testid='situation-input']", "협력사 공장에서 근로자가 설비에 끼여 사망하는 사고가 발생했습니다. 노조가 진상 조사를 요구하고 있습니다.")
            page.click("[data-testid='stance-apology']")
            page.click("[data-testid='entity-general']")
            page.click("[data-testid='entity-labor']")
            page.fill("input[aria-label='브랜드명']", "모의제조")
            page.click("[data-testid='submit']")
            page.wait_for_selector("[data-testid='package-view']", timeout=15000)
            page.wait_for_timeout(300)
            grave_text = page.locator("[data-testid='statement-body-public']").inner_text()
            check("중대재해: 애도 문구·임직원 서명", "애도" in grave_text and "임직원 일동" in grave_text and "불편과 불안" not in grave_text, grave_text[:100])
            check("중대재해: 근로자 대상 라벨", "근로자·이해관계자" in page.locator("[data-testid='statement-public']").inner_text())

            # 검수 모드 (로컬)
            page.click("button:has-text('새 상황')")
            page.wait_for_timeout(300)
            page.click("button:has-text('기존 입장문 검수')")
            page.wait_for_timeout(200)
            page.fill("[data-testid='situation-input']", DRAFT)
            page.click("[data-testid='submit']")
            page.wait_for_selector("[data-testid='review-view']", timeout=15000)
            page.wait_for_timeout(300)
            findings_text = page.locator("[data-testid='review-findings']").inner_text()
            check("검수: 위험 표현 지적", "확인 중" in findings_text or "단순한" in findings_text, findings_text[:80])
            rewrite = page.locator("[data-testid='review-rewrite']").inner_text()
            check("검수: 리라이트가 초안을 실제로 고침", rewrite.strip() != DRAFT.strip() and "확인 중" not in rewrite and "[완료 시각]" in rewrite, rewrite[:100])
            page.screenshot(path=str(SHOTS / "35-review-local.png"))

            # 전 유형 06·07 블록 유지 (직접 선택)
            page.click("button:has-text('새 검수')")
            page.wait_for_timeout(250)
            type_failures: list[str] = []
            for index, (type_id, type_label) in enumerate(CASE_TYPE_OPTIONS):
                if index > 0:
                    page.click("button:has-text('새 상황')")
                    page.wait_for_timeout(150)
                page.select_option("[data-testid='type-select']", type_id)
                page.fill("[data-testid='situation-input']", f"{type_label} 위기 상황입니다. 담당자가 사실관계를 확인하고 있습니다.")
                page.click("[data-testid='submit']")
                page.wait_for_selector("[data-testid='package-view']", timeout=15000)
                page.wait_for_timeout(120)
                has_similar = page.locator("[data-testid='block-similar']").count() == 1
                has_playbook = page.locator("[data-testid='block-playbook']").count() == 1
                shown = type_label in page.locator("[data-testid='package-view']").inner_text()
                if not (has_similar and has_playbook and shown):
                    type_failures.append(f"{type_id}({type_label}): similar={has_similar} playbook={has_playbook} label={shown}")
            check("전 16개 유형: 06·07 블록(사례 또는 표준 프로토콜)과 선택 라벨 모두 표시", not type_failures, " / ".join(type_failures[:5]))

            # ── "가격 인상 이슈" 단독 입력: 엉뚱한 사례 없이 가격 매뉴얼 ──
            page.click("button:has-text('새 상황')")
            page.wait_for_timeout(250)
            page.select_option("[data-testid='industry-select']", "auto")
            page.select_option("[data-testid='type-select']", "auto")
            page.click("[data-testid='entity-general']")
            page.fill("[data-testid='situation-input']", "가격 인상 이슈")
            page.click("[data-testid='stance-investigating']")
            page.click("[data-testid='submit']")
            page.wait_for_selector("[data-testid='package-view']", timeout=15000)
            page.wait_for_timeout(300)
            pricing_text = page.locator("[data-testid='package-view']").inner_text()
            check(
                "가격 인상 단독 입력: 유형 자동 판별",
                "가격·요금 인상" in pricing_text and "가격 인상 —" in pricing_text,
                pricing_text[:220],
            )
            check(
                "가격 인상: 00 쟁점 확장에 기존 고객·언론 포인트",
                page.locator("[data-testid='block-issue-brief']").count() == 1
                and "기존 고객 vs 신규 고객" in page.locator("[data-testid='block-issue-brief']").inner_text()
                and "언론이 파고들 지점" in page.locator("[data-testid='block-issue-brief']").inner_text(),
                page.locator("[data-testid='block-issue-brief']").inner_text()[:200] if page.locator("[data-testid='block-issue-brief']").count() else "none",
            )
            pricing_actions = page.locator("[data-testid='block-actions']").inner_text()
            check(
                "가격 인상: 체크리스트가 인상 숫자·기존 고객 보호를 먼저",
                "시점·폭·대상·기존 고객 적용일" in pricing_actions and "기존 고객 보호" in pricing_actions and "해지" in pricing_actions,
                pricing_actions[:200],
            )
            pricing_stmt = page.locator("[data-testid='statement-body-public']").inner_text()
            check(
                "가격 인상: 입장문에 인상·기존 고객·해지 안내",
                "인상" in pricing_stmt and "기존" in pricing_stmt and "해지" in pricing_stmt,
                pricing_stmt[:200],
            )
            similar_text = page.locator("[data-testid='block-similar']").inner_text()
            similar_cards = page.locator("[data-testid^='similar-case-']").count()
            irrelevant = [w for w in ["산업재해", "연예·인물", "개인정보·보안", "노사·고용", "환경·주민", "규제·제재"] if w in similar_text]
            check(
                "가격 인상: 06에 무관 사례 0건(가격 사례만)",
                similar_cards >= 1 and not irrelevant and similar_text.count("가격·요금 인상") >= similar_cards,
                f"cards={similar_cards} irrelevant={irrelevant} {similar_text[:220]}",
            )
            check(
                "가격 인상: 07이 가격 유형 대응 순서",
                page.locator("[data-testid^='playbook-phase-']").count() >= 4
                and ("적용 시점·대상 확정" in page.locator("[data-testid='block-playbook']").inner_text()
                     or "표준 대응 순서" in page.locator("[data-testid='block-playbook']").inner_text()),
                str(page.locator("[data-testid^='playbook-phase-']").count()),
            )
            page.screenshot(path=str(SHOTS / "39-pricing-package.png"))

            # 모바일 390 (데스크톱 페이지를 닫아 메모리를 확보)
            page.close()
            mobile = ctx.new_page()
            mobile.set_viewport_size({"width": 390, "height": 844})
            mobile.goto("http://127.0.0.1:4195/", wait_until="networkidle")
            mobile.wait_for_timeout(400)
            check("모바일: 첫 화면 가로 넘침 0", mobile.evaluate("document.documentElement.scrollWidth") <= 391, str(mobile.evaluate("document.documentElement.scrollWidth")))
            mobile.screenshot(path=str(SHOTS / "36-compose-mobile.png"))
            mobile_ready = False
            for attempt in range(3):
                try:
                    mobile.wait_for_selector("[data-testid='situation-input']", timeout=8000)
                    mobile.fill("[data-testid='situation-input']", SITUATION, timeout=8000)
                    mobile_ready = True
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    mobile.reload(wait_until="networkidle")
                    mobile.wait_for_timeout(1200)
            check("모바일: 입력창 사용 가능", mobile_ready)
            mobile.click("[data-testid='stance-investigating']")
            mobile.click("[data-testid='entity-platform']")
            mobile.click("[data-testid='submit']")
            mobile.wait_for_selector("[data-testid='package-view']", timeout=15000)
            mobile.wait_for_timeout(400)
            check("모바일: 결과 화면 가로 넘침 0", mobile.evaluate("document.documentElement.scrollWidth") <= 391, str(mobile.evaluate("document.documentElement.scrollWidth")))
            check("모바일: 5블록 렌더", mobile.locator("[data-testid='block-outlook']").count() == 1)
            mobile.screenshot(path=str(SHOTS / "37-package-mobile.png"), full_page=True)
            ctx.close()
            browser.close()

        check("콘솔 오류 0", len(console_errors) == 0, " / ".join(console_errors[:4]))
    finally:
        for proc in procs:
            proc.terminate()

    passed = sum(1 for _, ok, _ in checks if ok)
    for name, ok, detail in checks:
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {name}" + (f"  — {detail}" if detail and not ok else ""))
    print(f"\n{passed}/{len(checks)} 통과")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
