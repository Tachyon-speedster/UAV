// ---------------------------------------------------------------------------
// missionModel.ts
//
// A small, self-contained "what if" projector: given a mission profile
// (altitude, ambient temperature, throttle, duration), forward-simulates
// engine health and key temperatures over the mission using the SAME
// digital twin equations as the live simulation, so the projection is
// consistent with what the live view would show under those conditions.
//
// This is not a sophisticated mission planner — it exists to demonstrate
// "what happens to engine health under different operating conditions?"
// ---------------------------------------------------------------------------

import type { MissionRunInputs, MissionRunResult, MissionRunSample } from '../types';
import { predictEngineState } from './digitalTwinModel';

const SAMPLE_INTERVAL_MIN = 1;

export function runMissionSimulation(inputs: MissionRunInputs): MissionRunResult {
  const { altitude, ambientTemp, throttle, durationMinutes } = inputs;
  const engineLoad = Math.min(100, throttle * (0.85 + 0.15 * (throttle / 100)));

  const predicted = predictEngineState({ throttle, altitude, ambientTemp, engineLoad });

  // Thermal stress accumulates the longer the mission runs at this
  // throttle/altitude combination — a simple fatigue-style decay curve.
  const thermalStressFactor = Math.max(0, (predicted.cht - 150) / 60) + Math.max(0, (altitude - 15000) / 20000);
  const hotWeatherPenalty = Math.max(0, (ambientTemp - 25) / 40);
  const stressPerMinute = 0.015 * (thermalStressFactor + hotWeatherPenalty) * (0.4 + throttle / 100);

  const samples: MissionRunSample[] = [];
  let health = 98;
  let fuelUsedKg = 0;

  const steps = Math.max(1, Math.round(durationMinutes / SAMPLE_INTERVAL_MIN));
  for (let i = 0; i <= steps; i++) {
    const t = i * SAMPLE_INTERVAL_MIN;
    // CHT/EGT ramp toward their steady predicted value over the first ~10
    // minutes (thermal soak), then hold with slow creep from stress.
    const soak = Math.min(1, t / 10);
    const creep = 1 + (thermalStressFactor * t) / 400;
    const cht = predicted.cht * soak * creep + 60 * (1 - soak);
    const egt = predicted.egt * soak * creep + 200 * (1 - soak);

    health = Math.max(5, health - stressPerMinute);
    fuelUsedKg += (predicted.fuelFlow / 60) * SAMPLE_INTERVAL_MIN;

    samples.push({
      t,
      health: Math.round(health * 10) / 10,
      cht: Math.round(cht * 10) / 10,
      egt: Math.round(egt * 10) / 10,
      fuelUsedKg: Math.round(fuelUsedKg * 10) / 10,
    });
  }

  const finalHealth = samples[samples.length - 1].health;
  const risk: MissionRunResult['risk'] = finalHealth >= 85 ? 'LOW' : finalHealth >= 65 ? 'MEDIUM' : 'HIGH';

  return { samples, risk, finalHealth, totalFuelKg: Math.round(fuelUsedKg * 10) / 10 };
}
