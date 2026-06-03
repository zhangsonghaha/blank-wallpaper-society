"use client";

import { formatNumber } from "./utils";

interface DonutChartProps {
  segments: { label: string; value: number; color: string }[];
  total: number;
  size?: number;
}

export default function DonutChart({
  segments,
  total,
  size = 120,
}: DonutChartProps) {
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let currentOffset = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dashLength = pct * circumference;
    const arc = {
      ...seg,
      dashLength,
      dashOffset: -currentOffset,
      pct,
    };
    currentOffset += dashLength;
    return arc;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="flex-shrink-0">
        {/* 背景圆环 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-surface-card)"
          strokeWidth={strokeWidth}
        />
        {/* 各段 */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${center} ${center})`}
            className="transition-all duration-700"
          />
        ))}
        {/* 中心文字 */}
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          fill="var(--color-ink)"
          fontSize={16}
          fontWeight="bold"
        >
          {formatNumber(total)}
        </text>
        <text
          x={center}
          y={center + 10}
          textAnchor="middle"
          fill="var(--color-ash)"
          fontSize={10}
        >
          总计
        </text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-xs text-[var(--color-body)] flex-1">{seg.label}</span>
            <span className="text-xs font-medium text-[var(--color-ink)]">
              {seg.value}
            </span>
            <span className="text-xs text-[var(--color-ash)]">
              ({((seg.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
