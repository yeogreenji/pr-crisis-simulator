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
# 이 작업 환경은 메모리·프로세스 상한이 낮습니다. 전체 서버 13개 + Chromium을 한 번에 띄우면
# OOM/스레드 한도로 죽을 수 있어, 검증을 API 파트와 브라우저 파트로 나눠 돌릴 수 있게 합니다.
#   VERIFY_SCOPE=api  → API 계약 검사만 (브라우저 생략, 서버 전부 기동)
#   VERIFY_SCOPE=ui   → 브라우저 검사만 (UI에 필요한 서버 4개만 기동)
SCOPE = os.environ.get("VERIFY_SCOPE", "all")
UI_PORTS = {4195, 4196, 4197, 4199}
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
    # 이 작업 환경은 사용자당 프로세스/스레드 상한(256)이 낮아, 서버 13개를 띄우면 pthread_create가 실패합니다.
    # 스레드 풀을 최소로 고정해 상한 안에서 띄웁니다.
    env = {**os.environ, "PORT": str(port), "UV_THREADPOOL_SIZE": "1", **(extra_env or {})}
    log = open(TMP / f"{port}.log", "w")
    return subprocess.Popen(
        [NODE, "--v8-pool-size=1", "--max-semi-space-size=2", str(ROOT / "scripts" / script)],
        cwd=ROOT,
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
    )


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


