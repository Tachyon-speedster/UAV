import { useSimulation } from '../state/SimulationContext';
import { HealthGauge } from '../components/HealthGauge';
import { TelemetryCard, type Trend } from '../components/TelemetryCard';
import { LiveChart } from '../components/LiveChart';
import { EventLog } from '../components/EventLog';
import { FaultInjectionPanel } from '../components/FaultInjectionPanel';
import { DemoScenarioSelector } from '../components/DemoScenarioSelector';

function computeTrend(current: number, previous: number | undefined): Trend {
  if (previous === undefined) return 'flat';
  const delta = current - previous;
  if (Math.abs(delta) < Math.abs(current) * 0.002 + 0.01) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

export function Overview() {
  const { snapshot, history, log } = useSimulation();
  const prev = history.length > 1 ? history[history.length - 2] : undefined;
  const t = snapshot.telemetry;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-4">
      <div className="space-y-4 min-w-0">
        {/* Top status */}
        <div className="bg-base-800 border border-base-600 rounded shadow-panel p-5 flex items-center gap-8">
          <HealthGauge health={snapshot.health} band={snapshot.healthBand} />
          <div className="grid grid-cols-2 gap-x-10 gap-y-4">
            <StatBlock label="ENGINE STATE" value={snapshot.engineState.replace('_', ' ')} />
            <StatBlock label="ALTITUDE" value={`${Math.round(t.altitude).toLocaleString()} ft`} />
            <StatBlock label="THROTTLE" value={`${Math.round(t.throttle)}%`} />
            <StatBlock label="RPM" value={Math.round(t.rpm).toLocaleString()} />
          </div>
        </div>

        {/* Telemetry cards */}
        <div className="grid grid-cols-4 gap-3">
          <TelemetryCard label="RPM" value={Math.round(t.rpm).toLocaleString()} unit="rpm" trend={computeTrend(t.rpm, prev?.rpm)} />
          <TelemetryCard label="CHT" value={t.cht.toFixed(1)} unit="°C" trend={computeTrend(t.cht, prev?.cht)} warn={t.cht > 195} />
          <TelemetryCard label="EGT" value={t.egt.toFixed(0)} unit="°C" trend={computeTrend(t.egt, prev?.egt)} warn={t.egt > 740} />
          <TelemetryCard
            label="OIL PRESSURE"
            value={t.oilPressure.toFixed(1)}
            unit="psi"
            trend={computeTrend(t.oilPressure, prev?.oilPressure)}
            warn={t.oilPressure < 35}
          />
          <TelemetryCard
            label="OIL TEMPERATURE"
            value={t.oilTemperature.toFixed(1)}
            unit="°C"
            trend={computeTrend(t.oilTemperature, prev?.oilTemperature)}
          />
          <TelemetryCard label="FUEL FLOW" value={t.fuelFlow.toFixed(1)} unit="kg/h" trend="flat" />
          <TelemetryCard
            label="VIBRATION"
            value={t.vibration.toFixed(2)}
            unit="mm/s"
            trend={computeTrend(t.vibration, prev?.vibration)}
            warn={t.vibration > 3.5}
          />
          <TelemetryCard label="ENGINE LOAD" value={Math.round(t.engineLoad).toString()} unit="%" trend="flat" />
        </div>

        <LiveChart history={history} />
      </div>

      <div className="space-y-4 min-w-0">
        <DemoScenarioSelector />
        <FaultInjectionPanel />
        <div className="h-64">
          <EventLog entries={log} />
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-ink-500">{label}</div>
      <div className="font-mono text-lg text-ink-100 tabular mt-0.5">{value}</div>
    </div>
  );
}
