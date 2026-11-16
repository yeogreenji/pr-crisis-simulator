import type {
  Analysis,
  ChannelSimulation,
  GoldenTimeStep,
  PressQaItem,
  RevisionVariant,
  RiskSpan,
} from "../types";
import { getIndustry } from "./industries";
import { getIssue } from "./presets";
import { josaEun } from "./korean";

/**
 * 로컬 규칙 엔진이 만드는 실전 산출물.
 * API(/api/analyze)가 없거나 실패해도 화면이 비지 않도록,
 * 업종 매뉴얼(규제 주체·법령·골든타임·금기 표현)을 그대로 재료로 씁니다.
 */

export type DeliverableInput = Pick<
  Analysis,
  "brand" | "issue" | "industry" | "text" | "spans" | "missing" | "qa" | "channelForecasts"
>;

const RE_APOLOGY = /사과|죄송|고개\s?숙/;
const RE_TITLE = /입장문|보도자료|공지|안내문|설명드립니다|알려드립니다|관련/;

function applySpans(text: string, spans: RiskSpan[]): string {
  let body = text;
  for (const span of [...spans].sort((a, b) => b.start - a.start)) {
    if (span.start < 0 || span.end > body.length) continue;
    body = body.slice(0, span.start) + span.replacement + body.slice(span.end);
  }
  return body.replace(/\r\n/g, "\n").trim();
}

function stripTitle(text: string): string {
  const lines = text.split("\n");
  const first = lines[0]?.trim() ?? "";
  const looksTitle =
    first.length > 0 &&
    first.length <= 42 &&
    !/[.!?]$/.test(first) &&
    (RE_TITLE.test(first) || first.length <= 24);
  return (looksTitle ? lines.slice(1) : lines).join("\n").trim();
}

const placeholder = (label: string) => `[확인 필요: ${label}]`;

function topSpan(spans: RiskSpan[]): RiskSpan | undefined {
  return spans.find((s) => s.severity === 3) ?? spans[0];
}

export function buildLocalRevisions(a: DeliverableInput): RevisionVariant[] {
  const issue = getIssue(a.issue);
  const industry = getIndustry(a.industry);
  const cleaned = stripTitle(applySpans(a.text, a.spans));
  const hadApology = RE_APOLOGY.test(a.text);
  const span = topSpan(a.spans);
  const trimIndustry = (label: string) =>
    label.startsWith(`${industry.short} · `) ? label.slice(industry.short.length + 3) : label;
  const missingLabels = a.missing.map((m) => trimIndustry(m.label));
  const firstMissing = missingLabels[0] ?? "세부 수치";

  // ① 공감·수습 우선형 — 소비자·커뮤니티
  const empathyParts: string[] = [`${a.brand} ${issue.short} 관련 사과 및 조치 안내`, ""];
  empathyParts.push(`${a.brand}${josaEun(a.brand)} ${industry.apologyTarget}께 고개 숙여 사과드립니다.`);
  empathyParts.push("");
  empathyParts.push(industry.closing);
  empathyParts.push("");
  empathyParts.push(cleaned);
  empathyParts.push("");
  empathyParts.push(
    missingLabels.length
      ? `아직 확인되지 않은 ${missingLabels.slice(0, 3).join("·")} 항목은 추정하지 않고, 확인되는 대로 이 공지에 추가하겠습니다.`
      : "확인된 사실과 일정은 추가 확인되는 대로 이 공지에 계속 반영하겠습니다.",
  );
  empathyParts.push("");
  empathyParts.push("문의: [고객센터·담당 채널]");
  empathyParts.push("");
  empathyParts.push(`${a.brand} 드림`);

  const empathyChanges: string[] = [
    "사과 주체와 대상을 첫 문단으로 올려 ‘형식적 해명’ 프레임을 먼저 막았습니다.",
    "고객이 지금 할 행동과 문의 창구를 사과문 안에 넣었습니다.",
  ];
  if (span) empathyChanges.push(`“${span.text}”를 “${span.replacement}”로 바꿔 ${span.label} 표현을 걷어냈습니다.`);
  if (missingLabels.length) empathyChanges.push(`${missingLabels.slice(0, 2).join("·")}는 숨기지 않고 [확인 필요]로 남겼습니다.`);
  if (hadApology) empathyChanges.push("원문의 사과 표현은 유지하되, 대상·범위를 구체화했습니다.");

  // ② 팩트·원칙 명확형 — 언론·기관
  const playbook = industry.playbook;
  const actionItems = (playbook.timeline[1]?.items ?? playbook.timeline[0]?.items ?? []).slice(0, 3);
  const regulators = playbook.regulators.slice(0, 2);
  const laws = playbook.laws.slice(0, 2);

  const authorityParts: string[] = [`${a.brand} ${issue.short} 관련 사실관계 및 대응 계획`, ""];
  authorityParts.push("1. 사실관계");
  authorityParts.push(`- 발생·인지 시점: ${placeholder("최초 인지·공지 시각")}`);
  authorityParts.push(`- 영향 범위·규모: ${placeholder(firstMissing)}`);
  authorityParts.push(cleaned);
  authorityParts.push("");
  authorityParts.push("2. 현재 조치");
  for (const item of actionItems) authorityParts.push(`- ${item}`);
  authorityParts.push("");
  authorityParts.push("3. 규제·법적 대응");
  for (const r of regulators) authorityParts.push(`- ${r.name}: ${r.role}`);
  if (laws.length) authorityParts.push(`- 검토 법령: ${laws.map((l) => `${l.name}(${l.note})`).join(", ")}`);
  authorityParts.push("");
  authorityParts.push("4. 향후 일정");
  authorityParts.push(`- ${placeholder("검사·조사 결과 공개 일정")}`);
  authorityParts.push(`- ${placeholder("보상·후속 조치 기준")}`);
  authorityParts.push("");
  authorityParts.push("5. 대응 원칙");
  authorityParts.push(
    "확인되지 않은 사실은 추정하지 않습니다. 확인된 범위와 일정만 공개하고, 추가 확인되는 내용은 같은 채널에 즉시 보강하겠습니다.",
  );
  authorityParts.push("");
  authorityParts.push("문의: [고객센터·담당 채널]");
  authorityParts.push("");
  authorityParts.push(`${a.brand} 드림`);

  const authorityChanges: string[] = [
    "제목·사실관계·조치·규제 대응·일정을 번호로 나눠 기사 인용 단위를 만들었습니다.",
    `규제 주체(${regulators[0]?.name ?? "담당 기관"})와 검토 법령을 명시해 ‘확인 중’ 프레임을 줄였습니다.`,
    "감정 표현 대신 확인된 사실과 공개 일정만 남겼습니다.",
  ];
  if (span) authorityChanges.push(`“${span.text}” 같은 단정·방어 표현을 “${span.replacement}”로 교체했습니다.`);

  return [
    {
      id: "empathy",
      label: "공감·수습 우선형",
      audience: "소비자·커뮤니티",
      body: empathyParts.join("\n"),
      changes: empathyChanges.slice(0, 5),
    },
    {
      id: "authority",
      label: "팩트·원칙 명확형",
      audience: "언론·기관",
      body: authorityParts.join("\n"),
      changes: authorityChanges.slice(0, 5),
    },
  ];
}

