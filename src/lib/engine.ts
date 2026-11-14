import type {
  Analysis,
  ChannelForecast,
  ChannelId,
  FactCheck,
  Grade,
  Headline,
  IssueCategoryId,
  MissingEvidence,
  QaItem,
  Reaction,
  RiskBreakdown,
  RiskCategoryId,
  RiskSpan,
  Severity,
  ViralRisk,
} from "../types";
import {
  GRADE_LABELS,
  RISK_CATEGORIES,
  getChannel,
  getIssue,
} from "./presets";
import { RISK_RULES } from "./rules";
import { josaEun, josaRo } from "./korean";
import {
  ACCENTS,
  CHANNEL_THEMES,
  COMMENT_TEMPLATES,
  HANDLES,
  ISSUE_THEMES,
} from "./sentiment";

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const pick = <T,>(arr: T[], key: string, offset = 0): T => arr[(hashString(key) + offset) % arr.length];

export interface Sentence {
  start: number;
  end: number;
  text: string;
}

export function splitSentences(text: string): Sentence[] {
  const raw: { start: number; end: number }[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\n") {
      raw.push({ start, end: i });
      start = i + 1;
      continue;
    }
    if (
      (ch === "." || ch === "!" || ch === "?") &&
      (i === text.length - 1 || /\s/.test(text[i + 1] ?? ""))
    ) {
      raw.push({ start, end: i + 1 });
      start = i + 1;
    }
  }
  if (start < text.length) raw.push({ start, end: text.length });

  const out: Sentence[] = [];
  for (const r of raw) {
    let s = r.start;
    let e = r.end;
    while (s < e && /\s/.test(text[s] ?? "")) s += 1;
    while (e > s && /\s/.test(text[e - 1] ?? "")) e -= 1;
    if (e > s) out.push({ start: s, end: e, text: text.slice(s, e) });
  }
  return out;
}

export interface StructuralGaps {
  apology: boolean;
  timeRef: boolean;
  numbers: boolean;
  contact: boolean;
  verification: boolean;
  title: boolean;
}

const RE_APOLOGY = /사과|죄송|고개\s?숙/;
const RE_TIME = /(\d{1,2}월\s?\d{1,2}일|\d{4}년|\d{1,2}:\d{2}|\d{1,2}시\s?\d{0,2}분|[월화수목금토일]요일|오늘|내일|어제|이번\s?주|다음\s?주)/;
const RE_NUMBERS = /(\d[\d,.]*)\s?(명|건|원|%|시간|분|초|개|대|회|배|억|만|곳)/;
const RE_CONTACT = /문의|고객센터|이메일|메일|카카오톡|채팅|전화|챗봇/;
const RE_VERIFY = /검사|시험|인증|감사|검증|조사\s?결과|로그|재현\s?테스트/;
const RE_TITLE = /입장문|보도자료|공지|안내문|설명드립니다|알려드립니다|관련/;

export function detectStructural(text: string): StructuralGaps {
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  return {
    apology: RE_APOLOGY.test(text),
    timeRef: RE_TIME.test(text),
    numbers: RE_NUMBERS.test(text),
    contact: RE_CONTACT.test(text),
    verification: RE_VERIFY.test(text),
    title: (firstLine.length <= 40 && RE_TITLE.test(firstLine)) || (firstLine.length <= 24 && !/[.!?]$/.test(firstLine) && firstLine.length > 0),
  };
}

interface CandidateHit {
  ruleId: string;
  category: RiskCategoryId;
  severity: Severity;
  label: string;
  reason: string;
  matched: string;
  index: number;
  sentenceIndex: number;
  row: number;
  replacement: string;
  suggestion: string;
}

function overlaps(a: { index: number; matched: string }, b: { index: number; matched: string }) {
  const aEnd = a.index + a.matched.length;
  const bEnd = b.index + b.matched.length;
  return a.index < bEnd && b.index < aEnd;
}

export interface Detected {
  hits: CandidateHit[];
  points: Record<RiskCategoryId, number>;
  criticalCount: number;
}

