// ---------------------------------------------------------------------------
// faultDetection.ts
//
// PROTOTYPE DIAGNOSTIC LAYER — simple, explainable rule/residual thresholds.
// This is intentionally NOT machine learning. It exists so the rest of the
// system (UI, event log, health index) has a real diagnosis to react to in
// this demo, while making the seam obvious for where a trained model would
// plug in later.
//
// To swap in a real model later: implement the AnomalyDetector interface
// below (see modules/futureMl.ts) and call it instead of / alongside
// `diagnose()`, without changing anything in the UI layer — pages only
// consume a `DiagnosticResult`.
// ---------------------------------------------------------------------------

import type { DiagnosticResult, FaultType, TwinChannel, TwinComparisonSet } from '../types';

// Residual thresholds (absolute value) above which a channel is considered
// "suspect". Tuned against RESIDUAL_SCALE in engineSimulation.ts so a fully
// severe fault clearly crosses its threshold well before max severity.
const THRESHOLDS: Record<TwinChannel, number> = {
  rpm: 90,
  egt: 18,
  cht: 12,
  oilPressure: -9, // negative: pressure DROP is the signal
  vibration: 0.9,
};

interface Rule {
  id: FaultType;
  label: string;
  test: (twin: TwinComparisonSet) => boolean;
  confidence: (twin: TwinComparisonSet) => number;
  evidence: (twin: TwinComparisonSet) => string[];
  recommendation: string;
}

function pctAbove(residual: number, threshold: number): number {
  return (Math.abs(residual) / Math.abs(threshold)) * 100 - 100;
}

const RULES: Rule[] = [
  {
    id: 'OVERHEATING',
    label: 'OVERHEATING SUSPECTED',
    test: (t) => t.cht.residual > THRESHOLDS.cht && t.egt.residual > 8,
    confidence: (t) => clampConfidence(55 + pctAbove(t.cht.residual, THRESHOLDS.cht) * 0.8),
    evidence: (t) => [
      `CHT +${pctDelta(t.cht)}% above digital twin baseline`,
      `EGT +${pctDelta(t.egt)}% above digital twin baseline`,
      'Thermal residual trending upward',
    ],
    recommendation: 'Inspect cooling/thermal system before next high-load operation.',
  },
  {
    id: 'LUBRICATION_DEGRADATION',
    label: 'LUBRICATION ISSUE SUSPECTED',
    test: (t) => t.oilPressure.residual < THRESHOLDS.oilPressure,
    confidence: (t) => clampConfidence(55 + pctAbove(t.oilPressure.residual, THRESHOLDS.oilPressure) * 0.8),
    evidence: (t) => [
      `Oil pressure ${pctDelta(t.oilPressure)}% below digital twin baseline`,
      'Lubrication residual trending downward',
    ],
    recommendation: 'Check oil pressure system and lubrication circuit before next flight.',
  },
  {
    id: 'INJECTOR_ABNORMALITY',
    label: 'INJECTOR ABNORMALITY SUSPECTED',
    test: (t) => Math.abs(t.egt.residual) > THRESHOLDS.egt && Math.abs(t.rpm.residual) > 35,
    confidence: (t) => clampConfidence(50 + pctAbove(Math.abs(t.egt.residual), THRESHOLDS.egt) * 0.7),
    evidence: () => ['EGT reading unstable relative to twin prediction', 'RPM fluctuation detected alongside fuel-flow error'],
    recommendation: 'Inspect fuel injection / metering system before next operation.',
  },
  {
    id: 'VIBRATION_ANOMALY',
    label: 'MECHANICAL/VIBRATION ANOMALY SUSPECTED',
    test: (t) => t.vibration.residual > THRESHOLDS.vibration,
    confidence: (t) => clampConfidence(55 + pctAbove(t.vibration.residual, THRESHOLDS.vibration) * 0.8),
    evidence: (t) => [`Vibration +${pctDelta(t.vibration)}% above digital twin baseline`, 'Mechanical residual sustained above threshold'],
    recommendation: 'Inspect mounts, balance, and mechanical linkages before next flight.',
  },
];

function pctDelta(cmp: { measured: number; predicted: number }): string {
  if (cmp.predicted === 0) return '—';
  const pct = ((cmp.measured - cmp.predicted) / Math.abs(cmp.predicted)) * 100;
  return Math.abs(pct).toFixed(0);
}

function clampConfidence(v: number): number {
  return Math.max(30, Math.min(97, Math.round(v)));
}

/**
 * SENSOR DRIFT vs genuine degradation:
 * If exactly one channel has a growing residual while ALL other channels
 * remain close to the twin's prediction, this points to a faulty sensor
 * rather than true engine degradation (the rest of the "engine" agrees with
 * the twin — only one instrument disagrees).
 */
function detectSensorDrift(twin: TwinComparisonSet): { channel: TwinChannel; result: DiagnosticResult } | null {
  const channels: TwinChannel[] = ['rpm', 'egt', 'cht', 'oilPressure', 'vibration'];
  const severities = channels.map((c) => ({
    channel: c,
    severity: Math.abs(twin[c].residual) / Math.abs(THRESHOLDS[c]),
  }));
  severities.sort((a, b) => b.severity - a.severity);
  const top = severities[0];
  const rest = severities.slice(1);
  const restNormal = rest.every((r) => r.severity < 0.5);

  if (top.severity > 1.1 && restNormal) {
    const confidence = clampConfidence(55 + (top.severity - 1) * 40);
    return {
      channel: top.channel,
      result: {
        status: confidence > 70 ? 'WARNING' : 'NORMAL',
        activeDiagnosis: 'SENSOR DRIFT SUSPECTED',
        confidence,
        evidence: [
          { label: `${channelLabel(top.channel)} sensor diverging from digital twin prediction` },
          { label: 'All other monitored channels remain within normal band' },
          { label: 'Pattern consistent with instrumentation fault, not engine degradation' },
        ],
        recommendation: `Cross-check ${channelLabel(top.channel)} sensor / wiring; engine condition otherwise appears normal.`,
      },
    };
  }
  return null;
}

function channelLabel(c: TwinChannel): string {
  const labels: Record<TwinChannel, string> = {
    rpm: 'RPM',
    egt: 'EGT',
    cht: 'CHT',
    oilPressure: 'Oil pressure',
    vibration: 'Vibration',
  };
  return labels[c];
}

/**
 * Runs the full rule-based diagnostic pass over the current twin comparison
 * set and returns a single best-explanation result. This is the "diagnostics.ts"
 * module referenced in the architecture doc — independent of the UI, and
 * built so a future ML AnomalyDetector can be substituted without changing
 * the DiagnosticResult contract.
 */
export function diagnose(twin: TwinComparisonSet): DiagnosticResult {
  // Sensor drift is checked first — it's a specifically-shaped pattern
  // (one channel off, rest normal) rather than a magnitude threshold.
  const drift = detectSensorDrift(twin);
  if (drift) return drift.result;

  const triggered = RULES.filter((r) => r.test(twin));
  if (triggered.length === 0) {
    return {
      status: 'NORMAL',
      activeDiagnosis: null,
      confidence: 0,
      evidence: [],
      recommendation: null,
    };
  }

  // Pick the highest-confidence rule as the primary diagnosis.
  const best = triggered.reduce((a, b) => (a.confidence(twin) >= b.confidence(twin) ? a : b));
  const confidence = best.confidence(twin);

  return {
    status: confidence >= 75 ? 'CRITICAL' : 'WARNING',
    activeDiagnosis: best.label,
    confidence,
    evidence: best.evidence(twin).map((label) => ({ label })),
    recommendation: best.recommendation,
  };
}
