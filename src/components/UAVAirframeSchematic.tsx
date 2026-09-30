import type { SubsystemHealth } from '../types';

// ---------------------------------------------------------------------------
// UAVAirframeSchematic.tsx
//
// Full-airframe counterpart to EngineSchematic.tsx. Instead of highlighting a
// zone on the piston engine block, this maps the same six SubsystemHealth
// channels onto a stylised top-down MALE (Medium-Altitude Long-Endurance)
// UAV planform — nose sensor turret, forward avionics bay, wings, mid-body
// fluid bay, aft pusher-engine nacelle, and tail boom / V-tail. Colour
// thresholds intentionally match SubsystemHealthBars.tsx so a zone here and
// its bar on the right always agree.
// ---------------------------------------------------------------------------

const NORMAL_STROKE = '#3a424b';
const NORMAL_FILL = '#1f242a';
const HUD_BLUE = '#4ea8de';

function zoneColor(v: number): string {
  if (v >= 90) return '#4ade80';
  if (v >= 40) return '#f5a524';
  return '#f0475a';
}

function fillFor(color: string) {
  // same colour as the stroke, low opacity — a translucent "damage overlay"
  // rather than a solid block, so the airframe line art stays readable.
  return `${color}2e`;
}

interface Zone {
  value: number;
  color: string;
  critical: boolean;
}

function zoneFor(subsystems: SubsystemHealth, key: keyof SubsystemHealth): Zone {
  const value = subsystems[key];
  const color = zoneColor(value);
  return { value, color, critical: color === '#f0475a' };
}