function detectHits(text: string, sentences: Sentence[]): Detected {
  const candidates: CandidateHit[] = [];
  for (const rule of RISK_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      const index = m.index;
      const sentenceIndex = sentences.findIndex((s) => index >= s.start && index < s.end);
      if (sentenceIndex < 0) continue;
      const sentence = sentences[sentenceIndex];
      if (rule.guard && !rule.guard(sentence.text)) continue;
      const replacement = rule.replace(m[0]);
      if (replacement === m[0]) continue;
      const offset = m.index - sentence.start;
      const suggestion = (
        sentence.text.slice(0, offset) + replacement + sentence.text.slice(offset + m[0].length)
      ).trim();
      if (!suggestion || suggestion === sentence.text) continue;
      candidates.push({
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity,
        label: rule.label,
        reason: rule.reason,
        matched: m[0],
        index,
        sentenceIndex,
        row: sentenceIndex,
        replacement,
        suggestion,
      });
    }
  }

  const sorted = candidates.sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    if (b.matched.length !== a.matched.length) return b.matched.length - a.matched.length;
    return a.index - b.index;
  });

  const accepted: CandidateHit[] = [];
  for (const c of sorted) {
    if (accepted.some((a) => overlaps(a, c))) continue;
    accepted.push(c);
  }
  accepted.sort((a, b) => a.index - b.index);

  const points: Record<RiskCategoryId, number> = { evidence: 0, liability: 0, emotion: 0, tone: 0 };
  for (const hit of accepted) points[hit.category] += hit.severity;

  return {
    hits: accepted,
    points,
    criticalCount: accepted.filter((h) => h.severity === 3).length,
  };
}

interface ScoreConfig {
  issue: IssueCategoryId;
  channels: ChannelId[];
}

function computeScore(
  text: string,
  detected: Detected,
  structural: StructuralGaps,
  cfg: ScoreConfig,
): { score: number; breakdown: RiskBreakdown[] } {
  const issue = getIssue(cfg.issue);
  const breakdown: RiskBreakdown[] = RISK_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    short: c.short,
    weight: c.weight,
    hint: c.hint,
    score: Math.round(clamp(6 + detected.points[c.id] * 7, 0, 100)),
  }));

  const weighted = breakdown.reduce((acc, b) => acc + b.score * b.weight, 0);
  const channelPull = cfg.channels.length
    ? Math.max(...cfg.channels.map((id) => getChannel(id).negativityOffset)) * 0.55
    : 0;

  let adj = issue.baseline * 0.8 + channelPull + detected.criticalCount * 1.5;

  if (!structural.apology) adj += 7;
  if (!structural.numbers) adj += 4;
  if (!structural.timeRef) adj += 4;
  if (!structural.contact) adj += 1.5;
  if (!structural.verification) adj += 1;
  if (text.trim().length < 200) adj += 5;

  if (structural.numbers) adj -= 4;
  if (structural.timeRef) adj -= 2;
  if (structural.apology) adj -= 2;
  if (structural.verification) adj -= 2;

  const score = Math.round(clamp(weighted + adj, 4, 97));
  return { score, breakdown };
}

export function gradeFor(score: number): Grade {
  const band = GRADE_LABELS.find((g) => score <= g.max) ?? GRADE_LABELS[GRADE_LABELS.length - 1];
  const color =
    band.tone === "ok"
      ? "#16714F"
      : band.tone === "watch"
        ? "#2F5F8A"
        : band.tone === "warn"
          ? "#A9660A"
          : "#C8352B";
  return { label: band.label, tone: band.tone, color, desc: band.desc };
}

function replaceRange(text: string, start: number, end: number, value: string): string {
  return `${text.slice(0, start)}${value}${text.slice(end)}`;
}

function scoreOnly(text: string, cfg: ScoreConfig): number {
  const sentences = splitSentences(text);
  const detected = detectHits(text, sentences);
  return computeScore(text, detected, detectStructural(text), cfg).score;
}

const PRESS_ANGLE: Record<IssueCategoryId, string> = {
  "service-outage": "기자는 원인 설명보다 '규모·복구 시점·보상 기준'을 먼저 확인합니다.",
  "product-safety": "기자는 '검사 주체'와 '회수 범위'가 없으면 해명으로 받아들이지 않습니다.",
  "pricing-change": "기자는 '사전 고지'와 '기존 고객 보호'를 법적 쟁점으로 먼저 봅니다.",
  "data-privacy": "기자는 신고 기한과 2차 피해 안내를 첫 질문으로 던집니다.",
  "people-org": "기자는 결정 절차와 대상자 통보 방식을 확인합니다.",
  "executive-speech": "기자는 발언 원문과 공식 입장 여부를 먼저 확인합니다.",
};

