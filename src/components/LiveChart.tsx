import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TelemetryHistoryPoint } from '../types';

type ChannelKey = keyof Omit<TelemetryHistoryPoint, 't'>;

const CHANNELS: { key: ChannelKey; label: string; unit: string; color: string }[] = [
  { key: 'rpm', label: 'RPM', unit: 'rpm', color: '#4ea8de' },
  { key: 'egt', label: 'EGT', unit: '°C', color: '#f5a524' },
  { key: 'cht', label: 'CHT', unit: '°C', color: '#f0475a' },
  { key: 'oilPressure', label: 'OIL PRESSURE', unit: 'psi', color: '#4ade80' },
  { key: 'oilTemperature', label: 'OIL TEMP', unit: '°C', color: '#c3ccd3' },
  { key: 'vibration', label: 'VIBRATION', unit: 'mm/s', color: '#a78bfa' },
];

export function LiveChart({ history }: { history: TelemetryHistoryPoint[] }) {
  const [channel, setChannel] = useState<ChannelKey>('rpm');
  const active = CHANNELS.find((c) => c.key === channel)!;

  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[11px] tracking-widest text-ink-500">LIVE TELEMETRY — LAST 60S</span>
        <div className="flex gap-1 flex-wrap justify-end">
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              onClick={() => setChannel(c.key)}
              className={`px-2 py-1 rounded text-[10px] font-mono tracking-wide border transition-colors ${
                channel === c.key
                  ? 'border-ink-500 text-ink-100 bg-base-700'
                  : 'border-base-600 text-ink-500 hover:text-ink-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#2a3037" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fill: '#5c656d', fontSize: 10, fontFamily: 'Consolas' }}
              axisLine={{ stroke: '#2a3037' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#5c656d', fontSize: 10, fontFamily: 'Consolas' }}
              axisLine={{ stroke: '#2a3037' }}
              tickLine={false}
              width={44}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: '#171b1f',
                border: '1px solid #2a3037',
                borderRadius: 4,
                fontFamily: 'Consolas',
                fontSize: 12,
              }}
              labelFormatter={(t) => `t = ${t}s`}
              formatter={(v: number) => [`${v} ${active.unit}`, active.label]}
            />
            <Line type="monotone" dataKey={channel} stroke={active.color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
