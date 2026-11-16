import { ArrowRight, BookOpen, ScanText, ShieldAlert, Sparkles } from "lucide-react";
import type { Preset } from "../types";
import { PRESETS } from "../lib/presets";
import { Card, Eyebrow } from "./ui";

export function EmptyState({ onPreset }: { onPreset: (p: Preset) => void }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="grid-paper pointer-events-none absolute inset-0 opacity-[0.35]" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent-soft blur-3xl" />

      <div className="relative px-5 py-9 text-center sm:px-8 sm:py-12">
        <svg viewBox="0 0 240 96" className="mx-auto h-[92px] w-[210px]" aria-hidden>
          <path d="M120 8 152 78H88L120 8Z" fill="#101319" />
          <path d="M120 8v70" stroke="#fff" strokeOpacity=".22" strokeWidth="1" />
          <path d="M14 46h74" stroke="#c3c7cf" strokeWidth="1.4" strokeDasharray="3 3" />
          <circle cx="14" cy="46" r="2.4" fill="#c3c7cf" />
          <path d="M154 44 226 26" stroke="#c8352b" strokeWidth="2" strokeLinecap="round" />
          <path d="M154 48 228 48" stroke="#2b45e0" strokeWidth="2" strokeLinecap="round" />
          <path d="M154 52 226 72" stroke="#1d8a63" strokeWidth="2" strokeLinecap="round" />
          <circle cx="154" cy="48" r="2.4" fill="#101319" />
        </svg>

        <Eyebrow className="mt-4">PR Intelligence Console</Eyebrow>
        <h1 className="mx-auto mt-2 max-w-[420px] text-[22px] font-semibold leading-[1.35] tracking-[-0.035em] sm:text-[25px]">
          초안 한 편으로
          <br />
          세 개의 시선을 미리 봅니다
        </h1>
        <p className="mx-auto mt-2.5 max-w-[430px] text-[12px] leading-[1.85] text-muted">
          기자가 쓸 제목, 채널별 반응, 점수를 깎는 문장을 한 번에 점검하세요. ‘새 글 작성’에 내 초안을 붙여넣거나
          파일로 불러오면 바로 분석합니다.
        </p>

        <div className="mx-auto mt-6 grid max-w-[540px] gap-2 sm:grid-cols-2">
          {[
            { icon: ShieldAlert, title: "기자 시각", desc: "비판·긍정 헤드라인과 팩트체크" },
            { icon: Sparkles, title: "채널 여론", desc: "6개 채널 톤과 바이럴 리스크" },
            { icon: ScanText, title: "문장 X-ray", desc: "위험 구절과 점수 감소 교체안" },
            { icon: BookOpen, title: "업종 매뉴얼", desc: "6개 업종 골든타임·금기 표현" },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface/80 px-3 py-3 text-left">
              <f.icon size={14} className="text-accent" />
              <div className="mt-2 text-[11.5px] font-semibold text-ink">{f.title}</div>
              <div className="mt-0.5 text-[10px] leading-relaxed text-muted">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">예시로 먼저 보기</div>
          <div className="mx-auto flex max-w-[560px] flex-wrap justify-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPreset(p)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-ink-2 transition-colors hover:border-accent/40 hover:text-accent-deep"
              >
                {p.label}
                <ArrowRight size={11} className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </button>
            ))}
          </div>
        </div>

        <p className="mt-5 text-[9.5px] text-faint">
          식품·유통·소비재·IT·제조·엔터 6개 업종 매뉴얼 내장 · 실시간 AI 연결 시 정밀 분석 · 샘플 기업은 모두 가상입니다
        </p>
      </div>
    </Card>
  );
}
