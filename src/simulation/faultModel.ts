// ---------------------------------------------------------------------------
// faultModel.ts
//
// Defines how each fault type perturbs the MEASURED engine telemetry away
// from the healthy baseline the digital twin predicts. Each function is a
// pure, deterministic function of severity (0-100) and elapsed time since
// injection (so faults ramp in rather than snapping to full severity), which
// keeps the demo readable and repeatable for judges.
//
// SENSOR_DRIFT is the one exception by design: it perturbs only the reading
// of a single sensor channel, leaving the true underlying engine condition
// (and therefore the other channels) essentially normal. This is what lets
// the demo show the difference between genuine engine degradation and a
// faulty sensor — see diagnostics/faultDetection.ts.
// ---------------------------------------------------------------------------

import type { ActiveFault, EngineTelemetry, TwinChannel } from '../types';
import type { PredictedState } from './digitalTwinModel';

/** Ramps 0→1 over ~20s so effects appear gradual, not instantaneous. */
function ramp(elapsedSeconds: number, rampSeconds = 20): number {
  return Math.min(1, elapsedSeconds / rampSeconds);
}

export interface FaultEffect {
  telemetry: Partial<EngineTelemetry>;
  /** Additive offsets applied directly to measured twin-channels, used for
   * SENSOR_DRIFT where only the *reading* should move, not the true state. */
  sensorOnlyOffsets: Partial<Record<TwinChannel, number>>;
}

const EMPTY_EFFECT: FaultEffect = { telemetry: {}, sensorOnlyOffsets: {} };

export function applyFault(
  fault: ActiveFault,
  baseline: EngineTelemetry,
  twinPrediction: PredictedState,
): FaultEffect {
  if (fault.type === 'NONE') return EMPTY_EFFECT;

  const s = fault.severity / 100;
  const r = ramp(fault.elapsedSeconds);
  const strength = s * r;

  switch (fault.type) {
    case 'OVERHEATING': {
      // CHT and EGT climb; cooling can't keep pace. Health-relevant residual
      // grows steadily, exactly the signature fault_detection.ts looks for.
      const chtRise = strength * 55; // up to +55 degC at full severity
      const egtRise = strength * 40;
      return {
        telemetry: {
          cht: baseline.cht + chtRise,
          egt: baseline.egt + egtRise,
        },
        sensorOnlyOffsets: {},
      };
    }

    case 'LUBRICATION_DEGRADATION': {
      const pressureDrop = strength * 26; // psi
      const oilTempRise = strength * 22; // degC
      const vibRise = strength * 0.9; // mild secondary effect
      return {
        telemetry: {
          oilPressure: Math.max(8, baseline.oilPressure - pressureDrop),
          oilTemperature: baseline.oilTemperature + oilTempRise,
          vibration: baseline.vibration + vibRise,
        },
        sensorOnlyOffsets: {},
      };
    }

    case 'INJECTOR_ABNORMALITY': {
      // Fuel metering becomes uneven -> EGT instability + fuel flow error +
      // small RPM hunting. Uses a fast oscillation layered on top of the
      // ramp so the instrument reads visibly "unstable" rather than just
      // biased, matching the brief's "EGT becomes unstable" behaviour.
      const oscillation = Math.sin(fault.elapsedSeconds * 1.7) * strength;
      const egtSwing = oscillation * 45;
      const fuelError = strength * (0.18 + 0.05 * Math.sin(fault.elapsedSeconds * 2.3));
      const rpmHunt = oscillation * 60;
      return {
        telemetry: {
          egt: baseline.egt + egtSwing,
          fuelFlow: baseline.fuelFlow * (1 + fuelError),
          rpm: baseline.rpm + rpmHunt,
        },
        sensorOnlyOffsets: {},
      };
    }

    case 'VIBRATION_ANOMALY': {
      const vibRise = strength * 3.2; // mm/s, e.g. imbalance/mount wear
      return {
        telemetry: {
          vibration: baseline.vibration + vibRise,
        },
        sensorOnlyOffsets: {},
      };
    }

    case 'SENSOR_DRIFT': {
      const channel = fault.driftChannel ?? 'egt';
      // Drift grows roughly linearly with time-since-injection (typical of a
      // slowly failing sensor / loose connector), capped by severity.
      const magnitudeByChannel: Record<TwinChannel, number> = {
        rpm: 220,
        egt: 60,
        cht: 25,
        oilPressure: 14,
        vibration: 1.6,
      };
      const drift = strength * magnitudeByChannel[channel];
      return {
        telemetry: {},
        sensorOnlyOffsets: { [channel]: drift },
      };
    }

    default:
      return EMPTY_EFFECT;
  }
}
