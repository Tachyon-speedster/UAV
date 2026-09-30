import type { SubsystemHealth } from '../types';

const LABELS: { key: keyof SubsystemHealth; label: string }[] = [
  { key: 'combustion', label: 'COMBUSTION' },
  { key: 'lubrication', label: 'LUBRICATION' },
  { key: 'thermal', label: 'THERMAL' },
  { key: 'mechanical', label: 'MECHANICAL' },
  { key: 'electrical', label: 'ELECTRICAL' },
  { key: 'sensors', label: 'SENSORS' },
];

function barColor(v: number): string {
  if (v >= 90) return '#4ade80';
  if (v >= 70) return '#f5a524';
  if (v >= 40) return '#f5a524';
  return '#f0475a';
}

export function SubsystemHealthBars({ subsystems }: { subsystems: SubsystemHealth }) {
  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
      <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">SUBSYSTEM HEALTH</div>
      <div className="space-y-2.5">
        {LABELS.map(({ key, label }) => {
          const v = subsystems[key];
          const color = barColor(v);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[11px] text-ink-300 tracking-wide">{label}</span>
                <span className="font-mono text-[11px] tabular" style={{ color }}>
                  {v}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-base-600 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${v}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
