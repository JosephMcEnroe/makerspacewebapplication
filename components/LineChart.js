"use client";

import { useState } from "react";
import styles from "./LineChart.module.css";

const VIEW_W = 560;
const VIEW_H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 16 };

export default function LineChart({ data, formatValue = (v) => v }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const yPadding = range * 0.25;

  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = VIEW_H - PAD.top - PAD.bottom;

  const points = data.map((d, i) => {
    const x = PAD.left + (data.length === 1 ? innerW / 2 : (innerW / (data.length - 1)) * i);
    const y =
      PAD.top + innerH - ((d.value - minValue + yPadding) / (range + yPadding * 2)) * innerH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x},${PAD.top + innerH} L ${points[0].x},${PAD.top + innerH} Z`;

  const gridLines = [0.25, 0.5, 0.75].map((f) => PAD.top + innerH * f);

  return (
    <div className={styles.wrapper}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.svg} preserveAspectRatio="none">
        {gridLines.map((y) => (
          <line key={y} x1={PAD.left} x2={VIEW_W - PAD.right} y1={y} y2={y} className={styles.gridLine} />
        ))}

        <path d={areaPath} className={styles.area} />
        <path d={linePath} className={styles.line} />

        {hoveredIndex !== null && (
          <line
            x1={points[hoveredIndex].x}
            x2={points[hoveredIndex].x}
            y1={PAD.top}
            y2={PAD.top + innerH}
            className={styles.crosshair}
          />
        )}

        {points.map((p, i) => (
          <g key={p.label}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 6 : 4}
              className={styles.marker}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
            <circle cx={p.x} cy={p.y} r={12} className={styles.hitTarget} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} />
            <text x={p.x} y={VIEW_H - 6} className={styles.axisLabel} textAnchor="middle">
              {p.label}
            </text>
          </g>
        ))}

        {hoveredIndex !== null && (
          <g>
            <rect
              x={Math.min(Math.max(points[hoveredIndex].x - 30, PAD.left), VIEW_W - PAD.right - 60)}
              y={Math.max(points[hoveredIndex].y - 34, 0)}
              width={60}
              height={22}
              rx={6}
              className={styles.tooltipBg}
            />
            <text
              x={Math.min(Math.max(points[hoveredIndex].x, PAD.left + 30), VIEW_W - PAD.right - 30)}
              y={Math.max(points[hoveredIndex].y - 19, 15)}
              textAnchor="middle"
              className={styles.tooltipText}
            >
              {formatValue(points[hoveredIndex].value)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
