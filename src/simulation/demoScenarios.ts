import type { DemoScenarioId, FaultType, TwinChannel } from '../types';

export interface DemoScenario {
  id: DemoScenarioId;
  label: string;
  description: string;
  fault: FaultType;
  severity: number;
  driftChannel?: TwinChannel;
  altitude?: number;
  throttle?: number;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'HEALTHY',
    label: '1. Healthy Engine',
    description: 'Baseline cruise, no faults injected.',
    fault: 'NONE',
    severity: 0,
  },
  {
    id: 'OVERHEATING',
    label: '2. Overheating',
    description: 'CHT/EGT climb progressively above the twin baseline.',
    fault: 'OVERHEATING',
    severity: 70,
  },
  {
    id: 'LUBRICATION_DEGRADATION',
    label: '3. Lubrication Degradation',
    description: 'Oil pressure falls, oil temperature rises.',
    fault: 'LUBRICATION_DEGRADATION',
    severity: 65,
  },
  {
    id: 'INJECTOR_ABNORMALITY',
    label: '4. Injector Abnormality',
    description: 'Fuel metering error causes EGT/RPM instability.',
    fault: 'INJECTOR_ABNORMALITY',
    severity: 60,
  },
  {
    id: 'VIBRATION_ANOMALY',
    label: '5. Vibration Anomaly',
    description: 'Mechanical vibration rises above the healthy band.',
    fault: 'VIBRATION_ANOMALY',
    severity: 60,
  },
  {
    id: 'SENSOR_DRIFT',
    label: '6. Sensor Drift',
    description: 'EGT sensor reading drifts while the true engine stays normal.',
    fault: 'SENSOR_DRIFT',
    severity: 75,
    driftChannel: 'egt',
  },
  {
    id: 'HIGH_ALTITUDE',
    label: '7. High-Altitude Operation',
    description: 'High-altitude ISR profile — thinner air, cooler ambient.',
    fault: 'NONE',
    severity: 0,
    altitude: 22000,
    throttle: 78,
  },
];
