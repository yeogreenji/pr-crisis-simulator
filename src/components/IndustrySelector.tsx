import { Factory, Music4, Server, ShoppingBag, Sparkles, UtensilsCrossed, BookOpen } from "lucide-react";
import type { IndustryId } from "../types";
import { INDUSTRIES } from "../lib/industries";
import { cx } from "./ui";

const ICONS: Record<IndustryId, typeof UtensilsCrossed> = {
  food: UtensilsCrossed,
  retail: ShoppingBag,
  consumer: Sparkles,
  tech: Server,
  steel: Factory,
  entertainment: Music4,
};

export function IndustrySelector({
  value,
  onChange,
  onOpenPlaybook,
  compact = false,
}: {
  value: IndustryId;
  onChange: (id: IndustryId) => void;
  onOpenPlaybook?: (id: IndustryId) => void;
  compact?: boolean;
}) {
  const current = INDUSTRIES.find((i) => i.id === value) ?? INDUSTRIES[0];

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-ink-2">업종</span>
        {onOpenPlaybook && (
          <button
            type="button"
            onClick={() => onOpenPlaybook(value)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-deep hover:underline"
          >
            <BookOpen size={10} />
            매뉴얼
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {INDUSTRIES.map((industry) => {
          const Icon = ICONS[industry.id];
          const active = industry.id === value;
          return (
            <button
              key={industry.id}
              type="button"
              onClick={() => onChange(industry.id)}
              aria-pressed={active}
              title={industry.tagline}
              className={cx(
                "group flex flex-col items-start gap-1 rounded-lg border px-2 py-1.5 text-left transition-all",
                active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-[#fcfcfa] text-ink-2 hover:border-line-strong hover:bg-white",
              )}
            >
              <Icon size={13} strokeWidth={active ? 2.2 : 1.9} className={active ? "text-white" : "text-muted"} />
              <span className="w-full truncate text-[10.5px] font-semibold leading-tight">{industry.short}</span>
            </button>
          );
        })}
      </div>

      {!compact && (
        <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-relaxed text-muted">
          <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full" style={{ background: current.accent }} />
          <span>
            <b className="font-semibold text-ink-2">{current.label}</b> · {current.tagline}
          </span>
        </p>
      )}
    </div>
  );
}