def new_page_retry(ctx, attempts: int = 3):
    """같은 컨텍스트에서 새 탭을 열 때도 renderer가 간헐적으로 죽습니다(메모리 상한). 재시도합니다."""
    last = None
    for _ in range(attempts):
        try:
            return ctx.new_page()
        except Exception as exc:  # noqa: BLE001
            last = exc
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

    def start(script: str, port: int, env: dict[str, str] | None = None) -> subprocess.Popen | None:
        if SCOPE == "ui" and port not in UI_PORTS:
            return None
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
            if SCOPE == "ui" and port not in UI_PORTS:
                continue
            wait_port(port)

        if SCOPE != "ui":
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
                gen.get("responseMimeType") == "application/json" and gen.get("temperature") == 0.45 and gen.get("maxOutputTokens") == 8000 * 3 + 1024,
                json.dumps(gen, ensure_ascii=False)[:200],
            )
            check("Gemini 프롬프트: 상황·입장·유형 전달", "[우리 입장]" in user_prompt and "apology" in user_prompt and "소비재·식품" in user_prompt, user_prompt[:120])
            captured_system = str(captured.get("system") or "")
            check(
                "Gemini 프롬프트: 4채널(사내·SNS·방어 논리) 스키마 요청",
                '"channels"' in captured_system and "사내 공지" in captured_system and "commentGuide" in captured_system,
                captured_system[-260:],
            )
            check(
                "Gemini 프롬프트: 사건 조사(investigation) 스키마 요청",
                '"investigation"' in captured_system
                and "사건 조사" in captured_system
                and '"pattern"' in captured_system
                and "내부에서 확인할 항목" in captured_system,
                captured_system[-300:],
            )
            investigation_result = result.get("investigation") or {}
            check(
                "API: 사건 조사 블록 반환(개요·쟁점·체크)",
                isinstance(investigation_result, dict)
                and bool(investigation_result.get("summary"))
                and len(investigation_result.get("issues") or []) >= 3
                and len(investigation_result.get("checks") or []) >= 2
                and len(investigation_result.get("pattern") or []) >= 3,
                json.dumps(investigation_result, ensure_ascii=False)[:220],
            )

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

            # 페이월·로그인 페이지: 본문 대신 제목·요약만 읽고도 분석을 이어감
            status, body = api(4197, make_package_payload(situation="http://127.0.0.1:4199/article/paywall"))
            paywall_source = body.get("source") or {}
            paywall_prompt = ""
            try:
                paywall_prompt = json.loads((TMP / "gemini-last.json").read_text(encoding="utf-8")).get("user") or ""
            except (OSError, json.JSONDecodeError):
                pass
            check(
                "URL: 페이월 기사는 제목·요약으로 부분 분석(200·partial)",
                status == 200 and paywall_source.get("ok") is True and paywall_source.get("partial") is True,
                f"{status} {paywall_source}",
            )
            check(
                "URL: 부분 분석 시 프롬프트에 추측 금지 지시",
                "본문은 로그인·페이월 등으로 읽지 못했고" in paywall_prompt,
                paywall_prompt[-400:],
            )

            # 출력 한도로 JSON이 잘려도 마지막 완결 지점까지 살려서 응답
            status, body = api(4197, make_package_payload(situation="TRUNCATE_TEST 서비스 장애로 보상 기준 논란이 커지고 있습니다."))
            check(
                "API: 잘린 JSON도 완결 지점까지 복구해 200",
                status == 200 and isinstance((body.get("result") or {}).get("statements"), list),
                f"{status} {str(body)[:160]}",
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

        if SCOPE != "api":
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
                check("첫 화면: 대응 대안 7개(6종 + 직접 입력)", page.locator("[data-testid^='stance-']").count() == 7)
                check("첫 화면: 유형 칩 6개", page.locator("[data-testid^='entity-']").count() == 6)
                check("첫 화면: 기업 상황 칩 12개", page.locator("[data-testid^='situation-tag-']").count() == 12, str(page.locator("[data-testid^='situation-tag-']").count()))
                check(
                    "첫 화면: 업종·이슈 유형 기본값이 '자동 판별'",
                    page.input_value("[data-testid='industry-select']") == "auto"
                    and page.input_value("[data-testid='type-select']") == "auto"
                    and page.locator("[data-testid='industry-select'] option").count() == 13
                    and page.locator("[data-testid='type-select'] option").count() == 17,
                    f"industry={page.input_value('[data-testid=industry-select]')} type={page.input_value('[data-testid=type-select]')}",
                )
                check("첫 화면: 사업분야 예시 칩 5개", page.locator("[data-testid='industry-example']").count() == 5, str(page.locator("[data-testid='industry-example']").count()))
                check(
                    "첫 화면: 업종 12개를 그룹으로 묶음",
                    page.locator("[data-testid='industry-select'] optgroup").count() >= 4,
                    str(page.locator("[data-testid='industry-select'] optgroup").count()),
                )
                check("첫 화면: 빈 입력이면 버튼 비활성", page.locator("[data-testid='submit']").is_disabled())

                # ── v8: 요금제 (Starter / Pro / Enterprise) ──
                check("요금제: 기본은 Starter", "Starter" in page.inner_text("[data-testid='plan-badge']"))
                page.click("[data-testid='plan-badge']")
                page.wait_for_selector("[data-testid='pricing-modal']", timeout=8000)
                page.wait_for_timeout(250)
                check(
                    "요금제: 3개 플랜 + 월 가격 표시",
                    all(page.locator(f"[data-testid='plan-card-{k}']").count() == 1 for k in ["starter", "pro", "enterprise"])
                    and "49,000원" in page.inner_text("[data-testid='plan-card-pro']")
                    and "199,000원" in page.inner_text("[data-testid='plan-card-enterprise']"),
                    page.inner_text("[data-testid='pricing-modal']")[:200],
                )
                check("요금제: B2B 비교표 13행", page.locator("[data-testid^='plan-row-']").count() == 13, str(page.locator("[data-testid^='plan-row-']").count()))
                page.click("[data-testid='billing-annual']")
                page.wait_for_timeout(200)
                check(
                    "요금제: 연 결제 토글 → 월 환산·절약액",
                    "40,833원" in page.inner_text("[data-testid='plan-card-pro']") and "98,000원" in page.inner_text("[data-testid='plan-card-pro']"),
                    page.inner_text("[data-testid='plan-card-pro']")[:160],
                )
                page.screenshot(path=str(SHOTS / "48-pricing.png"))
                page.click("[data-testid='billing-monthly']")
                page.wait_for_timeout(150)
                page.click("[data-testid='plan-cta-pro']")
                page.wait_for_timeout(300)
                check("요금제: Pro 무료 체험 활성화(결제 전 데모)", "Pro 체험" in page.inner_text("[data-testid='pricing-modal']"))
                page.screenshot(path=str(SHOTS / "49-pricing-pro.png"))
                page.click("[data-testid='pricing-close']")
                page.wait_for_timeout(250)
                check("요금제: 헤더 배지가 Pro 체험으로 변경", "Pro" in page.inner_text("[data-testid='plan-badge']"))

                # 대응 대안 확장: 직접 입력 상자
                page.click("[data-testid='stance-custom']")
                page.wait_for_timeout(150)
                check("대안: 직접 입력 선택 시 입력 상자", page.locator("[data-testid='custom-stance-input']").count() == 1)
                page.fill("[data-testid='custom-stance-input']", "사실은 인정하되 형사 책임은 부인하고 보상부터 진행한다")
                check("대안: 직접 입력 문장이 안내에 반영", "사실은 인정하되" in page.inner_text("[data-testid='active-stance-note']"))
                page.click("[data-testid='stance-investigating']")

                # 사업분야 예시 → 입력란 삽입
                page.click("[data-testid='industry-example'] >> nth=0")
                page.wait_for_timeout(150)
                check("예시 칩: 입력란에 상황 문장이 들어감", len(page.input_value("[data-testid='situation-input']")) > 10)
                page.fill("[data-testid='situation-input']", "")

                # 기업 상황 태그 선택
                page.click("[data-testid='situation-tag-listed-large']")
                page.click("[data-testid='situation-tag-spreading']")
                page.wait_for_timeout(150)
                check(
                    "기업 상황: 선택한 조건이 안내에 표시",
                    "공시" in page.inner_text("[data-testid='situation-tags']") and "확산" in page.inner_text("[data-testid='situation-tags']"),
                )
                check("기업 상황: 최대 3개 제한", page.locator("[data-testid='situation-tag-b2b']").get_attribute("aria-pressed") == "false")
                page.click("[data-testid='situation-tag-listed-large']")
                page.click("[data-testid='situation-tag-spreading']")
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

                # ── v8: 임원 커맨드 바 · 공유 브리핑 링크 ──
                bar = page.locator("[data-testid='exec-bar']")
                bar_box = bar.bounding_box()
                bar_pos = bar.evaluate("el => getComputedStyle(el).position")
                check(
                    "임원 바: 위험지수 · 입장 · 채널 준비 4/4",
                    bar.count() == 1
                    and "/100" in page.inner_text("[data-testid='exec-risk']")
                    and "즉시 사과" in page.inner_text("[data-testid='exec-stance']")
                    and "4/4" in page.inner_text("[data-testid='exec-readiness']"),
                    page.inner_text("[data-testid='exec-bar']")[:160],
                )
                check("임원 바: 스크롤해도 상단 고정", bar_pos == "sticky" and bar_box is not None and bar_box["y"] >= 0)
                check(
                    "임원 바: 공유·임원 보고서·더 보기 액션",
                    page.locator("[data-testid='share-open']").count() == 1
                    and page.locator("[data-testid='export-menu']").count() == 1
                    and page.locator("button[aria-label='더 보기']").count() == 1,
                )
                page.screenshot(path=str(SHOTS / "50-exec-bar.png"))

                page.click("[data-testid='share-open']")
                page.wait_for_selector("[data-testid='share-url']", timeout=15000)
                share_url = page.input_value("[data-testid='share-url']")
                check(
                    "공유 링크: #share= 압축 URL 생성",
                    "#share=1z" in share_url and len(share_url) > 600,
                    f"{len(share_url)}자 {share_url[:80]}",
                )
                check("공유 링크: 클립보드에 자동 복사", "#share=" in page.evaluate("navigator.clipboard.readText()"))
                page.screenshot(path=str(SHOTS / "51-share-panel.png"))
                page.click("[data-testid='share-close']")
                page.wait_for_timeout(150)

                brief = new_page_retry(ctx)
                brief.goto(share_url, wait_until="networkidle")
                brief.wait_for_selector("[data-testid='briefing-view']", timeout=15000)
                brief.wait_for_timeout(400)
                brief_text = brief.locator("[data-testid='briefing-view']").inner_text()
                check(
                    "공유 브리핑: 읽기 전용 뷰 · 브랜드 · 위험지수",
                    "읽기 전용" in brief.inner_text("[data-testid='briefing-bar']")
                    and "한결푸드" in brief_text
                    and "/100" in brief_text
                    and "4채널 실행 문안" in brief_text,
                    brief_text[:160],
                )
                check(
                    "공유 브리핑: 4채널 문안·실행 순서·유관기관",
                    "모의 고객 공지" in brief_text and "사내" in brief_text and "1시간" in brief_text and "유관기관" in brief_text,
                    brief_text[:200],
                )
                check(
                    "공유 브리핑: 사건 조사 요약·확인 대기 항목",
                    brief.locator("[data-testid='briefing-investigation']").count() == 1
                    and "사건 조사" in brief_text
                    and "발표 전 확인 대기" in brief_text,
                    brief_text[:200],
                )
                check(
                    "공유 브리핑: 수정·재생성·내보내기 버튼 없음",
                    brief.locator("[data-testid='share-open']").count() == 0
                    and brief.locator("[data-testid='export-menu']").count() == 0
                    and brief.locator("[data-testid='situation-input']").count() == 0,
                )
                brief.screenshot(path=str(SHOTS / "52-briefing.png"))
                brief.close()

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

                # 위험 스코어카드 · 4채널 탭
                check("결과: 7축 위험 스코어카드", page.locator("[data-testid='block-scorecard']").count() == 1 and page.locator("[data-testid='block-scorecard'] svg polygon").count() >= 5)

                # ── 사건 조사 블록 (AI 개요 + 업종 매뉴얼 체크 병합) ──
                inv_block = page.locator("[data-testid='block-investigation']")
                check("결과: 사건 조사 블록이 스코어카드 아래에 표시", inv_block.count() == 1)
                inv_text = inv_block.inner_text() if inv_block.count() else ""
                check(
                    "사건 조사: AI 개요·쟁점·로컬 매뉴얼 체크 병합",
                    "모의 조사 개요" in inv_text
                    and page.locator("[data-testid='investigation-issues'] li").count() >= 3
                    and page.locator("[data-testid^='investigation-check-']").count() >= 5
                    and "식품의약품안전처" in inv_text,
                    inv_text[:240],
                )
                check(
                    "사건 조사: 확산 경로·참고 사례·규제 접점",
                    "이 유형이 커지는 경로" in inv_text
                    and ("참고 맥락" in inv_text or "참고 사례" in inv_text)
                    and "관련 법령" in inv_text,
                    inv_text[-240:],
                )
                page.locator("[data-testid='block-investigation']").scroll_into_view_if_needed()
                page.wait_for_timeout(3400)  # 공유 토스트가 사라질 때까지
                # 스크린샷에만 상단 고정 바를 잠시 숨깁니다(캡처 후 즉시 복구).
                page.evaluate("() => { const el = document.querySelector(\"[data-testid='exec-bar']\"); if (el) el.style.display = 'none'; }")
                page.wait_for_timeout(120)
                inv_block.screenshot(path=str(SHOTS / "56-investigation.png"))
                page.evaluate("() => { const el = document.querySelector(\"[data-testid='exec-bar']\"); if (el) el.style.display = ''; }")
                page.wait_for_timeout(120)
                check_progress_before = page.inner_text("[data-testid='investigation-progress']")
                page.locator("[data-testid^='investigation-check-']").first.click()
                page.wait_for_timeout(250)
                check_progress = page.inner_text("[data-testid='investigation-progress']")
                check(
                    "사건 조사: 체크하면 진행률이 갱신",
                    "0/" in check_progress_before and "1/" in check_progress,
                    f"{check_progress_before} -> {check_progress}",
                )
                page.screenshot(path=str(SHOTS / "57-investigation-viewport.png"))
                page.locator("[data-testid^='investigation-check-']").first.click()
                page.wait_for_timeout(150)
                check(
                    "결과: 4채널 탭(입장문/기자/사내/SNS)",
                    all(page.locator(f"[data-testid='channel-tab-{k}']").count() == 1 for k in ["official", "qa", "internal", "social"]),
                )
                page.click("[data-testid='channel-tab-internal']")
                page.wait_for_timeout(200)
                internal_text = page.inner_text("[data-testid='block-channels']")
                check(
                    "채널 ③: AI 사내 공지 + 임직원 할 일·금지 사항",
                    "모의 AI 사내 공지" in internal_text and "임직원이 할 일" in internal_text and "하지 말아야 할 말" in internal_text and "모의 AI 지침" in internal_text,
                    internal_text[:160],
                )
                page.screenshot(path=str(SHOTS / "44-channels-internal.png"))
                page.click("[data-testid='channel-tab-social']")
                page.wait_for_timeout(200)
                social_text = page.inner_text("[data-testid='block-channels']")
                check("채널 ④: 짧은 공지·댓글 대응 가이드", "공식 계정 공지" in social_text and "예상 댓글" in social_text and "모의 AI 답글" in social_text)
                page.screenshot(path=str(SHOTS / "45-channels-social.png"))
                page.click("[data-testid='channel-tab-official']")
                page.wait_for_timeout(150)
                check("결과: 유관기관 4곳 이상", page.locator("[data-testid='block-stakeholders']").inner_text().count("모의") >= 4)
                check("결과: 악화 트리거·다음 대응", "모의 트리거" in page.locator("[data-testid='block-outlook']").inner_text())
                check("결과: 모범 vs 실패 대조 블록", page.locator("[data-testid='block-compare']").count() == 1)
                check("결과: 대조 블록에 두 열", page.locator("[data-testid='block-compare']").inner_text().count("모범") >= 1 and page.locator("[data-testid='block-compare']").inner_text().count("실패") >= 1)

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

                # ── 확장: 사실 적시 스탠스 + 금융 업종 + 기업 상황 태그 ──
                page.reload(wait_until="networkidle")
                page.wait_for_timeout(500)
                page.fill("[data-testid='situation-input']", "대출 금리 인상 통보 후 소비자 반발과 금리 비교 게시물이 확산 중입니다.")
                page.click("[data-testid='stance-facts']")
                page.select_option("[data-testid='industry-select']", "finance")
                page.click("[data-testid='situation-tag-listed-large']")
                page.click("[data-testid='situation-tag-spreading']")
                page.fill("[data-testid='situation-note']", "투자사 요청으로 확인 중")
                page.fill("input[aria-label='브랜드명']", "한결캐피탈")
                page.click("[data-testid='submit']")
                page.wait_for_selector("[data-testid='package-view']", timeout=40000)
                page.wait_for_timeout(400)
                facts_text = page.locator("[data-testid='package-view']").inner_text()
                check(
                    "확장: 사실 적시 입장 + 금융 업종 + 기업 상황 칩",
                    "사실 적시" in facts_text and "금융·핀테크" in facts_text and "상장사·대기업" in facts_text and "여론 악화·보도 확산" in facts_text,
                    facts_text[:220],
                )
                check("확장: 대조 블록이 금융 사안에서도 표시", page.locator("[data-testid='block-compare']").count() == 1)
                try:
                    captured_facts = json.loads((TMP / "gemini-last.json").read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    captured_facts = {}
                prompt_facts = captured_facts.get("user") or ""
                check("AI 프롬프트: 사실 적시 지침 전달", "[우리 입장]\nfacts" in prompt_facts and "사실과 다른 점" in prompt_facts, prompt_facts[:260])
                check(
                    "AI 프롬프트: 기업 상황 지침 전달",
                    "[기업 상황]" in prompt_facts and "상장사·대기업" in prompt_facts and "투자사 요청으로 확인 중" in prompt_facts,
                    prompt_facts[:400],
                )
                page.screenshot(path=str(SHOTS / "40-facts-finance.png"))

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
                    "자동 판별: 항공·반려동물 사고 → 여행·항공·숙박 + 제품·식품 안전",
                    "여행·항공·숙박" in auto_text and "제품·식품 안전" in auto_text and "직접 선택" not in auto_text,
                    auto_text[:220],
                )
                check("자동 판별: 철강·중대재해 오분류 없음", "철강·제조·중공업" not in auto_text and "중대재해·산업재해" not in auto_text, auto_text[:220])
                check("자동 판별: 06·07 블록 유지", page.locator("[data-testid='block-similar']").count() == 1 and page.locator("[data-testid='block-playbook']").count() == 1)

                page.click("[data-testid='statement-public'] button:has-text('이 입장문 복사')")
                page.wait_for_timeout(400)
                clip = page.evaluate("navigator.clipboard.readText()")
                check("복사: 입장문 원클릭", "모의 고객 공지" in clip and len(clip) > 200, clip[:60])

                page.click("[data-testid='channel-tab-qa']")
                page.wait_for_timeout(250)
                page.click("[data-testid='qa-item']:nth-child(2) button")
                page.wait_for_timeout(200)
                page.click("[data-testid='qa-item']:nth-child(2) button:has-text('답변 복사')")
                page.wait_for_timeout(300)
                clip = page.evaluate("navigator.clipboard.readText()")
                check("복사: Q&A 답변", "확인된 피해" in clip, clip[:60])
                check("채널 ②: 핵심 방어 논리 3축", "모의 방어 1" in page.locator("[data-testid='block-qa']").inner_text())

                page.click("button[aria-label='더 보기']")
                page.wait_for_timeout(200)
                page.click("[data-testid='copy-all']")
                page.wait_for_timeout(300)
                clip = page.evaluate("navigator.clipboard.readText()")
                check("복사: 패키지 전체", "PRISM 대응 패키지" in clip and "전체 대응 시스템" in clip and "유관기관" in clip, str(len(clip)))
                page.click("button[aria-label='더 보기']")
                page.wait_for_timeout(200)
                page.click("[data-testid='copy-markdown']")
                page.wait_for_timeout(300)
                md = page.evaluate("navigator.clipboard.readText()")
                check("복사: 팀 공유용 Markdown", md.startswith("# ") and "## 01. 골든타임 체크리스트" in md and "| 단계 | 목표 |" in md, md[:120])

                # 임원 보고서 내보내기 — .md 파일 다운로드
                page.click("[data-testid='export-menu']")
                page.wait_for_timeout(200)
                check("내보내기: 메뉴에 인쇄·Word·Markdown", page.locator("[data-testid='print-pdf']").count() == 1 and page.locator("[data-testid='report-doc']").count() == 1 and page.locator("[data-testid='report-md']").count() == 1)
                with page.expect_download(timeout=15000) as dl:
                    page.click("[data-testid='report-md']")
                download = dl.value
                md_path = TMP / "report-download.md"
                download.save_as(str(md_path))
                downloaded = md_path.read_text(encoding="utf-8")
                check(
                    "내보내기: .md 파일에 경영진 요약·4채널 포함",
                    download.suggested_filename.endswith(".md") and "경영진 요약" in downloaded and "사내 임직원 공지문" in downloaded and all(a in downloaded for a in ["브랜드 신뢰 타격", "법적·규제 노출", "커뮤니티 확산도"]),
                    f"{download.suggested_filename} {len(downloaded)}자",
                )
                check(
                    "내보내기: .md 파일에 사건 조사 섹션(체크리스트·규제 접점·확산 경로)",
                    "## 2. 사건 조사" in downloaded
                    and "실무 팩트체크" in downloaded
                    and "이 유형이 커지는 경로" in downloaded
                    and ("규제 접점" in downloaded or "관련 법령" in downloaded),
                    downloaded[:160],
                )

                # 임원 보고서 인쇄 레이아웃 — 인쇄 미디어에서 4채널이 모두 펼쳐지는지
                page.emulate_media(media="print")
                try:
                    page.wait_for_function(
                        "() => { const el = document.querySelector(\"[data-testid='block-qa']\"); return el && getComputedStyle(el).display === 'block'; }",
                        timeout=6000,
                    )
                except Exception:  # noqa: BLE001
                    pass
                page.wait_for_timeout(300)
                panel_count = page.locator("[data-print-panel]").count()
                panel_displays = [
                    page.locator("[data-print-panel]").nth(i).evaluate("el => getComputedStyle(el).display")
                    for i in range(panel_count)
                ]
                panel_text = " ".join(
                    page.locator("[data-print-panel]").nth(i).text_content() or "" for i in range(panel_count)
                )
                header_info = page.locator("[data-testid='print-header']").evaluate(
                    "el => ({ display: getComputedStyle(el).display, text: el.textContent || '' })"
                )
                check(
                    "인쇄 미리보기: 4채널 패널이 모두 펼쳐짐",
                    panel_count == 4
                    and all(state == "block" for state in panel_displays)
                    and "모의 AI 사내 공지" in panel_text
                    and "모의 AI 답글" in panel_text,
                    f"count={panel_count} display={panel_displays}",
                )
                check(
                    "인쇄 미리보기: 보고서 머리말·7축 요약",
                    header_info.get("display") != "none"
                    and "crisis communication report" in str(header_info.get("text", "")).lower()
                    and "종합 위험지수" in str(header_info.get("text", "")),
                    f"{header_info}",
                )
                check(
                    "인쇄: 사건 조사 블록이 보고서에 그대로 인쇄됨",
                    page.locator("[data-testid='block-investigation']").count() == 1
                    and page.locator("[data-testid='block-investigation']").evaluate("el => getComputedStyle(el).display") != "none"
                    and "실무 팩트체크" in page.locator("[data-testid='block-investigation']").inner_text(),
                )
                page.screenshot(path=str(SHOTS / "46-print-layout.png"), full_page=False)
                page.emulate_media(media="screen")
                page.wait_for_timeout(150)

                # 같은 상황 · 다른 입장 비교
                page.click("[data-testid='compare-stance']")
                page.wait_for_selector("[aria-label='입장 비교']", timeout=10000)
                page.wait_for_timeout(400)
                compare_text = page.inner_text("[aria-label='입장 비교']")
                check(
                    "비교: 두 입장·7축·총점이 한 화면에",
                    "같은 상황 · 다른 입장 비교" in compare_text and compare_text.count("/100") >= 2 and "브랜드 신뢰 타격" in compare_text,
                    compare_text[:160],
                )
                page.screenshot(path=str(SHOTS / "47-compare.png"))
                page.locator("[aria-label='입장 비교'] button:has-text('닫기')").first.click()
                page.wait_for_timeout(200)

                # 비교 기록에서 다시 열기
                page.click("button[aria-label='더 보기']")
                page.wait_for_timeout(200)
                page.click("[data-testid='open-history']")
                page.wait_for_selector("[data-testid='history-item']", timeout=8000)
                check("기록: 자동 저장된 시뮬레이션 2건 이상", page.locator("[data-testid='history-item']").count() >= 2, str(page.locator("[data-testid='history-item']").count()))
                page.locator("[data-testid='history-item']").nth(0).click()
                page.locator("[data-testid='history-item']").nth(1).click()
                page.wait_for_timeout(150)
                page.click("[data-testid='history-compare']")
                page.wait_for_selector("[aria-label='입장 비교']", timeout=8000)
                check("기록: 저장된 두 건을 비교 화면으로 열기", "같은 상황 · 다른 입장 비교" in page.inner_text("[aria-label='입장 비교']"))
                page.locator("[aria-label='입장 비교'] button:has-text('닫기')").first.click()
                page.wait_for_timeout(200)
                page.screenshot(path=str(SHOTS / "32-package-desktop.png"))

                # ── v8: Starter 게이팅 → Pro 재활성화 ──
                page.click("[data-testid='plan-badge']")
                page.wait_for_selector("[data-testid='pricing-modal']", timeout=8000)
                page.wait_for_timeout(200)
                page.click("[data-testid='plan-downgrade']")
                page.wait_for_timeout(250)
                page.click("[data-testid='pricing-close']")
                page.wait_for_timeout(250)
                check("Starter: 임원 바 채널 준비 2/2", "2/2" in page.inner_text("[data-testid='exec-readiness']"))
                page.click("[data-testid='channel-tab-internal']")
                page.wait_for_timeout(250)
                gate = page.locator("[data-testid='channel-gate-internal']")
                check(
                    "Starter: 사내 공지 탭은 미리보기 잠금 카드",
                    gate.count() == 1 and "PRO" in gate.inner_text() and "미리보기" in gate.inner_text(),
                    gate.inner_text()[:160] if gate.count() else "none",
                )
                page.screenshot(path=str(SHOTS / "53-starter-gate.png"))
                page.click("[data-testid='channel-upgrade-internal']")
                page.wait_for_timeout(300)
                check(
                    "Starter: 잠금 카드 → 요금제 모달(해당 기능 강조)",
                    page.locator("[data-testid='pricing-modal']").count() == 1
                    and page.locator("[data-testid='pricing-highlight']").count() == 1
                    and "4채널" in page.inner_text("[data-testid='pricing-highlight']"),
                )
                page.click("[data-testid='pricing-close']")
                page.wait_for_timeout(200)
                page.click("[data-testid='share-open']")
                page.wait_for_timeout(300)
                check(
                    "Starter: 공유 링크는 요금제 모달로 안내",
                    page.locator("[data-testid='pricing-modal']").count() == 1 and page.locator("[data-testid='share-panel']").count() == 0,
                )
                page.click("[data-testid='pricing-close']")
                page.wait_for_timeout(200)
                page.click("[data-testid='export-menu']")
                page.wait_for_timeout(200)
                page.click("[data-testid='report-doc']")
                page.wait_for_timeout(300)
                check(
                    "Starter: Word·PDF 보고서는 요금제 모달로 안내",
                    page.locator("[data-testid='pricing-modal']").count() == 1
                    and "Word" in page.inner_text("[data-testid='pricing-highlight']"),
                )
                page.click("[data-testid='plan-cta-pro']")
                page.wait_for_timeout(250)
                page.click("[data-testid='pricing-close']")
                page.wait_for_timeout(250)
                check("Pro 재활성화: 채널 준비 4/4", "4/4" in page.inner_text("[data-testid='exec-readiness']"))
                page.click("[data-testid='channel-tab-internal']")
                page.wait_for_timeout(200)
                check("Pro: 사내 공지 잠금 해제", page.locator("[data-testid='channel-gate-internal']").count() == 0)
                page.screenshot(path=str(SHOTS / "54-package-pro.png"))

                page.locator("button:has-text('참고 매뉴얼')").first.click()
                page.wait_for_timeout(300)
                check(
                    "매뉴얼 모달: 4탭(상황·대안·업종·사례)",
                    page.get_by_text("상황 유형 매뉴얼").count() > 0
                    and page.get_by_text("대응 대안").count() > 0
                    and page.get_by_text("업종 매뉴얼").count() > 0,
                )
                page.click("[data-testid='manual-tab-stance']")
                page.wait_for_timeout(200)
                stance_modal = page.inner_text("[data-testid='manual-modal']")
                check(
                    "매뉴얼: 대응 대안 6종 + 직접 입력 설명",
                    all(k in stance_modal for k in ["공식 사과", "사실 적시", "선제 보상", "무대응", "강경 대응", "직접 입력"]),
                    stance_modal[:200],
                )
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
                local_inv = page.locator("[data-testid='block-investigation']")
                local_inv_text = local_inv.inner_text() if local_inv.count() else ""
                check(
                    "로컬: 사건 조사 — 업종 규제기관·팩트체크 6개·확산 경로",
                    local_inv.count() == 1
                    and "식품의약품안전처" in local_inv_text
                    and page.locator("[data-testid^='investigation-check-']").count() >= 5
                    and "이 유형이 커지는 경로" in local_inv_text
                    and "실시간 AI 조사" not in local_inv_text,
                    local_inv_text[:240],
                )
                page.locator("[data-testid='block-investigation']").scroll_into_view_if_needed()
                page.wait_for_timeout(200)
                page.evaluate("() => { const el = document.querySelector(\"[data-testid='exec-bar']\"); if (el) el.style.display = 'none'; }")
                page.wait_for_timeout(120)
                local_inv.screenshot(path=str(SHOTS / "58-investigation-local.png"))
                page.evaluate("() => { const el = document.querySelector(\"[data-testid='exec-bar']\"); if (el) el.style.display = ''; }")
                page.wait_for_timeout(120)

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

                # 확장 스탠스: 사실 적시 / 선제 보상 / 무대응 / 직접 입력
                stance_cases = [
                    (
                        "facts",
                        "협력사 원재료에서 기준치 초과 성분이 검출됐다는 보도가 나갔고, 커뮤니티에 인증샷이 확산 중입니다.",
                        ["사실과 다른 부분", "정정을 요청드립니다"],
                    ),
                    (
                        "compensation",
                        "제품 결함으로 피해가 커지고 있지만 원인은 아직 확인되지 않았습니다.",
                        ["보상", "신청 방법", "어떤 조건과도 연결하지 않습니다"],
                    ),
                    (
                        "silence",
                        "확인되지 않은 루머가 소수 계정에서 도는 단계입니다.",
                        ["지금은 공개하지 않습니다", "공개 전환 조건", "노코멘트"],
                    ),
                    (
                        "custom",
                        "경쟁사 제보로 알려진 내부 문건 논란입니다.",
                        ["[입장]", "이 입장에서 지킬 선", "형사 책임은 부인"],
                    ),
                ]
                for sid, text, needles in stance_cases:
                    page.click("button:has-text('새 상황')")
                    page.wait_for_timeout(250)
                    page.fill("[data-testid='situation-input']", text)
                    page.click(f"[data-testid='stance-{sid}']")
                    if sid == "custom":
                        page.fill("[data-testid='custom-stance-input']", "사실은 인정하되 형사 책임은 부인하고 보상부터 진행한다")
                    page.click("[data-testid='submit']")
                    page.wait_for_selector("[data-testid='package-view']", timeout=15000)
                    page.wait_for_timeout(250)
                    public_text = page.locator("[data-testid='statement-body-public']").inner_text()
                    check(
                        f"로컬: {sid} 스탠스 문안이 해당 톤으로 생성",
                        all(n in public_text for n in needles),
                        public_text[:120],
                    )
                    if sid == "silence":
                        press_text = page.locator("[data-testid='statement-body-press']").inner_text()
                        check("로컬: 무대응 스탠스는 기자 최소 회신 문안", "최소 문안" in press_text and "노코멘트" in press_text, press_text[:120])
                    if sid == "facts":
                        press_text = page.locator("[data-testid='statement-body-press']").inner_text()
                        check("로컬: 사실 적시 스탠스는 정정 요청 포함", "정정 요청" in press_text, press_text[:120])

                # 업종 확장: 금융 — 업종 예시·규제기관·체크리스트
                page.click("button:has-text('새 상황')")
                page.wait_for_timeout(250)
                page.select_option("[data-testid='industry-select']", "finance")
                page.wait_for_timeout(150)
                check("업종 예시: 금융 선택 시 금리·횡령 예시 칩", "금리" in page.locator("[data-testid='industry-examples']").inner_text() and "횡령" in page.locator("[data-testid='industry-examples']").inner_text())
                page.fill("[data-testid='situation-input']", "임직원 횡령 사고가 보도되며 사고 금액과 내부통제 문제가 쟁점이 됐습니다.")
                page.click("[data-testid='stance-apology']")
                page.click("[data-testid='situation-tag-regulator']")
                page.fill("input[aria-label='브랜드명']", "한결캐피탈")
                page.click("[data-testid='submit']")
                page.wait_for_selector("[data-testid='package-view']", timeout=15000)
                page.wait_for_timeout(250)
                finance_text = page.locator("[data-testid='package-view']").inner_text()
                check("업종 확장: 금융 업종·규제기관 반영", "금융·핀테크" in finance_text and ("금융감독원" in finance_text or "금융위원회" in finance_text), finance_text[:150])
                check("기업 상황 반영: 당국 조사 태그·체크리스트", "당국 조사" in finance_text and "조사 협조" in page.locator("[data-testid='block-actions']").inner_text(), finance_text[:150])
                check("업종 확장: 금융 사안 대조 블록(실패 vs 표준)", page.locator("[data-testid='block-compare']").count() == 1 and "실패 사례" in page.locator("[data-testid='block-compare']").inner_text())
                page.screenshot(path=str(SHOTS / "41-local-finance.png"))

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

                # 신규 업종 4종: 라벨과 업종 고유 실행 항목이 패키지에 반영되는지
                new_industries = [
                    ("finance", "금융·핀테크", "예금·대출·결제"),
                    ("b2b", "B2B·SaaS·엔터프라이즈", "고객사와 현업 담당자"),
                    ("mobility", "모빌리티·제조", "차량·제품을 사용하시는"),
                    ("travel", "여행·항공·숙박", "여행 일정에 피해"),
                ]
                ind_failures: list[str] = []
                for iid, label, target in new_industries:
                    page.click("button:has-text('새 상황')")
                    page.wait_for_timeout(150)
                    page.select_option("[data-testid='industry-select']", iid)
                    page.fill("[data-testid='situation-input']", f"{label} 고객 항의가 커지고 있습니다.")
                    page.click("[data-testid='stance-apology']")
                    page.click("[data-testid='submit']")
                    page.wait_for_selector("[data-testid='package-view']", timeout=15000)
                    page.wait_for_timeout(120)
                    txt = page.locator("[data-testid='package-view']").inner_text()
                    if not (label in txt and target in txt):
                        ind_failures.append(f"{iid}: label={label in txt} target={target in txt}")
                check("신규 업종 4종: 라벨·업종별 사과 대상(전용 문안) 반영", not ind_failures, " / ".join(ind_failures))

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
                    "가격 인상: 쟁점 확장에 기존 고객, 사건 조사에 언론·여론 포인트",
                    page.locator("[data-testid='block-issue-brief']").count() == 1
                    and "기존 고객 vs 신규 고객" in page.locator("[data-testid='block-issue-brief']").inner_text()
                    and "인상률" in page.locator("[data-testid='investigation-issues']").inner_text()
                    and "기존 고객 적용일" in page.locator("[data-testid='investigation-issues']").inner_text(),
                    page.locator("[data-testid='investigation-issues']").inner_text()[:200] if page.locator("[data-testid='investigation-issues']").count() else "none",
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
                mobile = new_page_retry(ctx)
                mobile.set_viewport_size({"width": 390, "height": 844})
                mobile.goto("http://127.0.0.1:4195/", wait_until="networkidle")
                mobile.wait_for_timeout(400)
                check("모바일: 첫 화면 가로 넘침 0", mobile.evaluate("document.documentElement.scrollWidth") <= 391, str(mobile.evaluate("document.documentElement.scrollWidth")))
                mobile.screenshot(path=str(SHOTS / "36-compose-mobile.png"))
                mobile.click("[data-testid='plan-badge']")
                mobile.wait_for_selector("[data-testid='pricing-modal']", timeout=8000)
                mobile.wait_for_timeout(300)
                check("모바일: 요금제 모달 가로 넘침 0", mobile.evaluate("document.documentElement.scrollWidth") <= 391, str(mobile.evaluate("document.documentElement.scrollWidth")))
                mobile.screenshot(path=str(SHOTS / "55-pricing-mobile.png"))
                mobile.click("[data-testid='plan-cta-pro']")
                mobile.wait_for_timeout(250)
                mobile.click("[data-testid='pricing-close']")
                mobile.wait_for_timeout(250)
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
                check("모바일: 스코어카드·4채널 탭", mobile.locator("[data-testid='block-scorecard']").count() == 1 and mobile.locator("[data-testid='channel-tab-internal']").count() == 1)
                mobile.click("[data-testid='channel-tab-internal']")
                mobile.wait_for_timeout(250)
                check("모바일: 사내 공지 탭 가로 넘침 0", mobile.evaluate("document.documentElement.scrollWidth") <= 391, str(mobile.evaluate("document.documentElement.scrollWidth")))
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
