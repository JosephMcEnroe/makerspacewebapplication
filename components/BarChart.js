"use client";

import { useState } from "react";
import styles from "./BarChart.module.css";

const VIEW_W = 560;
const VIEW_H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 16 };
const MAX_BAR_WIDTH = 28;

export default function BarChart({ data, formatValue = (v) => v }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const maxValue = Math.max(...data.map((d) => d.value)) * 1.15;
  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = VIEW_H - PAD.top - PAD.bottom;
  const slotWidth = innerW / data.length;
  const barWidth = Math.min(slotWidth - 10, MAX_BAR_WIDTH);

  const gridLines = [0.25, 0.5, 0.75].map((f) => PAD.top + innerH * f);

  return (
    <div className={styles.wrapper}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.svg} preserveAspectRatio="none">
        {gridLines.map((y) => (
          <line key={y} x1={PAD.left} x2={VIEW_W - PAD.right} y1={y} y2={y} className={styles.gridLine} />
        ))}
        <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} className={styles.baseline} />

        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * innerH;
          const x = PAD.left + slotWidth * i + (slotWidth - barWidth) / 2;
          const y = PAD.top + innerH - barHeight;
          const isHovered = hoveredIndex === i;

          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                className={isHovered ? styles.barHovered : styles.bar}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {barHeight > 4 && (
                <rect
                  x={x}
                  y={PAD.top + innerH - 4}
                  width={barWidth}
                  height={4}
                  className={isHovered ? styles.barHovered : styles.bar}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              )}
              <text x={x + barWidth / 2} y={VIEW_H - 6} textAnchor="middle" className={styles.axisLabel}>
                {d.label}
              </text>

              {isHovered && (
                <g>
                  <rect
                    x={Math.min(Math.max(x + barWidth / 2 - 30, PAD.left), VIEW_W - PAD.right - 60)}
                    y={Math.max(y - 30, 0)}
                    width={60}
                    height={22}
                    rx={6}
                    className={styles.tooltipBg}
                  />
                  <text
                    x={Math.min(Math.max(x + barWidth / 2, PAD.left + 30), VIEW_W - PAD.right - 30)}
                    y={Math.max(y - 15, 15)}
                    textAnchor="middle"
                    className={styles.tooltipText}
                  >
                    {formatValue(d.value)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
