// ---------------------------------------------------------------------------
// digitalTwinModel.ts
//
// This is the "virtual engine" — a simplified, physics-INSPIRED model that
// predicts what a healthy aero-piston engine SHOULD be reading given the
// commanded operating conditions (throttle, altitude, ambient temperature).
//
// IMPORTANT: this model has no knowledge of injected faults. That is the
// entire point of a digital twin comparison — the twin represents the
// expected/healthy behaviour, and the gap between it and the measured
// (possibly-faulty) engine is the residual that drives diagnostics.
//
// These equations are deliberately simple and readable, not CFD/thermodynamic
// simulation. They are isolated in this file specifically so a future,
// higher-fidelity model (or a trained surrogate model) can be swapped in
// without touching the UI or the diagnostics layer — see PredictorInputs /
// PredictedState for the contract that must be preserved.
// ---------------------------------------------------------------------------

export interface PredictorInputs {
  throttle: number; // 0-100 %
  altitude: number; // ft
  ambientTemp: number; // degC at sea level reference, adjusted internally
  engineLoad: number; // 0-100 %
}

export interface PredictedState {
  rpm: number;
  egt: number;
  cht: number;
  oilPressure: number;
  vibration: number;
  fuelFlow: number;
}

const SEA_LEVEL_IDLE_RPM = 900;
const MAX_RPM = 6200;
const MAX_EGT = 780; // degC at full load, sea level, standard day
const MAX_CHT = 210; // degC at full load
const BASE_OIL_PRESSURE = 62; // psi at rated RPM, standard oil temp
const BASE_VIBRATION = 1.4; // mm/s at steady cruise

/**
 * Air density falls off with altitude, which the model uses as a simple
 * multiplier on volumetric efficiency and cooling effectiveness.
 * Approximate ISA density ratio, good enough for a demonstrator.
 */
function densityRatio(altitudeFt: number): number {
  const ratio = Math.pow(1 - altitudeFt / 145442, 4.2561);
  return Math.max(0.35, Math.min(1, ratio));
}

/** RPM = function(throttle, altitude density) */
export function predictRpm(inputs: PredictorInputs): number {
  const rho = densityRatio(inputs.altitude);
  const commanded = SEA_LEVEL_IDLE_RPM + (inputs.throttle / 100) * (MAX_RPM - SEA_LEVEL_IDLE_RPM);
  // Thinner air lets a naturally aspirated piston engine spin slightly higher
  // for the same throttle position (less pumping loss) but loses power.
  return commanded * (0.94 + 0.06 * (1 / rho) * 0.0 + 0.06 * (1 - rho) + rho * 0);
}

/** Fuel Flow = function(RPM, throttle) — roughly linear with commanded power. */
export function predictFuelFlow(inputs: PredictorInputs, rpm: number): number {
  const rho = densityRatio(inputs.altitude);
  const rpmFraction = (rpm - SEA_LEVEL_IDLE_RPM) / (MAX_RPM - SEA_LEVEL_IDLE_RPM);
  const baseFlow = 3.5 + rpmFraction * 34; // kg/h, idle ~3.5 up to ~37.5 kg/h
  return Math.max(2.5, baseFlow * (0.7 + 0.3 * rho));
}

/** EGT = function(RPM/load, ambient temperature) */
export function predictEgt(inputs: PredictorInputs): number {
  const loadFraction = inputs.engineLoad / 100;
  const ambientDelta = inputs.ambientTemp - 15; // ISA reference 15 degC
  return 340 + loadFraction * (MAX_EGT - 340) + ambientDelta * 0.6;
}

/** CHT = function(EGT, load, cooling effectiveness at altitude) */
export function predictCht(inputs: PredictorInputs, egt: number): number {
  const rho = densityRatio(inputs.altitude);
  const coolingEffectiveness = 0.55 + 0.45 * rho; // thinner air cools less
  const loadFraction = inputs.engineLoad / 100;
  const base = 70 + loadFraction * (MAX_CHT - 70);
  // A slice of EGT "leaks" thermally into CHT, tempered by cooling.
  const thermalCoupling = (egt - 340) * 0.05;
  return base / coolingEffectiveness * 0.62 + thermalCoupling + inputs.ambientTemp * 0.15;
}

/** Oil Pressure = function(RPM, nominal lubrication condition) */
export function predictOilPressure(rpm: number): number {
  const rpmFraction = Math.min(1, rpm / MAX_RPM);
  // Oil pressure rises with RPM up to a regulated plateau, typical of a
  // pressure-relief-valve-regulated wet-sump lubrication system.
  return Math.min(BASE_OIL_PRESSURE, 22 + rpmFraction * 55);
}

/** Vibration = function(RPM, load, nominal mechanical condition) */
export function predictVibration(inputs: PredictorInputs, rpm: number): number {
  const rpmFraction = rpm / MAX_RPM;
  const loadFraction = inputs.engineLoad / 100;
  return BASE_VIBRATION + rpmFraction * 1.1 + loadFraction * 0.6;
}

/** Runs the full predictor and returns the complete expected engine state. */
export function predictEngineState(inputs: PredictorInputs): PredictedState {
  const rpm = predictRpm(inputs);
  const egt = predictEgt(inputs);
  const cht = predictCht(inputs, egt);
  const oilPressure = predictOilPressure(rpm);
  const vibration = predictVibration(inputs, rpm);
  const fuelFlow = predictFuelFlow(inputs, rpm);
  return { rpm, egt, cht, oilPressure, vibration, fuelFlow };
}
