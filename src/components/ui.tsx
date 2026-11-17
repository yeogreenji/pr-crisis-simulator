import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export function Card({
  children,
  className,
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "aside" | "article";
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag className={cx("card", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("eyebrow", className)}>{children}</div>;
}

export function SectionHead({
  eyebrow,
  title,
  desc,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>}
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        {desc && <p className="mt-1 text-[14px] leading-relaxed text-muted">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

const SEVERITY_LABEL = ["참고", "주의", "심각"] as const;
const SEVERITY_COLOR = ["#2f5f8a", "#a9660a", "#c8352b"] as const;

export function SeverityTag({ level, label }: { level: 1 | 2 | 3; label?: string }) {
  const color = SEVERITY_COLOR[level - 1];
  return (
    <span
      className="chip"
      style={{ background: `${color}12`, color, border: `1px solid ${color}26` }}
      title={`심각도 ${level} · ${SEVERITY_LABEL[level - 1]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label ?? SEVERITY_LABEL[level - 1]}
    </span>
  );
}

export function ToneTag({ tone }: { tone: "분노" | "냉소" | "질문" | "연대" | "지지" | "우려" }) {
  const map: Record<string, string> = {
    분노: "bg-risk-soft text-risk",
    냉소: "bg-[#f1f0ec] text-ink-2",
    질문: "bg-accent-soft text-accent-deep",
    연대: "bg-ok-soft text-ok",
    지지: "bg-ok-soft text-ok",
    우려: "bg-warn-soft text-warn",
  };
  return <span className={cx("chip", map[tone])}>{tone}</span>;
}

export function scoreColor(score: number): string {
  if (score <= 24) return "#16714f";
  if (score <= 44) return "#2f5f8a";
  if (score <= 64) return "#a9660a";
  return "#c8352b";
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = scoreColor(score);
  return (
    <span
      className={cx(
        "num inline-flex items-baseline gap-0.5 rounded-lg font-semibold",
        size === "sm" && "px-1.5 py-0.5 text-[13.5px]",
        size === "md" && "px-2 py-1 text-[13px]",
        size === "lg" && "px-2.5 py-1.5 text-[16px]",
      )}
      style={{ color, background: `${color}0f`, border: `1px solid ${color}26` }}
    >
      {score}
      <span className="text-[11.5px] font-medium opacity-60">/100</span>
    </span>
  );
}

export function Meter({
  value,
  color,
  height = 4,
  track = "#ecece7",
}: {
  value: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: track }}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color ?? scoreColor(value) }}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors",
        checked ? "border-accent bg-accent" : "border-line-strong bg-[#e9e8e3]",
      )}
    >
      <span
        className={cx(
          "absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-all",
          checked ? "left-[19px]" : "left-[2px]",
        )}
      />
    </button>
  );
}

export function CopyButton({
  text,
  label = "복사",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <button
      type="button"
      className={cx("btn btn-ghost px-2 py-1 text-[13px] text-muted hover:text-ink", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? "복사됨" : label}
    </button>
  );
}

export function SectionDivider({ label }: { label?: string }) {
  if (!label) return <div className="hairline my-4" />;
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="hairline flex-1" />
      <span className="eyebrow">{label}</span>
      <div className="hairline flex-1" />
    </div>
  );
}

export function DeltaChip({
  delta,
  invert = false,
  suffix = "",
}: {
  delta: number;
  invert?: boolean;
  suffix?: string;
}) {
  if (delta === 0) {
    return <span className="chip bg-[#f1f0ec] text-muted">변화 없음</span>;
  }
  const good = invert ? delta > 0 : delta < 0;
  return (
    <span className={cx("num chip", good ? "bg-ok-soft text-ok" : "bg-risk-soft text-risk")}>
      {delta > 0 ? "+" : ""}
      {delta}
      {suffix}
    </span>
  );
}
