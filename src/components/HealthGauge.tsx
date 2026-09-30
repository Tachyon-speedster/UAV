import type { HealthBand } from '../types';

const BAND_COLOR: Record<HealthBand, string> = {
  HEALTHY: '#4ade80',
  MONITOR: '#f5a524',
  DEGRADED: '#f5a524',
  CRITICAL: '#f0475a',
};

export function HealthGauge({ health, band }: { health: number; band: HealthBand }) {
  const size = 168;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = Math.PI * radius * 1.5; // 270-degree arc
  const startAngle = -225;
  const fraction = Math.max(0, Math.min(100, health)) / 100;
  const dash = circumference * fraction;
  const color = BAND_COLOR[band];

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2a3037"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${Math.PI * radius * 2}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${Math.PI * radius * 2}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.6s ease' }}
          />
        </g>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-4xl font-semibold tabular text-ink-100">{Math.round(health)}%</span>
        <span
          className="font-mono text-[11px] tracking-widest mt-1 px-2 py-0.5 rounded"
          style={{ color, backgroundColor: `${color}1a` }}
        >
          {band}
        </span>
      </div>
    </div>
  );
}
