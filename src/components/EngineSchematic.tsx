import type { FaultType } from '../types';

type SubsystemId = 'INTAKE' | 'CYLINDERS' | 'COMBUSTION' | 'EXHAUST' | 'LUBRICATION' | 'CRANKSHAFT';

const FAULT_TO_SUBSYSTEM: Partial<Record<FaultType, SubsystemId[]>> = {
  OVERHEATING: ['CYLINDERS', 'COMBUSTION'],
  LUBRICATION_DEGRADATION: ['LUBRICATION', 'CRANKSHAFT'],
  INJECTOR_ABNORMALITY: ['COMBUSTION', 'INTAKE'],
  VIBRATION_ANOMALY: ['CRANKSHAFT'],
  SENSOR_DRIFT: [],
};

const NORMAL_STROKE = '#3a424b';
const NORMAL_FILL = '#1f242a';
const WARN_STROKE = '#f5a524';
const WARN_FILL = '#4a3312';

export function EngineSchematic({ fault }: { fault: FaultType }) {
  const highlighted = new Set(FAULT_TO_SUBSYSTEM[fault] ?? []);

  const block = (id: SubsystemId, x: number, y: number, w: number, h: number, label: string) => {
    const active = highlighted.has(id);
    return (
      <g key={id}>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={4}
          fill={active ? WARN_FILL : NORMAL_FILL}
          stroke={active ? WARN_STROKE : NORMAL_STROKE}
          strokeWidth={active ? 2 : 1}
          style={{ transition: 'all 0.4s ease' }}
        />
        <text
          x={x + w / 2}
          y={y + h / 2 + 4}
          textAnchor="middle"
          fontFamily="Consolas"
          fontSize="10"
          fill={active ? '#f5a524' : '#8a949d'}
          letterSpacing="0.5"
        >
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
      <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">ENGINE SCHEMATIC — SIMULATED</div>
      <svg viewBox="0 0 560 220" className="w-full h-auto">
        {/* Intake */}
        {block('INTAKE', 20, 90, 90, 40, 'INTAKE')}
        <line x1={110} y1={110} x2={150} y2={110} stroke={NORMAL_STROKE} strokeWidth={2} />

        {/* Cylinders (four, representing the piston bank) */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            {block('CYLINDERS', 150 + i * 55, 40, 44, 60, `CYL ${i + 1}`)}
          </g>
        ))}

        {/* Combustion label under cylinders */}
        {block('COMBUSTION', 150, 110, 220, 30, 'COMBUSTION')}

        <line x1={370} y1={110} x2={410} y2={110} stroke={NORMAL_STROKE} strokeWidth={2} />
        {/* Exhaust */}
        {block('EXHAUST', 410, 90, 90, 40, 'EXHAUST')}

        {/* Crankshaft, spans below cylinders */}
        {block('CRANKSHAFT', 150, 160, 220, 30, 'CRANKSHAFT')}

        {/* Lubrication loop */}
        {block('LUBRICATION', 20, 160, 100, 30, 'LUBRICATION')}
        <path
          d="M 70 160 L 70 145 L 260 145 L 260 160"
          fill="none"
          stroke={highlighted.has('LUBRICATION') ? WARN_STROKE : NORMAL_STROKE}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      </svg>
      <p className="mt-2 font-mono text-[10px] text-ink-700 leading-relaxed">
        Simplified 2D layout — highlighted subsystem reflects the active fault, not real DRDO engine drawings.
      </p>
    </div>
  );
}
