/** SVG 차트 — 외부 라이브러리 없이 레이더/축 막대를 그립니다. 인쇄에서도 그대로 나옵니다. */

export interface RadarSeries {
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

export function RadarChart({
  axes,
  series,
  size = 300,
}: {
  axes: { label: string; short: string }[];
  series: RadarSeries[];
  size?: number;
}) {
  const CX = 160;
  const CY = 156;
  const R = 104;
  const count = Math.max(3, axes.length);
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / count;
  const point = (i: number, value: number) => {
    const r = (Math.max(0, Math.min(100, value)) / 100) * R;
    return [CX + Math.cos(angle(i)) * r, CY + Math.sin(angle(i)) * r] as const;
  };
  const ring = (ratio: number) =>
    axes
      .map((_, i) => {
        const [x, y] = point(i, ratio * 100);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <svg viewBox="0 0 320 312" width={size} height={(size * 312) / 320} role="img" aria-label="7축 위험 레이더">
      {[25, 50, 75, 100].map((ratio) => (
        <polygon
          key={ratio}
          points={ring(ratio / 100)}
          fill={ratio === 100 ? "#f8fafc" : "none"}
          stroke={ratio === 100 ? "#cbd5e1" : "#e2e8f0"}
          strokeWidth={1}
        />
      ))}
      {axes.map((axis, i) => {
        const [x, y] = point(i, 100);
        const [lx, ly] = point(i, 128);
        const anchor = Math.abs(lx - CX) < 8 ? "middle" : lx > CX ? "start" : "end";
        return (
          <g key={axis.label}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text
              x={lx}
              y={ly + 3}
              textAnchor={anchor}
              fontSize={11.5}
              fontWeight={600}
              fill="#64748b"
            >
              {axis.short}
            </text>
          </g>
        );
      })}
      {series.map((s) => (
        <g key={s.label}>
          <polygon
            points={s.values
              .slice(0, count)
              .map((value, i) => {
                const [x, y] = point(i, value);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ")}
            fill={s.color}
            fillOpacity={series.length > 1 ? 0.12 : 0.16}
            stroke={s.color}
            strokeWidth={1.8}
            strokeDasharray={s.dashed ? "5 3" : undefined}
            strokeLinejoin="round"
          />
          {s.values.slice(0, count).map((value, i) => {
            const [x, y] = point(i, value);
            return <circle key={`${s.label}-${i}`} cx={x} cy={y} r={2.2} fill={s.color} />;
          })}
        </g>
      ))}
      <circle cx={CX} cy={CY} r={2} fill="#94a3b8" />
    </svg>
  );
}

export function MiniBars({
  values,
  colors,
  height = 5,
}: {
  values: number[];
  colors: string[];
  height?: number;
}) {
  return (
    <div className="flex w-full flex-col gap-1">
      {values.map((value, i) => (
        <div key={i} className="w-full overflow-hidden rounded-full" style={{ height, background: "#eef2f8" }}>
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: colors[i] ?? "#1d4ed8" }}
          />
        </div>
      ))}
    </div>
  );
}
