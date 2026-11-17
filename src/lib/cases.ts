import type { CaseStance, CaseType, CrisisCase } from "../types";
import food from "../data/cases/food.json";
import construction from "../data/cases/construction.json";
import pharma from "../data/cases/pharma.json";

/**
 * 실제 위기관리 사례 라이브러리.
 * 모든 수치·일자는 아래 sources의 공개 보도·공식 자료로 확인한 값만 사용했습니다.
 * 시뮬레이터의 샘플 기업은 가상이지만, 이 라이브러리의 기업·사건은 실명 사례입니다.
 */
const LEGACY_CASES: Omit<CrisisCase, "type" | "stance" | "tags">[] = [
  // ── 식품·외식 ──────────────────────────────────────────────
  {
    id: "egg-fipronil-2017",
    industry: "food",
    company: "국내 산란계 농가·정부 합동",
    country: "KR",
    date: "2017-08",
    title: "살충제 계란 파동 — 전수조사는 빨랐고, 회수는 늦었다",
    trigger: "친환경 농가 계란에서 피프로닐 등 살충제 성분 검출",
    scale: ["산란계 농장 1,239곳 전수검사", "52곳 부적합", "회수 대상 4,210만 개"],
    timeline: [
      { when: "8/15~18", what: "전국 산란계 농장 1,239곳 전수검사. 1차 49곳 부적합, 보완검사에서 3곳 추가." },
      { when: "8/18", what: "부적합 농가 특별점검반 구성, 출하중지·회수·폐기 착수." },
      { when: "8/21", what: "정부 합동 브리핑. 부적합 계란 4,210만 개를 회수 대상으로 설정." },
      { when: "10/17", what: "국정감사 자료: 부적합 농가 판매 4,326만 개 중 회수 830만 개(19.2%)." },
    ],
    response: [
      "전수검사·추적조사 인력 502명 투입, 수집·판매업체 1,600여 곳 압류·폐기",
      "난각코드를 고유번호 하나로 통일하고 생산연월일 표시 의무화 추진",
      "학교급식에 부적합 계란이 납품되지 않았다는 사실을 먼저 확인해 공개",
    ],
    outcome:
      "살충제 계란 10개 중 8개가 시중에 유통된 것으로 집계됐고, 가공품(빵·훈제란)은 대부분 소진됐다. 정부는 백서를 발간하고 제도 개선을 추진했지만 소비자 신뢰 회복에는 시간이 걸렸다.",
    lesson:
      "전수조사 속도만으로는 부족하다. '회수 대상'을 정했으면 회수율을 수치로 공개하고, 가공·급식 등 2차 유통 경로를 처음부터 함께 추적해야 한다.",
    verdict: "mixed",
    sources: [
      { label: "정책브리핑 · 살충제 검출 계란 유통량 추적조사 (2017-08-21)", url: "https://www.korea.kr/briefing/policyBriefingView.do?newsId=156221128" },
      { label: "연합뉴스 · 4천만개 중 20% 폐기 추정 (2017-08-22)", url: "https://www.yna.co.kr/view/AKR20170822083300017" },
      { label: "매일경제 · 4,320만개 중 830만개만 회수 (2017-10-17)", url: "https://www.mk.co.kr/news/business/8010989" },
    ],
  },
  {
    id: "chipotle-ecoli-2015",
    industry: "food",
    company: "Chipotle Mexican Grill",
    country: "US",
    date: "2015-10",
    title: "Chipotle E. coli — 폐쇄는 빨랐지만 매출은 6년이 걸렸다",
    trigger: "11개 주에서 STEC O26 집단 감염, 원인 식재료 특정 실패",
    scale: ["55명 감염·21명 입원", "43개 매장 폐쇄", "2015년 4분기 기존점 매출 -14.6%"],
    timeline: [
      { when: "2015-10-31", what: "워싱턴·오리건 매장 폐쇄. 11/3 43개 매장 추가 폐쇄, 매출 -20%까지 하락." },
      { when: "2015-11-10", what: "폐쇄 매장 재개. 매출 -9%로 회복하다 CDC 추가 발표 후 다시 -22%." },
      { when: "2015-12-04", what: "SEC 8-K: 4분기 기존점 매출 -8~-11% 전망, 2016년 가이던스 철회." },
      { when: "2016-09-21", what: "전국지 전면광고·영상으로 식품안전 프로그램 공개, 창업자 직접 사과." },
    ],
    response: [
      "문제 매장 전면 폐쇄와 전 식재료 교체, DNA 기반 원료 검사 도입",
      "유통기한 말기 검사(end-of-shelf-life testing), 독립 식품안전자문위원회 구성",
      "창업자 명의 전면광고·영상으로 '우리 기준을 지키지 못했다'고 직접 인정",
    ],
    outcome:
      "감염은 종결됐지만 회복은 느렸다. 평균 매장 매출은 250만 달러에서 180만 달러로 하락했고, 분석가들은 2020년까지도 완전 회복이 어렵다고 봤다.",
    lesson:
      "원인 식재료를 특정하지 못하면 '우리 기준을 지키지 못했다'는 구조적 자기 인정이 유일한 방어가 된다. 폐쇄·검사·자문위원회를 한 묶음으로 내놓아야 한다.",
    verdict: "mixed",
    sources: [
      { label: "CDC · E. coli O26 Chipotle 최종 업데이트", url: "https://archive.cdc.gov/www_cdc_gov/ecoli/2015/o26-11-15/index.html" },
      { label: "Chipotle · 2015년 4분기 실적·CDC 조사 종료 (2016-02-02)", url: "https://newsroom.chipotle.com/2016-02-02-chipotle-mexican-grill-inc-announces-fourth-quarter-and-full-year-2015-results-cdc-investigation-over-chipotle-welcomes-customers-back-to-restaurants" },
      { label: "CNBC · 1년 후에도 회복 중 (2016-10-31)", url: "https://www.cnbc.com/2016/10/31/one-year-after-chipotles-e-coli-crisis-chain-still-struggling.html" },
    ],
  },
  {
    id: "mcdonalds-onion-2024",
    industry: "food",
    company: "McDonald's",
    country: "US",
    date: "2024-10",
    title: "맥도날드 쿼터파운더 E. coli — 공급사·원인을 24시간 안에 특정",
    trigger: "14개 주에서 E. coli O157:H7, 슬라이스 양파가 유력 원인으로 지목",
    scale: ["104명 감염·34명 입원·1명 사망", "1/5 매장 쿼터파운더 일시 중단", "발표 직후 방문 -9.5%"],
    timeline: [
      { when: "2024-10-22", what: "CDC·FDA 발표. Taylor Farms가 콜로라도 공장산 양파 자진 회수." },
      { when: "2024-10-23", what: "맥도날드, 영향 주 매장의 슬라이스 양파 사용 중단. 쇠고기 패티는 검사 결과 무관 확인." },
      { when: "2024-10-29", what: "CEO가 실적 콜에서 고객 피해에 사과, 원인·조치·복구 계획 설명." },
      { when: "2024-12-03", what: "CDC·FDA 조사 종료. 추가 감염 없음 확인." },
    ],
    response: [
      "Taylor Farms 콜로라도 공장산 양파를 무기한 소싱 중단하고 다른 공급사로 교체",
      "문제 매장에서 쿼터파운더 판매를 중단하되, 쇠고기 무관 사실을 먼저 공개해 피해 범위를 좁힘",
      "CEO 명의 사과와 함께 매출 회복 계획(가치 메뉴 유지)을 동시에 제시",
    ],
    outcome:
      "방문객은 발표 직후 6.4~9.5% 줄었지만, 원인과 범위를 빠르게 특정하면서 확산은 조기에 진정됐다. 분석가들은 장기 영향은 제한적이라고 평가했다.",
    lesson:
      "원인을 특정할 수 있다면 24시간 안에 공급사·로트·중단 범위를 공개하라. '무관한 것'을 먼저 밝히는 것도 회수 범위를 좁히는 핵심 기술이다.",
    verdict: "exemplary",
    sources: [
      { label: "FDA · E. coli O157:H7 양파 조사 (2024-10)", url: "https://www.fda.gov/food/outbreaks-foodborne-illness/outbreak-investigation-e-coli-o157h7-onions-october-2024" },
      { label: "CDC · 최종 업데이트 (2024-12-03)", url: "https://cdc.gov/ecoli/outbreaks/investigation-update-e-coli-o157-2024.html" },
      { label: "Restaurant Dive · 발표 후 방문·매출 영향 (2024-10-30)", url: "https://www.restaurantdive.com/news/mcdonalds-traffic-sales-slide-amid-ecoli-outbreak/731400/" },
    ],
  },

  // ── 유통·이커머스 ──────────────────────────────────────────
  {
    id: "timon-wemakep-2024",
    industry: "retail",
    company: "티몬·위메프 (큐텐그룹)",
    country: "KR",
    date: "2024-07",
    title: "티메프 정산 지연 — '순차 처리'가 무기한 연기가 된 사태",
    trigger: "판매대금 정산 지연·유용, 카드사 결제자금 지급 중단",
    scale: ["미정산 1조 3,000억 원", "피해 판매자 48,124개사", "소비자 피해 234억 원·2.1만 명"],
    timeline: [
      { when: "2024-07-07", what: "판매대금 정산 지연이 표면화. 프로모션으로 급증한 결제액이 역효과." },
      { when: "2024-07-24", what: "카드사들이 티몬·위메프에 대한 결제자금 지급 전면 중단." },
      { when: "2024-07-29", what: "정부 관계부처 TF, 소비자 환불·판매자 유동성 5,600억 원+α 대책 발표." },
      { when: "2024-09", what: "두 회사 기업회생절차 개시. 2025년 1월까지 소비자 환불 445억 원 집행." },
    ],
    response: [
      "카드사·PG를 통한 일반상품·상품권 선환불, 여행·숙박은 집단분쟁조정으로 이관",
      "판매자 대상 긴급경영안정자금·금리 인하·만기연장 등 유동성 공급",
      "정산기한 준수·판매대금 별도관리 의무화하는 대규모유통업법·전자금융거래법 개정 추진",
    ],
    outcome:
      "회생절차로 미정산금 회수 가능성이 낮아졌고, 소비자 환불은 카드사·PG·판매사가 분담하는 구조로 처리됐다. 제도 개정 논의가 국회에서 이어졌다.",
    lesson:
      "돈이 걸린 사고에서 '시스템 오류'와 '순차 처리'는 답이 아니다. 피해 규모·지급 재원·날짜·대상을 첫 24시간에 제시하고, 셀러와 소비자를 동시에 다뤄야 한다.",
    verdict: "failure",
    sources: [
      { label: "자본시장연구원 · 티몬·위메프 사태의 주요 이슈 (2024-10)", url: "https://www.kcmi.re.kr/report/report_view?report_no=1801" },
      { label: "기획재정부 · 위메프·티몬 사태 대응방안 지원실적 (2025-01-23)", url: "https://mofe.go.kr/com/cmm/fms/FileDown.do?atchFileId=ATCH_000000000028191&fileSn=4" },
      { label: "매일경제 · 정부 긴급조사·피해구제 (2024-07-25)", url: "https://www.mk.co.kr/news/business/11077034" },
    ],
  },
  {
    id: "coupang-2021",
    industry: "retail",
    company: "쿠팡",
    country: "KR",
    date: "2021-10",
    title: "쿠팡 주소 노출 — 하루 만의 사과, 그러나 남은 질문",
    trigger: "앱 개선 작업 중 다른 회원의 이름·배송지 주소가 화면에 노출",
    scale: ["약 31만 명 정보 노출", "노출 시간 약 1시간", "사고 다음 날 대표 명의 사과"],
    timeline: [
      { when: "2021-10-26", what: "오후 2~3시 배송지 표기 개선 작업 중 오류 발생." },
      { when: "2021-10-27", what: "강승승 대표 명의 사과문, 이용자 문자 발송, 유관기관 신고." },
      { when: "2021-10-27", what: "개인정보보호위원회 사실관계 조사 착수." },
    ],
    response: [
      "사고 다음 날 대표 명의 사과와 개별 문자 통지",
      "노출 항목(이름·주소)과 시간(약 1시간)을 구체적으로 밝힘",
      "유관기관 신고와 재발 방지 약속",
    ],
    outcome:
      "초기 대응 속도는 빨랐지만 재발 방지 대책과 보상이 구체적이지 않아 '사과하고 말겠다'는 비판을 받았다. 이후에도 개인정보 관련 민원이 이어졌다.",
    lesson:
      "빠른 인정은 필요조건이지 충분조건이 아니다. 노출 항목·시간·대상 다음에 반드시 '재발 방지 조치와 이행 일정'이 붙어야 한다.",
    verdict: "mixed",
    sources: [
      { label: "뉴시스 · 개인정보 유출 사과와 남은 불안 (2021-10-28)", url: "https://www.newsis.com/view/NISX20211028_0001629892" },
    ],
  },
  {
    id: "coupang-2025",
    industry: "retail",
    company: "쿠팡",
    country: "KR",
    date: "2025-11",
    title: "쿠팡 3,370만 계정 유출 — '노출'이라는 단어가 만든 두 번째 사고",
    trigger: "해외 서버를 통한 장기간 개인정보 무단 접근, 5개월간 미인지",
    scale: ["계정 약 3,370만 개", "2025-06-24부터 접근 추정", "인지 후 11일 만에 규모 재공지"],
    timeline: [
      { when: "2025-11-18", what: "약 4,500개 계정 노출 인지, 경찰·KISA·개보위 신고." },
      { when: "2025-11-29", what: "후속 조사 결과 3,370만 개 계정 노출 공지. 이름·이메일·주소·일부 주문정보." },
      { when: "2025-12-03", what: "개보위, '노출'을 '유출'로 수정하고 미통지 항목 재통지·홈 공지 요구." },
      { when: "2025-12-04", what: "쿠팡, 게시글 표현을 '유출'로 정정. 다만 홈 공지·사과문은 이틀 만에 내려감." },
    ],
    response: [
      "사법기관·규제당국 협력, 독립 보안기업 전문가 영입, 내부 모니터링 강화",
      "결제정보·카드번호·로그인 정보는 미포함이라고 명시해 2차 피해 범위를 한정",
      "전 고객 대상 사과 문자 발송",
    ],
    outcome:
      "역대 최대 규모 과징금 가능성이 거론됐고, 집단 손해배상 논의가 시작됐다. '노출' 표현을 2주 만에 '유출'로 바꾸면서 책임 축소 논란이 커졌다.",
    lesson:
      "사고의 이름을 먼저 정하라. '노출'과 '유출'의 차이는 홍보 문구가 아니라 법적 책임의 크기다. 인지 지연은 그 자체로 최대 가중 요소가 된다.",
    verdict: "failure",
    sources: [
      { label: "쿠팡 뉴스룸 · 쿠팡에서 알려드립니다 (2025-11-29)", url: "https://news.coupang.com/archives/58849/" },
      { label: "파이낸셜뉴스 · 3,370만 계정 유출 (2025-11-30)", url: "https://www.fnnews.com/news/202511301116326310" },
      { label: "한겨레 · '노출'→'유출' 변경, 사과문 이틀 (2025-12-05)", url: "https://www.hani.co.kr/arti/economy/economy_general/1233107.html" },
    ],
  },
  {
    id: "target-2013",
    industry: "retail",
    company: "Target",
    country: "US",
    date: "2013-12",
    title: "Target 카드정보 유출 — 최고경영자가 책임진 벤치마크",
    trigger: "협력업체 계정 탈취로 POS 단말기 메모리 스크래핑 악성코드 감염",
    scale: ["카드 4,000만 장", "개인정보 7,000만 건", "누적 비용 2억 9,100만 달러"],
    timeline: [
      { when: "2013-11-27~12-15", what: "POS 단말기에서 카드 정보 탈취. 12/19 유출 공개." },
      { when: "2014-05", what: "그레그 스타인하펠 CEO 사임. CIO도 교체." },
      { when: "2015", what: "미국 주요 유통사 최초로 칩+PIN 카드 도입, 사이버퓨전센터 설립." },
    ],
    response: [
      "외부 보안업체(Verizon) 조사 의뢰, 원인(협력업체 계정·네트워크 분리 미흡) 공개",
      "최고경영자·CIO 교체로 책임 소재를 경영진에서 정리",
      "칩+PIN, 네트워크 분리, 사이버퓨전센터 등 구조적 투자",
    ],
    outcome:
      "2013년 4분기 이익 46% 감소, 누적 비용 2억 9,100만 달러(보험 9,000만 달러 제외 시 2억 달러). 2017년 47개 주와 1,850만 달러 합의.",
    lesson:
      "가장 강한 신뢰 회복 메시지는 '최고경영자의 책임'이다. 다만 책임 정리는 사고 원인의 구조적 수정(네트워크 분리·결제 보안)과 함께 가야 한다.",
    verdict: "failure",
    sources: [
      { label: "Krebs on Security · Target breach by the numbers", url: "https://krebsonsecurity.com/2014/05/the-target-breach-by-the-numbers/" },
      { label: "JISE · Teaching Case: Security Breach at Target", url: "https://jise.org/volume29/n1/JISEv29n1p11.pdf" },
      { label: "CNBC · Target 대응의 교훈 (2014-05-11)", url: "https://www.cnbc.com/2014/05/11/ta-breach-lessons-for-businesses.html" },
    ],
  },

  // ── 소비재·뷰티 ────────────────────────────────────────────
  {
    id: "humidifier-2011",
    industry: "consumer",
    company: "옥시레킷벤키저(현 RB코리아) 외",
    country: "KR",
    date: "2011-05",
    title: "가습기 살균제 — 5년의 침묵이 만든 브랜드의 종말",
    trigger: "가습기 살균제 흡입으로 인한 폐 손상·사망",
    scale: ["첫 사망 2011-05-10", "신고 피해 1,800명대·사망 260명대(2016년 집계)", "공식 사과까지 5년"],
    timeline: [
      { when: "2011-05", what: "원인 불명 폐손상 첫 사망. 8월 질병관리본부가 살균제를 위험 요인으로 지목." },
      { when: "2012-08", what: "유족·시민단체, 제조·판매 17개사 과실치사 혐의로 고발." },
      { when: "2016-04", what: "검찰 특별수사팀 가동. 롯데마트·홈플러스가 잇달아 사과." },
      { when: "2016-05-02", what: "옥시 한국법인 대표 기자회견, 공식 사과와 포괄 보상 방안 발표." },
    ],
    response: [
      "2013년 국정감사에서 50억 원 지원기금 조성 발표(공식 사과는 아님)",
      "2016년 검찰 수사 착수 후에야 공식 사과, 100억 원 규모 기금 추가 출연",
      "유해성 보고서 은폐·조작 의혹은 부인",
    ],
    outcome:
      "피해자 단체는 '검찰 수사를 의식한 보여주기식 사과'라며 수용하지 않았다. 브랜드 신뢰는 회복되지 않았고, 제조물 책임 논의와 제도 개선의 기준점이 됐다.",
    lesson:
      "책임을 인정하는 데 걸린 시간이 곧 브랜드 수명이었다. 원인 규명 전이라도 '피해를 인정하고 지원 절차를 시작한다'는 문장은 5년을 기다릴 필요가 없다.",
    verdict: "failure",
    sources: [
      { label: "연합뉴스 · 옥시 공식 사과·포괄 보상 (2016-05-02)", url: "https://www.yna.co.kr/view/AKR20160502079752030" },
      { label: "연합뉴스 · 가습기살균제 사건 5년 (2016-04-23)", url: "https://www.yna.co.kr/view/AKR20160423048900004" },
      { label: "연합뉴스 · 옥시 입장자료와 피해자 반발 (2016-04-21)", url: "https://www.yna.co.kr/view/AKR20160421130752030" },
    ],
  },
  {
    id: "modamoda-2023",
    industry: "consumer",
    company: "모다모다",
    country: "KR",
    date: "2021-12~2024-10",
    title: "모다모다 THB 논란 — 금지 원료 지정, 그러나 회수 기준은 없었다",
    trigger: "염색샴푸의 1,2,4-트리하이드록시벤젠(THB) 유전독성 가능성",
    scale: ["2021-12 식약처 행정예고", "2023-12 검증위 '가능성 배제 불가'", "기존 제품 2024-10-01까지 판매 허용"],
    timeline: [
      { when: "2021-12", what: "식약처, THB 화장품 사용금지 원료 지정 행정예고. 회사는 '신기술 규제'라 반발." },
      { when: "2023-12-06", what: "화장품 원료 안전성 검증위, 유전독성 가능성 배제 불가 결론." },
      { when: "2023-12", what: "회사, 1세대 제품 단종. 다만 자발적 회수·보상은 '검토 중'." },
      { when: "2024-10-01", what: "고시 개정 전 제조 제품의 판매 기한 종료. 강제 회수 조치는 없었음." },
    ],
    response: [
      "1세대 제품 단종, 2세대 제품에 THB 미함유 강조",
      "유럽 CPNP 등록·더마테스트 등 안전성 마케팅으로 전환",
      "부작용 발생 시 소비자분쟁해결기준에 따른 환불만 안내",
    ],
    outcome:
      "제품은 퇴출됐지만 기존 재고는 판매 기한까지 유통됐고, 소비자단체는 자발적 회수와 보상을 요구했다. 회사는 '신중 검토' 입장을 유지했다.",
    lesson:
      "규제가 '예방적 조치'라 강제 회수가 없을 때가 더 위험하다. 기업이 스스로 회수·보상 기준을 정해 발표하지 않으면, 그 공백을 소비자단체와 언론이 채운다.",
    verdict: "mixed",
    sources: [
      { label: "시사저널 · 모다모다 유해성 논란과 유통 (2023-12-19)", url: "https://www.sisajournal.com/news/articleView.html?idxno=279109" },
      { label: "한국일보 · THB 함유 샴푸, 자발적 회수 요구 (2023-12-09)", url: "https://www.hankookilbo.com/news/article/A2023120817070003209" },
    ],
  },
  {
    id: "note7-2016",
    industry: "consumer",
    company: "삼성전자",
    country: "KR",
    date: "2016-08~2017-01",
    title: "갤럭시 노트7 — 단종 후 5개월, 20만 대 재현 실험으로 원인을 공개",
    trigger: "배터리 셀 결함으로 인한 발화·소손",
    scale: ["판매 306만 대 중 330여 대 소손 보고", "완제품 20만 대·배터리 3만 개 재현 실험", "8포인트 배터리 안전검사 도입"],
    timeline: [
      { when: "2016-08-19", what: "출시. 이후 발화 사례가 잇따라 보고." },
      { when: "2016-09-02", what: "1차 리콜(삼성SDI 배터리). 10-11 단종 결정." },
      { when: "2017-01-23", what: "원인 조사 결과 발표. 배터리 자체 결함, 설계·SW 문제는 아님." },
      { when: "2017-03", what: "8포인트 검사·다중 안전장치를 갤럭시S8부터 적용." },
    ],
    response: [
      "1차 리콜 후 2차 리콜, 최종 단종으로 피해 확산 차단",
      "UL·Exponent·TÜV라인란드 등 3개 외부 기관에 독립 조사 의뢰",
      "700여 명 투입, 20만 대 재현 실험으로 소손 조건을 실제로 재현",
      "배터리 공급사에 법적 책임을 묻지 않고 세트메이커 책임을 인정",
    ],
    outcome:
      "단종이라는 최악의 선택을 빠르게 했고, 원인·검증·재발방지 3종을 한자리에서 공개해 '원인 불명' 프레임을 끊었다. 이후 배터리 안전 검사가 업계 표준으로 확산됐다.",
    lesson:
      "원인을 모르면 '모른다'고 말하고 조사 설계를 공개하라. 외부 기관·재현 실험·수치가 붙은 원인 발표는 최악의 사고도 교과서로 바꾼다.",
    verdict: "exemplary",
    sources: [
      { label: "삼성전자 뉴스룸 · 갤럭시 노트7 분석 결과 (2017-01-23)", url: "https://news.samsung.com/kr/인포그래픽-갤럭시-노트7-분석-결과를-알려드립니다" },
      { label: "한국일보 · 8단계 안전검사·재발 방지 (2017-01-23)", url: "https://www.hankookilbo.com/news/article/201701231995046598" },
      { label: "ZDNet Korea · 원인 발표 일문일답 (2017-01-23)", url: "https://zdnet.co.kr/view/?no=20170123120744" },
    ],
  },
  {
    id: "sunday-riley-2019",
    industry: "consumer",
    company: "Sunday Riley Modern Skincare",
    country: "US",
    date: "2019-10",
    title: "선데이 라일리 가짜 리뷰 — 벌금보다 오래 남은 20년 명령",
    trigger: "세포라 리뷰에 직원·대표가 가짜 계정으로 긍정 후기 작성",
    scale: ["2015-11~2018-04 반복", "대표 포함 직원·인턴 동원", "FTC 20년 행정명령"],
    timeline: [
      { when: "2015-11~2017-08", what: "직원들이 가짜 계정으로 제품 리뷰 작성. 세포라가 삭제하자 VPN으로 IP 은닉." },
      { when: "2018-04", what: "인턴에게 가짜 계정 생성 지시." },
      { when: "2019-10", what: "FTC, 허위 추천·이해관계 미공개로 제재 착수." },
      { when: "2020-11-06", what: "최종 동의명령. 대표 개인까지 책임, 위반 시 건당 최대 42,530달러 민사벌금." },
    ],
    response: [
      "초기에는 문제 제기를 부인하는 입장",
      "FTC 조사 후 동의명령 수용, 직원·대행사 대상 고지 의무 수락",
      "이후 리뷰·추천 표시 정책 정비",
    ],
    outcome:
      "현금 과징금은 없었지만 20년간 유지되는 행정명령과 기록 보관 의무가 부과됐다. '가짜 리뷰'가 브랜드 신뢰 자산을 훼손한 대표 사례로 남았다.",
    lesson:
      "리뷰는 광고다. 직원·대행사·인플루언서의 경제적 이해관계 표시는 마케팅 편의가 아니라 법적 의무이며, 위반 시 처벌은 브랜드가 아니라 대표 개인에게도 간다.",
    verdict: "failure",
    sources: [
      { label: "FTC · Sunday Riley 동의명령 (C-4729)", url: "https://consumerlawlibrary.org/decisions/v170-0010" },
      { label: "FTC · Complaint (192 3008)", url: "https://search.ftc.gov/system/files/documents/cases/192_3008_sunday_riley_complaint_0.pdf" },
    ],
  },

  // ── IT·플랫폼·핀테크 ───────────────────────────────────────
  {
    id: "kakao-2022",
    industry: "tech",
    company: "카카오",
    country: "KR",
    date: "2022-10",
    title: "카카오 데이터센터 화재 — 5일 장애를 공개 조사로 바꾼 대응",
    trigger: "판교 SK C&C 데이터센터 배터리실 화재로 전원 공급 중단",
    scale: ["전체 서버의 약 34% 영향", "카톡 복구까지 약 8시간+", "보상 약 275억 원·피해 신고 8.7만 건"],
    timeline: [
      { when: "2022-10-15 15:19", what: "데이터센터 리튬이온 배터리 화재. 약 8시간 후 진화." },
      { when: "2022-10-16", what: "비상대책위원회 출범(원인조사·재발방지·보상 3개 소위). 대표 사과." },
      { when: "2022-10-20", what: "모든 서비스 정상화. 무료 서비스까지 보상 기준 마련 착수." },
      { when: "2022-12-07", what: "if(kakao) dev에서 외부 전문가 원인 분석·재발방지 대책 공개." },
      { when: "2023-06-30", what: "보상 절차 종료. 총 275억 원, 소상공인 205건 지원." },
    ],
    response: [
      "3개 소위(원인조사·재발방지·보상)로 대응 체계를 분리",
      "외부 전문가를 원인조사 소위원장으로 선임해 제3자 분석 공개",
      "무료 서비스까지 보상 기준을 협의체(소상공인연합회·소비자연맹 등)로 결정",
      "데이터센터·운영도구 삼중화, 안산 데이터센터 4,600억 원 투자",
    ],
    outcome:
      "초기 복구 지연과 무료 서비스 보상 기준 부재로 비판을 받았지만, 원인 분석과 보상 절차를 끝까지 공개해 '사후 대응'의 표준을 세웠다. 2023년 보상 절차를 종료했다.",
    lesson:
      "장애 대응의 신뢰는 복구 속도보다 '원인 조사 설계'에서 갈린다. 외부 전문가·협의체·공개 발표를 한 묶음으로 준비하면 최악의 장애도 재발방지 자산이 된다.",
    verdict: "mixed",
    sources: [
      { label: "카카오 · 비상대책위원회 출범 (2022-10-16)", url: "https://www.kakaocorp.com/page/detail/9806" },
      { label: "카카오 · 재발방지 대책 발표 (2022-12-07)", url: "https://www.kakaocorp.com/page/detail/9843" },
      { label: "카카오 · 1015 장애 피해 지원 마무리 (2023-06-30)", url: "https://www.kakaocorp.com/page/detail/10540" },
    ],
  },
  {
    id: "kt-2021",
    industry: "tech",
    company: "KT",
    country: "KR",
    date: "2021-10",
    title: "KT 인터넷 먹통 — '디도스'라던 원인이 라우팅 오류로 바뀌기까지",
    trigger: "협력사 직원의 주간 라우팅 작업 오류가 전국망으로 확산",
    scale: ["11:20~12:04 전국 유·무선 장애", "최장 89분", "보상 최대 400억 원"],
    timeline: [
      { when: "2021-10-25 11:20", what: "전국 KT 유·무선 인터넷 장애. 12:04 대부분 복구." },
      { when: "2021-10-25 낮", what: "1차 입장 '대규모 디도스 공격' → 정부 확인 후 '라우팅 오류'로 정정." },
      { when: "2021-11-01", what: "재발방지·보상안 발표. 개인 15시간, 소상공인 10일 기준, 12월 일괄 감면." },
    ],
    response: [
      "장애 시간의 10배(15시간) 보상, 소상공인 10일 기준 보상, 신청 없이 일괄 감면",
      "네트워크혁신TF, 가상화 테스트베드, 라우팅 오류 확산 방지, OTP 작업 승인",
      "전담 콜센터·웹페이지 2주 운영",
    ],
    outcome:
      "보상은 업계 기준으로는 이례적으로 컸지만 1인당 평균 1,000원 수준이라 비판을 받았다. 초기 원인 오보는 '책임 회피' 논란을 키웠다.",
    lesson:
      "원인을 모를 때는 '추정'이라고 말하라. 확정처럼 말한 원인이 틀리면 두 번째 사고가 되고, 보상 총액보다 1인당 체감액이 기사가 된다.",
    verdict: "mixed",
    sources: [
      { label: "전기신문 · KT 재발방지·보상안 (2021-11-01)", url: "https://www.electimes.com/news/articleView.html?idxno=224578" },
      { label: "The Korea Times · 400억 원 보상 (2021-11-01)", url: "https://www.koreatimes.co.kr/business/tech-science/20211101/kt-to-pay-w40-bil-in-compensation-for-network-outage" },
      { label: "경향신문 · 원인과 보상 (2021-10-25)", url: "https://www.khan.co.kr/article/202110251426001" },
    ],
  },
  {
    id: "crowdstrike-2024",
    industry: "tech",
    company: "CrowdStrike",
    country: "GLOBAL",
    date: "2024-07",
    title: "CrowdStrike 글로벌 장애 — 8.5백만 대를 멈춘 업데이트",
    trigger: "Falcon 센서 콘텐츠 업데이트의 입력 필드 불일치로 윈도우 시스템 크래시",
    scale: ["윈도우 기기 850만 대", "Fortune 500 직접 손실 약 54억 달러 추정", "RCA 8월 6일 공개"],
    timeline: [
      { when: "2024-07-19", what: "글로벌 항공·병원·은행 시스템 마비. CEO 당일 사과·수정 배포." },
      { when: "2024-07-21", what: "마이크로소프트, USB 복구 도구 배포. 850만 대 규모 확인." },
      { when: "2024-07-24", what: "예비 보고서(PIR) 공개, 보험 손실 최대 10억 달러 추정." },
      { when: "2024-08-06", what: "원인 분석 보고서(RCA) 공개. 20개 필드 vs 21개 필드 불일치." },
    ],
    response: [
      "당일 CEO 명의 사과와 '사이버 공격 아님' 명시로 2차 공포 차단",
      "고객 대상 복구 가이드·USB 도구·BitLocker 대응 절차 제공",
      "RCA와 재발방지(단계적 배포·검증) 공개, 고객 통제권 확대",
    ],
    outcome:
      "기술적 원인과 복구 절차를 빠르게 공개했지만, 전 세계적 피해 규모와 보상 범위(항공사 손실 등)를 둘러싼 분쟁이 이어졌다.",
    lesson:
      "공급자 사고는 '우리 잘못'을 가장 먼저 말해야 고객이 복구에 집중할 수 있다. 원인·복구 도구·재발방지 3종을 24시간·2주·1개월 순으로 공개하라.",
    verdict: "mixed",
    sources: [
      { label: "CrowdStrike · 고객·파트너 서한 (2024-07-19)", url: "https://www.crowdstrike.com/en-us/blog/to-our-customers-and-partners/" },
      { label: "CISA · 광범위 IT 장애 (2024-07-19)", url: "https://www.cisa.gov/news-events/alerts/2024/07/19/widespread-it-outage-due-crowdstrike-update" },
      { label: "Cybersecurity Dive · RCA (2024-08-07)", url: "https://www.cybersecuritydive.com/news/crowdstrike-mismatch-falcon-sensor-outage/723569/" },
    ],
  },

  // ── 철강·제조·중공업 ───────────────────────────────────────
  {
    id: "kim-yonggyun-2018",
    industry: "steel",
    company: "한국서부발전 태안화력발전소·한국발전기술",
    country: "KR",
    date: "2018-12",
    title: "김용균 사망 — '협력업체 소속'이라는 첫 문장의 비용",
    trigger: "하청 노동자가 홀로 컨베이어벨트 점검 중 끼임 사망",
    scale: ["24세 하청 노동자 1명 사망", "정부 합동대책까지 6일", "산업안전보건법 전부개정('김용균법')"],
    timeline: [
      { when: "2018-12-10", what: "태안화력발전소에서 김용균 씨 사망. 2인 1조 규정·안전 울타리 미비." },
      { when: "2018-12-17", what: "고용노동부·산업부 장관 합동대책 발표, 유가족·국민에 사과." },
      { when: "2018-12-27", what: "국회, 원청 책임 강화 산업안전보건법 전부개정안 통과." },
      { when: "2019-12", what: "특별조사위 권고 22개 중 대부분 미이행 비판. '김용균 없는 김용균법' 지적." },
    ],
    response: [
      "사고 6일 후 장관 합동 사과와 전국 석탄화력 긴급점검",
      "2인 1조·6개월 미만 단독작업 금지·안전 울타리 보완",
      "특별산업안전조사위 구성, 산안법 개정으로 원청 책임 확대",
    ],
    outcome:
      "제도는 바뀌었지만 발전업 등 전기업종이 도급 금지 대상에서 빠지고 권고 이행이 더뎌 '법은 생겼지만 현장은 그대로'라는 비판이 남았다.",
    lesson:
      "첫 문장에서 '협력업체 소속'을 말하는 순간 위험의 외주화 프레임이 고정된다. 원청 책임 인정 → 작업중지 → 유가족 지원 순서가 유일한 순서다.",
    verdict: "failure",
    sources: [
      { label: "정책브리핑 · 태안화력 사고 합동 대책 (2018-12-17)", url: "https://www.korea.kr/briefing/policyBriefingView.do?newsId=156309220" },
      { label: "경향신문 · 외주화 근본 대책 부재 (2018-12-17)", url: "https://www.khan.co.kr/article/201812171532011" },
      { label: "서울신문 · '김용균 없는 김용균법' (2019-12-09)", url: "https://www.seoul.co.kr/news/society/2019/12/09/20191209008006" },
    ],
  },
  {
    id: "aricell-2024",
    industry: "steel",
    company: "아리셀 (에스코넥 계열)",
    country: "KR",
    date: "2024-06",
    title: "화성 아리셀 화재 — 하청·파견 구조가 피해를 키웠다",
    trigger: "리튬 1차전지 공장 포장 작업장에서 발화, 대피 훈련 미실시",
    scale: ["사망 23명·부상 8명", "사망자 중 20명 하청업체 소속", "외국인 사망자 18명"],
    timeline: [
      { when: "2024-06-24 10:31", what: "화성 서신면 아리셀 공장 화재. 사상자 31명." },
      { when: "2024-06-27", what: "유전자 대조로 신원 확인. 사망자 23명 중 20명이 사내하청 메이셀 소속." },
      { when: "2024-06-28", what: "고용노동부, 불법파견 의혹 수사팀 구성." },
      { when: "2024-08-23", what: "경찰, 대표 등 4명 구속영장 신청. 안전교육·대피훈련 미실시 확인." },
    ],
    response: [
      "중앙사고수습본부 가동, 유가족 장례·법률·보상 절차 안내",
      "압수수색·원인 조사, 산안법·중대재해처벌법 위반 여부 수사 협조",
      "회사 측은 '불법 파견 없었고 안전교육도 충분했다'고 부인",
    ],
    outcome:
      "대표 등이 구속영장이 청구되고, 위험의 외주화·불법 파견 문제가 전 산업으로 확대됐다. 유가족 지원과 산재 처리 절차는 이어졌다.",
    lesson:
      "'안전교육을 충분히 했다'는 부인은 사망자 소속·훈련 기록·대피 절차 앞에서 즉시 무너진다. 하청·파견 인력의 안전 기록을 원청이 직접 보관해야 한다.",
    verdict: "failure",
    sources: [
      { label: "한겨레 · 사망자 23명 중 하청 20명 (2024-06-27)", url: "https://www.hani.co.kr/arti/society/labor/1146768.html" },
      { label: "중앙일보 · 외국인 사망자 전원 파견 의혹 (2024-06-25)", url: "https://www.joongang.co.kr/article/25259017" },
      { label: "KBS · 수사결과·대표 영장 (2024-08-23)", url: "https://news.kbs.co.kr/news/pc/view/view.do?ncd=8042499" },
    ],
  },
  {
    id: "posco-hinnamnor-2022",
    industry: "steel",
    company: "포스코",
    country: "KR",
    date: "2022-09",
    title: "포스코 포항제철소 침수 — 1주일 만의 고로 재가동과 3개월 공급 약속",
    trigger: "태풍 힌남노로 냉천 범람, 포항제철소 전 공정 침수",
    scale: ["고로 3기 전면 중단(1973년 이후 최초)", "복구 인력 3만여 명", "3개월 내 전 제품 재공급 약속"],
    timeline: [
      { when: "2022-09-06", what: "최대 500mm 폭우로 포항제철소 침수. 고로 3기 가동 중단, 하루 500억 원 손실 추정." },
      { when: "2022-09-12", what: "민·관·군 합동 복구로 전체 고로 재가동. 압연라인 배수 90%." },
      { when: "2022-09-21", what: "고객사 재고 2~3개월분, 3개월 내 전 제품 재공급·광양 대체 생산 계획 발표." },
      { when: "2022-10~12", what: "공장별 단계적 재가동. 열연 유통가 2주 만에 톤당 5만 원 상승." },
    ],
    response: [
      "고로 '골든타임(5일)'을 넘기지 않기 위해 24시간 민·관·군 합동 복구",
      "고객사·유통점 재고 수치와 품목별 재공급 일정을 구체적으로 공개",
      "광양·해외 법인 대체 생산, 수급점검 TF·민관 조사단과 공동 대응",
    ],
    outcome:
      "1주일 만에 고로를 되살려 '수개월 중단' 최악의 시나리오를 피했다. 다만 철강 가격 상승과 일부 제품 공급 차질은 현실화됐다.",
    lesson:
      "자연재해도 '수치와 일정'으로 평가된다. 재고·대체 생산·품목별 재개 시점을 공개하면 공급망 공포를 가격 폭등 전에 잠재울 수 있다.",
    verdict: "exemplary",
    sources: [
      { label: "연합뉴스 · 3개월 내 전 제품 재공급 (2022-09-21)", url: "https://www.yna.co.kr/view/AKR20220921082851003" },
      { label: "연합뉴스 · 일주일 만에 고로 재가동 (2022-09-14)", url: "https://www.yna.co.kr/view/AKR20220914108000003" },
      { label: "산업통상자원부 · 철강 수해복구·수급점검 TF (2022-09-14)", url: "https://www.motir.go.kr/kor/article/ATCL3f49a5a8c/166015/view" },
    ],
  },

  // ── 엔터·콘텐츠 ────────────────────────────────────────────
  {
    id: "hybe-adore-2024",
    industry: "entertainment",
    company: "하이브·어도어",
    country: "KR",
    date: "2024-04",
    title: "하이브–민희진 — 내부 분쟁이 문서 공개 경쟁이 된 72시간",
    trigger: "모회사의 자회사 감사 착수, 경영권 탈취 의혹과 주주간계약 갈등",
    scale: ["감사 착수 4/22", "기자회견 2시간 15분", "양측 입장문·대화록 수차례 공개"],
    timeline: [
      { when: "2024-04-22", what: "하이브, 어도어 감사 착수. 민 대표 측에 답변 이메일 발송." },
      { when: "2024-04-25", what: "하이브 중간 감사 결과·고발 발표. 민 대표 긴급 기자회견(2시간 15분)." },
      { when: "2024-04-26", what: "하이브, 12개 항목 반박 입장문과 메일·대화록 공개. '노예계약' 논쟁." },
      { when: "2024-05~", what: "법원 가처분·본안 소송으로 이동. 아티스트 활동·광고 일정에 영향." },
    ],
    response: [
      "하이브: 감사 결과·대화록·메일 기록을 단계적으로 공개하며 '경영권 탈취' 프레임 강화",
      "민 대표: 기자회견에서 '마녀사냥' 프레임과 주주간계약 불공정성 제기",
      "양측 모두 아티스트·팬을 언급하며 정당성 확보",
    ],
    outcome:
      "여론은 진영으로 갈렸고, 사안은 법원으로 이동했다. 아티스트 활동과 광고 계약에 대한 우려가 반복됐고, '내부 문서 공개'가 이후 분쟁의 기본값이 됐다.",
    lesson:
      "내부 분쟁을 언론으로 옮기면 상대도 문서를 공개한다. 공개 범위·시점·아티스트 보호선을 먼저 정하고, 계약 쟁점은 법률 절차로 분리하라.",
    verdict: "mixed",
    sources: [
      { label: "연합뉴스 · 기자회견과 고발 (2024-04-25)", url: "https://www.yna.co.kr/view/AKR20240425153800005" },
      { label: "연합뉴스 · 주주간계약 쟁점 (2024-04-26)", url: "https://www.yna.co.kr/view/AKR20240426137151005" },
      { label: "서울경제 · 하이브 반박 전문 (2024-04-26)", url: "https://www.sedaily.com/article/13881434" },
    ],
  },
  {
    id: "kim-hojoong-2024",
    industry: "entertainment",
    company: "김호중·생각엔터테인먼트",
    country: "KR",
    date: "2024-05",
    title: "김호중 음주 뺑소니 — 세 번의 부인이 실형으로 돌아왔다",
    trigger: "음주운전 접촉사고 후 도주, 매니저 허위 자수·블랙박스 제거",
    scale: ["5일간 3차례 음주 부인", "1심 징역 2년 6월", "대표 징역 2년·본부장 2년 6월"],
    timeline: [
      { when: "2024-05-09 23:40", what: "강남 신사동에서 택시 접촉사고 후 도주." },
      { when: "2024-05-14", what: "사고 보도. 소속사 '음주 아니다', 매니저가 자수했다는 입장." },
      { when: "2024-05-19", what: "음주운전 시인. '상황을 숨기기에 급급했다'고 인정." },
      { when: "2024-11-13", what: "1심 징역 2년 6월. 재판부 '범행 후 정황 불량' 지적." },
    ],
    response: [
      "1차: 음주 측정 결과 음주 없음, 매니저 자발적 자수라고 해명",
      "2차: 대표가 '매니저에게 허위 자수를 부탁했다'고 번복, '공황' 때문이라고 설명",
      "3차: 증거가 쌓이자 음주운전 인정, 임직원 전원 퇴사·대표 교체",
    ],
    outcome:
      "허위 해명이 사법방해로 이어져 양형에 불리하게 작용했다. 소속사 대표와 임원도 실형을 받았다.",
    lesson:
      "위기에서 거짓 해명은 사과가 아니라 증거인멸의 출발점이 된다. 확인되지 않은 혐의는 '확인 중'이 아니라 '확인 항목과 기한'으로 말하고, 이해충돌이 있는 사람은 대응에서 분리하라.",
    verdict: "failure",
    sources: [
      { label: "노컷뉴스 · 거짓 해명의 자충수 (2024-05-21)", url: "https://www.nocutnews.co.kr/news/6147543" },
      { label: "일요신문 · 1심 선고와 대응 전략 (2024-11-14)", url: "https://www.ilyo.co.kr/?ac=article_view&entry_id=482101" },
      { label: "아주경제 · 허위 자수·입장 번복 (2024-05-16)", url: "https://www.ajunews.com/view/20240516161223668" },
    ],
  },
  {
    id: "produce101-2019",
    industry: "entertainment",
    company: "CJ ENM·Mnet",
    country: "KR",
    date: "2019-07~2020-07",
    title: "프로듀스101 조작 — 5개월의 침묵, 구체성 없는 사과",
    trigger: "시청자 유료 문자투표 순위 조작",
    scale: ["전 시즌 조작", "사과까지 5개월", "300억 원 펀드 조성·방심위 과징금"],
    timeline: [
      { when: "2019-07", what: "시즌4 최종회 득표수 패턴 논란. 시청자 진상규명위 구성." },
      { when: "2019-12-30", what: "CJ ENM 대표 기자회견. 사과와 300억 원 펀드 발표. 구체적 보상안은 없음." },
      { when: "2020-07", what: "방심위, 과징금 의견 만장일치. 유료투표 환불 미이행 지적." },
    ],
    response: [
      "대표 명의 사과, 피해 연습생 보상·활동 지원 약속",
      "300억 원 규모 K팝 펀드 조성, 외부 독립기관 운영",
      "투표 관리시스템·시청자위원회·윤리강령 정비",
    ],
    outcome:
      "사과는 나왔지만 피해자·보상 범위가 특정되지 않아 '원론적 답변' 비판이 이어졌다. 유료투표 환불은 현실화되지 않았고, 방심위 제재로 이어졌다.",
    lesson:
      "사과의 속도보다 '누구에게 무엇을 어떻게'가 중요하다. 보상 대상이 확정되지 않았더라도 접수 창구·기준·일정을 먼저 열어야 신뢰가 생긴다.",
    verdict: "failure",
    sources: [
      { label: "YTN · CJ ENM 공식 사과, 구체성 미흡 (2019-12-30)", url: "https://www.ytn.co.kr/_ln/0117_201912301650410052" },
      { label: "중앙일보 · 대표 사과·300억 펀드 (2019-12-30)", url: "https://www.joongang.co.kr/article/23669037" },
      { label: "노컷뉴스 · 방심위 과징금·미이행 보상 (2020-07-22)", url: "https://www.nocutnews.co.kr/news/5383014" },
    ],
  },
];

