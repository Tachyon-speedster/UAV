import { useEffect, useRef } from 'react';
import type { EventLogEntry } from '../types';

const LEVEL_COLOR: Record<EventLogEntry['level'], string> = {
  info: '#c3ccd3',
  warn: '#f5a524',
  critical: '#f0475a',
};

export function EventLog({ entries }: { entries: EventLogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  return (
    <div className="bg-base-800 border border-base-600 rounded shadow-panel p-4 flex flex-col h-full min-h-0">
      <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-2">EVENT LOG</div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1">
        {entries.map((e) => (
          <div key={e.id} className="font-mono text-[11px] leading-relaxed flex gap-2">
            <span className="text-ink-700 shrink-0">{e.timestamp}</span>
            <span style={{ color: LEVEL_COLOR[e.level] }}>{e.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
