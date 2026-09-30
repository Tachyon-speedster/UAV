// ---------------------------------------------------------------------------
// engineSimulation.ts
//
// The simulation core. On every tick it:
//   1. Advances commanded conditions (throttle/altitude/load) toward a
//      believable steady operating point (CRUISE by default).
//   2. Computes the healthy baseline telemetry (what a good engine reads).
//   3. Computes the Digital Twin's prediction from the SAME commanded
//      conditions (digitalTwinModel.ts) — the twin never sees faults.
//   4. Applies any active fault to the *measured* telemetry (faultModel.ts).
//   5. Derives residuals, twin sync %, engine health, and subsystem health.
//
// This module has no React dependency — it is a plain, testable simulation
// core. `state/useEngineSimulation.ts` wraps it in a React hook that ticks it
// on an interval and exposes state to the UI.
// ---------------------------------------------------------------------------

import type {
  ActiveFault,
  EngineState,
  EngineTelemetry,
  FaultType,
  HealthBand,
  SubsystemHealth,
  TwinChannel,
  TwinComparisonSet,
} from '../types';
import { predictEngineState } from './digitalTwinModel';
import { applyFault } from './faultModel';

export interface SimConfig {
  throttle: number; // 0-100, commanded
  altitude: number; // ft, commanded
  ambientTemp: number; // degC
}

export interface SimState {
  simTimeSeconds: number;
  telemetry: EngineTelemetry;
  twin: TwinComparisonSet;
  twinSyncPercent: number;
  health: number;
  healthBand: HealthBand;
  subsystems: SubsystemHealth;
  fault: ActiveFault;
  engineState: EngineState;
}

const TWIN_CHANNELS: TwinChannel[] = ['rpm', 'egt', 'cht', 'oilPressure', 'vibration'];

// Residual scale used to normalise each channel into a comparable "severity
// units" range before folding into twin-sync% and health. Chosen so that a
// fully severe fault drives roughly a 25-40 point swing on that channel.
const RESIDUAL_SCALE: Record<TwinChannel, number> = {
  rpm: 400,
  egt: 60,
  cht: 45,
  oilPressure: 25,
  vibration: 3,
};

export function classifyHealthBand(health: number): HealthBand {
  if (health >= 90) return 'HEALTHY';
  if (health >= 70) return 'MONITOR';
  if (health >= 40) return 'DEGRADED';
  return 'CRITICAL';
}

export function classifyEngineState(throttle: number, altitude: number): EngineState {
  if (throttle < 8) return 'IDLE';
  if (altitude > 12000 && throttle > 70) return 'CLIMB';
  if (throttle > 85) return 'HIGH_LOAD';
  return 'CRUISE';
}

function computeHealthyBaseline(cfg: SimConfig): EngineTelemetry {
  const engineLoad = Math.min(100, cfg.throttle * (0.85 + 0.15 * (cfg.throttle / 100)));
  const predicted = predictEngineState({
    throttle: cfg.throttle,
    altitude: cfg.altitude,
    ambientTemp: cfg.ambientTemp,
    engineLoad,
  });
  return {
    rpm: predicted.rpm,
    cht: predicted.cht,
    egt: predicted.egt,
    oilPressure: predicted.oilPressure,
    oilTemperature: 78 + engineLoad * 0.18 + (cfg.ambientTemp - 15) * 0.3,
    fuelFlow: predicted.fuelFlow,
    vibration: predicted.vibration,
    throttle: cfg.throttle,
    altitude: cfg.altitude,
    engineLoad,
  };
}

/** Small deterministic-looking sensor noise so lines aren't perfectly flat. */
function noise(amplitude: number, t: number, seedOffset: number): number {
  return (
    Math.sin(t * 0.7 + seedOffset) * amplitude * 0.6 +
    Math.sin(t * 2.3 + seedOffset * 1.7) * amplitude * 0.4
  );
}

/**
 * Advances the simulation by one tick and returns the full derived state.
 * Pure function of (previous sim time, config, fault) — no hidden state —
 * so it's easy to reason about, test, and later swap for real telemetry.
 */