/** 초기 20건에 유형·입장 분류를 덧붙이는 표. 입장은 출처로 확인되는 경우에만 채웁니다. */
const LEGACY_META: Record<string, { type: CaseType; stance?: CaseStance; tags: string[] }> = {
  "egg-fipronil-2017": { type: "product-safety", stance: "investigating", tags: ["살충제", "회수", "전수조사"] },
  "chipotle-ecoli-2015": { type: "product-safety", stance: "apology", tags: ["E. coli", "식중독", "매장 폐쇄"] },
  "mcdonalds-onion-2024": { type: "product-safety", stance: "investigating", tags: ["E. coli", "공급사", "양파"] },
  "timon-wemakep-2024": { type: "financial", tags: ["정산 지연", "판매자", "카드사"] },
  "coupang-2021": { type: "data-breach", stance: "apology", tags: ["주소 노출", "개인정보"] },
  "coupang-2025": { type: "data-breach", stance: "apology", tags: ["계정 유출", "개인정보"] },
  "target-2013": { type: "data-breach", stance: "apology", tags: ["카드정보", "CEO 사임", "협력사"] },
  "humidifier-2011": { type: "product-safety", stance: "silence", tags: ["가습기 살균제", "사망", "침묵"] },
  "modamoda-2023": { type: "product-safety", tags: ["염색샴푸", "금지 원료", "회수"] },
  "note7-2016": { type: "product-safety", stance: "apology", tags: ["배터리", "발화", "단종"] },
  "sunday-riley-2019": { type: "false-claim", tags: ["가짜 리뷰", "FTC"] },
  "kakao-2022": { type: "outage", stance: "apology", tags: ["데이터센터", "화재", "보상"] },
  "kt-2021": { type: "outage", tags: ["통신 장애", "디도스", "라우팅"] },
  "crowdstrike-2024": { type: "outage", stance: "apology", tags: ["업데이트", "글로벌 장애"] },
  "kim-yonggyun-2018": { type: "industrial-accident", stance: "rebuttal", tags: ["하청", "원청 책임", "끼임"] },
  "aricell-2024": { type: "industrial-accident", tags: ["화재", "파견", "리튬"] },
  "posco-hinnamnor-2022": { type: "disaster", tags: ["태풍", "침수", "고로"] },
  "hybe-adore-2024": { type: "governance", stance: "rebuttal", tags: ["경영권", "기자회견", "문서 공개"] },
  "kim-hojoong-2024": { type: "celebrity", stance: "rebuttal", tags: ["음주운전", "부인", "실형"] },
  "produce101-2019": { type: "misconduct", stance: "silence", tags: ["투표 조작", "방송"] },
};