const ISSUE_HEADLINE_GAP_SHORT: Record<IssueCategoryId, string> = {
  "service-outage": "규모·복구 시점",
  "product-safety": "검사·회수 범위",
  "pricing-change": "사전 고지·보호 조치",
  "data-privacy": "유출 규모·신고 시점",
  "people-org": "절차·보상",
  "executive-speech": "원문·공식 입장",
};

const ISSUE_HEADLINE_GAP: Record<IssueCategoryId, string> = {
  "service-outage": "규모·복구 시점 답은 없었다",
  "product-safety": "검사·회수 범위 답은 없었다",
  "pricing-change": "고지·보호 조치 답은 없었다",
  "data-privacy": "유출 규모·신고 시점 답은 없었다",
  "people-org": "절차·보상 답은 없었다",
  "executive-speech": "원문·공식 입장 답은 없었다",
};

const ISSUE_HEADLINE_SLUG: Record<IssueCategoryId, string> = {
  "service-outage": "결제 오류",
  "product-safety": "성분 논란",
  "pricing-change": "요금 인상",
  "data-privacy": "개인정보 사고",
  "people-org": "인사 논란",
  "executive-speech": "임원 발언 파문",
};

function buildHeadlines(
  brand: string,
  issueId: IssueCategoryId,
  spans: RiskSpan[],
  structural: StructuralGaps,
  outlets: string,
): Headline[] {
  const slug = ISSUE_HEADLINE_SLUG[issueId];
  const top = spans.find((s) => s.severity === 3) ?? spans[0];
  const second = spans.filter((s) => s.id !== top?.id).find((s) => s.severity >= 2);
  const quoteA = top ? `“${top.text}”` : "“확인 중”";
  const quoteB = second ? `“${second.text}”` : "“추후 안내”";

  const critical: Headline[] = spans.length === 0
    ? [
        {
          tone: "critical" as const,
          outlet: outlets,
          text: `${brand}, ${slug} 해명… 남은 질문은 '${ISSUE_HEADLINE_GAP_SHORT[issueId]}'`,
          note: "문장 리스크는 낮아졌지만, 수치와 일정이 비면 이 각도가 남습니다.",
        },
        {
          tone: "critical" as const,
          outlet: "산업부",
          text: `${brand} ${slug} 대응, 사과는 담았지만… "보상 기준 확정 전까지"`,
          note: "보상·일정이 확정되기 전까지 나올 수 있는 잔여 프레임입니다.",
        },
      ]
    : [
    {
      tone: "critical",
      outlet: outlets,
      text: `${brand} ${slug} 해명에 ${quoteA}… ${ISSUE_HEADLINE_GAP[issueId]}`,
      note: "가장 인용되기 쉬운 문장을 제목 앞에 배치한 유형입니다.",
    },
    {
      tone: "critical",
      outlet: "산업부",
      text: second
        ? `${brand} ${quoteB}만 되풀이… ${slug} 피해 규모 '깜깜'`
        : `${slug} 확산 ${brand}… 피해 규모·시점 여전히 '깜깜'`,
      note: structural.numbers
        ? "수치는 있지만 시점·범위가 비면 이 프레임이 남습니다."
        : "수치가 없어 '깜깜이' 프레임이 그대로 성립합니다.",
    },
    {
      tone: "critical",
      outlet: outlets,
      text: `${brand} ${slug} 대응, 사과보다 해명… “책임 소재부터 밝혀라”`,
      note: structural.apology
        ? "사과 표현은 있으나 주체·대상이 약하면 이 각도가 살아납니다."
        : "사과 표현이 없어 책임 공방 프레임이 기본값이 됩니다.",
    },
  ];

  const positive: Headline[] = [
    {
      tone: "positive",
      outlet: outlets,
      text: `${brand}, ${slug} 원인·일정 공개… “재발 방지까지”`,
      note: "원인·검증 방법·일정이 모두 제시될 때만 성립합니다.",
    },
    {
      tone: "positive",
      outlet: "산업부",
      text: `${brand}, 피해 고객 전수 보상 기준 내놔… 신뢰 회복 시험대`,
      note: "보상 기준과 대상 수치가 확정 고지될 때 사용할 수 있는 프레임입니다.",
    },
  ];

  return [...critical, ...positive];
}