export function stepSimulation(simTimeSeconds: number, cfg: SimConfig, fault: ActiveFault): SimState {
  const healthyBaseline = computeHealthyBaseline(cfg);

  // Add gentle sensor noise to the healthy baseline before fault injection,
  // so "NORMAL" still looks like a live instrument, not a static number.
  const measured: EngineTelemetry = {
    ...healthyBaseline,
    rpm: healthyBaseline.rpm + noise(6, simTimeSeconds, 1),
    cht: healthyBaseline.cht + noise(0.6, simTimeSeconds, 2),
    egt: healthyBaseline.egt + noise(1.2, simTimeSeconds, 3),
    oilPressure: healthyBaseline.oilPressure + noise(0.4, simTimeSeconds, 4),
    vibration: Math.max(0.2, healthyBaseline.vibration + noise(0.05, simTimeSeconds, 5)),
    fuelFlow: healthyBaseline.fuelFlow + noise(0.2, simTimeSeconds, 6),
  };

  // Digital twin predicts from commanded conditions only — never sees faults.
  const engineLoad = measured.engineLoad;
  const predicted = predictEngineState({
    throttle: cfg.throttle,
    altitude: cfg.altitude,
    ambientTemp: cfg.ambientTemp,
    engineLoad,
  });

  // Apply the active fault to the measured channel(s).
  const effect = applyFault(fault, measured, predicted);
  const faultedMeasured: EngineTelemetry = { ...measured, ...effect.telemetry };

  const twin: TwinComparisonSet = {
    rpm: buildComparison(faultedMeasured.rpm, predicted.rpm, effect.sensorOnlyOffsets.rpm),
    egt: buildComparison(faultedMeasured.egt, predicted.egt, effect.sensorOnlyOffsets.egt),
    cht: buildComparison(faultedMeasured.cht, predicted.cht, effect.sensorOnlyOffsets.cht),
    oilPressure: buildComparison(
      faultedMeasured.oilPressure,
      predicted.oilPressure,
      effect.sensorOnlyOffsets.oilPressure,
    ),
    vibration: buildComparison(
      faultedMeasured.vibration,
      predicted.vibration,
      effect.sensorOnlyOffsets.vibration,
    ),
  };

  const twinSyncPercent = computeTwinSync(twin);
  const subsystems = computeSubsystemHealth(twin, fault);
  const health = computeOverallHealth(subsystems, fault);
  const healthBand = classifyHealthBand(health);
  const engineState = classifyEngineState(cfg.throttle, cfg.altitude);

  return {
    simTimeSeconds,
    telemetry: faultedMeasured,
    twin,
    twinSyncPercent,
    health,
    healthBand,
    subsystems,
    fault,
    engineState,
  };
}

function buildComparison(measured: number, predicted: number, sensorOffset?: number) {
  const displayedMeasured = measured + (sensorOffset ?? 0);
  return {
    measured: displayedMeasured,
    predicted,
    residual: displayedMeasured - predicted,
  };
}

function computeTwinSync(twin: TwinComparisonSet): number {
  let errorAccum = 0;
  for (const ch of TWIN_CHANNELS) {
    const normalised = Math.abs(twin[ch].residual) / RESIDUAL_SCALE[ch];
    errorAccum += Math.min(1, normalised);
  }
  const meanError = errorAccum / TWIN_CHANNELS.length;
  return Math.max(0, Math.round((1 - meanError) * 100));
}

function residualSeverity(channel: TwinChannel, twin: TwinComparisonSet): number {
  return Math.min(1, Math.abs(twin[channel].residual) / RESIDUAL_SCALE[channel]);
}