const NEW_CASES = [
  ...(food as unknown as CrisisCase[]),
  ...(construction as unknown as CrisisCase[]),
  ...(pharma as unknown as CrisisCase[]),
];

export const CRISIS_CASES: CrisisCase[] = [
  ...LEGACY_CASES.map((c) => {
    const meta = LEGACY_META[c.id];
    return { ...c, type: meta.type, stance: meta.stance, tags: meta.tags } as CrisisCase;
  }),
  ...NEW_CASES,
];

export const CASE_VERDICT_LABEL: Record<CrisisCase["verdict"], string> = {
  exemplary: "모범 대응",
  mixed: "혼합",
  failure: "실패 사례",
};

export const CASE_TYPE_LABEL: Record<CaseType, string> = {
  "product-safety": "제품·식품 안전",
  "false-claim": "허위·과장·조작",
  "data-breach": "개인정보·보안",
  outage: "서비스 장애",
  "industrial-accident": "산업재해·사고",
  disaster: "재난·자연재해",
  "owner-risk": "오너·경영진 리스크",
  labor: "노사·고용",
  celebrity: "연예·인물",
  financial: "정산·횡령·금융",
  governance: "경영권·지배구조",
  misconduct: "부정·비위",
  statement: "발언·광고 논란",
  environment: "환경·주민",
  regulatory: "규제·제재",
};

export const CASE_STANCE_LABEL: Record<CaseStance, string> = {
  apology: "사실 인정·사과",
  investigating: "경위 확인 중",
  rebuttal: "반박·부인",
  silence: "침묵·지연",
};

export const casesForIndustry = (industry: CrisisCase["industry"]) =>
  CRISIS_CASES.filter((c) => c.industry === industry);

export const CASE_BY_ID = new Map(CRISIS_CASES.map((c) => [c.id, c]));
