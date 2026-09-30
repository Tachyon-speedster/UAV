import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

export type Trend = 'up' | 'down' | 'flat';

export function TelemetryCard({
  label,
  value,
  unit,
  trend,
  warn,
}: {
  label: string;
  value: string;
  unit: string;
  trend: Trend;
  warn?: boolean;
}) {
  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
  const trendColor = trend === 'flat' ? 'text-ink-700' : warn ? 'text-status-warn' : 'text-status-info';

  return (
    <div className="bg-base-800 border border-base-600 rounded px-3.5 py-3 shadow-panel">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-ink-500">{label}</span>
        <TrendIcon size={12} className={trendColor} />
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`font-mono text-xl tabular ${warn ? 'text-status-warn' : 'text-ink-100'}`}>{value}</span>
        <span className="font-mono text-[11px] text-ink-500">{unit}</span>
      </div>
    </div>
  );
}
