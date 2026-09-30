// ---------------------------------------------------------------------------
// futureMl.ts — FUTURE ML MODULE (not implemented in this demo)
//
// These interfaces exist purely to show the architectural seam where trained
// models will plug in later, per the pipeline:
//
//   Telemetry -> Feature Extraction -> Digital Twin Residuals ->
//   Diagnostic Engine -> [Future ML Layer] -> Anomaly Detection ->
//   Fault Prediction -> RUL -> Maintenance Recommendation
//
// Nothing here produces real predictions. Every method intentionally returns
// a "not implemented" result so the UI can render an honest
// "MODULE READY FOR INTEGRATION" state instead of fabricating AI output.
// ---------------------------------------------------------------------------

import type { TwinComparisonSet } from '../types';

export interface NotImplemented {
  implemented: false;
  reason: 'FUTURE_ML_MODULE';
}

export interface AnomalyDetector {
  /** Future: ML-based anomaly scoring over the twin residual feature vector. */
  detect(twin: TwinComparisonSet): NotImplemented;
}

export interface FaultPredictor {
  /** Future: multi-class fault classification model (e.g. Random Forest / LSTM). */
  predict(twin: TwinComparisonSet): NotImplemented;
}

export interface RulPredictor {
  /** Future: Remaining Useful Life estimation with uncertainty bounds. */
  estimate(twin: TwinComparisonSet): NotImplemented;
}

const NOT_IMPLEMENTED: NotImplemented = { implemented: false, reason: 'FUTURE_ML_MODULE' };

export const anomalyDetectorPlaceholder: AnomalyDetector = {
  detect: () => NOT_IMPLEMENTED,
};

export const faultPredictorPlaceholder: FaultPredictor = {
  predict: () => NOT_IMPLEMENTED,
};

export const rulPredictorPlaceholder: RulPredictor = {
  estimate: () => NOT_IMPLEMENTED,
};
