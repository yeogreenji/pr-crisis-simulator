"""6개 업종 매뉴얼을 A4 PDF 한 권으로 내보냅니다."""
import io
from pathlib import Path

from playwright.sync_api import sync_playwright
from pypdf import PdfWriter, PdfReader

BASE = "http://127.0.0.1:4182/"
OUT = Path("/workspace/projects/pr-crisis-simulator/docs/prism-industry-playbooks.pdf")

INDUSTRIES = [("food", "식품"), ("retail", "유통"), ("consumer", "소비재"), ("tech", "IT"), ("steel", "제조"), ("entertainment", "엔터")]

COVER_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
  @page { margin: 0; }
  body { margin: 0; font-family: "Pretendard", "Apple SD Gothic Neo", sans-serif; color: #101319; }
  .page { width: 210mm; height: 297mm; padding: 26mm 22mm; box-sizing: border-box; display: flex; flex-direction: column; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #101319; padding-bottom: 10px; }
  .brand { font-size: 11pt; font-weight: 800; letter-spacing: 0.3em; }
  .sub { font-size: 8pt; letter-spacing: 0.12em; color: #555; margin-top: 4px; }
  .meta { font-size: 8pt; color: #555; text-align: right; }
  h1 { font-size: 30pt; line-height: 1.25; letter-spacing: -0.03em; margin: 26mm 0 0; }
  h1 span { color: #2b45e0; }
  .lead { font-size: 10.5pt; line-height: 1.9; color: #333; margin-top: 7mm; max-width: 150mm; }
  .list { margin-top: 14mm; border-top: 1px solid #ccc; }
  .row { display: flex; gap: 6mm; align-items: baseline; padding: 5.5mm 0; border-bottom: 1px solid #eee; }
  .num { font-family: monospace; font-size: 9pt; color: #999; width: 10mm; }
  .name { font-size: 12pt; font-weight: 700; width: 42mm; }
  .tag { font-size: 9.5pt; color: #444; }
  .foot { margin-top: auto; border-top: 1px solid #ccc; padding-top: 6px; font-size: 7.5pt; color: #777; line-height: 1.7; }
</style></head><body><div class="page">
  <div class="top"><div><div class="brand">PRISM</div><div class="sub">INDUSTRY CRISIS PLAYBOOK</div></div>
  <div class="meta">업종별 위기관리 매뉴얼<br>2026</div></div>
  <h1>같은 사고도<br>업종마다<br><span>다르게 대응한다</span></h1>
  <p class="lead">식품은 회수 범위, 유통은 환불·정산 기한, 제조는 작업 중지와 원청 책임, 엔터는 원문과 활동 계획이 첫 질문입니다.
  이 문서는 6개 업종의 위기 트리거·규제 주체·골든타임 타임라인·금기 표현·이해관계자 대응 톤을 현장 순서로 정리했습니다.</p>
  <div class="list">
    <div class="row"><div class="num">01</div><div class="name">식품·외식</div><div class="tag">이물·식중독·원산지 — 회수 범위가 신뢰를 가른다</div></div>
    <div class="row"><div class="num">02</div><div class="name">유통·이커머스</div><div class="tag">정산·환불·개인정보 — '언제, 얼마, 누구에게'</div></div>
    <div class="row"><div class="num">03</div><div class="name">소비재·뷰티</div><div class="tag">성분·광고·리콜 — 검사 주체와 회수 기준</div></div>
    <div class="row"><div class="num">04</div><div class="name">IT·플랫폼·핀테크</div><div class="tag">장애·유출·정책 — 범위, 복구 ETA, 보상</div></div>
    <div class="row"><div class="num">05</div><div class="name">철강·제조·중공업</div><div class="tag">산업재해·환경·공급망 — 사람이 먼저</div></div>
    <div class="row"><div class="num">06</div><div class="name">엔터·콘텐츠</div><div class="tag">아티스트·계약·팬덤 — 사실과 일정을 분리</div></div>
  </div>
  <div class="foot">사례는 공개 보도·공식 자료로 확인한 실제 사건이며, 시뮬레이터의 샘플 기업은 가상입니다.<br>배포 전 최신 법령·감독 기준과 사내 법무 검토를 확인하십시오. · PRISM</div>
</div></body></html>"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 1400}, locale="ko-KR")
    page.goto(BASE, wait_until="networkidle")
    page.get_by_role("button", name="사례·매뉴얼").first.click()
    page.wait_for_timeout(900)

    writer = PdfWriter()
    cover = browser.new_page(viewport={"width": 900, "height": 1200})
    cover.set_content(COVER_HTML)
    cover_pdf = cover.pdf(format="A4", print_background=True, prefer_css_page_size=True)
    for pg in PdfReader(io.BytesIO(cover_pdf)).pages:
        writer.add_page(pg)
    cover.close()

    for key, label in INDUSTRIES:
        page.emulate_media(media="screen")
        page.get_by_role("button", name=label, exact=True).click()
        page.wait_for_timeout(600)
        page.emulate_media(media="print")
        page.wait_for_timeout(300)
        pdf = page.pdf(format="A4", print_background=True, prefer_css_page_size=True)
        reader = PdfReader(io.BytesIO(pdf))
        for pg in reader.pages:
            writer.add_page(pg)
        print(f"{key}: {len(reader.pages)}p")

    with OUT.open("wb") as f:
        writer.write(f)
    print("saved", OUT, OUT.stat().st_size)
    browser.close()