function buildFactChecks(
  issueId: IssueCategoryId,
  structural: StructuralGaps,
  spans: RiskSpan[],
): FactCheck[] {
  const base = getIssue(issueId).factChecks;
  const checks: FactCheck[] = base.map((q, i) => ({
    question: q,
    why:
      i === 0
        ? "첫 질문에서 답이 없으면 기사는 '답변 회피'로 씁니다."
        : i === 1
          ? "규모를 특정하지 않으면 추측치가 먼저 나갑니다."
          : "범위가 불명확하면 보상 분쟁으로 이어집니다.",
    severity: (i === 0 ? 3 : i === 1 ? 3 : 2) as Severity,
  }));

  if (!structural.numbers) {
    checks.unshift({
      question: "피해·대상 규모를 수치로 제시하지 않은 이유는 무엇인가?",
      why: "초안 전체에 규모 수치가 없습니다. 기사화 단계에서 외부 추정치가 먼저 인용됩니다.",
      severity: 3,
    });
  }
  if (!structural.timeRef) {
    checks.unshift({
      question: "최초 인지 시각과 고객 공지까지 걸린 시간은?",
      why: "시점 정보가 없어 '공지 지연' 의혹을 반박할 근거가 없습니다.",
      severity: 3,
    });
  }
  if (!structural.apology) {
    checks.push({
      question: "사과의 주체와 대상이 명시되지 않은 이유는?",
      why: "누가 누구에게 사과하는지 없으면 '형식적 해명'으로 읽힙니다.",
      severity: 2,
    });
  }
  if (spans.some((s) => s.category === "liability" && s.severity === 3)) {
    checks.push({
      question: "법무 검토를 거친 표현인가, 현장 판단으로 작성됐나?",
      why: "보상·책임 관련 고위험 문장이 포함돼 있습니다.",
      severity: 3,
    });
  }

  return checks.slice(0, 6);
}

function buildMissing(structural: StructuralGaps, text: string): MissingEvidence[] {
  const out: MissingEvidence[] = [];
  if (!structural.numbers) {
    out.push({
      label: "규모 수치",
      detail: "피해 건수·대상 인원·금액 등 검증 가능한 숫자가 없습니다.",
      severity: 3,
    });
  }
  if (!structural.timeRef) {
    out.push({
      label: "시점·일정",
      detail: "발생·인지·복구·공지 시각 중 어느 것도 명시되지 않았습니다.",
      severity: 3,
    });
  }
  if (!structural.apology) {
    out.push({
      label: "사과 주체",
      detail: "사과 문장 또는 사과하는 주체가 확인되지 않습니다.",
      severity: 2,
    });
  }
  if (!structural.verification) {
    out.push({
      label: "검증 근거",
      detail: "검사·로그·재현 테스트 등 사실을 뒷받침하는 근거가 없습니다.",
      severity: 2,
    });
  }
  if (!structural.contact) {
    out.push({
      label: "문의 채널",
      detail: "이용자가 다음 행동을 할 창구(고객센터·이메일)가 없습니다.",
      severity: 1,
    });
  }
  if (!structural.title) {
    out.push({
      label: "문서 제목",
      detail: "공지 성격을 알리는 제목이 없어 인용 시 맥락이 잘립니다.",
      severity: 1,
    });
  }
  if (text.length > 0 && text.length < 200) {
    out.push({
      label: "설명 분량",
      detail: "200자 미만으로, 사실·조치·일정을 담기 어려운 길이입니다.",
      severity: 2,
    });
  }
  return out;
}

