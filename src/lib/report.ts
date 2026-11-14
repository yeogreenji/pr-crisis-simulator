import type { Analysis } from "../types";
import { getChannel } from "./presets";
import { getIndustry } from "./industries";

const sevLabel = (s: number) => (s === 3 ? "심각" : s === 2 ? "주의" : "참고");

export function buildMarkdown(a: Analysis, previous?: { score: number; createdAt: string } | null): string {
  const when = new Date(a.createdAt).toLocaleString("ko-KR");
  const lines: string[] = [];

  lines.push(`# ${a.brand} — PR 리스크 시뮬레이션 리포트`);
  lines.push("");
  lines.push(`- 업종: ${a.industryLabel}`);
  lines.push(`- 이슈 유형: ${a.issueLabel}`);
  lines.push(`- 타깃 채널: ${a.channels.map((c) => getChannel(c).label).join(", ")}`);
  lines.push(`- 분석 시각: ${when}`);
  lines.push(`- 엔진: ${a.engine === "llm" ? "내장 엔진 + LLM 정밀 분석" : "내장 휴리스틱 엔진 v2.5 · 업종 매뉴얼"}`);
  lines.push("");
  lines.push("## 1. 리스크 요약");
  lines.push("");
  lines.push(`**리스크 지수 ${a.score}/100 · ${a.grade.label}** — ${a.grade.desc}`);
  if (previous) {
    const diff = a.score - previous.score;
    lines.push("");
    lines.push(`직전 시뮬레이션(${new Date(previous.createdAt).toLocaleDateString("ko-KR")}, ${previous.score}점) 대비 **${diff > 0 ? "+" : ""}${diff}점**`);
  }
  lines.push("");
  lines.push("| 항목 | 점수 | 가중치 |");
  lines.push("| --- | --- | --- |");
  for (const b of a.breakdown) {
    lines.push(`| ${b.label} | ${b.score} | ${Math.round(b.weight * 100)}% |`);
  }
  lines.push("");
  lines.push(`- ${a.summaryLine}`);
  lines.push(`- 교체안 적용 시 예상 점수: **${a.stats.projectedScore}점** (${a.stats.suggestedGain}점 감소)`);
  lines.push(
    `- 업종 필수 항목: ${a.stats.industryChecksPassed}/${a.stats.industryChecksTotal} 충족`,
  );
  lines.push("");
  lines.push("### 업종 필수 항목 점검");
  lines.push("");
  for (const c of a.structureChecks) {
    lines.push(`- ${c.ok ? "✓" : "✗"} ${c.label}${c.hint && !c.ok ? ` — ${c.hint}` : ""}`);
  }
  lines.push("");
  lines.push("## 2. 기자 시각");
  lines.push("");
  lines.push("### 예상 헤드라인");
  lines.push("");
  for (const h of a.headlines) {
    lines.push(`- ${h.tone === "critical" ? "[비판]" : "[긍정]"} **${h.text}** — ${h.outlet}. ${h.note}`);
  }
  lines.push("");
  lines.push("### 팩트체크 질문");
  lines.push("");
  a.factChecks.forEach((f, i) => {
    lines.push(`${i + 1}. **${f.question}** (${sevLabel(f.severity)})`);
    lines.push(`   - ${f.why}`);
  });
  lines.push("");
  if (a.missing.length) {
    lines.push("### 빠진 근거");
    lines.push("");
    for (const m of a.missing) lines.push(`- **${m.label}** (${sevLabel(m.severity)}) — ${m.detail}`);
    lines.push("");
  }
  lines.push("## 3. 채널별 여론");
  lines.push("");
  lines.push("| 채널 | 부정 톤 | 확산 볼륨 | 밈 리스크 |");
  lines.push("| --- | --- | --- | --- |");
  for (const c of a.channelForecasts) {
    lines.push(`| ${c.label} | ${c.negativity} | ${c.volume} | ${c.memeRisk} |`);
  }
  lines.push("");
  lines.push(
    `**바이럴 리스크 ${a.viral.score}/100 · ${a.viral.level}** (예상 확산 반감기 ${a.viral.halfLife})`,
  );
  for (const d of a.viral.drivers) lines.push(`- ${d}`);
  lines.push("");
  for (const c of a.channelForecasts) {
    lines.push(`### ${c.label}`);
    lines.push(`주요 쟁점: ${c.themes.join(" · ")}`);
    for (const r of c.reactions) {
      lines.push(`- (${r.tone}) ${r.text} — ${r.handle}`);
    }
    lines.push("");
  }
  lines.push("## 4. 문장 X-ray");
  lines.push("");
  if (a.spans.length === 0) {
    lines.push("위험 문장이 감지되지 않았습니다.");
  } else {
    lines.push("| 위험 구절 | 항목 | 심각도 | 교체안 | 감소 |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const s of a.spans) {
      lines.push(
        `| ${s.text.replace(/\|/g, "\\|")} | ${s.label} | ${sevLabel(s.severity)} | ${s.suggestion.replace(/\|/g, "\\|")} | -${s.delta} |`,
      );
    }
  }
  lines.push("");
  lines.push("## 5. 응답 팩 (Q&A)");
  lines.push("");
  for (const q of a.qa) {
    lines.push(`### ${q.question}`);
    lines.push(`${q.answer}`);
    lines.push(`> ${q.status === "confirm" ? "확인 필요 — " : "준비됨 — "}${q.source}`);
    lines.push("");
  }
  lines.push("## 6. 수정 1차안");
  lines.push("");
  lines.push("```");
  lines.push(a.revisedDraft);
  lines.push("```");
  lines.push("");
  lines.push(`> [확인 필요]로 표시된 값은 실제 수치·일정으로 교체한 뒤 배포하세요.`);
  lines.push("");
  lines.push(`## 7. ${a.industryLabel} 매뉴얼 — 배포 전 체크`);
  lines.push("");
  const industry = getIndustry(a.industry);
  for (const r of industry.playbook.required) lines.push(`- **${r.label}** — ${r.desc}`);
  lines.push("");
  lines.push("주의 표현:");
  for (const b of industry.playbook.banned.slice(0, 4)) lines.push(`- “${b.phrase}” → ${b.instead} (${b.why})`);
  lines.push("");
  lines.push("---");
  lines.push("PRISM · PR 위기관리 시뮬레이터 · 모든 시나리오는 가상의 기업을 기준으로 생성됩니다.");
  lines.push("");

  return lines.join("\n");
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugForFile(brand: string, date: string) {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${brand || "prism"}-risk-report-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.md`;
}
