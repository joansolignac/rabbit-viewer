import React, { useMemo, useState } from 'react';
import type { QueueItem, StatSample, HistoryWindowKey } from '../types/rabbitmq';
import { HISTORY_WINDOWS } from '../types/rabbitmq';
import { TimeSeriesChart } from './TimeSeriesChart';
import type { ChartPoint, ChartSeries } from './TimeSeriesChart';
import { Activity, RefreshCw, ChevronDown, ChevronUp, Zap, Clock } from 'lucide-react';

const PEAK_SIGMA_K = 2;
const RATE_UNIT = '/s';
const MSGS_UNIT = ' msgs';

interface QueueThroughputProps {
  queue: QueueItem | null;
  windowKey: HistoryWindowKey;
  onWindowChange: (key: HistoryWindowKey) => void;
  loading: boolean;
}

interface PeakStats {
  max: ChartPoint | null;
  mean: number;
  std: number;
  threshold: number;
  peaks: ChartPoint[];
}

function toRatePoints(samples?: StatSample[]): ChartPoint[] {
  if (!samples || samples.length < 2) return [];
  const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const points: ChartPoint[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const deltaSeconds = (current.timestamp - previous.timestamp) / 1000;
    if (deltaSeconds <= 0) continue;
    const value = Math.max(0, (current.sample - previous.sample) / deltaSeconds);
    points.push({ t: current.timestamp, v: value });
  }

  return points;
}

function toGaugePoints(samples?: StatSample[]): ChartPoint[] {
  if (!samples) return [];
  return [...samples]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((sample) => ({ t: sample.timestamp, v: sample.sample }));
}

function computePeakStats(points: ChartPoint[]): PeakStats {
  if (points.length === 0) {
    return { max: null, mean: 0, std: 0, threshold: 0, peaks: [] };
  }

  let maxPoint = points[0];
  for (const point of points) {
    if (point.v >= maxPoint.v) maxPoint = point;
  }
  const max = maxPoint.v === 0 ? null : maxPoint;

  const mean = points.reduce((sum, point) => sum + point.v, 0) / points.length;
  const variance = points.reduce((sum, point) => sum + (point.v - mean) ** 2, 0) / points.length;
  const std = Math.sqrt(variance);
  const threshold = mean + PEAK_SIGMA_K * std;

  const peaks =
    points.length >= 3 && std > 0
      ? points.filter((point) => point.v > threshold && point.v > 0)
      : [];

  return { max, mean, std, threshold, peaks };
}

function formatRate(value: number): string {
  const decimals = value < 10 ? 2 : 1;
  return `${value.toFixed(decimals)}${RATE_UNIT}`;
}

function formatPeakTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatSpikeCount(count: number): string {
  return `${count} spike${count === 1 ? '' : 's'}`;
}

const EMPTY_LABEL =
  'No telemetry samples returned by the broker for this window. The queue may be idle, or management rates_mode is disabled.';

