#!/usr/bin/env python3
"""PRISM 실전형 AI 개조 검증.

- api/analyze.ts를 esbuild로 번들한 실제 핸들러를 로컬 서버로 띄워 검증합니다(모의 OpenAI).
- 실시간 AI 모드 / 로컬 폴백 / 정적 호스팅 폴백 / 파일 불러오기 / 새 글 / 복사 / 모바일 390px을 확인합니다.

준비:
  export PATH=/workspace/.tools/node-v22.12.0-linux-x64/bin:$PATH
  npm run build
  node_modules/.bin/esbuild api/analyze.ts --bundle --format=esm --platform=node --outfile=.tmp/analyze.mjs

실행:
  python3 scripts/verify_ai.py
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


def check(name: str, cond: bool, detail: str = "") -> None:
    checks.append((name, bool(cond), detail))


def wait_port(port: int, timeout: float = 15.0) -> None:
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
    proc = subprocess.Popen([NODE, str(ROOT / "scripts" / script)], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    return proc


def api_post(port: int, payload: dict, headers: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/api/analyze",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
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
        # 폴백 시나리오에서는 /api/analyze 실패가 브라우저 콘솔에 리소스 오류로 남습니다.
        # JS 예외(pageerror)와 그 외 콘솔 오류만 수집합니다.
        lambda m: console_errors.append(f"[console:{m.type}] {m.text}")
        if m.type == "error" and "Failed to load resource" not in m.text
        else None,
    )
    page.on("pageerror", lambda e: console_errors.append(f"[pageerror] {e}"))


def run_button(page):
    return page.get_by_role("button", name=re.compile("내 초안 분석하기|변경사항 반영"))


DRAFT = (
    "한결푸드입니다.\n\n최근 일부 온라인 커뮤니티에서 당사 냉동만두 제품에서 이물질이 발견되었다는 글과 사진이 확산되고 있습니다.\n"
    "해당 제품은 단순한 포장 과정의 문제로, 제조 공정과는 무관한 것으로 파악하고 있습니다.\n"
    "현재 정확한 원인과 영향받은 제품 범위는 확인 중입니다.\n"
    "일부 제품에 한해 판매를 중단했으며, 전량 회수 여부는 내부 검토 후 안내드리겠습니다.\n"
    "이용자 여러분께 불편을 드려 죄송합니다.\n"
    "안전성에는 문제가 없으며, 다른 제품은 정상 판매 중입니다.\n"
    "재발 방지에 최선을 다하겠습니다. 감사합니다."
)


def main() -> int:
    for path in (SHOTS, TMP):
        path.mkdir(parents=True, exist_ok=True)

    bundle = TMP / "analyze.mjs"
    if not bundle.exists():
        print("!! .tmp/analyze.mjs 가 없습니다. esbuild 번들을 먼저 만드세요.")
        return 2

    sample = TMP / "sample-draft.txt"
    sample.write_text(DRAFT, encoding="utf-8")

    procs: list[subprocess.Popen] = []
    try:
        mock = spawn("mock-openai.mjs", 4191)
        mock_fail = spawn("mock-openai.mjs", 4193, {"MOCK_FAIL": "1"})
        ai = spawn("serve-ai.mjs", 4190, {"OPENAI_API_KEY": "sk-test-harness", "OPENAI_BASE_URL": "http://127.0.0.1:4191/v1"})
        no_key = spawn("serve-ai.mjs", 4192, {"OPENAI_BASE_URL": "http://127.0.0.1:4191/v1"})
        fail = spawn("serve-ai.mjs", 4194, {"OPENAI_API_KEY": "sk-test-harness", "OPENAI_BASE_URL": "http://127.0.0.1:4193/v1"})
        static = subprocess.Popen(
            [sys.executable, "-m", "http.server", "4195", "--bind", "127.0.0.1", "--directory", str(ROOT / "dist")],
            stdout=open(TMP / "static.log", "w"),
            stderr=subprocess.STDOUT,
        )
        procs = [mock, mock_fail, ai, no_key, fail, static]
        for port in (4190, 4191, 4192, 4193, 4194, 4195):
            wait_port(port)

        # ---------- API 계약 ----------
        status, body = api_post(4190, {"draft": "짧음"})
        check("API: 20자 미만 초안 400", status == 400 and body.get("error") == "draft_too_short", f"{status} {body}")

        long_draft = "가" * 8001
        status, body = api_post(4190, {"draft": long_draft})
        check("API: 8,000자 초과 413", status == 413 and body.get("error") == "draft_too_long", f"{status} {body.get('error')}")

        status, body = api_post(4192, {"draft": DRAFT})
        check(
            "API: 서버 키 없음 501 no_key",
            status == 501 and body.get("error") == "no_key",
            f"{status} {body.get('error')}",
        )

        status, body = api_post(4194, {"draft": DRAFT})
        check("API: OpenAI 5xx → 502", status == 502 and body.get("error") == "upstream_error", f"{status} {body.get('error')}")

        status, body = api_post(4190, {"draft": DRAFT}, {"x-api-key": "sk-personal"})
        ok_shape = (
            status == 200
            and body.get("ok") is True
            and len(body.get("result", {}).get("revisions", [])) == 2
            and len(body.get("result", {}).get("goldenTime", [])) == 3
        )
        check("API: 계약대로 JSON 산출", ok_shape, f"{status}")

        # ---------- 데스크톱: 실시간 AI ----------
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(
                viewport={"width": 1440, "height": 960},
                locale="ko-KR",
                accept_downloads=True,
                permissions=["clipboard-read", "clipboard-write"],
            )
            page = ctx.new_page()
            attach(page)
            page.goto("http://127.0.0.1:4190/", wait_until="networkidle")
            page.wait_for_timeout(600)

            check("빈 상태 안내", page.get_by_text("세 개의 시선을 미리 봅니다").count() > 0)
            check("새 글 작성 버튼", page.get_by_role("button", name="새 글 작성").count() > 0)
            check("파일 불러오기 버튼", page.get_by_role("button", name="파일 불러오기").count() > 0)
            check("예시 드롭다운", page.get_by_text("예시로 테스트하기").count() > 0)
            page.screenshot(path=str(SHOTS / "21-desktop-empty-tool.png"))

            # 파일 불러오기
            page.set_input_files("[data-testid='draft-file-input']", str(sample))
            page.wait_for_timeout(500)
            value = page.locator("textarea").input_value()
            check("파일 불러오기: 본문 채움", "한결푸드" in value and len(value) > 100, str(len(value)))
            check("파일 불러오기: 토스트", page.get_by_text("불러왔습니다").count() > 0)

            run_button(page).click()
            page.wait_for_selector("text=실시간 AI 분석", timeout=30000)
            page.wait_for_timeout(800)
            chip = page.locator("[data-testid='ai-mode-chip']").inner_text()
            check("상단 모드 배지: 실시간 AI", "실시간 AI" in chip, chip)
            check("AI 모델 표시", page.get_by_text("gpt-4o-mini").count() > 0)
            check("AI 총평 표시", page.get_by_text("모의 헤드라인", exact=False).count() > 0)
            page.screenshot(path=str(SHOTS / "21b-desktop-ai-mode.png"))

            # 응답 팩: 수정 초안 2버전 + 복사 + 골든타임
            page.get_by_role("button", name=re.compile("^응답 팩")).first.click()
            page.wait_for_timeout(500)
            cards = page.locator("[data-testid='revision-card']")
            check("수정 초안 2버전 카드", cards.count() == 2, str(cards.count()))
            check("버전 라벨", page.get_by_text("공감·수습 우선형").count() > 0 and page.get_by_text("팩트·원칙 명확형").count() > 0)
            check("버전별 변경 포인트", page.get_by_text("사과를 첫 문단으로 올렸습니다.").count() > 0)
            body_text = page.locator("[data-revision='empathy']").inner_text()
            check("AI 문안 본문", "모의푸드" in body_text and len(body_text) > 80, str(len(body_text)))
            copy_btn = cards.first.get_by_role("button", name="복사")
            copy_btn.click()
            page.wait_for_timeout(300)
            check("원클릭 복사 피드백", cards.first.get_by_text("복사됨").count() > 0)
            clipped = page.evaluate("navigator.clipboard.readText()")
            check("클립보드에 문안", "모의푸드" in (clipped or ""), (clipped or "")[:40])

            page.wait_for_timeout(300)
            check("답변 가이드", page.get_by_text("모의 질문 — 회수 대상은 어느 로트까지입니까?").count() > 0)
            check("금기 표현", page.get_by_text("피해야 할 말").count() > 0)
            golden = page.locator("[data-testid='golden-time']")
            check("골든타임 플랜 카드", golden.count() == 1)
            check("골든타임 3구간", golden.get_by_text("1시간").count() > 0 and golden.get_by_text("24시간").count() > 0)
            golden.get_by_role("button", name=re.compile("모든 채널 판매 중지")).click()
            page.wait_for_timeout(200)
            check("골든타임 체크 동작", "/8" in golden.inner_text(), golden.inner_text()[:80])
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(300)
            page.screenshot(path=str(SHOTS / "22-desktop-revisions.png"))
            golden.scroll_into_view_if_needed()
            page.screenshot(path=str(SHOTS / "23-desktop-golden-time.png"))

            # 여론: AI 반응 + 악화 트리거
            page.get_by_role("button", name=re.compile("여론")).first.click()
            page.wait_for_timeout(400)
            checkt = page.get_by_text("악화 트리거").count() > 0
            check("채널별 악화 트리거", checkt)
            check("AI 시뮬레이션 배지", page.get_by_text("AI 시뮬레이션").count() > 0)
            check("AI 반응 문장", page.get_by_text("모의 반응", exact=False).count() > 0)
            page.screenshot(path=str(SHOTS / "24-desktop-sentiment-ai.png"))

            # 기자 시각: AI 헤드라인
            page.get_by_role("button", name=re.compile("기자 시각")).first.click()
            page.wait_for_timeout(300)
            check("AI 헤드라인 반영", page.get_by_text("모의 헤드라인", exact=False).count() >= 3)

            # 새 글 작성
            page.get_by_role("button", name="새 글 작성").click()
            page.wait_for_timeout(500)
            check("새 글: 에디터 비움", page.locator("textarea").input_value() == "")
            check("새 글: 분석 초기화", page.get_by_text("세 개의 시선을 미리 봅니다").count() > 0)
            check("새 글: 브랜드 비움", page.get_by_placeholder("회사·제품명").input_value() == "")

            # 예시 드롭다운 → 바로 분석
            page.locator("summary").first.click()
            page.wait_for_timeout(300)
            page.get_by_role("button", name=re.compile("이물질 회수 입장문")).first.click()
            page.wait_for_selector("text=실시간 AI 분석", timeout=30000)
            page.wait_for_timeout(600)
            check("예시 실행", page.get_by_text("한결푸드").count() > 0)

            # ---------- 로컬 폴백(서버 키 없음) + 개인 키로 승격 ----------
            page2 = ctx.new_page()
            attach(page2)
            page2.goto("http://127.0.0.1:4192/", wait_until="networkidle")
            page2.wait_for_timeout(400)
            page2.locator("summary").first.click()
            page2.wait_for_timeout(200)
            page2.get_by_role("button", name=re.compile("이물질 회수 입장문")).first.click()
            page2.wait_for_selector("text=로컬 규칙 모드", timeout=20000)
            page2.wait_for_timeout(600)
            check("폴백: 로컬 규칙 모드 표시", page2.get_by_text("로컬 규칙 모드").count() > 0)
            check("폴백: 사유 표시", page2.get_by_text("서버 키 미설정", exact=False).count() > 0)
            page2.get_by_role("button", name=re.compile("^응답 팩")).first.click()
            page2.wait_for_timeout(500)
            check("폴백: 수정 2버전 유지", page2.locator("[data-testid='revision-card']").count() == 2)
            page2.screenshot(path=str(SHOTS / "25-desktop-local-fallback.png"))

            page2.get_by_role("button", name="실시간 AI 켜짐").click()
            page2.wait_for_timeout(600)
            page2.locator("input[type='password']").fill("sk-personal-test")
            page2.get_by_role("button", name="저장", exact=True).click()
            page2.wait_for_timeout(400)
            page2.get_by_role("button", name=re.compile("AI로 다시 분석")).click()
            page2.wait_for_selector("text=실시간 AI 분석", timeout=30000)
            page2.wait_for_timeout(600)
            check("폴백 → 개인 키로 실시간 AI", "실시간 AI" in page2.locator("[data-testid='ai-mode-chip']").inner_text())
            stored = page2.evaluate("localStorage.getItem('prism.api.v2')")
            check("개인 키는 로컬에만 저장", "sk-personal-test" in (stored or ""))

            # ---------- 정적 호스팅(API 없음) ----------
            page3 = ctx.new_page()
            attach(page3)
            page3.goto("http://127.0.0.1:4195/", wait_until="networkidle")
            page3.wait_for_timeout(400)
            page3.locator("summary").first.click()
            page3.wait_for_timeout(200)
            page3.get_by_role("button", name=re.compile("배송·환불 지연 공지")).first.click()
            page3.wait_for_selector("text=로컬 규칙 모드", timeout=20000)
            page3.wait_for_timeout(800)
            note = page3.get_by_text("정적 호스팅", exact=False).count() > 0
            check("정적 호스팅: 로컬 폴백 사유", note, page3.get_by_test_id("ai-mode-chip").inner_text())
            page3.get_by_role("button", name=re.compile("^응답 팩")).first.click()
            page3.wait_for_timeout(500)
            check("정적 호스팅: 2버전 렌더", page3.locator("[data-testid='revision-card']").count() == 2)

            # ---------- 모바일 390px ----------
            mctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                locale="ko-KR",
                is_mobile=True,
                has_touch=True,
                permissions=["clipboard-read", "clipboard-write"],
            )
            mp = mctx.new_page()
            attach(mp)
            mp.goto("http://127.0.0.1:4190/", wait_until="networkidle")
            mp.wait_for_timeout(500)
            mp.locator("summary").first.click()
            mp.wait_for_timeout(300)
            mp.get_by_role("button", name=re.compile("이물질 회수 입장문")).first.click()
            mp.wait_for_selector("text=실시간 AI 분석", timeout=30000)
            mp.wait_for_timeout(700)
            check("모바일: 분석 패널 자동 전환", mp.get_by_text("예상 헤드라인").count() > 0)
            mp.get_by_role("button", name=re.compile("응답 팩")).first.click()
            mp.wait_for_timeout(500)
            check("모바일: 2버전 카드", mp.locator("[data-testid='revision-card']").count() == 2)
            check("모바일: 복사 버튼 보임", mp.locator("[data-testid='revision-card']").first.get_by_role("button", name="복사").is_visible())
            overflow = mp.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
            check("모바일: 가로 넘침 없음", overflow, mp.evaluate("document.documentElement.scrollWidth + '/' + window.innerWidth"))
            mp.screenshot(path=str(SHOTS / "26-mobile-ai-response.png"), full_page=True)
            mp.locator("[data-testid='golden-time']").scroll_into_view_if_needed()
            mp.wait_for_timeout(300)
            mp.screenshot(path=str(SHOTS / "27-mobile-golden-time.png"))
            mp.get_by_role("button", name="초안", exact=True).last.click()
            mp.wait_for_timeout(400)
            check("모바일: 초안 탭 파일 버튼", mp.get_by_role("button", name="파일 불러오기").is_visible())
            mp.screenshot(path=str(SHOTS / "28-mobile-input.png"))

            browser.close()

        check("콘솔 오류 0", len(console_errors) == 0, "; ".join(console_errors[:3]))
    finally:
        for proc in procs:
            proc.terminate()
        for proc in procs:
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

    passed = [c for c in checks if c[1]]
    failed = [c for c in checks if not c[1]]
    print(f"\nCHECKS {len(passed)}/{len(checks)} passed")
    for name, ok, detail in checks:
        print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    if console_errors:
        print("\nCONSOLE ERRORS")
        for e in console_errors[:10]:
            print(e)
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
