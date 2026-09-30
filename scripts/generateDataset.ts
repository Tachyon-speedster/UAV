import { writeFileSync, mkdirSync } from 'fs';
import { stepSimulation, emptyFault, newFault, type SimConfig } from '../src/simulation/engineSimulation';
import type { ActiveFault, FaultType, TwinChannel } from '../src/types';

const FAULT_TYPES: FaultType[] = [
  'OVERHEATING',
  'LUBRICATION_DEGRADATION',
  'INJECTOR_ABNORMALITY',
  'VIBRATION_ANOMALY',
  'SENSOR_DRIFT',
];

const DRIFT_CHANNELS: TwinChannel[] = ['rpm', 'egt', 'cht', 'oilPressure', 'vibration'];

const THROTTLE_PROFILES: { name: string; fn: (t: number, duration: number) => number }[] = [
  { name: 'idle_hold', fn: () => 5 },
  { name: 'cruise_hold', fn: () => 55 },
  { name: 'high_load_hold', fn: () => 88 },
  { name: 'full_throttle_hold', fn: () => 100 },
  { name: 'throttle_sweep', fn: (t, duration) => 5 + (95 * (t % duration)) / duration },
  { name: 'climb_profile', fn: (t, duration) => Math.min(100, 40 + 60 * Math.min(1, t / (duration * 0.4))) },
  { name: 'oscillating_throttle', fn: (t) => 50 + 35 * Math.sin(t * 0.05) },
];

const ALTITUDES = [0, 5000, 10000, 15000, 20000];
const AMBIENT_TEMPS = [-10, 5, 15, 25, 40];
const SEVERITIES = [25, 45, 65, 85, 100];
const RUN_DURATION_SECONDS = 180;
const FAULT_ONSET_FRACTION = 0.35;

interface Row {
  run_id: string; scenario: string; t: number; throttle_cmd: number; altitude_ft: number; ambient_temp_c: number;
  fault_type: string; fault_severity: number; fault_elapsed_s: number;
  rpm: number; egt: number; cht: number; oil_pressure: number; oil_temperature: number; fuel_flow: number; vibration: number;
  predicted_rpm: number; predicted_egt: number; predicted_cht: number; predicted_oil_pressure: number; predicted_vibration: number;
  residual_rpm: number; residual_egt: number; residual_cht: number; residual_oil_pressure: number; residual_vibration: number;
  twin_sync_pct: number; engine_health: number; health_band: string;
  sub_combustion: number; sub_lubrication: number; sub_thermal: number; sub_mechanical: number; sub_electrical: number; sub_sensors: number;
  engine_state: string;
}

function runScenario(runId: string, scenarioName: string, altitude: number, ambientTemp: number,
  throttleFn: (t: number, duration: number) => number, faultType: FaultType | 'NONE', severity: number,
  driftChannel: TwinChannel | undefined, rows: Row[]) {
  let fault: ActiveFault = emptyFault();
  const onsetSecond = Math.round(RUN_DURATION_SECONDS * FAULT_ONSET_FRACTION);
  for (let t = 0; t < RUN_DURATION_SECONDS; t++) {
    const throttle = Math.max(0, Math.min(100, throttleFn(t, RUN_DURATION_SECONDS)));
    const cfg: SimConfig = { throttle, altitude, ambientTemp };
    if (faultType !== 'NONE' && t === onsetSecond) fault = newFault(faultType, severity, driftChannel);
    if (fault.type !== 'NONE') fault = { ...fault, elapsedSeconds: fault.elapsedSeconds + 1 };
    const state = stepSimulation(t, cfg, fault);
    rows.push({
      run_id: runId, scenario: scenarioName, t, throttle_cmd: round2(throttle), altitude_ft: altitude, ambient_temp_c: ambientTemp,
      fault_type: fault.type, fault_severity: fault.severity, fault_elapsed_s: fault.elapsedSeconds,
      rpm: round2(state.telemetry.rpm), egt: round2(state.telemetry.egt), cht: round2(state.telemetry.cht),
      oil_pressure: round2(state.telemetry.oilPressure), oil_temperature: round2(state.telemetry.oilTemperature),
      fuel_flow: round2(state.telemetry.fuelFlow), vibration: round2(state.telemetry.vibration),
      predicted_rpm: round2(state.twin.rpm.predicted), predicted_egt: round2(state.twin.egt.predicted),
      predicted_cht: round2(state.twin.cht.predicted), predicted_oil_pressure: round2(state.twin.oilPressure.predicted),
      predicted_vibration: round2(state.twin.vibration.predicted),
      residual_rpm: round2(state.twin.rpm.residual), residual_egt: round2(state.twin.egt.residual),
      residual_cht: round2(state.twin.cht.residual), residual_oil_pressure: round2(state.twin.oilPressure.residual),
      residual_vibration: round2(state.twin.vibration.residual),
      twin_sync_pct: state.twinSyncPercent, engine_health: state.health, health_band: state.healthBand,
      sub_combustion: state.subsystems.combustion, sub_lubrication: state.subsystems.lubrication, sub_thermal: state.subsystems.thermal,
      sub_mechanical: state.subsystems.mechanical, sub_electrical: state.subsystems.electrical, sub_sensors: state.subsystems.sensors,
      engine_state: state.engineState,
    });
  }
}

function round2(v: number): number { return Math.round(v * 100) / 100; }

function main() {
  const rows: Row[] = [];
  let runCounter = 0;
  for (const profile of THROTTLE_PROFILES) {
    for (const altitude of ALTITUDES) {
      for (const ambientTemp of AMBIENT_TEMPS) {
        runCounter++;
        runScenario(`H${String(runCounter).padStart(5, '0')}`, `healthy_${profile.name}`, altitude, ambientTemp, profile.fn, 'NONE', 0, undefined, rows);
      }
    }
  }
  const faultThrottleProfiles = THROTTLE_PROFILES.filter((p) => ['cruise_hold', 'high_load_hold', 'throttle_sweep', 'climb_profile'].includes(p.name));
  const faultAltitudes = [0, 10000, 20000];
  const faultAmbientTemps = [-10, 15, 40];
  for (const faultType of FAULT_TYPES) {
    for (const severity of SEVERITIES) {
      for (const profile of faultThrottleProfiles) {
        for (const altitude of faultAltitudes) {
          for (const ambientTemp of faultAmbientTemps) {
            if (faultType === 'SENSOR_DRIFT') {
              for (const driftChannel of DRIFT_CHANNELS) {
                runCounter++;
                runScenario(`F${String(runCounter).padStart(5, '0')}`, `${faultType}_${profile.name}_drift-${driftChannel}`, altitude, ambientTemp, profile.fn, faultType, severity, driftChannel, rows);
              }
            } else {
              runCounter++;
              runScenario(`F${String(runCounter).padStart(5, '0')}`, `${faultType}_${profile.name}`, altitude, ambientTemp, profile.fn, faultType, severity, undefined, rows);
            }
          }
        }
      }
    }
  }
  mkdirSync('dataset', { recursive: true });
  const headers = Object.keys(rows[0]) as (keyof Row)[];
  const csvLines = [headers.join(',')];
  for (const row of rows) csvLines.push(headers.map((h) => row[h]).join(','));
  writeFileSync('dataset/uav_piston_engine_dataset.csv', csvLines.join('\n'));
  console.log(`Runs: ${runCounter}, Rows: ${rows.length}`);
}
main();
