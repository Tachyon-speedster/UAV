import { useSimulation } from '../state/SimulationContext';
import { UAVAirframeSchematic } from '../components/UAVAirframeSchematic';
import { SubsystemHealthBars } from '../components/SubsystemHealthBars';
import { HealthGauge } from '../components/HealthGauge';

export function Airframe() {
  const { snapshot } = useSimulation();
  const { fault, diagnostics } = snapshot;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-4 min-w-0">
        <UAVAirframeSchematic subsystems={snapshot.subsystems} />
      </div>

      <div className="space-y-4 min-w-0">
        <div className="bg-base-800 border border-base-600 rounded shadow-panel p-5 flex items-center gap-8">
          <HealthGauge health={snapshot.health} band={snapshot.healthBand} />
          <div>
            <div className="font-mono text-[10px] tracking-widest text-ink-500">ACTIVE FAULT</div>
            <div className="font-mono text-base text-ink-100 mt-0.5 tracking-wide">
              {fault.type === 'NONE' ? 'NONE' : fault.type.replace(/_/g, ' ')}
            </div>
            <div className="font-mono text-[10px] tracking-widest text-ink-500 mt-3">DIAGNOSIS</div>
            <div className="font-mono text-xs text-ink-300 mt-0.5 max-w-[220px] leading-relaxed">
              {diagnostics.activeDiagnosis ?? 'No active diagnosis — all zones nominal.'}
            </div>
          </div>
        </div>

        <SubsystemHealthBars subsystems={snapshot.subsystems} />

        <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4 font-mono text-[11px] text-ink-500 leading-relaxed">
          <p className="text-ink-300 mb-2 tracking-widest text-[10px]">ZONE MAPPING</p>
          <p>
            Each airframe zone mirrors one subsystem health channel from the Digital Twin: nose turret → sensors,
            forward bay → electrical, wing panels → mechanical, mid-fuselage bay → lubrication, aft nacelle →
            combustion, tail boom → thermal. A zone lights amber or red on the exact same threshold as its bar
            below, so a fault injected from the Overview page is reflected here immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
