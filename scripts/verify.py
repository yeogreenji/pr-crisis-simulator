import os
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4182/"
OUT = "/workspace/projects/pr-crisis-simulator/docs/screenshots"
errors = []
checks = []

def attach(page):
    page.on("console", lambda m: errors.append(f"[console:{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

def check(name, cond):
    checks.append((name, bool(cond)))

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 960}, device_scale_factor=1, locale="ko-KR", accept_downloads=True)
    page = ctx.new_page()
    attach(page)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)

    check("empty state visible", page.get_by_text("세 개의 시선을 미리 봅니다").count() > 0)

    page.get_by_role("button", name="시뮬레이션 실행").click()
    page.wait_for_selector("text=예상 헤드라인", timeout=15000)
    page.wait_for_timeout(600)
    check("press tab rendered", page.get_by_text("팩트체크").count() >= 0 and page.get_by_text("기자가 물을 질문").count() > 0)
    check("history saved", page.evaluate("JSON.parse(localStorage.getItem('prism.runs.v2')||'[]').length") >= 1)

    # stale detection
    ta = page.locator("textarea")
    ta.click()
    ta.press("End")
    ta.type(" 추가 문장입니다.")
    page.wait_for_timeout(300)
    check("stale banner", page.get_by_text("초안이 수정되었습니다").count() > 0)
    page.get_by_role("button", name="다시 분석", exact=True).click()
    page.wait_for_timeout(1600)
    check("stale cleared", page.get_by_text("초안이 수정되었습니다").count() == 0)

    # xray apply
    page.get_by_role("button", name="문장 X-ray").click()
    page.wait_for_timeout(400)
    page.locator(".whitespace-pre-wrap .mark-risk").first.click()
    page.wait_for_timeout(300)
    check("xray detail", page.get_by_text("이렇게 바꾸면").count() > 0)
    page.get_by_role("button", name="이 문장에 적용하고 재분석").click()
    page.wait_for_timeout(1800)
    check("apply toast", page.get_by_text("교체 적용").count() > 0)

    # API modal
    page.get_by_role("button", name="LLM 연동").click()
    page.wait_for_timeout(300)
    check("api modal", page.get_by_text("LLM 정밀 분석").count() > 0)
    page.get_by_role("button", name="OpenAI 호환").click()
    page.get_by_role("button", name="취소").click()
    page.wait_for_timeout(200)

    # download markdown
    with page.expect_download() as dl:
        page.get_by_role("button", name="리포트", exact=True).click()
    path = dl.value.path()
    content = open(path, encoding="utf-8").read()
    check("markdown exported", len(content) > 1200 and "리스크 요약" in content)
    check("markdown has revised draft", "수정 1차안" in content)

    # history compare
    page.get_by_role("button", name="시뮬레이션 히스토리").click()
    page.wait_for_timeout(700)
    picks = page.get_by_title("비교 대상으로 선택")
    check("history has runs", picks.count() >= 3)
    picks.nth(0).click()
    picks.nth(1).click()
    page.wait_for_timeout(400)
    check("compare panel", page.get_by_text("축별 점수").count() > 0)

    # delete one run
    before = page.get_by_title("비교 대상으로 선택").count()
    page.get_by_label("기록 삭제").first.click()
    page.wait_for_timeout(400)
    check("run deleted", page.get_by_label("기록 삭제").count() == before - 1)

    # tablet-ish layout
    page.set_viewport_size({"width": 1024, "height": 820})
    page.mouse.move(700, 500)
    page.get_by_role("button", name="시뮬레이터").first.click()
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/14-tablet.png")

    # mobile interaction
    mctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ko-KR", is_mobile=True, has_touch=True)
    mp = mctx.new_page()
    attach(mp)
    mp.goto(BASE, wait_until="networkidle")
    mp.wait_for_timeout(700)
    mp.get_by_role("button", name="분석").last.click()
    mp.wait_for_timeout(400)
    check("mobile empty analysis", mp.get_by_text("세 개의 시선을 미리 봅니다").count() > 0)
    mp.get_by_role("button", name="샘플로 시작").count()
    mp.get_by_role("button", name="성분 논란 해명 보도자료").first.click()
    mp.wait_for_selector("text=예상 헤드라인", timeout=15000)
    mp.wait_for_timeout(900)
    check("mobile run", mp.get_by_text("기자가 물을 질문").count() > 0)
    mp.get_by_role("button", name="리스크").last.click()
    mp.wait_for_timeout(400)
    check("mobile risk", mp.get_by_text("리스크 구성").count() > 0)

    browser.close()

print("CHECKS")
for name, ok in checks:
    print(("PASS " if ok else "FAIL ") + name)
print("ERRORS:", len(errors))
for e in errors:
    print(e)
