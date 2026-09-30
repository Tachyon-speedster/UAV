import { useSimulation } from '../state/SimulationContext';
import { Pause, Play } from 'lucide-react';

function StatusChip({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'live' }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-mono text-[10px] tracking-widest text-ink-500">{label}</span>
      <span className={`font-mono text-xs ${tone === 'live' ? 'text-status-healthy' : 'text-ink-100'}`}>{value}</span>
    </div>
  );
}

export function TopStatusBar() {
  const { snapshot, running, toggleRunning } = useSimulation();

  return (
    <header className="h-14 shrink-0 border-b border-base-600 bg-base-900 px-5 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <div>
          <div className="font-ui font-semibold text-sm text-ink-100 tracking-wide">AERO-PROPULSION DIGITAL TWIN</div>
          <div className="font-ui text-[11px] text-ink-500">Real-Time Engine Health &amp; Mission Reliability Monitor</div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <StatusChip label="ENGINE ID" value="AP-01" />
        <StatusChip label="MISSION" value="HIGH ALTITUDE ISR" />
        <StatusChip label="ENGINE STATE" value={snapshot.engineState.replace('_', ' ')} />
        <button
          onClick={toggleRunning}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-base-600 text-ink-300 hover:text-ink-100 hover:border-ink-500 transition-colors text-xs font-ui"
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
          {running ? 'PAUSE' : 'RESUME'}
        </button>
      </div>
    </header>
  );
}
