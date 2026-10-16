import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Cpu,
  Database,
  Layers,
} from 'lucide-react';

export const GruTopologyVisualizer: React.FC = () => {
  const [selectedHorizon, setSelectedHorizon] = useState<'6h' | '12h' | '24h'>('6h');
  const [activeTab, setActiveTab] = useState<'topology' | 'cell_gates' | 'evaluation'>('topology');

  const horizonMetrics = {
    '6h': {
      horizonLabel: '+6 Hours (36 steps)',
      gruMae: '0.378 %RH',
      gruRmse: '0.512 %RH',
      persistenceMae: '0.083 %RH',
      persistenceRmse: '0.118 %RH',
      status: 'Persistence Outperforms (+355% Error)',
      rationale: 'Over 6 hours, subsoil capacitive readings exhibit minimal diurnal drift. Lag-1 persistence remains nearly stationary, which the complex network slightly overshoots.',
      groundTruthVal: 99.2,
      persistenceVal: 99.2,
      gruVal: 98.6,
    },
    '12h': {
      horizonLabel: '+12 Hours (72 steps)',
      gruMae: '1.265 %RH',
      gruRmse: '1.642 %RH',
      persistenceMae: '0.140 %RH',
      persistenceRmse: '0.198 %RH',
      status: 'Persistence Outperforms (+803% Error)',
      rationale: 'At 12 hours (day-to-night diurnal transition), air temperature and humidity fluctuate, causing the GRU to infer excessive subsoil moisture fluctuation.',
      groundTruthVal: 99.1,
      persistenceVal: 99.2,
      gruVal: 97.4,
    },
    '24h': {
      horizonLabel: '+24 Hours (144 steps)',
      gruMae: '0.980 %RH',
      gruRmse: '1.310 %RH',
      persistenceMae: '0.204 %RH',
      persistenceRmse: '0.285 %RH',
      status: 'Persistence Outperforms (+380% Error)',
      rationale: 'Full diurnal cycle. Without irrigation events, soil pore relative humidity remains capped near saturation. The network predicts subtle evaporative loss that did not materialize at 20 cm depth.',
      groundTruthVal: 99.0,
      persistenceVal: 99.2,
      gruVal: 97.9,
    },
  };

  const activeMetric = horizonMetrics[selectedHorizon];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              GRU
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Two-Layer GRU Sequence Architecture &amp; Held-Out Benchmark
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Recurrent sequence model trained on the CC BY 4.0 Parma tomato trial (Belli et al., 2025) forecasting soil-humidity sensor signal (%RH).
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('topology')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'topology' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Network Topology
          </button>
          <button
            onClick={() => setActiveTab('cell_gates')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'cell_gates' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. GRU Cell Gating
          </button>
          <button
            onClick={() => setActiveTab('evaluation')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'evaluation' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Held-Out Evaluation
          </button>
        </div>
      </div>

      {/* TAB 1: TOPOLOGY FORWARD FLOW */}
      {activeTab === 'topology' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white shadow-inner">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Neural Network Forward Computation Topology
              </h4>
              <span className="text-[10px] font-mono text-emerald-400">
                Huber Loss (δ=1.0) · Adam (lr=1e-3) · 50 Epochs
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
              {/* Node 1: Input Sequence */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
                  <Database size={13} />
                  <span>Input Window</span>
                </div>
                <p className="font-mono text-sm font-extrabold text-white">144 × 5</p>
                <p className="text-[10px] text-slate-400 leading-tight">
                  24 hours @ 10-min dt: [Soil %RH, Soil T, EC, Air T, Air RH]
                </p>
              </div>

              {/* Node 2: GRU Layer 1 */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <Layers size={13} />
                  <span>GRU Layer 1</span>
                </div>
                <p className="font-mono text-sm font-extrabold text-white">64 Units</p>
                <p className="text-[10px] text-slate-400 leading-tight">
                  return_sequences=True, Dropout=0.10, recurrent tanh
                </p>
              </div>

              {/* Node 3: GRU Layer 2 */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <Layers size={13} />
                  <span>GRU Layer 2</span>
                </div>
                <p className="font-mono text-sm font-extrabold text-white">32 Units</p>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Sequence reduction to 32-dim latent hidden vector h_t
                </p>
              </div>

              {/* Node 4: Dense Residual Head */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold">
                  <Cpu size={13} />
                  <span>Residual Head</span>
                </div>
                <p className="font-mono text-sm font-extrabold text-white">Dense(3)</p>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Outputs future delta estimates: [Δy_+6h, Δy_+12h, Δy_+24h]
                </p>
              </div>

              {/* Node 5: Output Addition */}
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-bold">
                  <Clock size={13} />
                  <span>Forecast</span>
                </div>
                <p className="font-mono text-sm font-extrabold text-emerald-300">y_t + Δy</p>
                <p className="text-[10px] text-emerald-200/70 leading-tight">
                  Persistence baseline added to residual deltas
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-900 font-semibold block mb-0.5">Residual Delta Formulation:</strong>
            Rather than forcing the network to predict the absolute relative humidity level (which hovers around 98–99% inside soil pores), the Dense head estimates the <em>change</em> Δy relative to the current reading y_t. This ensures stable numerical convergence during gradient descent.
          </div>
        </div>
      )}

      {/* TAB 2: GRU CELL INTERNAL GATING */}
      {activeTab === 'cell_gates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white space-y-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Gated Recurrent Unit Mathematical Internal Gates
            </h4>

            <div className="space-y-3 font-mono text-xs">
              {/* Reset Gate */}
              <div className="rounded border border-slate-700 bg-slate-800 p-3 space-y-1">
                <div className="flex justify-between text-blue-400 font-bold">
                  <span>1. Reset Gate r_t</span>
                  <span className="text-[10px] text-slate-400">Sigmoid [0, 1]</span>
                </div>
                <p className="text-slate-200">
                  {'r_t = σ(W_r · x_t + U_r · h_{t-1} + b_r)'}
                </p>
                <p className="text-[10px] text-slate-400">
                  Controls how much of the past hidden state h_{'{t-1}'} to discard.
                </p>
              </div>

              {/* Update Gate */}
              <div className="rounded border border-slate-700 bg-slate-800 p-3 space-y-1">
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>2. Update Gate z_t</span>
                  <span className="text-[10px] text-slate-400">Sigmoid [0, 1]</span>
                </div>
                <p className="text-slate-200">
                  {'z_t = σ(W_z · x_t + U_z · h_{t-1} + b_z)'}
                </p>
                <p className="text-[10px] text-slate-400">
                  Balances long-term memory against new sensor input innovations.
                </p>
              </div>

              {/* Candidate Hidden State */}
              <div className="rounded border border-slate-700 bg-slate-800 p-3 space-y-1">
                <div className="flex justify-between text-purple-400 font-bold">
                  <span>3. Candidate State h_tilde_t</span>
                  <span className="text-[10px] text-slate-400">Tanh [-1, 1]</span>
                </div>
                <p className="text-slate-200">
                  {'h~_t = tanh(W_h · x_t + U_h · (r_t ⊙ h_{t-1}) + b_h)'}
                </p>
              </div>

              {/* Final State */}
              <div className="rounded border border-emerald-500/40 bg-emerald-950/40 p-3 space-y-1 text-emerald-300">
                <div className="flex justify-between font-bold">
                  <span>4. Updated Hidden State h_t</span>
                  <span className="text-[10px] text-emerald-400">Convex Combination</span>
                </div>
                <p className="text-white">
                  {'h_t = (1 - z_t) ⊙ h_{t-1} + z_t ⊙ h~_t'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Why GRU instead of LSTM or Plain RNN?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Standard Recurrent Neural Networks suffer from vanishing and exploding gradients over 144 timesteps (24 hours). While LSTM introduces 3 gates and an explicit cell state, Cho et al. (2014) demonstrated that GRU achieves comparable representation capacity with 25% fewer parameters:
              </p>
              <ul className="space-y-2 text-xs text-slate-700 list-disc list-inside">
                <li>Eliminates the separate cell state vector $c_t$, tracking hidden state $h_t$ directly.</li>
                <li>Merges forget and input gates into a coupled update gate $z_t$.</li>
                <li>Substantially lower inference latency for edge microcontrollers and solar-powered gateways.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HELD-OUT PERFORMANCE MATRIX */}
      {activeTab === 'evaluation' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Held-Out Test Set Performance (352 Chronological Windows)
            </h4>

            {/* Horizon Selector Tabs */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setSelectedHorizon('6h')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                  selectedHorizon === '6h' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                +6h Horizon
              </button>
              <button
                onClick={() => setSelectedHorizon('12h')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                  selectedHorizon === '12h' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                +12h Horizon
              </button>
              <button
                onClick={() => setSelectedHorizon('24h')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                  selectedHorizon === '24h' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                +24h Horizon
              </button>
            </div>
          </div>

          {/* Selected Horizon Metrics Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-700">
                Selected Target Horizon: {activeMetric.horizonLabel}
              </span>
              <span className="rounded bg-rose-100 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                {activeMetric.status}
              </span>
            </div>

            {/* Side-by-side Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* GRU Performance */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <span className="text-[11px] font-bold uppercase text-slate-500">Trained 2-Layer GRU</span>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Mean Absolute Error (MAE):</span>
                    <span className="font-mono font-bold text-slate-900">{activeMetric.gruMae}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Root Mean Squared Error (RMSE):</span>
                    <span className="font-mono font-bold text-slate-900">{activeMetric.gruRmse}</span>
                  </div>
                </div>
              </div>

              {/* Persistence Benchmark Performance */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
                <span className="text-[11px] font-bold uppercase text-emerald-800">Naive Persistence Baseline (y_t+h = y_t)</span>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Mean Absolute Error (MAE):</span>
                    <span className="font-mono font-bold text-emerald-900">{activeMetric.persistenceMae}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Root Mean Squared Error (RMSE):</span>
                    <span className="font-mono font-bold text-emerald-900">{activeMetric.persistenceRmse}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Horizon Comparison Graphic */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Held-Out Window Forecast Inspection (%RH)
              </span>
              <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs pt-1">
                <div className="rounded bg-slate-100 p-2">
                  <span className="text-[10px] text-slate-500 block">Ground Truth</span>
                  <strong className="text-slate-900 text-sm">{activeMetric.groundTruthVal}%</strong>
                </div>
                <div className="rounded bg-emerald-50 p-2 border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 block">Persistence</span>
                  <strong className="text-emerald-900 text-sm">{activeMetric.persistenceVal}%</strong>
                </div>
                <div className="rounded bg-rose-50 p-2 border border-rose-200">
                  <span className="text-[10px] text-rose-700 block">GRU Forecast</span>
                  <strong className="text-rose-900 text-sm">{activeMetric.gruVal}%</strong>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed italic border-t border-slate-200/60 pt-3">
              <strong>Agronomic Explanation:</strong> {activeMetric.rationale}
            </p>
          </div>

          {/* Honest Scientific Disclosure Box */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <AlertTriangle size={15} className="text-amber-700" />
              <span>Scientific Disclosure &amp; Defense Point</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-950">
              Because the GRU loses to persistence at all horizons, KshetraSense <strong>transparently discloses this limitation</strong> and retains the model as an educational benchmark rather than claiming operational predictive accuracy. Furthermore, the sensor target is <strong>pore-air relative humidity (%RH)</strong>, not Volumetric Water Content (VWC m³/m³). It is NEVER piped into irrigation valve controllers or hydraulic formulas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
