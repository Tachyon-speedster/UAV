export function SettingsPage() {
  return (
    <div className="max-w-xl space-y-4">
      <div className="bg-base-800 border border-base-600 rounded shadow-panel p-5">
        <div className="font-mono text-[11px] tracking-widest text-ink-500 mb-3">SYSTEM</div>
        <dl className="space-y-2 font-mono text-xs">
          <Row k="Mode" v="SIMULATION / DEMONSTRATION" />
          <Row k="Engine ID" v="AP-01" />
          <Row k="Prototype version" v="0.1.0" />
          <Row k="Problem statement" v="SIH PS 26054 — DRDO" />
          <Row k="Twin model" v="Simplified physics-inspired equations (digitalTwinModel.ts)" />
          <Row k="Diagnostics" v="Rule / residual-based (faultDetection.ts) — not ML" />
        </dl>
      </div>
      <div className="bg-base-800 border border-base-600 rounded shadow-panel p-5 font-mono text-[11px] text-ink-500 leading-relaxed">
        This is a simulation-based academic/hackathon prototype and does not represent classified or operational
        DRDO engine software. No real UAV engine data is used or implied.
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-base-700 pb-2">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-ink-100 text-right">{v}</dd>
    </div>
  );
}
