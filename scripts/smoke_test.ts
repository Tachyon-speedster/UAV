// ---------------------------------------------------------------------------
// smoke_test.ts — quick functional check for the "import real data" pipeline.
//
// Run with: npx tsx scripts/smoke_test.ts
//
// This exercises evaluateMeasuredTelemetry() + diagnose() — the same two
// functions ImportData.tsx calls per CSV row — against hand-built telemetry
// rows, to confirm the twin comparison and rule-based diagnosis behave
// correctly BEFORE trusting them against real sensor data. It intentionally
// does not touch the ML model (mlClassifier.ts uses browser-only APIs —
// fetch + WebAssembly — so it's verified separately, in-browser).
// ---------------------------------------------------------------------------
import { evaluateMeasuredTelemetry, type SimConfig } from '../src/simulation/engineSimulation';
import { predictEngineState } from '../src/simulation/digitalTwinModel';
import { diagnose } from '../src/diagnostics/faultDetection';
import type { EngineTelemetry } from '../src/types';

const cfg: SimConfig = { throttle: 55, altitude: 10000, ambientTemp: 15 };
const engineLoad = Math.min(100, cfg.throttle * (0.85 + 0.15 * (cfg.throttle / 100)));
const predicted = predictEngineState({
  throttle: cfg.throttle, altitude: cfg.altitude, ambientTemp: cfg.ambientTemp, engineLoad,
});

function check(label: string, expected: string, got: string | null) {
  const pass = (got ?? 'NONE').includes(expected);
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}: expected "${expected}", got "${got ?? 'NONE'}"`);
  return pass;
}

console.log('Twin-predicted healthy baseline for throttle=55%, alt=10000ft, ambient=15C:');
console.log(' ', predicted);
console.log();

let allPassed = true;

// 1. A row that exactly matches the twin's own prediction should read as
//    perfectly healthy — this is the most basic sanity check there is.
const healthyRow: EngineTelemetry = {
  rpm: predicted.rpm, egt: predicted.egt, cht: predicted.cht, oilPressure: predicted.oilPressure,
  oilTemperature: 88, fuelFlow: predicted.fuelFlow, vibration: predicted.vibration,
  throttle: cfg.throttle, altitude: cfg.altitude, engineLoad,
};
const healthyState = evaluateMeasuredTelemetry(0, cfg, healthyRow);
const healthyDiag = diagnose(healthyState.twin);
console.log('Test 1 — telemetry exactly matching the twin prediction:');
allPassed = check('diagnosis', 'NONE', healthyDiag.activeDiagnosis) && allPassed;
console.log(`  health=${healthyState.health} (${healthyState.healthBand}), twinSync=${healthyState.twinSyncPercent}%`);
console.log();

// 2. CHT/EGT pushed up by the same amount faultModel.ts applies for a
//    full-severity OVERHEATING fault (+55C CHT, +40C EGT).
const overheatRow: EngineTelemetry = { ...healthyRow, cht: predicted.cht + 55, egt: predicted.egt + 40 };
const overheatState = evaluateMeasuredTelemetry(0, cfg, overheatRow);
const overheatDiag = diagnose(overheatState.twin);
console.log('Test 2 — CHT+55C, EGT+40C (matches full-severity OVERHEATING):');
allPassed = check('diagnosis', 'OVERHEATING', overheatDiag.activeDiagnosis) && allPassed;
console.log(`  health=${overheatState.health} (${overheatState.healthBand}), confidence=${overheatDiag.confidence}%`);
console.log();

// 3. Oil pressure AND vibration nudged together, matching the real
//    correlated effect faultModel.ts applies for LUBRICATION_DEGRADATION.
//    (Nudging oil pressure ALONE, with every other channel untouched, is
//    indistinguishable from a single faulty sensor — that's the sensor-drift
//    detector working as intended, not a bug; the real fault always moves
//    more than one channel together.)
const lowOilRow: EngineTelemetry = { ...healthyRow, oilPressure: predicted.oilPressure - 26, vibration: predicted.vibration + 0.9 };
const lowOilState = evaluateMeasuredTelemetry(0, cfg, lowOilRow);
const lowOilDiag = diagnose(lowOilState.twin);
console.log('Test 3 — oil pressure -26psi + vibration +0.9mm/s (matches full-severity LUBRICATION_DEGRADATION):');
allPassed = check('diagnosis', 'LUBRICATION', lowOilDiag.activeDiagnosis) && allPassed;
console.log(`  health=${lowOilState.health} (${lowOilState.healthBand}), confidence=${lowOilDiag.confidence}%`);
console.log();

// 4. Exactly one channel disagreeing, everything else untouched — should be
//    read as a sensor problem, not an engine problem.
const sensorDriftRow: EngineTelemetry = { ...healthyRow, oilPressure: predicted.oilPressure - 26 };
const sensorDriftState = evaluateMeasuredTelemetry(0, cfg, sensorDriftRow);
const sensorDriftDiag = diagnose(sensorDriftState.twin);
console.log('Test 4 — ONLY oil pressure disagrees, every other channel untouched (should read as a sensor fault):');
allPassed = check('diagnosis', 'SENSOR', sensorDriftDiag.activeDiagnosis) && allPassed;
console.log();

console.log(allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED — see [FAIL] lines above');
process.exit(allPassed ? 0 : 1);
