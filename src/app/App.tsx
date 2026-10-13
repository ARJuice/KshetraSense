import { useState } from 'react';
import { Activity, BarChart3, ChevronLeft, CircleHelp, LayoutGrid, Menu, Sprout } from 'lucide-react';
import { ZoningWorkspace } from '../features/zoning/ZoningWorkspace';
import { FieldMonitoringView } from '../features/monitoring/FieldMonitoringView';

type AppModule = 'zoning' | 'monitoring' | 'methods';

const modules: Array<{ id: AppModule; label: string; detail: string; icon: typeof LayoutGrid }> = [
  { id: 'zoning', label: 'Soil zoning', detail: 'Zones & crop fit', icon: LayoutGrid },
  { id: 'monitoring', label: 'Field monitoring', detail: 'Samples & vegetation', icon: Activity },
  { id: 'methods', label: 'Methods', detail: 'Evidence & limits', icon: BarChart3 },
];

export default function App() {
  const [activeModule, setActiveModule] = useState<AppModule>('zoning');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const active = modules.find((module) => module.id === activeModule)!;

  return <div className={`app-shell ${sidebarOpen ? '' : 'app-shell--collapsed'}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand__mark"><Sprout size={19} /></div>{sidebarOpen && <div><strong>KshetraSense</strong><span>Field operations</span></div>}</div>
      <nav className="sidebar__nav" aria-label="Primary navigation">
        <p className="sidebar__label">Workspace</p>
        {modules.map((module) => { const Icon = module.icon; return <button key={module.id} className={`nav-item ${activeModule === module.id ? 'nav-item--active' : ''}`} onClick={() => setActiveModule(module.id)} title={!sidebarOpen ? module.label : undefined}><Icon size={18} />{sidebarOpen && <span><strong>{module.label}</strong><small>{module.detail}</small></span>}</button>; })}
      </nav>
      <div className="sidebar__bottom"><button className="nav-item nav-item--muted"><CircleHelp size={18} />{sidebarOpen && <span>Local-first workspace</span>}</button><button className="collapse-button" onClick={() => setSidebarOpen((current) => !current)} aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>{sidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}</button></div>
    </aside>
    <main className="main-content">
      <div className="topbar"><div><span className="topbar__section">{active.label}</span><span className="topbar__divider">/</span><span className="topbar__state">Local workspace</span></div><span className="topbar__live"><i className="is-neutral" /> No live sensor connection</span></div>
      {activeModule === 'zoning' && <ZoningWorkspace />}
      {activeModule === 'monitoring' && <FieldMonitoringView />}
      {activeModule === 'methods' && <MethodsView />}
    </main>
  </div>;
}

function MethodsView() {
  return <section className="workspace methods-view"><header className="workspace__header"><div><p className="eyebrow">Traceability</p><h1>Methods & limits</h1><p className="workspace__lede">See how measured inputs become a field map, which calculations are separate, and what each result cannot claim.</p></div></header><div className="methods-grid"><article className="panel"><h2>Soil zoning</h2><p>Starts with a WGS84 field polygon and 3–50 georeferenced lab samples. IDW p=2 estimates pH, EC, N, P and K at clipped grid cells; standardized profiles feed Auto-K K-means++ or Fuzzy C-means, followed by adjacent-profile merging and connected-zone splitting.</p><ul><li>K is selected by silhouette; FCM memberships are not probabilities</li><li>KshetraSense SHI is calculated separately and does not affect clustering</li><li>Cell values are estimates, not measurements at every grid location</li></ul></article><article className="panel"><h2>Crop fit</h2><p>After selecting a field cell or zone, the app submits that exact cell profile or zone mean to the independent crop-fit service. Apple, tomato and potato are assessed separately—not ranked or normalized into a 100% split.</p><ul><li>Only pH currently has a source-backed contextual range</li><li>N, P, K and EC remain visible but unassessed</li><li>It is not a yield forecast, prescription or success probability</li></ul></article><article className="panel"><h2>Field monitoring</h2><p>Monitoring remains an independent module. Regional SoilGrids values are contextual covariates, while CropSight/Sentinel-2 vegetation analysis retains its own area-of-interest and date inputs.</p><ul><li>External context is not silently blended into soil zoning</li><li>Provider availability and setup are surfaced separately</li><li>This workspace has no live sensor or actuator connection</li></ul></article></div></section>;
}
