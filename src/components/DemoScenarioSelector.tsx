import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { DEMO_SCENARIOS } from '../simulation/demoScenarios';
import { useSimulation } from '../state/SimulationContext';

export function DemoScenarioSelector() {
  const { runDemoScenario } = useSimulation();
  const [selectedId, setSelectedId] = useState(DEMO_SCENARIOS[0].id);

  const selected = DEMO_SCENARIOS.find((s) => s.id === selectedId)!;

  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
      <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">DEMO SCENARIO</div>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value as typeof selectedId)}
        className="w-full bg-base-700 border border-base-600 rounded px-3 py-2 text-sm font-ui text-ink-100 mb-2 focus:outline-none focus:border-status-info"
      >
        {DEMO_SCENARIOS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <p className="font-mono text-[11px] text-ink-500 mb-3 leading-relaxed">{selected.description}</p>
      <button
        onClick={() => runDemoScenario(selected)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-status-infoDim border border-status-info/50 text-status-info font-mono text-[11px] tracking-widest hover:bg-status-info/20 transition-colors"
      >
        <PlayCircle size={14} /> START DEMO
      </button>
    </div>
  );
}