export function UAVAirframeSchematic({ subsystems }: { subsystems: SubsystemHealth }) {
  const sensors = zoneFor(subsystems, 'sensors');
  const electrical = zoneFor(subsystems, 'electrical');
  const mechanical = zoneFor(subsystems, 'mechanical');
  const lubrication = zoneFor(subsystems, 'lubrication');
  const combustion = zoneFor(subsystems, 'combustion');
  const thermal = zoneFor(subsystems, 'thermal');

  const callout = (
    key: string,
    z: Zone,
    label: string,
    ax: number,
    ay: number,
    lx: number,
    ly: number,
    anchor: 'start' | 'middle' | 'end',
  ) => (
    <g key={key}>
      <line x1={ax} y1={ay} x2={lx} y2={ly} stroke={z.color} strokeWidth={1} opacity={0.65} />
      <circle cx={ax} cy={ay} r={2.5} fill={z.color} />
      {z.critical && <circle cx={ax} cy={ay} r={5} fill="none" stroke={z.color} strokeWidth={1} className="pulse-dot" />}
      <text
        x={lx}
        y={ly - 4}
        textAnchor={anchor}
        fontFamily="Consolas"
        fontSize="10"
        letterSpacing="0.5"
        fill={z.color}
      >
        {label} {Math.round(z.value)}%
      </text>
    </g>
  );

  const corner = (x: number, y: number, dx: number, dy: number) => (
    <path
      d={`M ${x} ${y + dy} L ${x} ${y} L ${x + dx} ${y}`}
      fill="none"
      stroke={HUD_BLUE}
      strokeWidth={1.5}
      opacity={0.45}
    />
  );

  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
      <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">
        MALE UAV AIRFRAME — LIVE HEALTH OVERLAY
      </div>

      <svg viewBox="0 0 700 340" className="w-full h-auto">
        {/* HUD corner brackets */}
        {corner(14, 14, 22, 22)}
        {corner(686, 14, -22, 22)}
        {corner(14, 326, 22, -22)}
        {corner(686, 326, -22, -22)}

        {/* Instrument bezel ticks, top & bottom — decorative only */}
        {Array.from({ length: 12 }).map((_, i) => (
          <g key={`tick-${i}`}>
            <line x1={40 + i * 55} y1={6} x2={40 + i * 55} y2={12} stroke={NORMAL_STROKE} strokeWidth={1} />
            <line x1={40 + i * 55} y1={334} x2={40 + i * 55} y2={328} stroke={NORMAL_STROKE} strokeWidth={1} />
          </g>
        ))}

        {/* Fuselage outline */}
        <path
          d="M 40 170 C 55 155, 90 148, 140 148 L 460 148 C 515 148, 565 156, 618 170
             C 565 184, 515 192, 460 192 L 140 192 C 90 192, 55 185, 40 170 Z"
          fill={NORMAL_FILL}
          stroke={NORMAL_STROKE}
          strokeWidth={1.5}
        />

        {/* Wings (mechanical) */}
        <polygon
          points="260,150 295,32 325,32 330,150"
          fill={fillFor(mechanical.color)}
          stroke={mechanical.color}
          strokeWidth={mechanical.critical ? 2 : 1}
        />
        <polygon
          points="260,190 295,308 325,308 330,190"
          fill={fillFor(mechanical.color)}
          stroke={mechanical.color}
          strokeWidth={mechanical.critical ? 2 : 1}
        />

        {/* Forward fuselage — avionics bay (electrical) */}
        <rect
          x={150}
          y={150}
          width={100}
          height={40}
          rx={4}
          fill={fillFor(electrical.color)}
          stroke={electrical.color}
          strokeWidth={electrical.critical ? 2 : 1}
        />

        {/* Mid fuselage — fluid bay (lubrication) */}
        <rect
          x={350}
          y={150}
          width={100}
          height={40}
          rx={4}
          fill={fillFor(lubrication.color)}
          stroke={lubrication.color}
          strokeWidth={lubrication.critical ? 2 : 1}
        />

        {/* Aft nacelle — pusher engine (combustion) */}
        <rect
          x={465}
          y={149}
          width={95}
          height={42}
          rx={6}
          fill={fillFor(combustion.color)}
          stroke={combustion.color}
          strokeWidth={combustion.critical ? 2 : 1}
        />

        {/* Tail boom / V-tail (thermal) */}
        <polygon
          points="560,150 612,118 602,152"
          fill={fillFor(thermal.color)}
          stroke={thermal.color}
          strokeWidth={thermal.critical ? 2 : 1}
        />
        <polygon
          points="560,190 612,222 602,188"
          fill={fillFor(thermal.color)}
          stroke={thermal.color}
          strokeWidth={thermal.critical ? 2 : 1}
        />

        {/* Pusher propeller */}
        <circle cx={624} cy={170} r={9} fill={NORMAL_FILL} stroke={HUD_BLUE} strokeWidth={1.5} />
        <line x1={615} y1={170} x2={633} y2={170} stroke={HUD_BLUE} strokeWidth={1.5} />
        <line x1={624} y1={161} x2={624} y2={179} stroke={HUD_BLUE} strokeWidth={1.5} />

        {/* Nose sensor turret (sensors) — hangs slightly below the nose, EO/IR ball style */}
        <circle
          cx={54}
          cy={177}
          r={10}
          fill={fillFor(sensors.color)}
          stroke={sensors.color}
          strokeWidth={sensors.critical ? 2 : 1}
        />

        {/* Leader-line callouts */}
        {callout('sensors', sensors, 'SENSORS', 54, 167, 54, 40, 'middle')}
        {callout('electrical', electrical, 'ELECTRICAL', 200, 150, 200, 22, 'middle')}
        {callout('thermal', thermal, 'THERMAL', 590, 148, 590, 40, 'middle')}
        {callout('lubrication', lubrication, 'LUBRICATION', 400, 192, 400, 300, 'middle')}
        {callout('combustion', combustion, 'COMBUSTION', 515, 191, 515, 300, 'middle')}

        {/* Mechanical label sits directly at the wing tip, no leader needed */}
        <text
          x={308}
          y={24}
          textAnchor="middle"
          fontFamily="Consolas"
          fontSize="10"
          letterSpacing="0.5"
          fill={mechanical.color}
        >
          MECHANICAL {Math.round(mechanical.value)}%
        </text>
        {mechanical.critical && (
          <circle cx={308} cy={32} r={4} fill="none" stroke={mechanical.color} strokeWidth={1} className="pulse-dot" />
        )}
      </svg>

      <div className="flex items-center gap-4 mt-1 font-mono text-[10px] text-ink-500">
        <LegendSwatch color="#4ade80" label="HEALTHY" />
        <LegendSwatch color="#f5a524" label="MONITOR / DEGRADED" />
        <LegendSwatch color="#f0475a" label="CRITICAL" />
      </div>

      <p className="mt-2 font-mono text-[10px] text-ink-700 leading-relaxed">
        Stylised twin-boom / V-tail MALE UAV planform used to visualise the same subsystem health signals as the
        Digital Twin page — not a scale or classified airframe drawing.
      </p>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="tracking-wide">{label}</span>
    </div>
  );
}
