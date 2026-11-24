import { getStance } from "./stances";
import { countPlaceholders, type ResponsePackage } from "./package";
import type { ChannelKit } from "./channels";
import { internalToText, socialToText } from "./channels";
import type { Scorecard } from "./scorecard";
import { getSituation } from "./situations";

/**
 * 임원 보고서 내보내기 — 화면 미리보기(인쇄/PDF)와 파일 다운로드(.md / .doc HTML)에 같은 내용을 씁니다.
 * 고객사 내부 자료이므로 문안에 개인정보·API 키는 넣지 않고, 작성 주체(PRISM)만 남깁니다.
 */

const esc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function reportFilename(pkg: ResponsePackage, ext: "md" | "doc"): string {
  const stamp = new Date(pkg.createdAt);
  const ymd = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}`;
  const clean = (value: string) => value.replace(/[\\/:*?"<>|\[\]\n]/g, "").replace(/\s+/g, "-").slice(0, 24) || "보고서";
  return `PRISM_${clean(pkg.brand)}_${clean(pkg.caseTypeLabel ?? pkg.eventLabel)}_${ymd}.${ext}`;
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/* ------------------------------------------------------------------ */
/* 마크다운                                                            */
/* ------------------------------------------------------------------ */

export function buildExecutiveMarkdown(pkg: ResponsePackage, card: Scorecard, kit: ChannelKit): string {
  const stance = getStance(pkg.stance, pkg.stanceCustom);
  const situations = (pkg.situations ?? []).map((id) => getSituation(id)?.label).filter((v): v is string => Boolean(v));
  const out: string[] = [];

  out.push(`# ${pkg.brand} — ${pkg.caseTypeLabel ?? pkg.eventLabel} 임원 보고서`);
  out.push("");
  out.push(`> ${pkg.headline}`);
  out.push("");
  out.push("## 0. 문서 정보");
  out.push("");
  out.push("| 항목 | 내용 |");
  out.push("| --- | --- |");
  out.push(`| 작성 | PRISM 위기 대응 워크스페이스 (${pkg.mode === "ai" ? `실시간 AI${pkg.ai?.model ? ` · ${pkg.ai.model}` : ""}` : "매뉴얼 엔진"}) |`);
  out.push(`| 작성 시각 | ${dateLabel(pkg.createdAt)} |`);
  out.push(`| 대상 브랜드 | ${pkg.brand} |`);
  out.push(`| 이슈 유형 | ${pkg.caseTypeLabel ?? "자동 판별 불가"}${pkg.caseTypeSource === "manual" ? " (직접 선택)" : ""} |`);
  out.push(`| 업종 | ${pkg.industryLabel}${pkg.industrySource === "manual" ? " (직접 선택)" : ""} |`);
  out.push(`| 선택한 입장 | ${stance.label}${pkg.stanceCustom ? ` — ${pkg.stanceCustom}` : ""} |`);
  if (situations.length) out.push(`| 기업 상황 | ${situations.join(" · ")}${pkg.situationNote ? ` · ${pkg.situationNote}` : ""} |`);
  out.push(`| 위험도(패키지 판정) | ${pkg.risk} |`);
  out.push(`| 종합 위험지수 | ${card.overall}/100 · ${card.band.label} |`);
  out.push("");
  out.push("### 상황");
  out.push("");
  out.push(pkg.situation.replace(/\n+/g, " "));
  if (pkg.fetch?.ok && pkg.fetch.url) {
    out.push("");
    out.push(`- 기사 원문: ${pkg.fetch.url}${pkg.fetch.title ? ` (${pkg.fetch.title})` : ""}`);
  }
  if (pkg.fetch && !pkg.fetch.ok) {
    out.push("");
    out.push(`- 기사 본문을 읽지 못했습니다: ${pkg.fetch.note ?? "접근 제한"} — 입력 설명과 매뉴얼 기준으로 작성했습니다.`);
  }
  out.push("");
  out.push("## 1. 경영진 요약");
  out.push("");
  out.push(`**진단** — ${pkg.headline}`);
  out.push("");
  out.push(`**대응 원칙** — ${pkg.strategy}`);
  out.push("");
  out.push(`**종합 위험지수 ${card.overall}/100 (${card.band.label})** — ${card.band.desc}`);
  out.push("");
  out.push("| 축 | 점수 | 해석 |");
  out.push("| --- | --- | --- |");
  for (const axis of card.axes) out.push(`| ${axis.label} | ${axis.value} | ${axis.reasons[0] ?? ""} |`);
  out.push("");
  out.push(`> ${card.note}`);
  out.push("");
  if (pkg.issueBrief) {
    out.push("### 먼저 잡아야 할 쟁점");
    out.push("");
    pkg.issueBrief.issues.forEach((issue, i) => out.push(`${i + 1}. **${issue.title}** — ${issue.detail}`));
    out.push("");
    if (pkg.issueBrief.factsToConfirm.length) {
      out.push("**보고 전에 숫자로 채워야 할 항목**");
      out.push("");
      pkg.issueBrief.factsToConfirm.forEach((fact) => out.push(`- [ ] ${fact}`));
      out.push("");
    }
  }

  out.push("## 2. 사건 조사 — 확인된 것과 확인할 것");
  out.push("");
  if (pkg.investigation) {
    const inv = pkg.investigation;
    out.push(`> 조사 파일 ${inv.fileNo} · ${inv.source === "ai" ? "실시간 AI 생성" : "매뉴얼 엔진 생성"}`);
    out.push("");
    out.push(`**개요** — ${inv.summary}`);
    out.push("");
    if (inv.trigger) out.push(`**촉발 요인** — ${inv.trigger}`);
    out.push("");
    for (const line of inv.background) out.push(`- ${line}`);
    out.push("");
    const regulators = inv.context.filter((c) => c.kind === "regulator");
    const laws = inv.context.filter((c) => c.kind === "law");
    if (regulators.length) out.push(`**규제 접점** — ${regulators.map((c) => `${c.name}(${c.note})`).join(" / ")}`);
    if (laws.length) out.push(`**관련 법령** — ${laws.map((c) => `${c.name}(${c.note})`).join(" / ")}`);
    out.push("");
    out.push("### 핵심 쟁점 및 여론·보도 포인트");
    out.push("");
    inv.issues.forEach((issue, i) => out.push(`${i + 1}. **(${issue.side})** ${issue.title ? `**${issue.title}** — ` : ""}${issue.detail}`));
    out.push("");
    out.push("### 실무 팩트체크 — 대외 발표 전에 닫아야 하는 항목");
    out.push("");
    inv.checks.forEach((c) => out.push(`- [ ] **${c.item}** _(${c.team})_ — ${c.why}${c.question ? ` / 기자 질문: ${c.question}` : ""}`));
    out.push("");
    if (inv.evidence.length) {
      out.push("### 확보해 둘 증거");
      out.push("");
      inv.evidence.forEach((e) => out.push(`- ${e}`));
      out.push("");
    }
    if (inv.pattern.length) {
      out.push("### 이 유형이 커지는 경로");
      out.push("");
      inv.pattern.forEach((p, i) => out.push(`${i + 1}. ${p}`));
      out.push("");
    }
    if (inv.precedent) {
      out.push("### 참고 사례");
      out.push("");
      out.push(`- ${inv.precedent.company} — ${inv.precedent.title} (${inv.precedent.date})`);
      out.push(`  - 교훈: ${inv.precedent.takeaway}`);
      out.push("");
    }
  }

  out.push("## 3. 골든타임 실행 체크리스트");
  out.push("");
  for (const phase of pkg.roadmap) {
    out.push(`### ${phase.window} — ${phase.title}`);
    out.push(`- 목표: ${phase.goal}`);
    out.push(`- 통과 기준: ${phase.gate}`);
    out.push("");
  }
  for (const group of pkg.actions) {
    out.push(`### ${group.window} — ${group.title}`);
    group.items.forEach((item) => out.push(`- [ ] ${item.text}${item.owner ? ` _(${item.owner})_` : ""}`));
    out.push("");
  }

  out.push("## 4. 4채널 실행 문안");
  out.push("");
  out.push("### ① 공식 입장문·보도자료");
  out.push("");
  pkg.statements.forEach((s) => {
    out.push(`#### ${s.label} · ${s.channel}`);
    out.push(`**${s.title}**`);
    out.push("");
    out.push("```text");
    out.push(s.body);
    out.push("```");
    out.push("");
  });
  out.push("### ② 기자 예상 Q&A · 핵심 방어 논리");
  out.push("");
  out.push("**핵심 방어 논리**");
  out.push("");
  kit.defense.forEach((point, i) => {
    out.push(`${i + 1}. **${point.frame}** — ${point.line}`);
    out.push(`   - 필요한 근거: ${point.proof}`);
    out.push(`   - 피할 말: ${point.avoid}`);
  });
  out.push("");
  out.push("**브릿지 문장**");
  out.push("");
  kit.bridge.forEach((line) => out.push(`- ${line}`));
  out.push("");
  pkg.qa.forEach((q, i) => {
    out.push(`**Q${i + 1}. ${q.question}**`);
    out.push("");
    out.push(q.answer);
    if (q.guide) out.push(`\n> 요령: ${q.guide}`);
    if (q.avoid.length) out.push(`> 피할 말: ${q.avoid.join(", ")}`);
    out.push("");
  });
  if (pkg.banned.length) {
    out.push("**금기 표현**");
    out.push("");
    pkg.banned.forEach((b) => out.push(`- **${b.phrase}** — ${b.why}`));
    out.push("");
  }
  out.push("### ③ 사내 임직원 공지문");
  out.push("");
  out.push("```text");
  out.push(internalToText(kit.internal));
  out.push("```");
  out.push("");
  out.push("### ④ SNS 공식 계정 공지 · 댓글 대응");
  out.push("");
  out.push("```text");
  out.push(socialToText(kit.social));
  out.push("```");
  out.push("");

  out.push("## 5. 유관기관·이해관계자 대응");
  out.push("");
  pkg.stakeholders.forEach((s) => {
    out.push(`### ${s.who} (${s.when} 내)`);
    out.push(`- 할 일: ${s.action}`);
    if (s.line) out.push(`- 첫 문장: “${s.line}”`);
    out.push("");
  });

  out.push("## 6. 예상 여론과 악화 시 다음 대응");
  out.push("");
  pkg.outlook.reactions.forEach((r) => out.push(`- [${r.channel}] ${r.text}`));
  out.push("");
  out.push("**악화 트리거**");
  pkg.outlook.triggers.forEach((t, i) => out.push(`${i + 1}. ${t}`));
  out.push("");
  out.push("**악화 시 다음 대응**");
  pkg.outlook.escalation.forEach((t, i) => out.push(`${i + 1}. ${t}`));
  out.push("");
  if (pkg.watchouts.length) {
    out.push("**이 유형에서만 생기는 함정**");
    pkg.watchouts.forEach((w) => out.push(`- ${w}`));
    out.push("");
  }

  out.push("---");
  out.push("");
  out.push(
    `PRISM 보고서 · 대괄호 [확인 필요] 값 ${countPlaceholders(pkg.statements.map((s) => s.body).join("\n"))}곳을 채우면 그대로 배포할 수 있습니다. 확인되지 않은 사실은 만들지 않았습니다.`,
  );
  out.push("");
  out.push("_내부 검토용 문서입니다. 외부 배포 전 커뮤니케이션 책임자 승인을 받으세요._");
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* Word(.doc) · 인쇄용 HTML                                            */
/* ------------------------------------------------------------------ */

