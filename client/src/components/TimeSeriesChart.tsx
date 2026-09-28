import React, { useState } from 'react';

export interface ChartPoint {
  t: number;
  v: number;
}

export interface ChartSeries {
  key: string;
  label: string;
  points: ChartPoint[];
  strokeColor?: string;
  strokeClass?: string;
  swatchClass?: string;
  gradientId?: string;
  dashed?: boolean;
  peaks?: ChartPoint[];
  currentValue?: number;
}

interface TimeSeriesChartProps {
  title: string;
  unit: string;
  series: ChartSeries[];
  windowEnd: number;
  windowSeconds: number;
  gapThresholdMs: number;
  emptyLabel: string;
  height?: number;
}

const CHART_WIDTH = 760;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 24;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const base = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / base;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * base;
}

function formatValue(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatTimeTick(timestamp: number, windowSeconds: number): string {
  const showSeconds = windowSeconds <= 600;
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {}),
  });
}

function buildPath(
  points: ChartPoint[],
  x: (t: number) => number,
  y: (v: number) => number,
  gapThresholdMs: number
): string {
  if (points.length === 0) return '';
  const sorted = [...points].sort((a, b) => a.t - b.t);
  let path = '';
  let previousT: number | null = null;

  for (const point of sorted) {
    const gapOk = previousT !== null && point.t - previousT <= gapThresholdMs;
    const command = gapOk ? 'L' : 'M';
    path += `${path ? ' ' : ''}${command} ${x(point.t).toFixed(2)} ${y(point.v).toFixed(2)}`;
    previousT = point.t;
  }

  return path;
}

