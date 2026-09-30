import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Play } from 'lucide-react';
import type { MissionRunResult, MissionType } from '../types';
import { runMissionSimulation } from '../simulation/missionModel';
import { MissionReplayPanel } from '../components/MissionReplayPanel';

const MISSION_TYPES: { id: MissionType; label: string }[] = [
  { id: 'HIGH_ALTITUDE_ISR', label: 'High Altitude ISR' },
  { id: 'ENDURANCE', label: 'Endurance' },
  { id: 'HOT_WEATHER', label: 'Hot Weather' },
  { id: 'CRUISE', label: 'Cruise' },
];

const RISK_COLOR: Record<MissionRunResult['risk'], string> = {
  LOW: '#4ade80',
  MEDIUM: '#f5a524',
  HIGH: '#f0475a',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] tracking-widest text-ink-500 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function Mission() {
  const [missionType, setMissionType] = useState<MissionType>('HIGH_ALTITUDE_ISR');
  const [altitude, setAltitude] = useState(18000);
  const [ambientTemp, setAmbientTemp] = useState(5);
  const [throttle, setThrottle] = useState(70);
  const [duration, setDuration] = useState(45);
  const [result, setResult] = useState<MissionRunResult | null>(null);

  const inputStyle =
    'w-full bg-base-700 border border-base-600 rounded px-3 py-2 text-sm font-mono text-ink-100 focus:outline-none focus:border-status-info';

  const run = () => {
    setResult(runMissionSimulation({ missionType, altitude, ambientTemp, throttle, durationMinutes: duration }));
  };

  const chartData = useMemo(() => result?.samples ?? [], [result]);

  return (
    <div className="grid grid-cols-[320px_1fr] gap-4">
      <div className="space-y-4 min-w-0">
        <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4 space-y-3">
          <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-1">MISSION SIMULATION</div>
          <Field label="MISSION TYPE">
            <select value={missionType} onChange={(e) => setMissionType(e.target.value as MissionType)} className={inputStyle}>
              {MISSION_TYPES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`ALTITUDE — ${altitude.toLocaleString()} ft`}>
            <input type="range" min={0} max={30000} step={500} value={altitude} onChange={(e) => setAltitude(Number(e.target.value))} className="w-full accent-status-info" />
          </Field>
          <Field label={`AMBIENT TEMPERATURE — ${ambientTemp}°C`}>
            <input type="range" min={-30} max={45} value={ambientTemp} onChange={(e) => setAmbientTemp(Number(e.target.value))} className="w-full accent-status-info" />
          </Field>
          <Field label={`THROTTLE — ${throttle}%`}>
            <input type="range" min={10} max={100} value={throttle} onChange={(e) => setThrottle(Number(e.target.value))} className="w-full accent-status-info" />
          </Field>
          <Field label={`MISSION DURATION — ${duration} min`}>
            <input type="range" min={5} max={180} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full accent-status-info" />
          </Field>
          <button
            onClick={run}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-status-infoDim border border-status-info/50 text-status-info font-mono text-[11px] tracking-widest hover:bg-status-info/20 transition-colors"
          >
            <Play size={14} /> RUN SIMULATION
          </button>
        </div>

        {result && (
          <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
            <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-2">MISSION RISK</div>
            <div
              className="font-mono text-2xl tracking-widest text-center py-2 rounded"
              style={{ color: RISK_COLOR[result.risk], backgroundColor: `${RISK_COLOR[result.risk]}1a` }}
            >
              {result.risk}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 text-center">
              <div>
                <div className="font-mono text-[10px] text-ink-500">FINAL HEALTH</div>
                <div className="font-mono text-lg text-ink-100">{result.finalHealth}%</div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-ink-500">FUEL USED</div>
                <div className="font-mono text-lg text-ink-100">{result.totalFuelKg} kg</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 min-w-0">
        <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
          <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">PREDICTED MISSION TREND</div>
          {result ? (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#2a3037" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: '#5c656d', fontSize: 10, fontFamily: 'Consolas' }} axisLine={{ stroke: '#2a3037' }} tickLine={false} label={{ value: 'min', position: 'insideBottomRight', offset: -2, fill: '#5c656d', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#5c656d', fontSize: 10, fontFamily: 'Consolas' }} axisLine={{ stroke: '#2a3037' }} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ background: '#171b1f', border: '1px solid #2a3037', borderRadius: 4, fontFamily: 'Consolas', fontSize: 12 }} />
                  <Line type="monotone" dataKey="health" name="Health %" stroke="#4ade80" strokeWidth={1.75} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="cht" name="CHT °C" stroke="#f0475a" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="egt" name="EGT °C" stroke="#f5a524" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center font-mono text-xs text-ink-700">
              Configure a mission profile and run the simulation to see a predicted health / thermal trend.
            </div>
          )}
        </div>

        <MissionReplayPanel />
      </div>
    </div>
  );
}
