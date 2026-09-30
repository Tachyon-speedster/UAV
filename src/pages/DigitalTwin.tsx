import { useSimulation } from '../state/SimulationContext';
import { TwinComparisonPanel } from '../components/TwinComparisonPanel';
import { SubsystemHealthBars } from '../components/SubsystemHealthBars';
import { EngineSchematic } from '../components/EngineSchematic';

export function DigitalTwin() {
  const { snapshot } = useSimulation();

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-4 min-w-0">
        <TwinComparisonPanel twin={snapshot.twin} syncPercent={snapshot.twinSyncPercent} />
        <EngineSchematic fault={snapshot.fault.type} />
      </div>
      <div className="space-y-4 min-w-0">
        <SubsystemHealthBars subsystems={snapshot.subsystems} />
        <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4 font-mono text-[11px] text-ink-500 leading-relaxed">
          <p className="text-ink-300 mb-2 tracking-widest text-[10px]">HOW SYNCHRONIZATION WORKS</p>
          <p>
            The Digital Twin predicts RPM, EGT, CHT, oil pressure, and vibration from commanded throttle, altitude,
            and ambient temperature alone — it has no knowledge of injected faults. The residual between each
            measured and predicted value drives Twin Sync %, subsystem health, and the diagnostics on the next page.
          </p>
        </div>
      </div>
    </div>
  );
}
