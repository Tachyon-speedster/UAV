import { useCallback, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Upload, Download, FileWarning, Loader2, CheckCircle2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { evaluateMeasuredTelemetry, type SimConfig } from '../simulation/engineSimulation';
import { diagnose } from '../diagnostics/faultDetection';
import { classifyFault } from '../ml/mlClassifier';
import type { DiagnosticResult, EngineTelemetry, FaultType, HealthBand } from '../types';

const REQUIRED_COLUMNS = ['throttle_cmd', 'altitude_ft', 'ambient_temp_c', 'rpm', 'egt', 'cht', 'oil_pressure', 'vibration'];
const OPTIONAL_COLUMNS = ['t', 'oil_temperature', 'fuel_flow'];
const MAX_ROWS = 3000; // keeps ONNX inference (sequential, in-browser) responsive

interface AnalyzedRow {
  t: number;
  telemetry: EngineTelemetry;
  health: number;
  healthBand: HealthBand;
  twinSyncPercent: number;
  ruleDiagnosis: DiagnosticResult;
  mlFaultType: FaultType | null;
  mlConfidence: number;
}

const FAULT_LABELS: Record<FaultType, string> = {
  NONE: 'NONE', OVERHEATING: 'OVERHEATING', LUBRICATION_DEGRADATION: 'LUBRICATION DEGRADATION',
  INJECTOR_ABNORMALITY: 'INJECTOR ABNORMALITY', VIBRATION_ANOMALY: 'VIBRATION ANOMALY', SENSOR_DRIFT: 'SENSOR DRIFT',
};

const BAND_COLOR: Record<HealthBand, string> = {
  HEALTHY: '#4ade80', MONITOR: '#4ea8de', DEGRADED: '#f5a524', CRITICAL: '#f0475a',
};

function downloadTemplate() {
  const header = 't,throttle_cmd,altitude_ft,ambient_temp_c,rpm,egt,cht,oil_pressure,oil_temperature,fuel_flow,vibration';
  const rows = [
    '0,55,10000,15,3800,520,142,48,92,18.4,2.6',
    '1,55,10000,15,3810,522,143,48,92,18.5,2.6',
    '2,60,10000,15,3980,540,148,47,93,19.6,2.7',
  ];
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'uav_dt_sensor_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadResults(rows: AnalyzedRow[]) {
  const header = 't,rpm,egt,cht,oil_pressure,vibration,twin_sync_pct,health,health_band,rule_diagnosis,rule_confidence,ml_fault_type,ml_confidence';
  const lines = rows.map((r) =>
    [
      r.t, r.telemetry.rpm.toFixed(1), r.telemetry.egt.toFixed(1), r.telemetry.cht.toFixed(1),
      r.telemetry.oilPressure.toFixed(1), r.telemetry.vibration.toFixed(2), r.twinSyncPercent, r.health, r.healthBand,
      r.ruleDiagnosis.activeDiagnosis ?? 'NONE', r.ruleDiagnosis.confidence,
      r.mlFaultType ?? 'PENDING', r.mlConfidence.toFixed(1),
    ].join(','),
  );
  const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'uav_dt_analyzed_results.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportData() {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'analyzing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<AnalyzedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  const handleFile = useCallback((file: File) => {
    setStatus('parsing');
    setError(null);
    setRows([]);
    setFileName(file.name);
    setProgress(0);

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const data = result.data as Record<string, number>[];
        const missing = REQUIRED_COLUMNS.filter((c) => !(c in (data[0] ?? {})));
        if (missing.length > 0) {
          setError(`CSV is missing required column(s): ${missing.join(', ')}. Required: ${REQUIRED_COLUMNS.join(', ')}.`);
          setStatus('error');
          return;
        }

        const wasTruncated = data.length > MAX_ROWS;
        setTruncated(wasTruncated);
        const usable = wasTruncated ? data.slice(0, MAX_ROWS) : data;

        setStatus('analyzing');
        const analyzed: AnalyzedRow[] = [];

        for (let i = 0; i < usable.length; i++) {
          const row = usable[i];
          const cfg: SimConfig = {
            throttle: row.throttle_cmd,
            altitude: row.altitude_ft,
            ambientTemp: row.ambient_temp_c,
          };
          const measured: EngineTelemetry = {
            rpm: row.rpm,
            egt: row.egt,
            cht: row.cht,
            oilPressure: row.oil_pressure,
            oilTemperature: row.oil_temperature ?? 85,
            fuelFlow: row.fuel_flow ?? 0,
            vibration: row.vibration,
            throttle: row.throttle_cmd,
            altitude: row.altitude_ft,
            engineLoad: 0,
          };
          const t = row.t ?? i;
          const state = evaluateMeasuredTelemetry(t, cfg, measured);
          const ruleDiagnosis = diagnose(state.twin);

          // eslint-disable-next-line no-await-in-loop -- ORT WASM session isn't safe to fan out concurrently
          const ml = await classifyFault({
            telemetry: state.telemetry,
            twin: state.twin,
            twinSyncPercent: state.twinSyncPercent,
            ambientTempC: cfg.ambientTemp,
          }).catch(() => null);

          analyzed.push({
            t,
            telemetry: state.telemetry,
            health: state.health,
            healthBand: state.healthBand,
            twinSyncPercent: state.twinSyncPercent,
            ruleDiagnosis,
            mlFaultType: ml?.faultType ?? null,
            mlConfidence: ml?.confidence ?? 0,
          });

          if (i % 25 === 0 || i === usable.length - 1) {
            setProgress(Math.round(((i + 1) / usable.length) * 100));
          }
        }

        setRows(analyzed);
        setStatus('done');
      },
      error: (err: Error) => {
        setError(err.message);
        setStatus('error');
      },
    });
  }, []);

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const worst = rows.reduce((a, b) => (a.health < b.health ? a : b));
    const ruleCounts = new Map<string, number>();
    const mlCounts = new Map<string, number>();
    let agree = 0;
    for (const r of rows) {
      const ruleKey = r.ruleDiagnosis.activeDiagnosis ?? 'NONE';
      ruleCounts.set(ruleKey, (ruleCounts.get(ruleKey) ?? 0) + 1);
      const mlKey = r.mlFaultType ? FAULT_LABELS[r.mlFaultType] : 'N/A';
      mlCounts.set(mlKey, (mlCounts.get(mlKey) ?? 0) + 1);
      const ruleFlagged = !!r.ruleDiagnosis.activeDiagnosis;
      const mlFlagged = r.mlFaultType && r.mlFaultType !== 'NONE';
      if (ruleFlagged === mlFlagged) agree++;
    }
    const topRule = [...ruleCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topMl = [...mlCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      worst,
      topRule: topRule ? topRule[0] : 'NONE',
      topMl: topMl ? topMl[0] : 'N/A',
      agreementPct: Math.round((agree / rows.length) * 100),
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="bg-base-800 border border-base-600 rounded shadow-panel p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[11px] tracking-widest text-ink-500">IMPORT REAL SENSOR DATA</span>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border border-base-600 text-ink-300 hover:text-ink-100 hover:border-ink-500 transition-colors"
          >
            <Download size={12} /> DOWNLOAD CSV TEMPLATE
          </button>
        </div>

        <p className="font-mono text-xs text-ink-500 leading-relaxed mb-3">
          Upload a CSV of real logged telemetry — from your instrumented test rig, a real UAV flight log, or any
          source — and it will run through the exact same digital-twin comparison, health scoring, rule-based
          diagnosis, and trained ML model as the live simulation. Required columns:{' '}
          <span className="text-ink-300">{REQUIRED_COLUMNS.join(', ')}</span>. Optional:{' '}
          <span className="text-ink-300">{OPTIONAL_COLUMNS.join(', ')}</span> (sensible defaults are used if omitted).
        </p>

        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-base-600 rounded-lg py-6 cursor-pointer hover:border-status-info transition-colors">
          <Upload size={16} className="text-ink-500" />
          <span className="font-mono text-xs text-ink-500">
            {fileName ? `Loaded: ${fileName}` : 'Click to choose a .csv file, or drag one here'}
          </span>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>

        {status === 'analyzing' && (
          <div className="flex items-center gap-2 mt-3 font-mono text-xs text-status-info">
            <Loader2 size={14} className="animate-spin" /> Running digital twin + rule engine + ML model on each
            row… {progress}%
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 mt-3 font-mono text-xs text-status-critical">
            <FileWarning size={14} /> {error}
          </div>
        )}
        {status === 'done' && (
          <div className="flex items-center gap-2 mt-3 font-mono text-xs text-status-healthy">
            <CheckCircle2 size={14} /> Analyzed {rows.length} rows.
            {truncated && ` File had more than ${MAX_ROWS} rows — only the first ${MAX_ROWS} were processed.`}
          </div>
        )}
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <SummaryCard label="ROWS ANALYZED" value={String(rows.length)} />
            <SummaryCard
              label="WORST HEALTH REACHED"
              value={`${summary.worst.health}%`}
              color={BAND_COLOR[summary.worst.healthBand]}
              sub={`at t=${summary.worst.t} (${summary.worst.healthBand})`}
            />
            <SummaryCard label="TOP RULE-BASED DIAGNOSIS" value={summary.topRule} small />
            <SummaryCard label="TOP ML DIAGNOSIS" value={summary.topMl} small />
          </div>

          <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] tracking-widest text-ink-500">ENGINE HEALTH OVER IMPORTED RUN</span>
              <button
                onClick={() => downloadResults(rows)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border border-base-600 text-ink-300 hover:text-ink-100 hover:border-ink-500 transition-colors"
              >
                <Download size={12} /> DOWNLOAD ANALYZED RESULTS
              </button>
            </div>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#2a3037" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: '#5c656d', fontSize: 10, fontFamily: 'Consolas' }} axisLine={{ stroke: '#2a3037' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#5c656d', fontSize: 10, fontFamily: 'Consolas' }} axisLine={{ stroke: '#2a3037' }} tickLine={false} width={36} />
                  <Tooltip
                    contentStyle={{ background: '#171b1f', border: '1px solid #2a3037', borderRadius: 4, fontFamily: 'Consolas', fontSize: 12 }}
                    labelFormatter={(t) => `t = ${t}`}
                    formatter={(v: number) => [`${v}%`, 'Engine Health']}
                  />
                  <Line type="monotone" dataKey="health" stroke="#4ea8de" strokeWidth={1.75} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
            <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">PER-ROW RESULTS (first 200 shown)</div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full font-mono text-[10px] text-ink-300">
                <thead className="sticky top-0 bg-base-800">
                  <tr className="text-ink-700 text-left border-b border-base-600">
                    <th className="py-1 pr-3">t</th>
                    <th className="py-1 pr-3">RPM</th>
                    <th className="py-1 pr-3">EGT</th>
                    <th className="py-1 pr-3">CHT</th>
                    <th className="py-1 pr-3">OIL PSI</th>
                    <th className="py-1 pr-3">HEALTH</th>
                    <th className="py-1 pr-3">RULE DIAGNOSIS</th>
                    <th className="py-1 pr-3">ML PREDICTION</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-b border-base-700/50">
                      <td className="py-1 pr-3">{r.t}</td>
                      <td className="py-1 pr-3">{r.telemetry.rpm.toFixed(0)}</td>
                      <td className="py-1 pr-3">{r.telemetry.egt.toFixed(0)}</td>
                      <td className="py-1 pr-3">{r.telemetry.cht.toFixed(0)}</td>
                      <td className="py-1 pr-3">{r.telemetry.oilPressure.toFixed(0)}</td>
                      <td className="py-1 pr-3" style={{ color: BAND_COLOR[r.healthBand] }}>{r.health}%</td>
                      <td className="py-1 pr-3">{r.ruleDiagnosis.activeDiagnosis ?? '—'}</td>
                      <td className="py-1 pr-3">{r.mlFaultType ? `${FAULT_LABELS[r.mlFaultType]} (${r.mlConfidence.toFixed(0)}%)` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, sub, small }: { label: string; value: string; color?: string; sub?: string; small?: boolean }) {
  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-3">
      <div className="font-mono text-[9px] tracking-widest text-ink-700">{label}</div>
      <div className={`font-mono ${small ? 'text-xs' : 'text-lg'} mt-1 truncate`} style={{ color: color ?? '#e8ecef' }} title={value}>
        {value}
      </div>
      {sub && <div className="font-mono text-[9px] text-ink-700 mt-0.5">{sub}</div>}
    </div>
  );
}
