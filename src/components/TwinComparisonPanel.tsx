import type { TwinChannel, TwinComparisonSet } from '../types';

const CHANNEL_META: { key: TwinChannel; label: string; unit: string; decimals: number }[] = [
  { key: 'rpm', label: 'RPM', unit: 'rpm', decimals: 0 },
  { key: 'egt', label: 'EGT', unit: '°C', decimals: 1 },
  { key: 'cht', label: 'CHT', unit: '°C', decimals: 1 },
  { key: 'oilPressure', label: 'OIL PRESSURE', unit: 'psi', decimals: 1 },
  { key: 'vibration', label: 'VIBRATION', unit: 'mm/s', decimals: 2 },
];

function fmt(v: number, decimals: number): string {
  return v.toFixed(decimals);
}

export function TwinComparisonPanel({ twin, syncPercent }: { twin: TwinComparisonSet; syncPercent: number }) {
  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[11px] tracking-widest text-ink-500">DIGITAL TWIN SYNCHRONIZATION</span>
        <span className="font-mono text-xs text-status-info">TWIN SYNC: {syncPercent}%</span>
      </div>

      <div className="grid grid-cols-4 gap-2 px-2 pb-2 font-mono text-[10px] tracking-widest text-ink-700">
        <span>CHANNEL</span>
        <span className="text-right">MEASURED</span>
        <span className="text-right">PREDICTED</span>
        <span className="text-right">RESIDUAL</span>
      </div>

      <div className="space-y-1">
        {CHANNEL_META.map(({ key, label, unit, decimals }) => {
          const cmp = twin[key];
          const residualPositive = cmp.residual >= 0;
          const magnitude = Math.abs(cmp.residual);
          const alertColor =
            magnitude / Math.max(1, Math.abs(cmp.predicted) * 0.15) > 0.6 ? 'text-status-warn' : 'text-ink-100';
          return (
            <div key={key} className="grid grid-cols-4 gap-2 px-2 py-2 rounded bg-base-700/50">
              <span className="font-mono text-xs text-ink-300 self-center">{label}</span>
              <span className="font-mono text-xs text-right tabular text-ink-100">
                {fmt(cmp.measured, decimals)} <span className="text-ink-700">{unit}</span>
              </span>
              <span className="font-mono text-xs text-right tabular text-ink-500">{fmt(cmp.predicted, decimals)}</span>
              <span className={`font-mono text-xs text-right tabular ${alertColor}`}>
                {residualPositive ? '+' : ''}
                {fmt(cmp.residual, decimals)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