export function buildLocalPressQa(a: DeliverableInput): PressQaItem[] {
  const banned = getIndustry(a.industry).playbook.banned;
  const avoidFor = (i: number): string[] => {
    if (banned.length === 0) return ["“확인 중입니다”", "“전혀 문제 없습니다”"];
    const start = i % banned.length;
    const picked = [banned[start], banned[(start + 1) % banned.length]].filter((b, idx, arr) => arr.indexOf(b) === idx);
    return picked.map((b) => `“${b.phrase}”`);
  };

  return a.qa.slice(0, 8).map((q, i) => ({
    id: `pq-${q.id}`,
    question: q.question,
    answerGuide: q.answer,
    avoid: avoidFor(i),
    severity: (i < 2 ? 3 : i < 4 ? 2 : 1) as PressQaItem["severity"],
    source: "local" as const,
  }));
}

export function buildLocalChannelSimulations(a: DeliverableInput): ChannelSimulation[] {
  const industry = getIndustry(a.industry);
  const hasNumbers = /\d[\d,.]*\s?(명|건|원|%|시간|분|초|개|대|회|배|억|만|곳)/.test(a.text);
  const hasApology = RE_APOLOGY.test(a.text);
  const industryTrigger = industry.playbook.triggers[0];

  return a.channelForecasts.map((c) => {
    const triggers: string[] = [];
    if (!hasNumbers) triggers.push("피해 규모 수치가 없어 외부 추측치가 먼저 인용됩니다.");
    if (!hasApology) triggers.push("사과 주체가 없어 ‘태도 논란’으로 프레임이 이동합니다.");
    if (c.kind === "press") triggers.push("‘확인 중’만 반복하면 ‘답변 회피’ 기사 각도가 굳습니다.");
    if (c.kind === "social") triggers.push("짧은 문장이 캡처되면 밈으로 고정돼 문맥이 사라집니다.");
    if (c.kind === "community") triggers.push("현업 경험담·인증샷이 붙으면 체감 피해가 커집니다.");
    if (c.id === "consumer-cafe") triggers.push("환불 후기·비교 인증이 이어지면 재구매 이탈로 번집니다.");
    if (c.id === "youtube") triggers.push("요약·해설 영상이 붙으면 48시간 뒤 2차 확산이 옵니다.");
    if (industryTrigger) triggers.push(`${industryTrigger.label} 이슈로 번지면 ${industry.short} 매뉴얼의 1차 질문이 바뀝니다.`);

    return {
      id: c.id,
      label: c.label,
      reactions: c.reactions.slice(0, 3),
      triggers: triggers.slice(0, 3),
      source: "local" as const,
    };
  });
}

export function buildLocalGoldenTime(a: DeliverableInput): GoldenTimeStep[] {
  const industry = getIndustry(a.industry);
  const timeline = industry.playbook.timeline;
  const wanted = ["1시간", "6시간", "24시간"];

  const steps: GoldenTimeStep[] = wanted.map((window, index) => {
    const source =
      timeline.find((t) => t.window.trim() === window) ??
      timeline.find((t) => t.window.includes(window.replace("시간", ""))) ??
      timeline[index] ??
      timeline[timeline.length - 1];
    const items = [...(source?.items ?? [])];
    if (index === 0 && a.missing.length) {
      items.push(`초안에서 빠진 ${a.missing.slice(0, 2).map((m) => m.label).join("·")} 항목을 이 시간 안에 확정`);
    }
    return {
      window: source?.window ?? window,
      title: source?.title ?? `${window} 초기 대응`,
      items,
    };
  });

  return steps;
}

export function buildLocalDeliverables(a: DeliverableInput): {
  revisions: RevisionVariant[];
  channelSimulations: ChannelSimulation[];
  pressQa: PressQaItem[];
  goldenTime: GoldenTimeStep[];
} {
  return {
    revisions: buildLocalRevisions(a),
    channelSimulations: buildLocalChannelSimulations(a),
    pressQa: buildLocalPressQa(a),
    goldenTime: buildLocalGoldenTime(a),
  };
}
