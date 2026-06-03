"use client";

import { useState } from "react";
import type { TrendPoint } from "./types";
import { formatNumber } from "./utils";

interface TrendChartProps {
  data: TrendPoint[];
  label: string;
  color: string;
  type?: "bar" | "line";
}

export default function TrendChart({
  data,
  label,
  color,
  type = "bar",
}: TrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data.length) return null;

  const W = 600;
  const H = 200;
  const PX = 40;
  const PY = 24;
  const chartW = W - PX * 2;
  const chartH = H - PY * 2;

  const maxVal = Math.max(...data.map((d) => d.count), 1);

  const points = data.map((d, i) => ({
    x: PX + (i / (data.length - 1 || 1)) * chartW,
    y: PY + chartH - (d.count / maxVal) * chartH,
  }));

  const barGroupWidth = chartW / data.length;
  const barWidth = Math.max(barGroupWidth * 0.6, 4);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = PY + chartH - ratio * chartH;
    const val = Math.round(ratio * maxVal);
    return { y, val };
  });

  const step = Math.max(Math.ceil(data.length / 7), 1);
  const xLabels = data
    .map((d, i) => {
      if (i % step === 0 || i === data.length - 1) {
        const x = PX + (i / (data.length - 1 || 1)) * chartW;
        const lbl = d.date.slice(5);
        return { x, label: lbl };
      }
      return null;
    })
    .filter(Boolean) as { x: number; label: string }[];

  const linePath = points
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(" ");
  const areaFillPath = `${linePath} L${points[points.length - 1].x},${PY + chartH} L${points[0].x},${PY + chartH} Z`;

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 网格线 */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PX}
              y1={g.y}
              x2={W - PX}
              y2={g.y}
              stroke="var(--color-hairline-soft)"
              strokeWidth={1}
              strokeDasharray={i > 0 ? "4,4" : "0"}
            />
            <text
              x={PX - 6}
              y={g.y + 4}
              textAnchor="end"
              fill="var(--color-ash)"
              fontSize={10}
            >
              {formatNumber(g.val)}
            </text>
          </g>
        ))}

        {type === "bar" ? (
          data.map((d, i) => {
            const x = PX + (i / data.length) * chartW + barGroupWidth * 0.2;
            const barH = (d.count / maxVal) * chartH;
            const y = PY + chartH - barH;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                fill={color}
                fillOpacity={hoveredIndex !== null && hoveredIndex !== i ? 0.3 : 0.75}
                rx={2}
                className="transition-all duration-150"
              />
            );
          })
        ) : (
          <>
            <path d={areaFillPath} fill={color} fillOpacity={0.08} />
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Hover 指示线 */}
        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint.x}
              y1={PY}
              x2={hoveredPoint.x}
              y2={PY + chartH}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="3,3"
              fillOpacity={0.5}
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r={4}
              fill="white"
              stroke={color}
              strokeWidth={2}
            />
          </>
        )}

        {/* 不可见的 hover 区域 */}
        {data.map((_, i) => (
          <rect
            key={`h${i}`}
            x={PX + (i / data.length) * chartW}
            y={PY}
            width={barGroupWidth}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {/* X轴标签 */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={H - 4}
            textAnchor="middle"
            fill="var(--color-ash)"
            fontSize={10}
          >
            {l.label}
          </text>
        ))}
      </svg>
      {/* Tooltip */}
      {hovered && hoveredPoint && (
        <div
          className="absolute pointer-events-none bg-[var(--color-ink)] text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg z-10"
          style={{
            left: `${(hoveredPoint.x / W) * 100}%`,
            top: `${((hoveredPoint.y - 30) / H) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-medium">{hovered.date}</div>
          <div>
            {label}: {formatNumber(hovered.count)}
          </div>
        </div>
      )}
    </div>
  );
}
