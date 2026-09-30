import { useState } from 'react';
import type { FaultType, TwinChannel } from '../types';
import { useSimulation } from '../state/SimulationContext';
import { Zap, XCircle } from 'lucide-react';

const FAULT_OPTIONS: { id: FaultType; label: string }[] = [
  { id: 'NONE', label: 'NORMAL' },
  { id: 'OVERHEATING', label: 'OVERHEATING' },
  { id: 'LUBRICATION_DEGRADATION', label: 'LUBRICATION DEGRADATION' },
  { id: 'INJECTOR_ABNORMALITY', label: 'INJECTOR ABNORMALITY' },
  { id: 'VIBRATION_ANOMALY', label: 'VIBRATION ANOMALY' },
  { id: 'SENSOR_DRIFT', label: 'SENSOR DRIFT' },
];

const DRIFT_CHANNELS: { id: TwinChannel; label: string }[] = [
  { id: 'rpm', label: 'RPM' },
  { id: 'egt', label: 'EGT' },
  { id: 'cht', label: 'CHT' },
  { id: 'oilPressure', label: 'OIL PRESSURE' },
  { id: 'vibration', label: 'VIBRATION' },
];

export function FaultInjectionPanel() {
  const { snapshot, injectFault, clearFault } = useSimulation();
  const [selected, setSelected] = useState<FaultType>('OVERHEATING');
  const [severity, setSeverity] = useState(60);
  const [driftChannel, setDriftChannel] = useState<TwinChannel>('egt');

  const isActive = snapshot.fault.type !== 'NONE';

  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
      <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">FAULT SIMULATOR</div>

      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {FAULT_OPTIONS.filter((f) => f.id !== 'NONE').map((f) => (
          <button
            key={f.id}
            onClick={() => setSelected(f.id)}
            className={`px-2 py-2 rounded text-[11px] font-mono tracking-wide border text-left transition-colors ${
              selected === f.id
                ? 'border-status-warn text-status-warn bg-status-warnDim'
                : 'border-base-600 text-ink-500 hover:text-ink-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selected === 'SENSOR_DRIFT' && (
        <div className="mb-3">
          <label className="font-mono text-[10px] tracking-widest text-ink-500 block mb-1.5">DRIFTING SENSOR</label>
          <div className="flex flex-wrap gap-1.5">
            {DRIFT_CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setDriftChannel(c.id)}
                className={`px-2 py-1 rounded text-[10px] font-mono border ${
                  driftChannel === c.id ? 'border-ink-500 text-ink-100 bg-base-700' : 'border-base-600 text-ink-500'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="font-mono text-[10px] tracking-widest text-ink-500">SEVERITY</label>
          <span className="font-mono text-xs text-ink-100 tabular">{severity}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={severity}
          onChange={(e) => setSeverity(Number(e.target.value))}
          className="w-full accent-status-warn"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => injectFault(selected, severity, selected === 'SENSOR_DRIFT' ? driftChannel : undefined)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-status-warnDim border border-status-warn/50 text-status-warn font-mono text-[11px] tracking-widest hover:bg-status-warn/20 transition-colors"
        >
          <Zap size={13} /> INJECT FAULT
        </button>
        <button
          onClick={clearFault}
          disabled={!isActive}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-base-600 text-ink-300 font-mono text-[11px] tracking-widest hover:border-ink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <XCircle size={13} /> CLEAR FAULT
        </button>
      </div>

      {isActive && (
        <div className="mt-3 font-mono text-[10px] text-status-warn tracking-wide">
          ACTIVE: {snapshot.fault.type.replace(/_/g, ' ')} @ {snapshot.fault.severity}% severity
          {snapshot.fault.driftChannel ? ` (${snapshot.fault.driftChannel.toUpperCase()})` : ''}
        </div>
      )}
    </div>
  );
}
