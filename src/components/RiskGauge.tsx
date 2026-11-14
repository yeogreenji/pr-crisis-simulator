import type { Grade } from "../types";
import { cx } from "./ui";

const CENTER = { x: 110, y: 104 };
const RADIUS = 82;

const SEGMENTS = [
  { from: 0, to: 25, color: "#1d8a63" },
  { from: 25, to: 45, color: "#7c9440" },
  { from: 45, to: 65, color: "#d09a25" },
  { from: 65, to: 85, color: "#d4742f" },
  { from: 85, to: 100, color: "#c8352b" },
];

const polar = (score: number, radius = RADIUS) => {
  const angle = ((180 + 1.8 * score) * Math.PI) / 180;
  return {
    x: CENTER.x + radius * Math.cos(angle),
    y: CENTER.y + radius * Math.sin(angle),
  };
};

const arcPath = (from: number, to: number, radius = RADIUS) => {
  const a = polar(from, radius);
  const b = polar(to, radius);
  const large = to - from > 50 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

export function RiskGauge({
  score,
  grade,
  size = "lg",
}: {
  score: number;
  grade: Grade;
  size?: "sm" | "lg";
}) {
  const marker = polar(score);
  const big = size === "lg";

  return (
    <div className={cx("relative w-full", big ? "h-[132px]" : "h-[104px]")}>
      <svg viewBox="0 0 220 126" className="h-full w-full" role="img" aria-label={`리스크 지수 ${score}점`}>
        {SEGMENTS.map((seg) => {
          const fillEnd = Math.min(score, seg.to);
          const filled = fillEnd > seg.from + 1.4;
          return (
            <g key={seg.from}>
              <path
                d={arcPath(seg.from + 1.2, seg.to - 1.2)}
                fill="none"
                stroke={seg.color}
                strokeWidth={big ? 11 : 9}
                strokeLinecap="round"
                opacity={0.14}
              />
              {filled && (
                <path
                  d={arcPath(seg.from + 1.2, fillEnd - 1.2)}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={big ? 11 : 9}
                  strokeLinecap="round"
                  style={{ transition: "d 700ms cubic-bezier(.22,.8,.3,1)" }}
                />
              )}
            </g>
          );
        })}

        {/* 마이너 눈금 */}
        {Array.from({ length: 21 }).map((_, i) => {
          const s = i * 5;
          const outer = polar(s, RADIUS + 10);
          const inner = polar(s, RADIUS + (i % 2 === 0 ? 15 : 13));
          return (
            <line
              key={s}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#d7d6cf"
              strokeWidth={i % 2 === 0 ? 1.2 : 0.8}
              opacity={i % 2 === 0 ? 0.9 : 0.5}
            />
          );
        })}

        {/* 현재 위치 마커 */}
        <circle
          cx={marker.x}
          cy={marker.y}
          r={big ? 7 : 5.5}
          fill="#fff"
          stroke={grade.color}
          strokeWidth={big ? 3.5 : 3}
          style={{ transition: "cx 700ms cubic-bezier(.22,.8,.3,1), cy 700ms cubic-bezier(.22,.8,.3,1)" }}
        />
        <circle cx={marker.x} cy={marker.y} r={2.2} fill={grade.color} />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-[38%] flex flex-col items-center">
        <div
          className={cx("num font-semibold leading-none text-ink", big ? "text-[52px]" : "text-[38px]")}
          style={{ letterSpacing: "-0.045em" }}
        >
          {score}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">risk index</div>
      </div>

      <div className="absolute inset-x-3 bottom-0 flex justify-between">
        <span className="num text-[9.5px] text-faint">0</span>
        <span className="num text-[9.5px] text-faint">100</span>
      </div>
    </div>
  );
}
