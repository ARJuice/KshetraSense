import { useState } from 'react';
import { Activity, BarChart3, ChevronLeft, Database, Layers, LayoutGrid, Leaf, Menu, Sprout } from 'lucide-react';
import { ZoningWorkspace } from '../features/zoning/ZoningWorkspace';
import { FieldMonitoringView } from '../features/monitoring/FieldMonitoringView';
import { LeafDiagnosisView } from '../features/leaf/LeafDiagnosisView';

type AppModule = 'zoning' | 'leaf' | 'monitoring' | 'methods';

const modules: Array<{ id: AppModule; label: string; detail: string; icon: typeof LayoutGrid }> = [
  { id: 'zoning', label: 'Soil Zoning', detail: 'Variable management units', icon: Layers },
  { id: 'leaf', label: 'Leaf Diagnosis', detail: 'Image-only classifier', icon: Leaf },
  { id: 'monitoring', label: 'Field Monitoring', detail: 'Observations & satellite', icon: Activity },
  { id: 'methods', label: 'Methodology & Limits', detail: 'Traceability & constraints', icon: BarChart3 },
];

export default function App() {
  const [activeModule, setActiveModule] = useState<AppModule>('zoning');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const active = modules.find((module) => module.id === activeModule)!;

  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'app-shell--collapsed'}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">
            <Sprout size={18} />
          </div>
          {sidebarOpen && (
            <div>
              <strong>KshetraSense</strong>
              <span>Precision Ag ERP</span>
            </div>
          )}
        </div>

        <nav className="sidebar__nav" aria-label="Primary navigation">
          <p className="sidebar__label">Workspace</p>
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = activeModule === module.id;
            return (
              <button
                key={module.id}
                className={`nav-item ${isActive ? 'nav-item--active' : ''}`}
                onClick={() => setActiveModule(module.id)}
                title={!sidebarOpen ? module.label : undefined}
              >
                <Icon size={18} />
                {sidebarOpen && (
                  <span>
                    <strong>{module.label}</strong>
                    <small>{module.detail}</small>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar__bottom">
          <div className="sidebar__meta">
            <Database size={14} className="text-slate-400" />
            {sidebarOpen && <span>Engine: 127.0.0.1:8000</span>}
          </div>
          <button
            className="collapse-button"
            onClick={() => setSidebarOpen((current) => !current)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <div className="topbar__breadcrumbs">
            <span className="topbar__app">KshetraSense</span>
            <span className="topbar__divider">/</span>
            <span className="topbar__section">{active.label}</span>
          </div>
          <div className="topbar__env">
            <span className="topbar__tag">Local Workspace</span>
          </div>
        </div>

        {activeModule === 'zoning' && <ZoningWorkspace />}
        {activeModule === 'leaf' && <LeafDiagnosisView />}
        {activeModule === 'monitoring' && <FieldMonitoringView />}
        {activeModule === 'methods' && <MethodsView />}
      </main>
    </div>
  );
}

function MethodsView() {
  return (
    <section className="workspace methods-view">
      <header className="workspace__header">
        <div>
          <p className="eyebrow">Methodology &amp; Constraints</p>
          <h1>Scientific Methods &amp; Mathematical Limits</h1>
          <p className="workspace__lede">
            Traceability architecture: how discrete measured laboratory inputs are projected to continuous field management zones, and explicit boundary limitations of each analytical model.
          </p>
        </div>
      </header>

      <div className="methods-grid">
        <article className="panel">
          <h2>Soil Zoning &amp; Spatial Clustering</h2>
          <p>
            Starts with a WGS84 field polygon and 3–50 georeferenced laboratory observations. Inverse Distance Weighting (IDW with power p=2) estimates pH, EC, N, P, and K across clipped grid cells. Standardized feature profiles feed unsupervised clustering: Auto-K K-means++ or Fuzzy C-means (FCM), followed by adjacent-profile boundary merging and connected-component zone assignment.
          </p>
          <ul>
            <li>Optimal cluster count K is selected automatically by silhouette score across valid candidates (K=2 to 6).</li>
            <li>The KshetraSense Soil Health Index (SHI) is computed independently and does not dictate clustering geometry.</li>
            <li>Cell values represent mathematical spatial interpolations, not in-situ physical measurements at every point.</li>
          </ul>
        </article>

        <article className="panel">
          <h2>Crop Fit Reference Report</h2>
          <p>
            When inspecting an individual cell or an entire management zone, the application extracts the exact cell vector or the area-weighted IDW mean profile. Published agronomic reference intervals (e.g., FAO, UC Davis, university extension literature) are evaluated factor-by-factor.
          </p>
          <ul>
            <li>Observed pH, EC, N, P, and K values remain transparently visible alongside citations.</li>
            <li>Only pH has standard numerical cited intervals. EC requires matching root-zone saturated extract (ECe) context; N/P/K require regional testing methodology calibration.</li>
            <li>Moisture and soil temperature are not inputs to this field-zoning workflow. The software provides contextual reference benchmarks; it does not prescribe planting or guarantee yields.</li>
          </ul>
        </article>

        <article className="panel">
          <h2>Independent Field Monitoring</h2>
          <p>
            Field monitoring remains an decoupled analytical module. Coarse regional SoilGrids data provide background covariates, while CropSight / Sentinel-2 multispectral vegetation indexing operates via its own dedicated temporal and spatial parameters.
          </p>
          <ul>
            <li>External satellite context is never silently blended into high-resolution soil zoning.</li>
            <li>Provider availability, token authentication, and data age are surfaced transparently.</li>
            <li>Local-first design runs without external cloud dependency for baseline zoning computation.</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
