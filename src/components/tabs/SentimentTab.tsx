import { Clock, Flame, Heart, MessageCircle, Radio, Waves } from "lucide-react";
import type { Analysis } from "../../types";
import { Card, Eyebrow, Meter, ScoreBadge, ToneTag, cx, scoreColor } from "../ui";

const levelColor = (s: number) => (s >= 72 ? "#c8352b" : s >= 54 ? "#a9660a" : s >= 34 ? "#2f5f8a" : "#16714f");

export function SentimentTab({ analysis }: { analysis: Analysis }) {
  const viralColor = levelColor(analysis.viral.score);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="grid gap-0 sm:grid-cols-[210px_minmax(0,1fr)]">
          <div className="border-b border-line p-4 sm:border-b-0 sm:border-r">
            <div className="flex items-center justify-between">
              <Eyebrow>Viral risk</Eyebrow>
              <Flame size={13} style={{ color: viralColor }} />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="num text-[36px] font-semibold leading-none" style={{ color: viralColor, letterSpacing: "-0.04em" }}>
                {analysis.viral.score}
              </span>
              <span className="text-[11px] text-faint">/100</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="chip"
                style={{ background: `${viralColor}14`, color: viralColor, border: `1px solid ${viralColor}26` }}
              >
                확산 {analysis.viral.level}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-faint">
                <Clock size={10} /> 반감기 {analysis.viral.halfLife}
              </span>
            </div>
            <div className="mt-3">
              <Meter value={analysis.viral.score} color={viralColor} height={5} />
            </div>
          </div>

          <div className="p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Waves size={12} className="text-muted" />
              <span className="text-[11px] font-semibold text-ink-2">확산을 키우는 요인</span>
            </div>
            <ul className="space-y-1.5">
              {analysis.viral.drivers.map((d, i) => (
                <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-muted">
                  <span className="num text-[9.5px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {analysis.channelForecasts.map((c) => (
          <Card key={c.id} className="flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cx(
                      "h-1.5 w-1.5 rounded-full",
                      c.kind === "press" ? "bg-info" : c.kind === "social" ? "bg-risk/70" : "bg-warn/80",
                    )}
                  />
                  <h3 className="text-[12.5px] font-semibold text-ink">{c.label}</h3>
                </div>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{c.note}</p>
              </div>
              <ScoreBadge score={c.negativity} size="sm" />
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <Meter value={c.negativity} height={4} />
              <span className="shrink-0 text-[9.5px] font-medium text-faint">부정 톤</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="chip bg-paper-deep text-muted">볼륨 {c.volume}</span>
              {c.themes.map((t) => (
                <span key={t} className="chip border border-line bg-surface text-ink-2">
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-3 space-y-1.5">
              {c.reactions.map((r) => (
                <article key={r.id} className="rounded-lg border border-line bg-[#fcfcfa] p-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[8.5px] font-bold text-white"
                      style={{ background: r.accent }}
                    >
                      {r.initials}
                    </span>
                    <span className="truncate text-[10.5px] font-semibold text-ink-2">{r.handle}</span>
                    {r.badge && <span className="chip hidden bg-paper-deep px-1.5 py-0 text-[9px] text-muted sm:inline-flex">{r.badge}</span>}
                    <span className="ml-auto shrink-0 text-[9px] text-faint">{r.time}</span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-[1.65] text-ink-2">{r.text}</p>
                  <div className="mt-1.5 flex items-center gap-2.5 text-[9.5px] text-faint">
                    <span className="inline-flex items-center gap-0.5">
                      <Heart size={9.5} /> {r.likes}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <MessageCircle size={9.5} /> {r.replies}
                    </span>
                    <span className="ml-auto">
                      <ToneTag tone={r.tone} />
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-auto flex items-center gap-1.5 pt-2.5 text-[9.5px] text-faint">
              <Radio size={10} />
              밈 리스크 <span className="num" style={{ color: scoreColor(c.memeRisk) }}>{c.memeRisk}</span>
              <span className="ml-auto">예측 반응 {c.reactions.length}건</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