function computeSubsystemHealth(twin: TwinComparisonSet, fault: ActiveFault): SubsystemHealth {
  const thermal = 100 - residualSeverity('cht', twin) * 55 - residualSeverity('egt', twin) * 35;
  const combustion = 100 - residualSeverity('egt', twin) * 45 - residualSeverity('rpm', twin) * 25;
  const lubrication = 100 - residualSeverity('oilPressure', twin) * 70;
  const mechanical = 100 - residualSeverity('vibration', twin) * 65;
  const sensors =
    fault.type === 'SENSOR_DRIFT' ? 100 - (fault.severity / 100) * Math.min(1, fault.elapsedSeconds / 20) * 60 : 100;
  // Electrical isn't directly modelled by a fault in this compact demo; it
  // stays nominal with a very small coupling to vibration (loose connectors).
  const electrical = 100 - residualSeverity('vibration', twin) * 10;

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return {
    combustion: clamp(combustion),
    lubrication: clamp(lubrication),
    thermal: clamp(thermal),
    mechanical: clamp(mechanical),
    electrical: clamp(electrical),
    sensors: clamp(sensors),
  };
}

function computeOverallHealth(subsystems: SubsystemHealth, fault: ActiveFault): number {
  // Weighted toward the subsystems most safety-relevant for a UAV engine.
  const weighted =
    subsystems.thermal * 0.25 +
    subsystems.combustion * 0.2 +
    subsystems.lubrication * 0.25 +
    subsystems.mechanical * 0.2 +
    subsystems.electrical * 0.05 +
    subsystems.sensors * 0.05;
  // Sensor drift alone shouldn't tank health as hard as real degradation —
  // it's a monitoring problem, not an engine problem — so damp its impact.
  if (fault.type === 'SENSOR_DRIFT') {
    return Math.round(Math.min(100, weighted + 6));
  }
  return Math.round(weighted);
}

export function emptyFault(): ActiveFault {
  return { type: 'NONE', severity: 0, elapsedSeconds: 0 };
}

export function newFault(type: FaultType, severity: number, driftChannel?: TwinChannel): ActiveFault {
  return { type, severity, driftChannel, elapsedSeconds: 0 };
}

/**
 * Evaluates a REAL measured telemetry sample (from an uploaded CSV or a live
 * sensor feed) against the digital twin's prediction for the same operating
 * conditions — no fault-simulation involved, since real data has no synthetic
 * fault object attached. This is what lets imported/real data run through
 * the exact same twin-comparison, health-scoring, and diagnosis pipeline the
 * live simulation uses, just with `measured` supplied directly instead of
 * generated by faultModel.ts.
 */
export function evaluateMeasuredTelemetry(
  simTimeSeconds: number,
  cfg: SimConfig,
  measured: EngineTelemetry,
): SimState {
  const engineLoad = measured.engineLoad || Math.min(100, cfg.throttle * (0.85 + 0.15 * (cfg.throttle / 100)));
  const predicted = predictEngineState({
    throttle: cfg.throttle,
    altitude: cfg.altitude,
    ambientTemp: cfg.ambientTemp,
    engineLoad,
  });

  const twin: TwinComparisonSet = {
    rpm: buildComparison(measured.rpm, predicted.rpm),
    egt: buildComparison(measured.egt, predicted.egt),
    cht: buildComparison(measured.cht, predicted.cht),
    oilPressure: buildComparison(measured.oilPressure, predicted.oilPressure),
    vibration: buildComparison(measured.vibration, predicted.vibration),
  };

  // No ground-truth fault object exists for real data — pass an empty one so
  // subsystem/health scoring uses its default (no synthetic sensor-drift
  // damping), and let the diagnosis layer (rule-based + ML) do the actual
  // fault-type reasoning from residuals alone, exactly like it would have to
  // on a real UAV.
  const fault = emptyFault();
  const twinSyncPercent = computeTwinSync(twin);
  const subsystems = computeSubsystemHealth(twin, fault);
  const health = computeOverallHealth(subsystems, fault);
  const healthBand = classifyHealthBand(health);
  const engineState = classifyEngineState(cfg.throttle, cfg.altitude);

  return {
    simTimeSeconds,
    telemetry: { ...measured, engineLoad },
    twin,
    twinSyncPercent,
    health,
    healthBand,
    subsystems,
    fault,
    engineState,
  };
}
