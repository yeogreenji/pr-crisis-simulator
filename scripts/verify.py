import json
import re
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4182/"
OUT = "/workspace/projects/pr-crisis-simulator/docs/screenshots"
errors = []
checks = []


def attach(page):
    page.on("console", lambda m: errors.append(f"[console:{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))


def run_button(page):
    return page.get_by_role("button", name=re.compile("시뮬레이션 실행|변경사항 반영"))


def check(name, cond):
    checks.append((name, bool(cond)))


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 960}, device_scale_factor=1, locale="ko-KR", accept_downloads=True)
    page = ctx.new_page()
    attach(page)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(700)

    check("empty state visible", page.get_by_text("세 개의 시선을 미리 봅니다").count() > 0)
    page.screenshot(path=f"{OUT}/01-desktop-idle.png")
    check("industry selector has 6 buttons", page.locator("[aria-pressed]").count() == 6)

    # 식품 샘플 실행
    run_button(page).click()
    page.wait_for_selector("text=예상 헤드라인", timeout=15000)
    page.wait_for_timeout(600)
    check("press tab rendered", page.get_by_text("기자가 물을 질문").count() > 0)
    check("industry chip in header", page.get_by_text("식품·외식").count() > 0)
    check("industry playbook strip", page.get_by_text("식품 playbook").count() > 0)

    runs = json.loads(page.evaluate("localStorage.getItem('prism.runs.v2')||'[]'"))
    check("history saved", len(runs) >= 1)
    check("run stores industry", runs[0].get("industry") == "food")

    # 문장 X-ray + 업종 필수 항목
    page.get_by_role("button", name="문장 X-ray").click()
    page.wait_for_timeout(500)
    check("xray structure checks", page.get_by_text("문서 골격 점검").count() > 0)
    check("industry check card", page.get_by_text("회수 범위·제조번호").count() > 0)
    page.locator(".whitespace-pre-wrap .mark-risk").first.click()
    page.wait_for_timeout(300)
    check("xray detail", page.get_by_text("이렇게 바꾸면").count() > 0)
    page.get_by_role("button", name="이 문장에 적용하고 재분석").click()
    page.wait_for_timeout(1800)
    check("apply toast", page.get_by_text("교체 적용").count() > 0)

    # 응답 팩: 업종 Q&A 포함
    page.get_by_role("button", name="응답 팩").click()
    page.wait_for_timeout(400)
    check("industry QA merged", page.get_by_text("회수 대상 제품을 어떻게 확인하나?").count() > 0)
    check("revised draft has industry closing", page.get_by_text("보관 중인 제품은 섭취하지 마시고").count() > 0)

    # 업종 전환: 제조
    steel = page.get_by_role("button", name="제조", exact=True)
    steel.click()
    page.wait_for_timeout(300)
    check("industry switch selected", steel.get_attribute("aria-pressed") == "true")
    run_button(page).click()
    page.wait_for_timeout(2200)
    runs = json.loads(page.evaluate("localStorage.getItem('prism.runs.v2')||'[]'"))
    check("steel run stored", runs[0].get("industry") == "steel")
    page.get_by_role("button", name="문장 X-ray").click()
    page.wait_for_timeout(400)
    check("steel checks shown", page.get_by_text("작업·가동 중지").count() > 0)
    check("steel score differs from food", runs[0]["score"] != runs[1]["score"] or runs[0]["industry"] != runs[1]["industry"])

    # 사례 라이브러리
    page.get_by_role("button", name="사례·매뉴얼").first.click()
    page.wait_for_timeout(600)
    check("library title", page.get_by_text("위기 사례 & 업종 매뉴얼").count() > 0)
    check("case count shown", page.get_by_text("전체 20").count() > 0)
    page.get_by_role("button", name="타임라인·초기 대응·결과 보기").first.click()
    page.wait_for_timeout(300)
    check("case timeline expanded", page.get_by_text("무슨 일이 있었나").count() > 0)
    check("case sources linked", page.locator("a[href^='https://']").count() >= 1)

    # 업종 필터
    page.get_by_role("button", name="철강·제조·중공업 3").click()
    page.wait_for_timeout(300)
    check("filter narrows cases", page.get_by_text("포스코 포항제철소").count() > 0)
    page.get_by_role("button", name="전체 20").click()
    page.wait_for_timeout(200)

    # 매뉴얼 패널: 업종 탭 전환
    page.get_by_role("button", name="엔터", exact=True).click()
    page.wait_for_timeout(300)
    check("playbook switches industry", page.get_by_text("엔터·콘텐츠 위기관리 매뉴얼").count() > 0)
    check("playbook golden time", page.get_by_text("골든타임 타임라인").count() > 0)
    check("playbook banned phrases", page.get_by_text("절대 금기 표현").count() > 0)

    # 매뉴얼 인쇄 (print media)
    page.emulate_media(media="print")
    page.set_viewport_size({"width": 820, "height": 1160})
    page.wait_for_timeout(600)
    check("playbook print visible", page.locator(".print-playbook").is_visible())
    check("analysis print hidden in library", page.locator(".print-report").count() == 0)
    page.screenshot(path=f"{OUT}/20-playbook-print.png", full_page=True)
    page.emulate_media(media="screen")
    page.set_viewport_size({"width": 1440, "height": 960})

    # 이 업종으로 실행
    page.get_by_role("button", name="이 업종으로 실행").click()
    page.wait_for_timeout(2400)
    check("simulate from playbook", page.get_by_text("예상 헤드라인").count() > 0)
    runs = json.loads(page.evaluate("localStorage.getItem('prism.runs.v2')||'[]'"))
    check("entertainment run", runs[0].get("industry") == "entertainment")

    # 히스토리 비교
    page.get_by_role("button", name="히스토리").first.click()
    page.wait_for_timeout(700)
    picks = page.get_by_title("비교 대상으로 선택")
    check("history has runs", picks.count() >= 3)
    picks.nth(0).click()
    picks.nth(1).click()
    page.wait_for_timeout(400)
    check("compare panel", page.get_by_text("축별 점수").count() > 0)
    page.screenshot(path=f"{OUT}/07-desktop-history.png")

    # 데스크톱 스크린샷
    page.get_by_role("button", name="시뮬레이터").first.click()
    page.wait_for_timeout(2200)
    page.mouse.move(720, 420)
    page.wait_for_timeout(300)
    page.screenshot(path=f"{OUT}/02-desktop-press.png")
    page.get_by_role("button", name="여론").click()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/03-desktop-sentiment.png")
    page.get_by_role("button", name="문장 X-ray").click()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/04-desktop-xray.png")
    marks = page.locator(".whitespace-pre-wrap .mark-risk")
    if marks.count() > 1:
        marks.nth(min(1, marks.count() - 1)).click()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/05-desktop-xray-detail.png")
    page.get_by_role("button", name="응답 팩").click()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/06-desktop-response.png")

    page.get_by_role("button", name="문장 X-ray").click()
    page.wait_for_timeout(300)
    page.get_by_role("button", name="전체 교체안 적용").click()
    page.wait_for_timeout(3200)
    page.screenshot(path=f"{OUT}/12-desktop-improved.png")

    page.get_by_role("button", name="사례·매뉴얼").first.click()
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{OUT}/16-desktop-library-cases.png")
    page.get_by_role("button", name="식품", exact=True).click()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/17-desktop-library-playbook.png")

    # 인쇄 리포트
    page.get_by_role("button", name="시뮬레이터").first.click()
    page.wait_for_timeout(800)
    page.emulate_media(media="print")
    page.set_viewport_size({"width": 820, "height": 1160})
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/13-print-report.png", full_page=True)
    page.emulate_media(media="screen")
    page.set_viewport_size({"width": 1440, "height": 960})

    # 태블릿
    page.set_viewport_size({"width": 1024, "height": 820})
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/14-tablet.png")
    page.set_viewport_size({"width": 1440, "height": 960})

    # 모바일
    mctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ko-KR", is_mobile=True, has_touch=True)
    mp = mctx.new_page()
    attach(mp)
    mp.goto(BASE, wait_until="networkidle")
    mp.wait_for_timeout(700)
    mp.screenshot(path=f"{OUT}/08-mobile-idle.png")
    run_button(mp).click()
    mp.wait_for_selector("text=예상 헤드라인", timeout=15000)
    mp.wait_for_timeout(900)
    check("mobile run", mp.get_by_text("기자가 물을 질문").count() > 0)
    mp.screenshot(path=f"{OUT}/09-mobile-press.png")
    mp.get_by_role("button", name="리스크").last.click()
    mp.wait_for_timeout(400)
    check("mobile risk", mp.get_by_text("리스크 구성").count() > 0)
    mp.screenshot(path=f"{OUT}/10-mobile-risk.png")
    mp.get_by_role("button", name="분석").last.click()
    mp.get_by_role("button", name="문장 X-ray").click()
    mp.wait_for_timeout(400)
    mp.screenshot(path=f"{OUT}/11-mobile-xray.png")

    # 모바일 라이브러리
    mp.get_by_role("button", name="사례", exact=True).last.click()
    mp.wait_for_timeout(700)
    check("mobile library", mp.get_by_text("위기 사례 & 업종 매뉴얼").count() > 0)
    mp.screenshot(path=f"{OUT}/19-mobile-library.png")
    mp.get_by_role("button", name="업종 매뉴얼").click()
    mp.wait_for_timeout(500)
    check("mobile playbook pane", mp.get_by_text("골든타임 타임라인").count() > 0)
    mp.screenshot(path=f"{OUT}/18-mobile-playbook.png")

    browser.close()

print("CHECKS")
for name, ok in checks:
    print(("PASS " if ok else "FAIL ") + name)
print("ERRORS:", len(errors))
for e in errors:
    print(e)
