// ---------------------------------------------------------------------------
// Core domain types for the Aero-Propulsion Digital Twin demonstrator.
// This file is the single source of truth for shapes shared between the
// simulation engine, the digital twin model, the diagnostics layer, and the
// UI. Keeping these in one place makes it straightforward to later swap the
// simulation for a real telemetry source (CAN/SocketCAN, logged flight data,
// etc.) without touching the UI layer.
// ---------------------------------------------------------------------------

/** Engine telemetry channels tracked by the demonstrator. */
export interface EngineTelemetry {
  rpm: number;
  cht: number; // Cylinder Head Temperature, degC
  egt: number; // Exhaust Gas Temperature, degC
  oilPressure: number; // psi
  oilTemperature: number; // degC
  fuelFlow: number; // kg/h
  vibration: number; // mm/s
  throttle: number; // %
  altitude: number; // ft
  engineLoad: number; // %
}

export type TelemetryKey = keyof EngineTelemetry;

/** The subset of telemetry the Digital Twin actually predicts / compares. */
export type TwinChannel = 'rpm' | 'egt' | 'cht' | 'oilPressure' | 'vibration';

export interface TwinComparison {
  measured: number;
  predicted: number;
  residual: number; // measured - predicted
}

export type TwinComparisonSet = Record<TwinChannel, TwinComparison>;

export type FaultType =
  | 'NONE'
  | 'OVERHEATING'
  | 'LUBRICATION_DEGRADATION'
  | 'INJECTOR_ABNORMALITY'
  | 'VIBRATION_ANOMALY'
  | 'SENSOR_DRIFT';

export interface ActiveFault {
  type: FaultType;
  severity: number; // 0-100
  /** Only meaningful for SENSOR_DRIFT — which channel's sensor is drifting. */
  driftChannel?: TwinChannel;
  /** Simulation-time seconds since the fault was injected (drives ramp-up). */
  elapsedSeconds: number;
}

export type HealthBand = 'HEALTHY' | 'MONITOR' | 'DEGRADED' | 'CRITICAL';

export interface SubsystemHealth {
  combustion: number;
  lubrication: number;
  thermal: number;
  mechanical: number;
  electrical: number;
  sensors: number;
}

export type EngineState = 'START' | 'IDLE' | 'CRUISE' | 'CLIMB' | 'HIGH_LOAD';

export type MissionType = 'HIGH_ALTITUDE_ISR' | 'ENDURANCE' | 'HOT_WEATHER' | 'CRUISE';

export interface EventLogEntry {
  id: string;
  timestamp: string; // HH:MM:SS (sim clock)
  message: string;
  level: 'info' | 'warn' | 'critical';
}

export interface DiagnosticEvidence {
  label: string;
}

export interface DiagnosticResult {
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  activeDiagnosis: string | null;
  confidence: number; // 0-100, "Diagnostic Confidence" (rule-based, not ML)
  evidence: DiagnosticEvidence[];
  recommendation: string | null;
}

/** Result of running the real trained XGBoost model (via ONNX Runtime Web,
 * fully client-side) against the current telemetry + digital twin residuals. */
export interface MlDiagnosticResult {
  status: 'loading' | 'ready' | 'error';
  faultType: FaultType | null;
  confidence: number; // 0-100, softmax probability of the predicted class
  probabilities: Partial<Record<FaultType, number>>;
  modelInfo: {
    trainedOn: string;
    testAccuracy: number;
  } | null;
  error?: string;
}

export interface MissionRunInputs {
  missionType: MissionType;
  altitude: number;
  ambientTemp: number;
  throttle: number;
  durationMinutes: number;
}

export interface MissionRunSample {
  t: number; // minutes elapsed
  health: number;
  cht: number;
  egt: number;
  fuelUsedKg: number;
}

export interface MissionRunResult {
  samples: MissionRunSample[];
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  finalHealth: number;
  totalFuelKg: number;
}

export type DemoScenarioId =
  | 'HEALTHY'
  | 'OVERHEATING'
  | 'LUBRICATION_DEGRADATION'
  | 'INJECTOR_ABNORMALITY'
  | 'VIBRATION_ANOMALY'
  | 'SENSOR_DRIFT'
  | 'HIGH_ALTITUDE';

/** Full snapshot of simulation state at one tick — what drives the whole UI. */
export interface SimulationSnapshot {
  simTimeSeconds: number;
  telemetry: EngineTelemetry;
  twin: TwinComparisonSet;
  twinSyncPercent: number;
  health: number;
  healthBand: HealthBand;
  subsystems: SubsystemHealth;
  fault: ActiveFault;
  engineState: EngineState;
  diagnostics: DiagnosticResult;
}

export interface TelemetryHistoryPoint {
  t: number; // seconds, rolling
  rpm: number;
  cht: number;
  egt: number;
  oilPressure: number;
  oilTemperature: number;
  vibration: number;
}
