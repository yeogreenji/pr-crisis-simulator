import { useMemo, useState } from "react";
import { Check, Clock, ListChecks } from "lucide-react";
import type { GoldenTimeStep } from "../types";
import { Card, Eyebrow, cx } from "./ui";

export function GoldenTimePlan({ steps, industryLabel }: { steps: GoldenTimeStep[]; industryLabel: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const total = useMemo(() => steps.reduce((acc, s) => acc + s.items.length, 0), [steps]);
  const checked = Object.values(done).filter(Boolean).length;

  const toggle = (key: string) => setDone((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Card className="overflow-hidden" data-testid="golden-time">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <Eyebrow>Golden time</Eyebrow>
          <h3 className="mt-1 text-[14px] font-semibold tracking-tight">골든타임 액션 플랜</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip bg-paper-deep text-muted">{industryLabel} 매뉴얼</span>
          <span className="inline-flex items-center gap-1 text-[10px] text-faint">
            <ListChecks size={11} />
            <span className="num">
              {checked}/{total}
            </span>
          </span>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={`${step.window}-${index}`}
            className={cx(
              "border-b border-line p-3.5 md:border-b-0",
              index < steps.length - 1 && "md:border-r",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-ink text-[9px] font-bold text-white">
                {index + 1}
              </span>
              <span className="num text-[11px] font-semibold text-ink">{step.window}</span>
              <Clock size={10} className="text-faint" />
            </div>
            <p className="mt-1.5 text-[11.5px] font-semibold text-ink-2">{step.title}</p>
            <ul className="mt-2 space-y-1">
              {step.items.map((item, i) => {
                const key = `${index}-${i}`;
                const isDone = Boolean(done[key]);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="flex w-full items-start gap-1.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-paper-deep/60"
                      aria-pressed={isDone}
                    >
                      <span
                        className={cx(
                          "mt-[1px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border",
                          isDone ? "border-ok bg-ok text-white" : "border-line-strong bg-white",
                        )}
                      >
                        {isDone && <Check size={9} strokeWidth={3} />}
                      </span>
                      <span
                        className={cx(
                          "text-[10.5px] leading-[1.55]",
                          isDone ? "text-faint line-through" : "text-ink-2",
                        )}
                      >
                        {item}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line bg-[#fbfbf8] px-4 py-2 text-[9.5px] leading-relaxed text-muted">
        체크 상태는 이 화면에서만 유지됩니다. 1시간 항목은 배포 전에, 24시간 항목은 첫 보도 이후에 담당자를 정해 두세요.
      </div>
    </Card>
  );
}