function buildChannels(
  channels: ChannelId[],
  score: number,
  issueId: IssueCategoryId,
  brand: string,
  product: string,
  phrase: string,
  emotionPoints: number,
  structural: StructuralGaps,
): ChannelForecast[] {
  return channels.map((id) => {
    const ch = getChannel(id);
    const negativity = Math.round(
      clamp(
        score * 0.72 + ch.negativityOffset * 1.6 + emotionPoints * 0.7 + (structural.numbers ? -4 : 4),
        12,
        97,
      ),
    );
    const volume: ChannelForecast["volume"] =
      ch.kind === "social"
        ? negativity >= 78
          ? "매우 높음"
          : "높음"
        : ch.kind === "community"
          ? negativity >= 62
            ? "높음"
            : "보통"
          : negativity >= 70
            ? "높음"
            : "보통";

    const templates = COMMENT_TEMPLATES[id];
    const start = hashString(`${brand}-${id}`) % templates.length;
    const count = ch.kind === "press" ? 3 : 3;
    const reactions: Reaction[] = [];
    for (let i = 0; i < count; i += 1) {
      const tpl = templates[(start + i) % templates.length];
      const handle = pick(HANDLES[id], `${brand}-${id}-h-${i}`, i);
      const seed = hashString(`${brand}-${id}-${tpl.tone}-${i}`);
      reactions.push({
        id: `${id}-r${i}`,
        handle,
        initials: handle.replace(/^@/, "").slice(0, 2).toUpperCase(),
        accent: ACCENTS[seed % ACCENTS.length],
        time: `${(seed % 9) + 1}${seed % 2 === 0 ? "분" : "시간"} 전`,
        text: tpl.text({ brand, product, phrase, issueShort: getIssue(issueId).short }),
        tone: tpl.tone,
        likes: (seed % 840) + 12,
        replies: (seed % 47) + 2,
        badge: tpl.badge,
      });
    }

    const themes = [
      ...ISSUE_THEMES[issueId].slice(0, 2),
      ...CHANNEL_THEMES[id].slice(0, 1),
    ];

    return {
      id,
      label: ch.label,
      short: ch.short,
      kind: ch.kind,
      negativity,
      volume,
      themes,
      reactions,
      memeRisk:
        id === "sns-x"
          ? Math.round(clamp(negativity + 8, 10, 99))
          : id === "youtube"
            ? Math.round(clamp(negativity - 4, 10, 96))
            : Math.round(clamp(negativity - 18, 5, 90)),
      note: ch.note,
    };
  });
}

function buildViral(
  score: number,
  channels: ChannelId[],
  spans: RiskSpan[],
  structural: StructuralGaps,
  emotionPoints: number,
  issueId: IssueCategoryId,
): ViralRisk {
  const sns = channels.includes("sns-x");
  const yt = channels.includes("youtube");
  const shortPhrase = spans.find((s) => s.severity >= 2 && s.text.length <= 8);
  let value = score * 0.5 + emotionPoints * 1.1 + (sns ? 12 : 0) + (yt ? 6 : 0);
  if (shortPhrase) value += 8;
  if (!structural.numbers) value += 4;
  if (issueId === "product-safety" || issueId === "data-privacy") value += 5;
  const viralScore = Math.round(clamp(value, 5, 99));

  const level: ViralRisk["level"] =
    viralScore >= 72 ? "높음" : viralScore >= 54 ? "주의" : viralScore >= 34 ? "관찰" : "낮음";

  const drivers: string[] = [];
  if (shortPhrase) drivers.push(`“${shortPhrase.text}”가 캡처·인용에 적합한 길이입니다.`);
  if (!structural.numbers) drivers.push("수치 부재로 추측성 2차 콘텐츠가 붙기 쉽습니다.");
  if (sns) drivers.push("SNS·X 노출 시 밈화 속도가 가장 빠릅니다.");
  if (yt) drivers.push("요약·해설 영상이 붙으면 48시간 뒤 2차 확산이 옵니다.");
  if (!structural.apology) drivers.push("사과 주체가 없어 '태도 논란'으로 프레임이 이동합니다.");
  if (drivers.length === 0) drivers.push("현재 문장만으로는 확산 트리거가 크지 않습니다.");

  const halfLife =
    viralScore >= 78 ? "1주 이상" : viralScore >= 58 ? "약 3~5일" : viralScore >= 38 ? "약 2~3일" : "약 1~2일";

  return { score: viralScore, level, drivers: drivers.slice(0, 4), halfLife };
}

