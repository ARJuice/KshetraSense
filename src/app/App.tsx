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
      <div className="topbar"><div><span className="topbar__section">{active.label}</span><span className="topbar__divider">/</span><span className="topbar__state">Local workspace</span></div><span className="topbar__live"><i /> Session active</span></div>
      {activeModule === 'zoning' && <ZoningWorkspace />}
      {activeModule === 'monitoring' && <FieldMonitoringView />}
      {activeModule === 'methods' && <MethodsView />}
    </main>
  </div>;
}

function MethodsView() {
  return <section className="workspace methods-view"><header className="workspace__header"><div><p className="eyebrow">Traceability</p><h1>Methods & limits</h1><p className="workspace__lede">Use this workspace to understand what was computed, what data was used, and what the result cannot claim.</p></div></header><div className="methods-grid"><article className="panel"><h2>Soil zoning</h2><p>Runs K-means or Fuzzy C-means over the entered soil observations. Zone colors describe statistical groups, not management prescriptions.</p><ul><li>Inputs: pH, N, P, K, EC, soil temperature</li><li>Seeded run for reproducibility</li><li>Selection and crop fit are zone-specific</li></ul></article><article className="panel"><h2>Crop fit</h2><p>Will report transparent factor checks for the selected zone’s average measurements. It does not rank crops as a 100% split or predict yield.</p><ul><li>Observed mean shown alongside each rule</li><li>Missing factors stay missing</li><li>Sources and profile version travel with the result</li></ul></article><article className="panel"><h2>Field monitoring</h2><p>Stores measured soil sample provenance and exposes optional external context without blending it into the zoning calculation.</p><ul><li>SoilGrids is regional modeled context</li><li>CropSight retains its own circular AOI and date range</li><li>External-service failure is shown explicitly</li></ul></article></div></section>;
}