export const QueueThroughput: React.FC<QueueThroughputProps> = ({
  queue,
  windowKey,
  onWindowChange,
  loading,
}) => {
  // Chart is open by default as requested: "que este grafico se pueda ver mucho, mejor"
  const [isExpanded, setIsExpanded] = useState(true);
  const [chartTab, setChartTab] = useState<'rates' | 'backlog' | 'dual'>('dual');
  const [fallbackNow] = useState(() => Date.now());

  const activeWindow = useMemo(
    () => HISTORY_WINDOWS.find((item) => item.key === windowKey) ?? HISTORY_WINDOWS[1],
    [windowKey]
  );

  const publishPoints = useMemo(
    () => toRatePoints(queue?.message_stats?.publish_details?.samples),
    [queue?.message_stats?.publish_details?.samples]
  );

  const deliverPoints = useMemo(
    () => toRatePoints(queue?.message_stats?.deliver_get_details?.samples),
    [queue?.message_stats?.deliver_get_details?.samples]
  );

  const ackPoints = useMemo(
    () => toRatePoints(queue?.message_stats?.ack_details?.samples),
    [queue?.message_stats?.ack_details?.samples]
  );

  const readyPoints = useMemo(
    () => toGaugePoints(queue?.messages_ready_details?.samples),
    [queue?.messages_ready_details?.samples]
  );

  const unackedPoints = useMemo(
    () => toGaugePoints(queue?.messages_unacknowledged_details?.samples),
    [queue?.messages_unacknowledged_details?.samples]
  );

  const publishPeaks = useMemo(() => computePeakStats(publishPoints), [publishPoints]);
  const deliverPeaks = useMemo(() => computePeakStats(deliverPoints), [deliverPoints]);

  const windowEnd = useMemo(() => {
    const all = [
      ...publishPoints,
      ...deliverPoints,
      ...ackPoints,
      ...readyPoints,
      ...unackedPoints,
    ];
    if (all.length === 0) return fallbackNow;
    return all.reduce((max, point) => Math.max(max, point.t), all[0].t);
  }, [publishPoints, deliverPoints, ackPoints, readyPoints, unackedPoints, fallbackNow]);

  const rateSeries: ChartSeries[] = [
    {
      key: 'publish',
      label: 'Publish Rate',
      points: publishPoints,
      strokeColor: '#ffffff',
      currentValue: queue?.message_stats?.publish_details?.rate,
      peaks: publishPeaks.peaks,
    },
    {
      key: 'deliver',
      label: 'Deliver Rate',
      points: deliverPoints,
      strokeColor: '#a1a1aa',
      currentValue: queue?.message_stats?.deliver_get_details?.rate,
      peaks: deliverPeaks.peaks,
    },
    {
      key: 'ack',
      label: 'Ack Rate',
      points: ackPoints,
      strokeColor: '#71717a',
      dashed: true,
      currentValue: queue?.message_stats?.ack_details?.rate,
    },
  ];

  const backlogSeries: ChartSeries[] = [
    {
      key: 'ready',
      label: 'Ready Messages',
      points: readyPoints,
      strokeColor: '#ffffff',
      currentValue: queue?.messages_ready,
    },
    {
      key: 'unacked',
      label: 'In-Flight Unacked',
      points: unackedPoints,
      strokeColor: '#71717a',
      currentValue: queue?.messages_unacknowledged,
    },
  ];

  return (
    <div className="bg-[#0b0d13] border border-[#202433] overflow-hidden font-mono text-zinc-200">
      {/* Integrated Controls & Telemetry Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-[#07080a] border-b border-[#202433]">
        {/* Left: Section Title & Live Rates */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white font-bold">
            <Activity className="size-4 text-white" />
            <span>Telemetry & Rates</span>
            {loading && <RefreshCw className="size-3 animate-spin text-zinc-400" />}
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400 pl-4 border-l border-zinc-800">
            <div>
              <span className="text-[10px] uppercase text-zinc-500 mr-1.5">Pub:</span>
              <strong className="text-white">
                {formatRate(queue?.message_stats?.publish_details?.rate ?? 0)}
              </strong>
            </div>
            <span>•</span>
            <div>
              <span className="text-[10px] uppercase text-zinc-500 mr-1.5">Deliv:</span>
              <strong className="text-zinc-200">
                {formatRate(queue?.message_stats?.deliver_get_details?.rate ?? 0)}
              </strong>
            </div>
            <span>•</span>
            <div>
              <span className="text-[10px] uppercase text-zinc-500 mr-1.5">Ack:</span>
              <strong className="text-zinc-400">
                {formatRate(queue?.message_stats?.ack_details?.rate ?? 0)}
              </strong>
            </div>
          </div>
        </div>

        {/* Right: Embedded Options (Window Pills + View Switcher + Collapse Toggle) */}
        <div className="flex flex-wrap items-center gap-3 self-end lg:self-auto">
          {/* Embedded View Switcher Tabs */}
          {isExpanded && (
            <div className="flex items-center border border-zinc-800 bg-[#0c0e14] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setChartTab('dual')}
                className={`px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                  chartTab === 'dual' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Dual View
              </button>
              <button
                type="button"
                onClick={() => setChartTab('rates')}
                className={`px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                  chartTab === 'rates' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Rates
              </button>
              <button
                type="button"
                onClick={() => setChartTab('backlog')}
                className={`px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                  chartTab === 'backlog' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Backlog
              </button>
            </div>
          )}

          {/* Embedded Window Selector Pills */}
          <div className="flex items-center gap-1 border border-zinc-800 bg-[#0c0e14] p-0.5 text-xs">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 px-1">Window:</span>
            {HISTORY_WINDOWS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onWindowChange(item.key)}
                className={`px-2 py-0.5 text-[10px] font-mono transition-colors ${
                  windowKey === item.key
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Toggle Expand/Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="hw-btn-secondary !px-2.5 !py-1 !text-[10px] flex items-center gap-1"
          >
            <span>{isExpanded ? 'Hide' : 'Show'}</span>
            {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        </div>
      </div>

      {/* Expanded Chart Viewport */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-[#07080a] animate-fade-in">
          {/* Integrated Peak Telemetry Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Peak Publish Card */}
            <div className="p-3 bg-[#0d0f15] border border-zinc-800 flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Zap className="size-3 text-white" />
                  <span>Peak Ingestion (Publish)</span>
                </div>
                <div className="text-xl font-bold text-white mt-1">
                  {publishPeaks.max ? formatRate(publishPeaks.max.v) : '0.00/s'}
                </div>
                <div className="mt-1 text-[10px] text-zinc-500">
                  {publishPeaks.max
                    ? `${formatPeakTime(publishPeaks.max.t)} · avg ${formatRate(publishPeaks.mean)} · ${formatSpikeCount(publishPeaks.peaks.length)}`
                    : 'No spike anomaly detected'}
                </div>
              </div>
              {publishPeaks.peaks.length > 0 && (
                <span className="hw-tag border-red-500/80 bg-red-950/50 text-red-300 font-bold text-[9px]">
                  {publishPeaks.peaks.length} SPIKES
                </span>
              )}
            </div>

            {/* Peak Deliver Card */}
            <div className="p-3 bg-[#0d0f15] border border-zinc-800 flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Clock className="size-3 text-zinc-400" />
                  <span>Peak Processing (Deliver)</span>
                </div>
                <div className="text-xl font-bold text-zinc-200 mt-1">
                  {deliverPeaks.max ? formatRate(deliverPeaks.max.v) : '0.00/s'}
                </div>
                <div className="mt-1 text-[10px] text-zinc-500">
                  {deliverPeaks.max
                    ? `${formatPeakTime(deliverPeaks.max.t)} · avg ${formatRate(deliverPeaks.mean)} · ${formatSpikeCount(deliverPeaks.peaks.length)}`
                    : 'No delivery activity detected'}
                </div>
              </div>
              {deliverPeaks.peaks.length > 0 && (
                <span className="hw-tag border-zinc-700 bg-zinc-900/60 text-zinc-300 font-bold text-[9px]">
                  {deliverPeaks.peaks.length} SPIKES
                </span>
              )}
            </div>
          </div>

          {/* SVG Charts */}
          {chartTab === 'dual' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TimeSeriesChart
                title="Message Ingestion & Drain Rates"
                unit={RATE_UNIT}
                series={rateSeries}
                windowEnd={windowEnd}
                windowSeconds={activeWindow.ageSeconds}
                gapThresholdMs={activeWindow.incrSeconds * 2500}
                emptyLabel={EMPTY_LABEL}
                height={160}
              />
              <TimeSeriesChart
                title="Queue Backlog & In-Flight Gauge"
                unit={MSGS_UNIT}
                series={backlogSeries}
                windowEnd={windowEnd}
                windowSeconds={activeWindow.ageSeconds}
                gapThresholdMs={activeWindow.incrSeconds * 2500}
                emptyLabel={EMPTY_LABEL}
                height={160}
              />
            </div>
          ) : chartTab === 'rates' ? (
            <TimeSeriesChart
              title="Message Ingestion & Drain Rates (Publish, Deliver, Ack)"
              unit={RATE_UNIT}
              series={rateSeries}
              windowEnd={windowEnd}
              windowSeconds={activeWindow.ageSeconds}
              gapThresholdMs={activeWindow.incrSeconds * 2500}
              emptyLabel={EMPTY_LABEL}
              height={180}
            />
          ) : (
            <TimeSeriesChart
              title="Queue Backlog & In-Flight Gauge (Ready vs Unacknowledged)"
              unit={MSGS_UNIT}
              series={backlogSeries}
              windowEnd={windowEnd}
              windowSeconds={activeWindow.ageSeconds}
              gapThresholdMs={activeWindow.incrSeconds * 2500}
              emptyLabel={EMPTY_LABEL}
              height={180}
            />
          )}
        </div>
      )}
    </div>
  );
};