const QA_BANK: Record<IssueCategoryId, { q: string; a: string }[]> = {
  "service-outage": [
    {
      q: "장애는 언제 시작됐고 언제 복구됐나?",
      a: "장애는 [최초 발생 시각]에 시작돼 [복구 완료 시각]에 정상화됐습니다. 총 영향 시간은 [N]시간 [N]분입니다.",
    },
    {
      q: "영향받은 고객은 몇 명인가?",
      a: "전체 [전체 수]명 중 [영향 수]명([비율]%)입니다. 전수 집계 결과이며, 잔여 영향 여부는 [확인 시각]에 재확인했습니다.",
    },
    {
      q: "보상은 어떻게 하나?",
      a: "SLA 기준에 따라 [보상 기준]으로 안내드리며, [날짜]까지 일괄 적용하겠습니다.",
    },
    {
      q: "원인은 무엇인가?",
      a: "원인은 [원인]으로 확인됐습니다. 재현 테스트와 로그로 검증했고, 상세 기술 내용은 [공개 채널]에 정리해 공개하겠습니다.",
    },
    {
      q: "재발 방지 대책은?",
      a: "[구체 조치]를 [일정]까지 적용하고, 완료 후 결과를 공개하겠습니다.",
    },
    {
      q: "공지가 왜 늦었나?",
      a: "최초 인지 후 [N]분 만에 앱 공지를 냈고, [N]시간 뒤 상세 안내를 배포했습니다. 지연이 있었다면 사유와 함께 공개하겠습니다.",
    },
  ],
  "product-safety": [
    {
      q: "논란 성분이 실제로 함유됐나?",
      a: "해당 성분은 [함량]으로, [검사 기관]의 [검사 항목] 결과 기준치 이내임을 확인했습니다.",
    },
    {
      q: "검사는 전수인가 샘플인가?",
      a: "[검사 방식]으로 진행했으며, 대상은 [범위]입니다. 검사 성적서는 [공개 채널]에 공개하겠습니다.",
    },
    {
      q: "회수·환불 범위는?",
      a: "[대상 제품·배치]에 대해 [회수/환불 기준]으로 처리하며, 비용은 당사가 부담합니다. 접수는 [날짜]부터 시작합니다.",
    },
    {
      q: "전성분 표기는 왜 달랐나?",
      a: "표기 오류의 원인은 [원인]이며, [날짜]까지 전 제품 표기를 재검수하겠습니다.",
    },
    {
      q: "다른 제품도 안전한가?",
      a: "[동일 라인 제품]에 대한 검사를 [일정]까지 완료하고 결과를 공개하겠습니다.",
    },
    {
      q: "소비자 우려에 대한 입장은?",
      a: "우려를 가볍게 보지 않습니다. 확인된 사실과 남은 확인 항목을 구분해 공개하겠습니다.",
    },
  ],
  "pricing-change": [
    {
      q: "왜 인상하나?",
      a: "인상은 [원가·서비스 변경 내역]에 따른 것이며, 항목별 근거는 [공개 채널]에 정리했습니다.",
    },
    {
      q: "기존 고객은 어떻게 보호되나?",
      a: "기존 약정 고객은 [보호 조치]를 적용하며, [날짜]까지 현행 요금을 유지합니다.",
    },
    {
      q: "사전 고지는 언제 했나?",
      a: "변경 적용 [N]일 전부터 이메일과 앱 알림으로 순차 안내했으며, 발송 이력은 [확인 방법]으로 확인할 수 있습니다.",
    },
    {
      q: "해지 위약금은?",
      a: "이번 변경으로 해지하는 경우 위약금은 면제하며, [신청 방법]으로 접수합니다.",
    },
    {
      q: "환불·차액 보상은?",
      a: "이미 결제된 기간에 대해서는 [기준]에 따라 차액을 [처리 방식]으로 돌려드립니다.",
    },
    {
      q: "법정 고지 기간을 지켰나?",
      a: "관련 약관과 법정 고지 기간을 확인해 [날짜]까지 재안내하겠습니다.",
    },
  ],
  "data-privacy": [
    {
      q: "무엇이 얼마나 유출됐나?",
      a: "유출 항목은 [항목], 규모는 [N]건입니다. 비밀번호·결제정보 포함 여부는 [포함 여부]입니다.",
    },
    {
      q: "언제 인지했고 언제 신고했나?",
      a: "[인지 시각]에 인지해 [신고 시각]에 관계 기관에 신고했습니다. 법정 기한 준수 여부는 [검토 결과]입니다.",
    },
    {
      q: "2차 피해 가능성은?",
      a: "[2차 피해 가능성]으로 판단하며, 이용자께서는 [조치]를 해주시기 바랍니다.",
    },
    {
      q: "원인은 무엇인가?",
      a: "원인은 [원인]이며, 재현 테스트와 접근 로그로 확인했습니다.",
    },
    {
      q: "재발 방지 대책은?",
      a: "[접근 통제·암호화 조치]를 [일정]까지 적용하고 외부 감사를 받겠습니다.",
    },
    {
      q: "보상은 어떻게 하나?",
      a: "피해 확인 시 [보상 기준]에 따라 지원하며, 접수 창구는 [채널]입니다.",
    },
  ],
  "people-org": [
    {
      q: "결정 절차는 무엇이었나?",
      a: "결정은 [절차]를 거쳐 [결정 주체]가 했으며, 관련 기록은 [확인 방법]으로 확인 가능합니다.",
    },
    {
      q: "대상자에게 언제 어떻게 통보했나?",
      a: "[통보 시점]에 [통보 방식]으로 안내했고, 개별 상담을 [기간] 동안 진행합니다.",
    },
    {
      q: "보상·재배치 계획은?",
      a: "[보상 기준]과 [재배치 프로그램]을 [일정]까지 확정해 안내하겠습니다.",
    },
    {
      q: "구성원 의견은 수렴했나?",
      a: "[수렴 방식]으로 의견을 받았으며, 추가 논의는 [채널]로 접수합니다.",
    },
    {
      q: "노사 협의는?",
      a: "[협의 여부]이며, 필요한 절차는 [일정]에 따라 진행합니다.",
    },
  ],
  "executive-speech": [
    {
      q: "발언 원문과 맥락은?",
      a: "원문은 [원문]이며, 발언 맥락은 [맥락]입니다. 전체 영상은 [공개 채널]에 공개합니다.",
    },
    {
      q: "공식 입장인가?",
      a: "해당 발언은 [공식/개인 의견]이며, 회사의 공식 입장은 아래와 같습니다.",
    },
    {
      q: "발언자에 대한 조치는?",
      a: "[조치 내용]을 [일정]까지 진행하고 결과를 공유하겠습니다.",
    },
    {
      q: "사과는 누가 하나?",
      a: "[사과 주체]가 [대상]에게 직접 사과드리며, 방식은 [방식]입니다.",
    },
    {
      q: "재발 방지 대책은?",
      a: "임원 대상 [교육·검수 절차]를 [일정]까지 도입하겠습니다.",
    },
  ],
};

