import { Activity, GitCompareArrows, Stethoscope, Radar, Plane, UploadCloud, Settings } from 'lucide-react';

export type PageId = 'OVERVIEW' | 'DIGITAL_TWIN' | 'AIRFRAME' | 'DIAGNOSTICS' | 'MISSION' | 'IMPORT_DATA' | 'SETTINGS';

const NAV_ITEMS: { id: PageId; label: string; icon: typeof Activity }[] = [
  { id: 'OVERVIEW', label: 'Overview', icon: Activity },
  { id: 'DIGITAL_TWIN', label: 'Digital Twin', icon: GitCompareArrows },
  { id: 'AIRFRAME', label: 'Airframe', icon: Plane },
  { id: 'DIAGNOSTICS', label: 'Diagnostics', icon: Stethoscope },
  { id: 'MISSION', label: 'Mission', icon: Radar },
  { id: 'IMPORT_DATA', label: 'Import Data', icon: UploadCloud },
];

export function Sidebar({ page, onNavigate }: { page: PageId; onNavigate: (p: PageId) => void }) {
  return (
    <aside className="w-56 shrink-0 bg-base-900 border-r border-base-600 flex flex-col">
      <div className="px-4 py-4 border-b border-base-600">
        <div className="font-mono text-[11px] tracking-widest text-ink-500">SYSTEM</div>
        <div className="font-ui font-semibold text-ink-100 text-sm mt-0.5">AP-01 TWIN</div>
      </div>

      <nav className="flex-1 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-ui transition-colors border-l-2 ${
                active
                  ? 'bg-base-800 border-status-info text-ink-100'
                  : 'border-transparent text-ink-500 hover:text-ink-300 hover:bg-base-800/60'
              }`}
            >
              <Icon size={16} strokeWidth={2} />
              <span className="tracking-wide">{item.label.toUpperCase()}</span>
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => onNavigate('SETTINGS')}
        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-ui border-l-2 border-t border-base-600 ${
          page === 'SETTINGS' ? 'bg-base-800 border-l-status-info text-ink-100' : 'border-l-transparent text-ink-500 hover:text-ink-300'
        }`}
      >
        <Settings size={16} />
        <span className="tracking-wide">SYSTEM</span>
      </button>
    </aside>
  );
}