const SECTION = (title: string, body: string) => `<section><h2>${esc(title)}</h2>${body}</section>`;

const pre = (text: string) => `<pre>${esc(text)}</pre>`;

const list = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

export function buildExecutiveHtml(pkg: ResponsePackage, card: Scorecard, kit: ChannelKit, opts: { standalone?: boolean } = {}): string {
  const stance = getStance(pkg.stance, pkg.stanceCustom);
  const situations = (pkg.situations ?? []).map((id) => getSituation(id)?.label).filter((v): v is string => Boolean(v));
  const bandColor = card.band.color;

  const axisRows = card.axes
    .map(
      (axis) => `<tr>
  <td class="axis">${esc(axis.label)}</td>
  <td class="score"><b style="color:${axis.value >= 70 ? "#b02a22" : axis.value >= 50 ? "#96620d" : "#17694c"}">${axis.value}</b><span class="bar"><i style="width:${axis.value}%"></i></span></td>
  <td class="why">${esc(axis.reasons[0] ?? "")}</td>
</tr>`,
    )
    .join("");

  const metaRows = [
    ["작성", `PRISM 위기 대응 워크스페이스 (${pkg.mode === "ai" ? `실시간 AI${pkg.ai?.model ? ` · ${pkg.ai.model}` : ""}` : "매뉴얼 엔진"})`],
    ["작성 시각", dateLabel(pkg.createdAt)],
    ["대상 브랜드", pkg.brand],
    ["이슈 유형", `${pkg.caseTypeLabel ?? "자동 판별 불가"}${pkg.caseTypeSource === "manual" ? " (직접 선택)" : ""}`],
    ["업종", `${pkg.industryLabel}${pkg.industrySource === "manual" ? " (직접 선택)" : ""}`],
    ["선택한 입장", `${stance.label}${pkg.stanceCustom ? ` — ${pkg.stanceCustom}` : ""}`],
    ...(situations.length ? [["기업 상황", `${situations.join(" · ")}${pkg.situationNote ? ` · ${pkg.situationNote}` : ""}`]] : []),
    ["종합 위험지수", `${card.overall}/100 · ${card.band.label}`],
  ]
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join("");

  const statementHtml = pkg.statements
    .map(
      (s) => `<div class="doc">
  <div class="doc-head">${esc(s.label)} · ${esc(s.channel)}</div>
  <div class="doc-title">${esc(s.title)}</div>
  ${pre(s.body)}
</div>`,
    )
    .join("");

  const defenseHtml = `<ol class="defense">${kit.defense
    .map(
      (p) => `<li><b>${esc(p.frame)}</b> — ${esc(p.line)}<br><span class="muted">필요한 근거: ${esc(p.proof)} · 피할 말: ${esc(p.avoid)}</span></li>`,
    )
    .join("")}</ol><p class="muted"><b>브릿지 문장</b><br>${kit.bridge.map((b) => esc(b)).join("<br>")}</p>`;

  const qaHtml = pkg.qa
    .map(
      (q, i) => `<div class="qa"><div class="q">Q${i + 1}. ${esc(q.question)}</div><div class="a">${esc(q.answer).replace(/\n/g, "<br>")}</div>${
        q.guide ? `<div class="muted">요령: ${esc(q.guide)}</div>` : ""
      }${q.avoid.length ? `<div class="muted">피할 말: ${esc(q.avoid.join(", "))}</div>` : ""}</div>`,
    )
    .join("");

  const actionHtml = `<table class="grid"><thead><tr><th>구간</th><th>항목</th><th>담당</th></tr></thead><tbody>${pkg.actions
    .flatMap((g) => g.items.map((item, i) => `<tr><td>${i === 0 ? esc(`${g.window} · ${g.title}`) : ""}</td><td>${esc(item.text)}</td><td>${esc(item.owner)}</td></tr>`))
    .join("")}</tbody></table>`;

  const stakeholderHtml = `<table class="grid"><thead><tr><th>대상</th><th>시한</th><th>할 일</th><th>첫 문장</th></tr></thead><tbody>${pkg.stakeholders
    .map((s) => `<tr><td>${esc(s.who)}</td><td>${esc(s.when)}</td><td>${esc(s.action)}</td><td>${esc(s.line)}</td></tr>`)
    .join("")}</tbody></table>`;

  const issuesHtml = pkg.issueBrief
    ? `<ol>${pkg.issueBrief.issues.map((i) => `<li><b>${esc(i.title)}</b> — ${esc(i.detail)}</li>`).join("")}</ol>${
        pkg.issueBrief.factsToConfirm.length
          ? `<p class="muted"><b>보고 전에 채워야 할 숫자·일정</b><br>${pkg.issueBrief.factsToConfirm.map((f) => `☐ ${esc(f)}`).join("<br>")}</p>`
          : ""
      }`
    : "";

  const investigationHtml = pkg.investigation
    ? (() => {
        const inv = pkg.investigation;
        const regulators = inv.context.filter((c) => c.kind === "regulator");
        const laws = inv.context.filter((c) => c.kind === "law");
        return `<p><b>개요</b> — ${esc(inv.summary)}</p>
${inv.trigger ? `<p><b>촉발 요인</b> — ${esc(inv.trigger)}</p>` : ""}
${list(inv.background)}
${regulators.length ? `<p class="muted"><b>규제 접점</b> — ${regulators.map((c) => `${esc(c.name)}(${esc(c.note)})`).join(" / ")}</p>` : ""}
${laws.length ? `<p class="muted"><b>관련 법령</b> — ${laws.map((c) => `${esc(c.name)}(${esc(c.note)})`).join(" / ")}</p>` : ""}
<h3>핵심 쟁점 및 여론·보도 포인트</h3>
<ol>${inv.issues.map((i) => `<li><b>(${esc(i.side)})</b> ${i.title ? `<b>${esc(i.title)}</b> — ` : ""}${esc(i.detail)}</li>`).join("")}</ol>
<h3>실무 팩트체크 — 대외 발표 전에 닫아야 하는 항목</h3>
<table class="grid"><thead><tr><th>담당</th><th>확인 항목</th><th>왜</th><th>기자 질문</th></tr></thead><tbody>${inv.checks
          .map((c) => `<tr><td>${esc(c.team)}</td><td>☐ ${esc(c.item)}</td><td>${esc(c.why)}</td><td>${esc(c.question)}</td></tr>`)
          .join("")}</tbody></table>
${inv.evidence.length ? `<p class="muted"><b>확보해 둘 증거</b><br>${inv.evidence.map((e) => `☐ ${esc(e)}`).join("<br>")}</p>` : ""}
${inv.pattern.length ? `<p class="muted"><b>이 유형이 커지는 경로</b><br>${inv.pattern.map((p, i) => `${i + 1}. ${esc(p)}`).join("<br>")}</p>` : ""}
${inv.precedent ? `<p class="muted"><b>참고 사례</b> — ${esc(inv.precedent.company)}, ${esc(inv.precedent.title)} (${esc(inv.precedent.date)})<br>교훈: ${esc(inv.precedent.takeaway)}</p>` : ""}`;
      })()
    : "";

  const style = `
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Malgun Gothic","Apple SD Gothic Neo","Pretendard",sans-serif; color:#0f172a; font-size:10.5pt; line-height:1.55; margin:0; }
  .cover { border-bottom:3px solid #0f172a; padding-bottom:14px; margin-bottom:18px; }
  .eyebrow { font-size:8.5pt; letter-spacing:.16em; text-transform:uppercase; color:#8b8f98; font-weight:700; }
  h1 { font-size:20pt; margin:6px 0 8px; letter-spacing:-.02em; line-height:1.28; }
  h2 { font-size:12pt; margin:22px 0 8px; padding-bottom:5px; border-bottom:1px solid #deddd5; }
  h3 { font-size:10.5pt; margin:14px 0 6px; }
  table { width:100%; border-collapse:collapse; margin:8px 0 4px; }
  th, td { border:1px solid #e2e1da; padding:5px 7px; text-align:left; vertical-align:top; font-size:9.5pt; }
  th { background:#f6f6f2; font-weight:700; }
  table.meta th { width:26%; background:#fbfbf8; }
  .axis { width:30%; font-weight:600; }
  .score { width:26%; white-space:nowrap; }
  .score b { font-size:11pt; margin-right:6px; }
  .bar { display:inline-block; width:70px; height:5px; background:#ecece7; border-radius:3px; vertical-align:middle; overflow:hidden; }
  .bar i { display:block; height:100%; background:#1e3a5f; }
  .why { color:#5c616c; font-size:9pt; }
  .scoreboard { display:flex; gap:14px; align-items:flex-start; }
  .total { min-width:118px; border:1px solid #deddd5; border-radius:10px; padding:10px; text-align:center; background:#fbfbf8; }
  .total b { display:block; font-size:26pt; line-height:.98; color:${bandColor}; }
  .total span { font-size:9pt; color:#5c616c; }
  .doc { border:1px solid #e2e1da; border-radius:8px; padding:10px 12px; margin:10px 0; page-break-inside:avoid; }
  .doc-head { font-size:8.5pt; color:#8b8f98; font-weight:700; }
  .doc-title { font-weight:700; margin:3px 0 6px; }
  pre { white-space:pre-wrap; font-family:inherit; font-size:9.5pt; line-height:1.55; margin:0; }
  .qa { border-bottom:1px dashed #e2e1da; padding:7px 0; page-break-inside:avoid; }
  .qa .q { font-weight:700; }
  .qa .a { margin-top:2px; }
  .muted { color:#5c616c; font-size:9pt; }
  .defense li { margin-bottom:5px; }
  .foot { margin-top:20px; border-top:1px solid #deddd5; padding-top:8px; font-size:8.5pt; color:#8b8f98; }
  section { page-break-inside:auto; }
  h2, h3 { page-break-after:avoid; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  `;

  const body = `
<div class="cover">
  <div class="eyebrow">PRISM · Crisis Communication Report</div>
  <h1>${esc(pkg.brand)} — ${esc(pkg.caseTypeLabel ?? pkg.eventLabel)} 임원 보고서</h1>
  <div class="muted">${esc(dateLabel(pkg.createdAt))} · ${esc(stance.label)} 기준 · 내부 검토용</div>
</div>
<table class="meta">${metaRows}</table>
${SECTION("1. 경영진 요약", `<p><b>진단</b> — ${esc(pkg.headline)}</p><p><b>대응 원칙</b> — ${esc(pkg.strategy)}</p>
<div class="scoreboard"><div class="total"><b>${card.overall}</b><span>종합 위험지수 /100</span><span style="color:${bandColor};font-weight:700">${esc(card.band.label)}</span></div>
<table><thead><tr><th>축</th><th>점수</th><th>해석</th></tr></thead><tbody>${axisRows}</tbody></table></div>
<p class="muted">${esc(card.note)}</p>
<p><b>상황</b><br>${esc(pkg.situation.replace(/\n+/g, " "))}</p>
${pkg.fetch?.ok && pkg.fetch.url ? `<p class="muted">기사 원문: ${esc(pkg.fetch.url)}</p>` : ""}
${pkg.fetch && !pkg.fetch.ok ? `<p class="muted">기사 본문을 읽지 못했습니다(${esc(pkg.fetch.note ?? "접근 제한")}). 입력 설명과 매뉴얼 기준으로 작성했습니다.</p>` : ""}`)}
${investigationHtml ? SECTION("2. 사건 조사 — 확인된 것과 확인할 것", investigationHtml) : ""}
${issuesHtml ? SECTION("3. 먼저 잡아야 할 쟁점", issuesHtml) : ""}
${SECTION("4. 골든타임 실행 체크리스트", actionHtml)}
${SECTION("5. 4채널 실행 문안 — ① 공식 입장문·보도자료", statementHtml)}
${SECTION("6. ② 기자 예상 Q&A · 핵심 방어 논리", `${defenseHtml}${qaHtml}${pkg.banned.length ? `<p class="muted"><b>금기 표현</b><br>${pkg.banned.map((b) => `${esc(b.phrase)} — ${esc(b.why)}`).join("<br>")}</p>` : ""}`)}
${SECTION("7. ③ 사내 임직원 공지문", pre(internalToText(kit.internal)))}
${SECTION("8. ④ SNS 공식 계정 공지 · 댓글 대응", pre(socialToText(kit.social)))}
${SECTION("9. 유관기관·이해관계자 대응", stakeholderHtml)}
${SECTION("10. 예상 여론과 악화 시 다음 대응", `${list(pkg.outlook.reactions.map((r) => `[${r.channel}] ${r.text}`))}<p><b>악화 트리거</b></p>${list(pkg.outlook.triggers)}<p><b>악화 시 다음 대응</b></p>${list(pkg.outlook.escalation)}${pkg.watchouts.length ? `<p><b>이 유형에서만 생기는 함정</b></p>${list(pkg.watchouts)}` : ""}`)}
<div class="foot">PRISM 위기 대응 워크스페이스 · 대괄호 [확인 필요] 값만 채우면 그대로 배포할 수 있습니다. 확인되지 않은 사실은 만들지 않았습니다.<br>내부 검토용 문서입니다. 외부 배포 전 커뮤니케이션 책임자 승인을 받으세요.</div>
`;

  if (!opts.standalone) return `<style>${style}</style>${body}`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pkg.brand)} — ${esc(pkg.caseTypeLabel ?? pkg.eventLabel)} 임원 보고서</title>
<meta name="author" content="PRISM">${"<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->"}
<style>${style}</style></head>
<body>${body}</body></html>`;
}

export function downloadMarkdown(pkg: ResponsePackage, card: Scorecard, kit: ChannelKit) {
  downloadFile(reportFilename(pkg, "md"), buildExecutiveMarkdown(pkg, card, kit), "text/markdown");
}

export function downloadDoc(pkg: ResponsePackage, card: Scorecard, kit: ChannelKit) {
  const html = buildExecutiveHtml(pkg, card, kit, { standalone: true });
  // Word가 UTF-8로 열도록 BOM을 붙입니다.
  downloadFile(reportFilename(pkg, "doc"), `\ufeff${html}`, "application/msword");
}