function buildQa(issueId: IssueCategoryId, text: string): QaItem[] {
  const dateMatch = text.match(/(\d{1,2}월\s?\d{1,2}일)/);
  const date = dateMatch?.[1];
  return QA_BANK[issueId].map((item, i) => {
    let answer = item.a;
    if (date) answer = answer.replace(/\[최초 발생 시각\]/g, date).replace(/\[인지 시각\]/g, date);
    const remaining = /\[[^\]]+\]/.test(answer);
    return {
      id: `qa-${i}`,
      question: item.q,
      answer,
      status: remaining ? "confirm" : "ready",
      source: remaining ? "추가 확인 필요 값이 남아 있습니다." : "초안에서 확인된 값으로 작성했습니다.",
    };
  });
}

function buildRevisedDraft(
  text: string,
  brand: string,
  issueId: IssueCategoryId,
  spans: RiskSpan[],
): string {
  let body = text;
  const ordered = [...spans].sort((a, b) => b.start - a.start);
  for (const span of ordered) {
    body = replaceRange(body, span.start, span.end, span.replacement);
  }

  const issue = getIssue(issueId);
  const structural = detectStructural(body);
  const title = `${brand} ${issue.short} 관련 입장문`;
  const apology = `${brand}${josaEun(brand)} 이번 ${issue.short}${josaRo(issue.short)} 불편과 불안을 드린 점, 고객 여러분께 고개 숙여 사과드립니다.`;
  const closing = `확인된 피해 규모와 보상 기준, 재발 방지 조치의 이행 일정은 [확정 일시]까지 추가로 안내드리겠습니다.\n문의: [고객센터·담당 채널]\n\n${brand} 드림`;

  const parts: string[] = [];
  if (!structural.title) parts.push(title);
  let bodyText = body.trim();
  if (!detectStructural(bodyText).apology) bodyText = `${apology}\n\n${bodyText}`;
  parts.push(bodyText);
  if (!/문의\s?[:：]/.test(body)) parts.push(closing);
  return parts.join("\n\n");
}

