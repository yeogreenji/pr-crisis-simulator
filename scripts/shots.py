import os
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4182/"
OUT = "/workspace/projects/pr-crisis-simulator/docs/screenshots"
os.makedirs(OUT, exist_ok=True)

errors = []

def attach(page):
    page.on("console", lambda m: errors.append(f"[console:{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 960}, device_scale_factor=2, locale="ko-KR")
    page = ctx.new_page()
    attach(page)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{OUT}/01-desktop-idle.png")

    page.get_by_role("button", name="시뮬레이션 실행").click()
    page.wait_for_selector("text=예상 헤드라인", timeout=15000)
    page.wait_for_timeout(900)
    page.screenshot(path=f"{OUT}/02-desktop-press.png")

    page.get_by_role("button", name="여론").click()
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/03-desktop-sentiment.png")

    page.get_by_role("button", name="문장 X-ray").click()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/04-desktop-xray.png")

    marks = page.locator(".whitespace-pre-wrap .mark-risk")
    if marks.count() > 2:
        marks.nth(4).click()
        page.wait_for_timeout(600)
        page.screenshot(path=f"{OUT}/05-desktop-xray-detail.png")

    page.get_by_role("button", name="응답 팩").click()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/06-desktop-response.png")

    # v2: apply every suggestion and re-run
    page.get_by_role("button", name="문장 X-ray").click()
    page.get_by_role("button", name="전체 교체안 적용").click()
    page.wait_for_timeout(4600)
    page.screenshot(path=f"{OUT}/12-desktop-improved.png")

    page.get_by_role("button", name="시뮬레이션 히스토리").click()
    page.wait_for_timeout(800)
    page.mouse.move(760, 620)
    picks = page.get_by_title("비교 대상으로 선택")
    if picks.count() >= 2:
        picks.nth(0).click()
        picks.nth(1).click()
        page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/07-desktop-history.png")

    # print layout
    page.get_by_role("button", name="시뮬레이터").first.click()
    page.wait_for_timeout(600)
    page.emulate_media(media="print")
    page.screenshot(path=f"{OUT}/13-print-report.png", full_page=True)
    page.emulate_media(media="screen")

    # Mobile
    mctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ko-KR", is_mobile=True, has_touch=True)
    mp = mctx.new_page()
    attach(mp)
    mp.goto(BASE, wait_until="networkidle")
    mp.wait_for_timeout(1000)
    mp.screenshot(path=f"{OUT}/08-mobile-idle.png")
    mp.mouse.move(200, 400)
    mp.get_by_role("button", name="시뮬레이션 실행").scroll_into_view_if_needed()
    mp.get_by_role("button", name="시뮬레이션 실행").click()
    mp.wait_for_selector("text=예상 헤드라인", timeout=15000)
    mp.wait_for_timeout(900)
    mp.screenshot(path=f"{OUT}/09-mobile-press.png")
    mp.get_by_role("button", name="리스크").last.click()
    mp.wait_for_timeout(800)
    mp.screenshot(path=f"{OUT}/10-mobile-risk.png")
    mp.get_by_role("button", name="분석").last.click()
    mp.get_by_role("button", name="문장 X-ray").click()
    mp.wait_for_timeout(500)
    mp.screenshot(path=f"{OUT}/11-mobile-xray.png")

    browser.close()

print("ERRORS:")
for e in errors:
    print(e)
print("done")
