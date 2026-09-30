import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { MISSION_REPLAYS } from '../simulation/missionReplays';

export function MissionReplayPanel() {
  const [missionId, setMissionId] = useState(MISSION_REPLAYS[0].id);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const mission = MISSION_REPLAYS.find((m) => m.id === missionId)!;
  const frame = mission.frames[Math.min(frameIndex, mission.frames.length - 1)];

  useEffect(() => {
    setFrameIndex(0);
    setPlaying(false);
  }, [missionId]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setFrameIndex((i) => {
          if (i >= mission.frames.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 250);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mission.id]);

  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4">
      <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">MISSION REPLAY</div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {MISSION_REPLAYS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMissionId(m.id)}
            className={`px-2.5 py-1.5 rounded text-[10px] font-mono border tracking-wide ${
              missionId === m.id ? 'border-ink-500 text-ink-100 bg-base-700' : 'border-base-600 text-ink-500 hover:text-ink-300'
            }`}
          >
            {m.title}
          </button>
        ))}
      </div>
      <p className="font-mono text-[11px] text-ink-500 mb-3">{mission.description}</p>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <ReplayStat label="T" value={`${frame.simTimeSeconds}s`} />
        <ReplayStat label="HEALTH" value={`${frame.health}%`} tone={frame.healthBand} />
        <ReplayStat label="CHT" value={`${frame.telemetry.cht.toFixed(0)}°C`} />
        <ReplayStat label="EGT" value={`${frame.telemetry.egt.toFixed(0)}°C`} />
      </div>

      <input
        type="range"
        min={0}
        max={mission.frames.length - 1}
        value={frameIndex}
        onChange={(e) => setFrameIndex(Number(e.target.value))}
        className="w-full accent-status-info mb-3"
      />

      <div className="flex gap-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-base-600 text-ink-300 font-mono text-[11px] tracking-widest hover:border-ink-500"
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
          {playing ? 'PAUSE' : 'PLAY'}
        </button>
        <button
          onClick={() => {
            setFrameIndex(0);
            setPlaying(false);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-base-600 text-ink-300 font-mono text-[11px] tracking-widest hover:border-ink-500"
        >
          <RotateCcw size={13} /> RESET
        </button>
      </div>
    </div>
  );
}

function ReplayStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const color = tone === 'CRITICAL' ? '#f0475a' : tone === 'DEGRADED' || tone === 'MONITOR' ? '#f5a524' : '#eef1f3';
  return (
    <div className="bg-base-700/50 rounded px-2 py-1.5 text-center">
      <div className="font-mono text-[9px] text-ink-700 tracking-widest">{label}</div>
      <div className="font-mono text-xs tabular" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
