import React, { useState } from 'react';
import {
  AlertTriangle,
  Eye,
  ShieldAlert,
} from 'lucide-react';

interface FoliarClassSample {
  id: string;
  name: string;
  crop: string;
  condition: string;
  isHealthy: boolean;
  simulatedTopScore: number;
  runnerUpClass: string;
  runnerUpScore: number;
  thirdClass: string;
  thirdScore: number;
  visualSymptom: string;
}

const AUDITED_CLASSES: FoliarClassSample[] = [
  {
    id: 'Tomato___Early_blight',
    name: 'Tomato Early Blight',
    crop: 'Tomato',
    condition: 'Early blight',
    isHealthy: false,
    simulatedTopScore: 0.942,
    runnerUpClass: 'Tomato___Target_Spot',
    runnerUpScore: 0.038,
    thirdClass: 'Tomato___healthy',
    thirdScore: 0.012,
    visualSymptom: 'Concentric dark target-board rings with yellow chlorotic halos on lower foliage.',
  },
  {
    id: 'Tomato___Late_blight',
    name: 'Tomato Late Blight',
    crop: 'Tomato',
    condition: 'Late blight',
    isHealthy: false,
    simulatedTopScore: 0.915,
    runnerUpClass: 'Tomato___Early_blight',
    runnerUpScore: 0.052,
    thirdClass: 'Tomato___Septoria_leaf_spot',
    thirdScore: 0.021,
    visualSymptom: 'Water-soaked irregular necrotic lesions rapidly expanding under humid conditions.',
  },
  {
    id: 'Tomato___healthy',
    name: 'Tomato Healthy Leaf',
    crop: 'Tomato',
    condition: 'Healthy',
    isHealthy: true,
    simulatedTopScore: 0.978,
    runnerUpClass: 'Tomato___Early_blight',
    runnerUpScore: 0.011,
    thirdClass: 'Tomato___Target_Spot',
    thirdScore: 0.006,
    visualSymptom: 'Uniform deep green pigmentation, intact venation, no necrotic spots or lesions.',
  },
  {
    id: 'Corn_(maize)___Common_rust_',
    name: 'Corn Common Rust',
    crop: 'Corn',
    condition: 'Common rust',
    isHealthy: false,
    simulatedTopScore: 0.934,
    runnerUpClass: 'Corn_(maize)___Northern_Leaf_Blight',
    runnerUpScore: 0.041,
    thirdClass: 'Corn_(maize)___healthy',
    thirdScore: 0.015,
    visualSymptom: 'Golden-brown to cinnamon-brown pustules erupting across both upper and lower leaf surfaces.',
  },
  {
    id: 'Apple___Apple_scab',
    name: 'Apple Scab',
    crop: 'Apple',
    condition: 'Apple scab',
    isHealthy: false,
    simulatedTopScore: 0.892,
    runnerUpClass: 'Apple___Black_rot',
    runnerUpScore: 0.065,
    thirdClass: 'Apple___healthy',
    thirdScore: 0.028,
    visualSymptom: 'Olive-green to velvety dark brown lesions on leaf surface, leading to curling and distortion.',
  },
];

