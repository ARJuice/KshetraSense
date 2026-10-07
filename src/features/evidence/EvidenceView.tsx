import React from 'react';

export const EvidenceView: React.FC = () => {
  return (
    <div className="flex-1 p-6 overflow-y-auto bg-parchment-100/60 max-w-5xl mx-auto w-full space-y-6">
      {/* View Header */}
      <div className="pb-4 border-b border-line-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-editorial text-2xl font-bold text-ink">Evidence &amp; Metrics</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-parchment-200 text-ink-muted border border-line-border font-semibold">
            METHODOLOGY RECORD
          </span>
        </div>
        <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
          Scientific methods, datasets, validation criteria, and boundaries. All unmeasured metrics are explicitly disclosed as "Not measured yet"—no placeholder scores or fabricated benchmarks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Vision Module Evidence */}
        <div className="bg-parchment-50 border border-line-border rounded-xl p-5 shadow-instrument space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-line-subtle">
            <h3 className="font-editorial text-base font-bold text-ink">1. Leaf Condition Classifier</h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sage-100 text-sage-800">
              MobileNetV3-Small
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-line-subtle">
              <span className="text-ink-muted">Input Specification:</span>
              <span className="font-mono text-ink font-medium">1 RGB image, 224×224 px, pixels only</span>
            </div>
            <div className="flex justify-between py-1 border-b border-line-subtle">
              <span className="text-ink-muted">Target Classes:</span>
              <span className="font-mono text-ink font-medium">17 PlantVillage conditions</span>
            </div>
            <div className="flex justify-between py-1 border-b border-line-subtle">
              <span className="text-ink-muted">Test Macro-F1 (PlantVillage):</span>
              <span className="italic text-amberGold font-mono">Not measured yet</span>
            </div>
            <div className="flex justify-between py-1 border-b border-line-subtle">
              <span className="text-ink-muted">Balanced Accuracy:</span>
              <span className="italic text-amberGold font-mono">Not measured yet</span>
            </div>
            <div className="flex justify-between py-1 border-b border-line-subtle">
              <span className="text-ink-muted">Batch-1 CPU Latency (p95):</span>
              <span className="italic text-amberGold font-mono">Not measured yet</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-muted">PlantDoc Generalization:</span>
              <span className="italic text-amberGold font-mono">Not measured yet (exploratory)</span>
            </div>
          </div>

          <p className="text-[11px] text-ink-subtle leading-relaxed pt-2 border-t border-line-subtle">
            Evaluation protocol preserves physical leaf independence across splits using <code className="font-mono text-[10px]">leaf_id</code> metadata. Soil features and zone context are excluded from model inputs.
          </p>
        </div>

        {/* 2. Soil Zoning Module Evidence */}
        <div className="bg-parchment-50 border border-line-border rounded-xl p-5 shadow-instrument space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-line-subtle">
            <h3 className="font-editorial text-base font-bold text-ink">2. Crop-Neutral Zoning</h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sage-100 text-sage-800">
              K-means · FCM
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-line-subtle">
              <span className="text-ink-muted">Feature Schema:</span>
              <span className="font-mono text-ink font-medium">pH, EC, Temp, N, P, K</span>
            </div>
            <div className="flex justify-between py-1 border-b border-line-subtle">
              <span className="text-ink-muted">Standardization:</span>
              <span className="font-mono text-ink font-medium">Declared feature-wise z-score</span>
            </div>
            <div className="flex justify-between py-1 border-b border-line-subtle">
              <span className="text-ink-muted">Adjusted Rand Index (Recovery):</span>
              <span className="italic text-amberGold font-mono">Not measured yet</span>
            </div>
            <div className="flex justify-between py-1 border-b border-line-subtle">
              <span className="text-ink-muted">Silhouette Diagnostic:</span>
              <span className="italic text-amberGold font-mono">Not measured yet</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-muted">FCM Membership Semantics:</span>
              <span className="font-mono text-ink font-medium">Fuzzy cluster strength, not confidence</span>
            </div>
          </div>

          <p className="text-[11px] text-ink-subtle leading-relaxed pt-2 border-t border-line-subtle">
            Zoning groups multidimensional feature vectors and does not by itself guarantee contiguous geographical parcels. Silhouette scores measure geometric compactness in feature space, not agronomic quality.
          </p>
        </div>

        {/* 3. Datasets and Partitions */}
        <div className="bg-parchment-50 border border-line-border rounded-xl p-5 shadow-instrument space-y-3">
          <h3 className="font-editorial text-base font-bold text-ink pb-2 border-b border-line-subtle">
            3. Datasets &amp; Partitions
          </h3>
          <div className="space-y-3 text-xs text-ink-muted">
            <div>
              <span className="font-semibold text-ink block">PlantVillage (Target Set):</span>
              <p className="text-[11px] leading-relaxed">
                Single-leaf laboratory images across 17 audited conditions. Group-preserving train/validation/test split audited against physical leaf overlap.
              </p>
            </div>
            <div>
              <span className="font-semibold text-ink block">PlantDoc (Cross-Dataset Check):</span>
              <p className="text-[11px] leading-relaxed">
                In-field natural environment images. Audit restricts evaluation strictly to exact matching classes with separate coverage reporting.
              </p>
            </div>
            <div>
              <span className="font-semibold text-ink block">Synthetic Soil Grid:</span>
              <p className="text-[11px] leading-relaxed">
                Fixed-seed Mulberry32 (#42), 18×12 grid (216 cells). Spatially coherent synthetic features. Never randomized on reload.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Boundaries and Known Limitations */}
        <div className="bg-parchment-50 border border-line-border rounded-xl p-5 shadow-instrument space-y-3">
          <h3 className="font-editorial text-base font-bold text-ink pb-2 border-b border-line-subtle">
            4. Known Limitations &amp; Boundaries
          </h3>
          <ul className="space-y-2 text-xs text-ink-muted list-disc list-inside leading-relaxed">
            <li>
              <strong className="text-ink">No Cultivation Probabilities:</strong> Crop Fit compares independent soil threshold factors. It is never a probability split totaling 100%.
            </li>
            <li>
              <strong className="text-ink">No Live Sensors:</strong> Grid markers are illustrative sampling points with no telemetry streams or pump actuation.
            </li>
            <li>
              <strong className="text-ink">No Agronomic Prescriptions:</strong> Yield predictions, fertilizer schedules, and curative chemical advice are outside the product scope.
            </li>
            <li>
              <strong className="text-ink">No Terrain Flattening:</strong> Cell relief is an analytical encoding of the selected attribute, not physical topography.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