export interface AnalyzeInput {
  text: string;
  brand: string;
  issue: IssueCategoryId;
  channels: ChannelId[];
}

export function analyze(input: AnalyzeInput): Analysis {
  const text = input.text.replace(/\r\n/g, "\n");
  const brand = input.brand.trim() || "당사";
  const issue = getIssue(input.issue);
  const channels: ChannelId[] = input.channels.length
    ? input.channels
    : [issue.id === "product-safety" ? "consumer-cafe" : "econ-press"];

  const sentences = splitSentences(text);
  const detected = detectHits(text, sentences);
  const structural = detectStructural(text);
  const { score, breakdown } = computeScore(text, detected, structural, {
    issue: input.issue,
    channels,
  });

  const spans: RiskSpan[] = detected.hits.map((hit, i) => {
    const modified = replaceRange(text, hit.index, hit.index + hit.matched.length, hit.replacement);
    const newScore = scoreOnly(modified, { issue: input.issue, channels });
    return {
      id: `span-${i}`,
      start: hit.index,
      end: hit.index + hit.matched.length,
      text: hit.matched,
      ruleId: hit.ruleId,
      category: hit.category,
      severity: hit.severity,
      label: hit.label,
      reason: hit.reason,
      replacement: hit.replacement,
      suggestion: hit.suggestion,
      delta: Math.max(0, score - newScore),
    };
  });

  const revisedDraft = buildRevisedDraft(text, brand, input.issue, spans);
  const projectedScore = scoreOnly(revisedDraft, { issue: input.issue, channels });
  const suggestedGain = Math.max(0, score - projectedScore);

  const outlets = channels.includes("econ-press")
    ? "경제지 산업부"
    : channels.includes("it-press")
      ? "IT 전문지"
      : "산업부";

  const phrase = spans.find((s) => s.severity === 3)?.text ?? spans[0]?.text ?? "확인 중";
  const headlines = buildHeadlines(brand, input.issue, spans, structural, outlets);
  const factChecks = buildFactChecks(input.issue, structural, spans);
  const missing = buildMissing(structural, text);
  const channelForecasts = buildChannels(
    channels,
    score,
    input.issue,
    brand,
    input.brand.trim() || "해당 제품",
    phrase,
    detected.points.emotion,
    structural,
  );
  const viral = buildViral(
    score,
    channels,
    spans,
    structural,
    detected.points.emotion,
    input.issue,
  );
  const qa = buildQa(input.issue, text);

  const criticalSpans = spans.filter((s) => s.severity === 3).length;
  const summaryLine = `고위험 문장 ${criticalSpans}개 · ${
    structural.numbers ? "규모 수치 있음" : "규모 수치 없음"
  } · ${structural.timeRef ? "시점 명시" : "시점 없음"} · ${
    structural.apology ? "사과 표현 있음" : "사과 표현 없음"
  }`;

  return {
    id: `${Date.now().toString(36)}-${hashString(text).toString(36).slice(0, 6)}`,
    createdAt: new Date().toISOString(),
    brand,
    issue: input.issue,
    issueLabel: issue.label,
    channels,
    text,
    score,
    grade: gradeFor(score),
    breakdown,
    spans,
    headlines,
    factChecks,
    missing,
    channelForecasts,
    viral,
    qa,
    revisedDraft,
    summaryLine,
    pressAngle: PRESS_ANGLE[input.issue],
    stats: {
      chars: text.length,
      sentences: sentences.length,
      riskySpans: spans.length,
      criticalSpans,
      suggestedGain,
      projectedScore,
    },
    engine: "heuristic",
    source: "heuristic",
  };
}

/** 교체안을 실제로 적용한 뒤의 점수 (미리보기용) */
export function previewScore(text: string, issue: IssueCategoryId, channels: ChannelId[]): number {
  return scoreOnly(text, { issue, channels });
}