export const MobileNetV3Visualizer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'simulator' | 'safety'>('architecture');
  const [selectedSample, setSelectedSample] = useState<FoliarClassSample>(AUDITED_CLASSES[0]);
  const [activeLayer, setActiveLayer] = useState<'stem' | 'bneck' | 'se' | 'head'>('bneck');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Visualizer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              CNN
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              MobileNetV3-Small Leaf Disease Classifier &amp; Safety Gate
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Edge-optimized neural vision architecture (11 inverted residual blocks) with enforced reviewRequired safety gating.
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'architecture' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. CNN Architecture
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'simulator' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Inference Simulator
          </button>
          <button
            onClick={() => setActiveTab('safety')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'safety' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Mandatory Safety Gate
          </button>
        </div>
      </div>

      {/* TAB 1: CNN ARCHITECTURE & INVERTED RESIDUAL BLOCKS */}
      {activeTab === 'architecture' && (
        <div className="space-y-6">
          {/* Top-level Pipeline Topology Diagram */}
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white shadow-inner">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                Forward Tensor Transformation Flow
              </span>
              <span className="font-mono text-[11px] text-emerald-400">
                1.53M Parameters · 92.97% Test Split Acc
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
              {/* Node 1: Input Tensor */}
              <button
                onClick={() => setActiveLayer('stem')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeLayer === 'stem' ? 'border-emerald-400 bg-slate-800 ring-1 ring-emerald-400' : 'border-slate-700 bg-slate-800/60'
                }`}
              >
                <span className="font-mono text-[10px] text-blue-400 font-bold block">INPUT TENSOR</span>
                <p className="font-mono text-sm font-extrabold text-white mt-1">224 × 224 × 3</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Pillow Bilinear resize, ImageNet RGB normalization
                </p>
              </button>

              {/* Node 2: Stem Conv */}
              <button
                onClick={() => setActiveLayer('stem')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeLayer === 'stem' ? 'border-emerald-400 bg-slate-800 ring-1 ring-emerald-400' : 'border-slate-700 bg-slate-800/60'
                }`}
              >
                <span className="font-mono text-[10px] text-emerald-400 font-bold block">STEM CONV</span>
                <p className="font-mono text-sm font-extrabold text-white mt-1">Conv2d 3×3</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  16 filters, stride 2, Hard-Swish activation
                </p>
              </button>

              {/* Node 3: 11 Inverted Residual Bottlenecks */}
              <button
                onClick={() => setActiveLayer('bneck')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeLayer === 'bneck' ? 'border-emerald-400 bg-slate-800 ring-1 ring-emerald-400' : 'border-slate-700 bg-slate-800/60'
                }`}
              >
                <span className="font-mono text-[10px] text-purple-400 font-bold block">11 B-NECK BLOCKS</span>
                <p className="font-mono text-sm font-extrabold text-white mt-1">Depthwise+SE</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Channel expansion, 3×3/5×5 DWS, SE attention
                </p>
              </button>

              {/* Node 4: SE Attention Channel Module */}
              <button
                onClick={() => setActiveLayer('se')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeLayer === 'se' ? 'border-emerald-400 bg-slate-800 ring-1 ring-emerald-400' : 'border-slate-700 bg-slate-800/60'
                }`}
              >
                <span className="font-mono text-[10px] text-amber-400 font-bold block">SE ATTENTION</span>
                <p className="font-mono text-sm font-extrabold text-white mt-1">Adaptive Pool</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Channel recalibration with Hard-Sigmoid gating
                </p>
              </button>

              {/* Node 5: Classifier Head */}
              <button
                onClick={() => setActiveLayer('head')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeLayer === 'head' ? 'border-emerald-400 bg-slate-800 ring-1 ring-emerald-400' : 'border-slate-700 bg-slate-800/60'
                }`}
              >
                <span className="font-mono text-[10px] text-emerald-400 font-bold block">CLASSIFIER</span>
                <p className="font-mono text-sm font-extrabold text-white mt-1">17 Logits</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Dropout(0.2), Linear head, reviewRequired: true
                </p>
              </button>
            </div>
          </div>

          {/* Detailed Layer Inspection Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
            {activeLayer === 'bneck' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Inverted Residual Bottleneck Block (bneck) Architecture
                  </h4>
                  <span className="font-mono text-xs text-emerald-700 font-bold">Howard et al., ICCV 2019</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Unlike traditional ResNets that compress features into a low-dimensional bottleneck before expansion, MobileNetV3 follows an <em>inverted</em> residual design:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
                    <span className="font-mono text-[10px] font-bold text-slate-500">PHASE 1</span>
                    <strong className="block text-slate-900">1×1 Pointwise Expansion</strong>
                    <p className="text-[11px] text-slate-600">Expands input channels by expansion factor $t$ (e.g. $t=3$ to $6$) to high-dimensional manifold.</p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
                    <span className="font-mono text-[10px] font-bold text-slate-500">PHASE 2</span>
                    <strong className="block text-slate-900">Depthwise Conv (3×3 or 5×5)</strong>
                    <p className="text-[11px] text-slate-600">Spatial feature extraction with one filter per input channel, drastically reducing MAC operations.</p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
                    <span className="font-mono text-[10px] font-bold text-slate-500">PHASE 3</span>
                    <strong className="block text-slate-900">Squeeze-and-Excitation</strong>
                    <p className="text-[11px] text-slate-600">Channel attention weighting using global pooling and Hard-Sigmoid gating.</p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
                    <span className="font-mono text-[10px] font-bold text-slate-500">PHASE 4</span>
                    <strong className="block text-slate-900">Linear Bottleneck Projection</strong>
                    <p className="text-[11px] text-slate-600">1×1 projection without non-linearity, preserving learned representations before residual addition.</p>
                  </div>
                </div>

                {/* Hard-Swish formula callout */}
                <div className="rounded-lg bg-slate-900 p-3 text-white font-mono text-xs space-y-1">
                  <span className="text-emerald-400 font-bold block">Hard-Swish Activation Function:</span>
                  <p className="text-slate-200">
                    {'h_swish(x) = x · (ReLU6(x + 3) / 6)'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Approximates the Swish function without costly floating-point exponential operations, ideal for agricultural mobile edge devices.
                  </p>
                </div>
              </div>
            )}

            {activeLayer === 'se' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Squeeze-and-Excitation (SE) Channel Attention Module
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  SE modules dynamically recalibrate channel-wise feature responses by explicitly modeling interdependencies between channels:
                </p>
                <div className="rounded-lg bg-slate-900 p-3 text-white font-mono text-xs space-y-1">
                  <p className="text-emerald-400 font-bold">
                    {'z = AdaptiveAvgPool2d(x)  # Squeeze'}
                  </p>
                  <p className="text-slate-200">
                    {'s = HardSigmoid(Linear_2(ReLU(Linear_1(z))))  # Excitation'}
                  </p>
                  <p className="text-emerald-300">
                    {'output = x · s  # Channel-wise feature scaling'}
                  </p>
                </div>
              </div>
            )}

            {activeLayer === 'stem' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Image Ingestion &amp; ImageNet Normalization
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Raw uploaded leaf photographs (JPEG/PNG up to 10 MiB) undergo strict decoding validation and transformation:
                </p>
                <div className="rounded-lg bg-slate-900 p-3 text-white font-mono text-xs space-y-1">
                  <p className="text-slate-200">
                    {'tensor_normalized = (pixel_rgb / 255.0 - mean) / std'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225]
                  </p>
                </div>
              </div>
            )}

            {activeLayer === 'head' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  17-Class Audited Classification Head &amp; Latency Profile
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  A dense layer maps the 1024-dimensional feature vector to 17 audited logits across Apple, Potato, Tomato, and Corn foliar diseases.
                </p>
                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="rounded border border-slate-200 bg-white p-2.5">
                    <span className="text-slate-500 text-[10px] block">Warmed CPU Inference:</span>
                    <strong className="text-emerald-700 text-sm">84.08 ms</strong>
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-2.5">
                    <span className="text-slate-500 text-[10px] block">Test Set Macro-F1:</span>
                    <strong className="text-emerald-700 text-sm">93.52%</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INFERENCE SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500">Sample Foliar Conditions:</span>
            {AUDITED_CLASSES.map((sample) => (
              <button
                key={sample.id}
                onClick={() => setSelectedSample(sample)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  selectedSample.id === sample.id
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {sample.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Visual Leaf Preview & Diagnosis (6 cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-400">Audited Specimen: {selectedSample.crop}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      selectedSample.isHealthy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {selectedSample.isHealthy ? 'Healthy Tissue' : 'Pathology Detected'}
                  </span>
                </div>

                <div className="h-44 rounded-lg bg-slate-800 border border-slate-700 flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <Eye size={28} className="text-emerald-400" />
                  <h4 className="text-base font-bold text-white">{selectedSample.name}</h4>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                    {selectedSample.visualSymptom}
                  </p>
                </div>

                <div className="rounded bg-slate-800 p-3 text-[11px] font-mono text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span>Input Resolution:</span>
                    <span className="text-emerald-400">224 × 224 × 3 RGB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Warmed Latency:</span>
                    <span className="text-emerald-400">84.08 ms (CPU)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dataset Origin:</span>
                    <span className="text-slate-400">Filtered PlantVillage (CC-BY 4.0)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top-3 Softmax Distribution (6 cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Model Ranked Softmax Distribution
                </span>

                <div className="space-y-3">
                  {/* Top-1 */}
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-3 space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-950">
                        #1: {selectedSample.name}
                      </span>
                      <span className="font-mono font-bold text-emerald-800">
                        {(selectedSample.simulatedTopScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-emerald-200 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${selectedSample.simulatedTopScore * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Runner-up */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        #2: {selectedSample.runnerUpClass.replace('___', ' ')}
                      </span>
                      <span className="font-mono font-bold text-slate-600">
                        {(selectedSample.runnerUpScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-slate-500 rounded-full"
                        style={{ width: `${selectedSample.runnerUpScore * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Third */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        #3: {selectedSample.thirdClass.replace('___', ' ')}
                      </span>
                      <span className="font-mono font-bold text-slate-600">
                        {(selectedSample.thirdScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full"
                        style={{ width: `${selectedSample.thirdScore * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 flex items-start gap-2">
                  <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-amber-900">Uncalibrated Output:</strong> Scores represent raw normalized softmax logits; they are NOT statistical probabilities of pathology in field settings.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MANDATORY SAFETY GATE */}
      {activeTab === 'safety' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-400" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                Enforced Decision Support Policy (Decision 0004)
              </h4>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-700 pb-2">
                <span className="text-slate-400">reviewRequired:</span>
                <span className="text-emerald-400 font-bold">true (Always Enforced)</span>
              </div>
              <div className="flex justify-between border-b border-slate-700 pb-2">
                <span className="text-slate-400">autonomousActuation:</span>
                <span className="text-rose-400 font-bold">false (Strictly Prohibited)</span>
              </div>
              <div className="flex justify-between border-b border-slate-700 pb-2">
                <span className="text-slate-400">multimodalFusion:</span>
                <span className="text-rose-400 font-bold">false (Isolated Domain)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">pesticideDosagePrescription:</span>
                <span className="text-rose-400 font-bold">false (Refused by API)</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every single response from POST /v1/leaf/predict includes reviewRequired: true. The application explicitly refuses to automate spray booms or chemical application without physical human expert confirmation.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Why Autonomous Foliar Spraying is Fatal
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Leaf disease classifiers trained on uniform laboratory backgrounds (PlantVillage) suffer from severe out-of-distribution domain shift when presented with real farm photos containing soil debris, direct sunlight, insect shadows, or multi-pathogen infections.
              </p>
              <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 space-y-1 text-xs text-rose-950">
                <span className="font-bold text-rose-900 block">Agronomic Harm Disclaimer:</span>
                <p className="leading-relaxed text-[11px]">
                  Misclassifying bacterial spot as fungal blight would prompt incorrect fungicide application, resulting in crop destruction, unnecessary chemical runoff, and heavy financial losses for the farmer.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
