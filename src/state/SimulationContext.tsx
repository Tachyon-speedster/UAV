// ---------------------------------------------------------------------------
// SimulationContext.tsx
//
// Wraps the plain simulation core (simulation/engineSimulation.ts) in a React
// context so OVERVIEW, DIGITAL TWIN, DIAGNOSTICS, and MISSION pages all read
// from the same ticking simulation without prop drilling. This is the only
// place setInterval / component lifecycle touches the simulation.
// ---------------------------------------------------------------------------

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActiveFault,
  EventLogEntry,
  FaultType,
  MlDiagnosticResult,
  SimulationSnapshot,
  TelemetryHistoryPoint,
  TwinChannel,
} from '../types';
import { emptyFault, newFault, stepSimulation, type SimConfig } from '../simulation/engineSimulation';
import { diagnose } from '../diagnostics/faultDetection';
import { classifyFault, preloadModel } from '../ml/mlClassifier';
import { DEMO_SCENARIOS, type DemoScenario } from '../simulation/demoScenarios';

const TICK_MS = 1000;
const HISTORY_WINDOW_SECONDS = 60;
const MAX_LOG_ENTRIES = 60;

function formatSimClock(totalSeconds: number): string {
  const base = 12 * 3600 + 42 * 60; // demo clock starts at 12:42:00
  const s = base + totalSeconds;
  const hh = Math.floor(s / 3600) % 24;
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

let logIdCounter = 0;
function makeLogEntry(simTimeSeconds: number, message: string, level: EventLogEntry['level']): EventLogEntry {
  logIdCounter += 1;
  return { id: `log-${logIdCounter}`, timestamp: formatSimClock(simTimeSeconds), message, level };
}

interface SimulationContextValue {
  snapshot: SimulationSnapshot;
  history: TelemetryHistoryPoint[];
  log: EventLogEntry[];
  config: SimConfig;
  running: boolean;
  mlDiagnosis: MlDiagnosticResult;
  setThrottle: (v: number) => void;
  setAltitude: (v: number) => void;
  setAmbientTemp: (v: number) => void;
  injectFault: (type: FaultType, severity: number, driftChannel?: TwinChannel) => void;
  clearFault: () => void;
  toggleRunning: () => void;
  runDemoScenario: (scenario: DemoScenario) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

const INITIAL_CONFIG: SimConfig = { throttle: 62, altitude: 18000, ambientTemp: 8 };

const INITIAL_ML_DIAGNOSIS: MlDiagnosticResult = {
  status: 'loading',
  faultType: null,
  confidence: 0,
  probabilities: {},
  modelInfo: null,
};

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SimConfig>(INITIAL_CONFIG);
  const [fault, setFault] = useState<ActiveFault>(emptyFault());
  const [running, setRunning] = useState(true);
  const [simTimeSeconds, setSimTimeSeconds] = useState(0);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() => buildSnapshot(0, INITIAL_CONFIG, emptyFault()));
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>([]);
  const [mlDiagnosis, setMlDiagnosis] = useState<MlDiagnosticResult>(INITIAL_ML_DIAGNOSIS);
  const [log, setLog] = useState<EventLogEntry[]>([
    makeLogEntry(0, 'ENGINE STARTED', 'info'),
    makeLogEntry(1, 'DIGITAL TWIN SYNCHRONIZED', 'info'),
  ]);

  // Kick off loading the ONNX model + metadata as soon as the app mounts,
  // so the first live tick doesn't pay the (one-time) model download cost.
  useEffect(() => {
    preloadModel();
  }, []);

  // Guards against out-of-order async resolution: if tick N+1's inference
  // resolves before tick N's (unlikely at 1Hz, but not impossible under load),
  // this ensures the UI only ever shows the most recently REQUESTED result.
  const mlRequestSeq = useRef(0);

  const runMlInference = useCallback((next: SimulationSnapshot, cfg: SimConfig) => {
    const seq = ++mlRequestSeq.current;
    classifyFault({
      telemetry: next.telemetry,
      twin: next.twin,
      twinSyncPercent: next.twinSyncPercent,
      ambientTempC: cfg.ambientTemp,
    })
      .then((result) => {
        if (seq !== mlRequestSeq.current) return; // a newer request already superseded this one
        setMlDiagnosis({
          status: 'ready',
          faultType: result.faultType,
          confidence: result.confidence,
          probabilities: result.probabilities,
          modelInfo: result.modelInfo,
        });
      })
      .catch((err) => {
        if (seq !== mlRequestSeq.current) return;
        setMlDiagnosis((prev) => ({ ...prev, status: 'error', error: String(err) }));
      });
  }, []);

  const prevBandRef = useRef(snapshot.healthBand);
  const prevDiagnosisRef = useRef<string | null>(null);
  const prevFaultTypeRef = useRef<FaultType>('NONE');

  const pushLog = useCallback((entries: EventLogEntry[]) => {
    if (entries.length === 0) return;
    setLog((prev) => [...prev, ...entries].slice(-MAX_LOG_ENTRIES));
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSimTimeSeconds((prevT) => {
        const nextT = prevT + 1;

        setFault((prevFault) => {
          const advanced =
            prevFault.type === 'NONE' ? prevFault : { ...prevFault, elapsedSeconds: prevFault.elapsedSeconds + 1 };

          const next = buildSnapshot(nextT, configRef.current, advanced);
          setSnapshot(next);
          runMlInference(next, configRef.current);

          setHistory((prevHistory) => {
            const point: TelemetryHistoryPoint = {
              t: nextT,
              rpm: Math.round(next.telemetry.rpm),
              cht: Math.round(next.telemetry.cht * 10) / 10,
              egt: Math.round(next.telemetry.egt * 10) / 10,
              oilPressure: Math.round(next.telemetry.oilPressure * 10) / 10,
              oilTemperature: Math.round(next.telemetry.oilTemperature * 10) / 10,
              vibration: Math.round(next.telemetry.vibration * 100) / 100,
            };
            const merged = [...prevHistory, point];
            return merged.length > HISTORY_WINDOW_SECONDS ? merged.slice(-HISTORY_WINDOW_SECONDS) : merged;
          });

          // Event log: react to band changes, diagnosis changes, fault clears.
          const entries: EventLogEntry[] = [];
          if (prevFaultTypeRef.current === 'NONE' && advanced.type !== 'NONE') {
            entries.push(makeLogEntry(nextT, `FAULT INJECTED → ${advanced.type.replace(/_/g, ' ')}`, 'warn'));
          }
          if (prevFaultTypeRef.current !== 'NONE' && advanced.type === 'NONE') {
            entries.push(makeLogEntry(nextT, 'FAULT CLEARED — ENGINE NORMALIZING', 'info'));
          }
          if (next.diagnostics.activeDiagnosis && next.diagnostics.activeDiagnosis !== prevDiagnosisRef.current) {
            entries.push(makeLogEntry(nextT, 'ANOMALY DETECTED', 'warn'));
            entries.push(makeLogEntry(nextT, `${next.diagnostics.activeDiagnosis}`, 'warn'));
          }
          if (!next.diagnostics.activeDiagnosis && prevDiagnosisRef.current) {
            entries.push(makeLogEntry(nextT, 'DIAGNOSTIC CLEARED — READINGS NOMINAL', 'info'));
          }
          if (next.healthBand !== prevBandRef.current) {
            const level = next.healthBand === 'HEALTHY' ? 'info' : next.healthBand === 'MONITOR' ? 'warn' : 'critical';
            entries.push(makeLogEntry(nextT, `ENGINE HEALTH → ${next.health}% (${next.healthBand})`, level));
          }
          pushLog(entries);

          prevBandRef.current = next.healthBand;
          prevDiagnosisRef.current = next.diagnostics.activeDiagnosis;
          prevFaultTypeRef.current = advanced.type;

          return advanced;
        });

        return nextT;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Keep a ref of the latest config so the interval closure always reads
  // the current throttle/altitude/ambientTemp without resetting the timer.
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const setThrottle = useCallback((v: number) => setConfig((c) => ({ ...c, throttle: v })), []);
  const setAltitude = useCallback((v: number) => setConfig((c) => ({ ...c, altitude: v })), []);
  const setAmbientTemp = useCallback((v: number) => setConfig((c) => ({ ...c, ambientTemp: v })), []);

  const injectFault = useCallback(
    (type: FaultType, severity: number, driftChannel?: TwinChannel) => {
      setFault(newFault(type, severity, driftChannel));
    },
    [],
  );

  const clearFault = useCallback(() => setFault(emptyFault()), []);
  const toggleRunning = useCallback(() => setRunning((r) => !r), []);

  const runDemoScenario = useCallback((scenario: DemoScenario) => {
    setConfig((c) => ({
      throttle: scenario.throttle ?? c.throttle,
      altitude: scenario.altitude ?? c.altitude,
      ambientTemp: c.ambientTemp,
    }));
    setFault(
      scenario.fault === 'NONE' ? emptyFault() : newFault(scenario.fault, scenario.severity, scenario.driftChannel),
    );
  }, []);

  const value = useMemo<SimulationContextValue>(
    () => ({
      snapshot,
      history,
      log,
      config,
      running,
      mlDiagnosis,
      setThrottle,
      setAltitude,
      setAmbientTemp,
      injectFault,
      clearFault,
      toggleRunning,
      runDemoScenario,
    }),
    [snapshot, history, log, config, running, mlDiagnosis, setThrottle, setAltitude, setAmbientTemp, injectFault, clearFault, toggleRunning, runDemoScenario],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

function buildSnapshot(simTimeSeconds: number, cfg: SimConfig, fault: ActiveFault): SimulationSnapshot {
  const state = stepSimulation(simTimeSeconds, cfg, fault);
  const diagnostics = diagnose(state.twin);
  return { ...state, diagnostics };
}

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used within SimulationProvider');
  return ctx;
}

export { DEMO_SCENARIOS };
