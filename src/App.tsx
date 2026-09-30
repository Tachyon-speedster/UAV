import { useState } from 'react';
import { Sidebar, type PageId } from './components/Sidebar';
import { TopStatusBar } from './components/TopStatusBar';
import { SimulationProvider } from './state/SimulationContext';
import { Overview } from './pages/Overview';
import { DigitalTwin } from './pages/DigitalTwin';
import { Airframe } from './pages/Airframe';
import { Diagnostics } from './pages/Diagnostics';
import { Mission } from './pages/Mission';
import { ImportData } from './pages/ImportData';
import { SettingsPage } from './pages/SettingsPage';

function PageContent({ page }: { page: PageId }) {
  switch (page) {
    case 'OVERVIEW':
      return <Overview />;
    case 'DIGITAL_TWIN':
      return <DigitalTwin />;
    case 'AIRFRAME':
      return <Airframe />;
    case 'DIAGNOSTICS':
      return <Diagnostics />;
    case 'MISSION':
      return <Mission />;
    case 'IMPORT_DATA':
      return <ImportData />;
    case 'SETTINGS':
      return <SettingsPage />;
    default:
      return null;
  }
}

export default function App() {
  const [page, setPage] = useState<PageId>('OVERVIEW');

  return (
    <SimulationProvider>
      <div className="h-screen w-screen flex bg-base-900 text-ink-100 font-ui overflow-hidden">
        <Sidebar page={page} onNavigate={setPage} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopStatusBar />
          <main className="flex-1 overflow-y-auto p-5">
            <PageContent page={page} />
          </main>
        </div>
      </div>
    </SimulationProvider>
  );
}
