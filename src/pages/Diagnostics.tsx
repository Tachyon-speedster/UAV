import { useSimulation } from '../state/SimulationContext';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { AiMlPanel } from '../components/AiMlPanel';

const STATUS_META = {
  NORMAL: { color: '#4ade80', bg: '#1f4530', icon: CheckCircle2, label: 'NORMAL' },
  WARNING: { color: '#f5a524', bg: '#4a3312', icon: AlertTriangle, label: 'WARNING' },
  CRITICAL: { color: '#f0475a', bg: '#4a1520', icon: ShieldAlert, label: 'CRITICAL' },
} as const;

export function Diagnostics() {
  const { snapshot } = useSimulation();
  const { diagnostics } = snapshot;
  const meta = STATUS_META[diagnostics.status];
  const Icon = meta.icon;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-4 min-w-0">
        <div className="bg-base-800 border border-base-600 rounded shadow-panel p-5">
          <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">CURRENT STATUS</div>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded border"
            style={{ backgroundColor: meta.bg, borderColor: `${meta.color}55` }}
          >
            <Icon size={22} style={{ color: meta.color }} />
            <span className="font-mono text-lg tracking-widest" style={{ color: meta.color }}>
              {meta.label}
            </span>
          </div>
        </div>

        <div className="bg-base-800 border border-base-600 rounded shadow-panel p-5">
          <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">ACTIVE DIAGNOSTIC</div>
          {diagnostics.activeDiagnosis ? (
            <>
              <div className="font-ui text-base text-ink-100 font-semibold mb-2">{diagnostics.activeDiagnosis}</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-ink-500">Diagnostic Confidence</span>
                <div className="flex-1 h-1.5 rounded-full bg-base-600 overflow-hidden max-w-[160px]">
                  <div
                    className="h-full rounded-full bg-status-info"
                    style={{ width: `${diagnostics.confidence}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-status-info tabular">{diagnostics.confidence}%</span>
              </div>
              <p className="font-mono text-[10px] text-ink-700 mt-2">
                Prototype score — rule/residual-based, not an ML confidence estimate.
              </p>
            </>
          ) : (
            <p className="font-mono text-sm text-ink-500">No active diagnosis. All monitored channels within the digital twin's expected band.</p>
          )}
        </div>

        {diagnostics.evidence.length > 0 && (
          <div className="bg-base-800 border border-base-600 rounded shadow-panel p-5">
            <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">EVIDENCE</div>
            <ul className="space-y-1.5">
              {diagnostics.evidence.map((e, i) => (
                <li key={i} className="font-mono text-xs text-ink-300 flex gap-2">
                  <span className="text-status-warn">›</span>
                  {e.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {diagnostics.recommendation && (
          <div className="bg-base-800 border border-base-600 rounded shadow-panel p-5">
            <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">RECOMMENDATION</div>
            <p className="font-ui text-sm text-ink-100">{diagnostics.recommendation}</p>
            <p className="font-mono text-[10px] text-status-warn mt-2 tracking-wide">
              PROTOTYPE RECOMMENDATION — NOT OPERATIONAL MAINTENANCE GUIDANCE
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4 min-w-0">
        <AiMlPanel />
        <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4 font-mono text-[11px] text-ink-500 leading-relaxed">
          <p className="text-ink-300 mb-2 tracking-widest text-[10px]">DETECTION PIPELINE</p>
          <p>
            Telemetry → Feature Extraction → Digital Twin Residuals → Rule-Based Diagnostic Engine (above) +
            Trained XGBoost Classifier (ONNX Runtime, running fully client-side — panel above) → Cross-checked
            Fault Prediction → Remaining Useful Life estimation (see Mission page) → Maintenance Recommendation.
          </p>
        </div>
      </div>
    </div>
  );
}