function buildAreaPath(
  points: ChartPoint[],
  x: (t: number) => number,
  y: (v: number) => number,
  baselineY: number,
  gapThresholdMs: number
): string {
  if (points.length < 2) return '';
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const linePart = buildPath(points, x, y, gapThresholdMs);
  if (!linePart) return '';

  return `${linePart} L ${x(last.t).toFixed(2)} ${baselineY.toFixed(2)} L ${x(first.t).toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  title,
  unit,
  series,
  windowEnd,
  windowSeconds,
  gapThresholdMs,
  emptyLabel,
  height = 160,
}) => {
  const [hoverX, setHoverX] = useState<number | null>(null);

  const windowStart = windowEnd - windowSeconds * 1000;
  const innerW = CHART_WIDTH - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;
  const baselineY = PAD_T + innerH;

  const visibleSeries = series.map((item) => ({
    ...item,
    visible: item.points.filter((point) => point.t >= windowStart && point.t <= windowEnd),
  }));

  const hasData = visibleSeries.some((item) => item.visible.length >= 2);

  if (!hasData) {
    return (
      <div className="p-4 bg-[#090b10] border border-zinc-800/80 space-y-2 font-mono">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-zinc-300 font-bold">
          <span>{title}</span>
          <span className="text-[10px] text-zinc-500 font-normal">window: {windowSeconds}s</span>
        </div>
        <div className="py-8 border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
          {emptyLabel}
        </div>
      </div>
    );
  }

  const allVisiblePoints = visibleSeries.flatMap((item) => item.visible);
  const yMax = niceMax(allVisiblePoints.reduce((max, point) => Math.max(max, point.v), 0));

  const x = (t: number) => PAD_L + ((t - windowStart) / (windowSeconds * 1000)) * innerW;
  const y = (v: number) => PAD_T + innerH - (v / yMax) * innerH;

  const gridFractions = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => windowStart + fraction * windowSeconds * 1000);

  // Hover timestamp calculation
  const hoverTime = hoverX !== null ? windowStart + ((hoverX - PAD_L) / innerW) * (windowSeconds * 1000) : null;

  return (
    <div className="p-4 bg-[#08090d] border border-zinc-800/90 space-y-3 relative font-mono select-none">
      {/* Chart Top Header & Active Telemetry Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-100 font-bold">{title}</span>
          <span className="hw-tag text-[9px] border-zinc-800 bg-zinc-900/60 text-zinc-400">
            {windowSeconds < 60 ? `${windowSeconds}s` : `${Math.round(windowSeconds / 60)}m`} window
          </span>
        </div>

        {/* Legend with Live Values */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {visibleSeries.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full inline-block"
                style={{
                  backgroundColor: item.strokeColor || '#ffffff',
                }}
              />
              <span className="text-zinc-400 text-[11px]">{item.label}:</span>
              <span className="text-white font-bold text-xs">
                {item.currentValue !== undefined ? formatValue(item.currentValue) : '0.00'}
                {unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Chart Surface */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${height}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clientX = e.clientX - rect.left;
            const svgX = (clientX / rect.width) * CHART_WIDTH;
            if (svgX >= PAD_L && svgX <= CHART_WIDTH - PAD_R) {
              setHoverX(svgX);
            } else {
              setHoverX(null);
            }
          }}
          onMouseLeave={() => setHoverX(null)}
        >
          <defs>
            {/* Minimalist White Translucent Gradient */}
            <linearGradient id="grad-white-subtle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </linearGradient>
            {/* Minimalist Silver Translucent Gradient */}
            <linearGradient id="grad-silver-subtle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a1a1aa" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#a1a1aa" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {gridFractions.map((fraction) => {
            const lineY = PAD_T + innerH - fraction * innerH;
            return (
              <g key={`grid-${fraction}`}>
                <line
                  x1={PAD_L}
                  y1={lineY}
                  x2={CHART_WIDTH - PAD_R}
                  y2={lineY}
                  stroke="#1c1f2b"
                  strokeWidth={1}
                  strokeDasharray={fraction > 0 && fraction < 1 ? '3 3' : undefined}
                />
                <text
                  x={PAD_L - 8}
                  y={lineY + 3.5}
                  textAnchor="end"
                  fontSize={9}
                  className="fill-zinc-500 font-mono"
                >
                  {Number((fraction * yMax).toFixed(1))}
                </text>
              </g>
            );
          })}

          {/* X Axis Time Ticks */}
          {xTicks.map((tick, index) => (
            <text
              key={`xtick-${tick}`}
              x={PAD_L + (index / (xTicks.length - 1)) * innerW}
              y={height - 4}
              textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}
              fontSize={9}
              className="fill-zinc-500 font-mono"
            >
              {formatTimeTick(tick, windowSeconds)}
            </text>
          ))}

          {/* Translucent Area Fills */}
          {visibleSeries.map((item, idx) => {
            const gradId = idx === 0 ? 'url(#grad-white-subtle)' : 'url(#grad-silver-subtle)';
            const areaPath = buildAreaPath(item.visible, x, y, baselineY, gapThresholdMs);
            if (!areaPath) return null;

            return (
              <path
                key={`area-${item.key}`}
                d={areaPath}
                fill={gradId}
                className="transition-opacity duration-300"
              />
            );
          })}

          {/* Series Lines */}
          {visibleSeries.map((item, idx) => {
            const linePath = buildPath(item.visible, x, y, gapThresholdMs);
            if (!linePath) return null;

            const strokeColor = item.strokeColor || (idx === 0 ? '#ffffff' : idx === 1 ? '#d4d4d8' : '#71717a');

            return (
              <g key={`series-${item.key}`}>
                <path
                  d={linePath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={item.dashed ? 1.5 : 2}
                  strokeDasharray={item.dashed ? '4 3' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Red Peak Spike Indicators */}
                {item.peaks &&
                  item.peaks
                    .filter((p) => p.t >= windowStart && p.t <= windowEnd)
                    .map((peak, pIdx) => {
                      const px = x(peak.t);
                      const py = y(peak.v);
                      return (
                        <g key={`peak-${item.key}-${pIdx}`}>
                          <circle cx={px} cy={py} r={5} fill="#ef4444" fillOpacity="0.25" className="animate-ping" />
                          <circle cx={px} cy={py} r={3} fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                        </g>
                      );
                    })}
              </g>
            );
          })}

          {/* Interactive Hover Guide Line */}
          {hoverX !== null && (
            <line
              x1={hoverX}
              y1={PAD_T}
              x2={hoverX}
              y2={baselineY}
              stroke="#ffffff"
              strokeWidth={1}
              strokeDasharray="2 2"
              className="opacity-70"
            />
          )}
        </svg>

        {/* Hover Floating Information Pill */}
        {hoverX !== null && hoverTime !== null && (
          <div
            className="absolute top-1 pointer-events-none bg-zinc-900/90 border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-200 shadow-xl flex items-center gap-2 transform -translate-x-1/2 font-mono animate-fade-in"
            style={{
              left: `${((hoverX - PAD_L) / innerW) * 100}%`,
            }}
          >
            <span className="text-zinc-400">{formatTimeTick(hoverTime, windowSeconds)}</span>
            <span className="text-white font-bold">
              {formatValue(
                allVisiblePoints.reduce((closest, pt) =>
                  Math.abs(pt.t - hoverTime) < Math.abs(closest.t - hoverTime) ? pt : closest
                , allVisiblePoints[0])?.v || 0
              )}
              {unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
