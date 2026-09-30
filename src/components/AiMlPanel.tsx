import { Cpu, Loader2, AlertTriangle } from 'lucide-react';
import { useSimulation } from '../state/SimulationContext';
import type { FaultType } from '../types';

const FAULT_LABELS: Record<FaultType, string> = {
  NONE: 'NO FAULT',
  OVERHEATING: 'OVERHEATING',
  LUBRICATION_DEGRADATION: 'LUBRICATION DEGRADATION',
  INJECTOR_ABNORMALITY: 'INJECTOR ABNORMALITY',
  VIBRATION_ANOMALY: 'VIBRATION ANOMALY',
  SENSOR_DRIFT: 'SENSOR DRIFT',
};

function faultColor(f: FaultType | null): string {
  if (!f || f === 'NONE') return '#4ade80';
  return '#f0475a';
}

export function AiMlPanel() {
  const { mlDiagnosis, snapshot } = useSimulation();

  const agrees =
    mlDiagnosis.status === 'ready' &&
    ((mlDiagnosis.faultType === 'NONE' && !snapshot.diagnostics.activeDiagnosis) ||
      (!!mlDiagnosis.faultType &&
        mlDiagnosis.faultType !== 'NONE' &&
        !!snapshot.diagnostics.activeDiagnosis &&
        snapshot.diagnostics.activeDiagnosis.includes(FAULT_LABELS[mlDiagnosis.faultType].split(' ')[0])));

  const sortedProbs = mlDiagnosis.status === 'ready'
    ? Object.entries(mlDiagnosis.probabilities).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 3)
    : [];

  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu size={14} className="text-status-info" />
        <span className="font-mono text-[11px] tracking-widest text-ink-500">ML MODEL PREDICTION</span>
        <span className="ml-auto px-2 py-0.5 rounded bg-status-infoDim border border-status-info/30 text-status-info font-mono text-[10px] tracking-widest">
          XGBOOST · ONNX RUNTIME (BROWSER, OFFLINE)
        </span>
      </div>

      {mlDiagnosis.status === 'loading' && (
        <div className="flex items-center gap-2 text-ink-500 font-mono text-xs py-3">
          <Loader2 size={14} className="animate-spin" /> Loading model weights…
        </div>
      )}

      {mlDiagnosis.status === 'error' && (
        <div className="flex items-center gap-2 text-status-critical font-mono text-xs py-3">
          <AlertTriangle size={14} /> Model failed to load — {mlDiagnosis.error ?? 'unknown error'}
        </div>
      )}

      {mlDiagnosis.status === 'ready' && mlDiagnosis.faultType && (
        <>
          <div className="flex items-center justify-between px-3 py-3 rounded bg-base-700/50 mb-3">
            <div>
              <div className="font-mono text-[10px] tracking-widest text-ink-700">PREDICTED CLASS</div>
              <div className="font-ui text-base font-semibold mt-0.5" style={{ color: faultColor(mlDiagnosis.faultType) }}>
                {FAULT_LABELS[mlDiagnosis.faultType]}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] tracking-widest text-ink-700">CONFIDENCE</div>
              <div className="font-mono text-lg tabular" style={{ color: faultColor(mlDiagnosis.faultType) }}>
                {mlDiagnosis.confidence.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            {sortedProbs.map(([cls, p]) => (
              <div key={cls} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-ink-500 w-32 truncate">{FAULT_LABELS[cls as FaultType]}</span>
                <div className="flex-1 h-1.5 rounded-full bg-base-600 overflow-hidden">
                  <div className="h-full rounded-full bg-status-info" style={{ width: `${p}%` }} />
                </div>
                <span className="font-mono text-[10px] text-ink-500 w-10 text-right tabular">{p?.toFixed(1)}%</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-base-700/30 mb-2">
            <span className="font-mono text-[10px] text-ink-700">RULE-BASED vs ML:</span>
            <span
              className="font-mono text-[10px] px-1.5 py-0.5 rounded"
              style={{
                color: agrees ? '#4ade80' : '#f5a524',
                backgroundColor: agrees ? '#1f452033' : '#4a331233',
              }}
            >
              {agrees ? 'AGREE' : 'DIFFER — CROSS-CHECK'}
            </span>
          </div>

          {mlDiagnosis.modelInfo && (
            <p className="font-mono text-[10px] text-ink-700">
              Model trained on {mlDiagnosis.modelInfo.trainedOn} · {mlDiagnosis.modelInfo.testAccuracy}% held-out
              accuracy (clean synthetic data — see project report for noise-robustness results).
            </p>
          )}
        </>
      )}
    </div>
  );
}
