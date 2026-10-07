import React, { useState } from 'react';
import {
  PLANT_VILLAGE_17_CLASSES,
  MOCK_LEAF_SAMPLE,
} from '../../data/fixtures/leafFixtures';

export const LeafDiagnosisView: React.FC = () => {
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [localImageName, setLocalImageName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSampleLoaded, setIsSampleLoaded] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    // Format check
    const validFormats = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validFormats.includes(file.type)) {
      setErrorMessage(`Unsupported format (${file.type}). Accepts JPEG, PNG, or WebP.`);
      return;
    }

    // Size limit: 10 MB
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage(`File exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Megapixel check: 16 MP max
        const mp = (img.width * img.height) / 1_000_000;
        if (mp > 16) {
          setErrorMessage(`Resolution exceeds 16 MP limit (${mp.toFixed(1)} MP).`);
          return;
        }
        setLocalImageUrl(url);
        setLocalImageName(file.name);
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const handleClearPreview = () => {
    setLocalImageUrl(null);
    setLocalImageName(null);
    setErrorMessage(null);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-parchment-100/60 max-w-6xl mx-auto w-full">
      {/* View Header */}
      <div className="mb-6 pb-4 border-b border-line-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-editorial text-2xl font-bold text-ink">Leaf Diagnosis</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-sage-100 text-sage-800 border border-sage-300 font-semibold">
            17-CLASS CLASSIFIER
          </span>
        </div>
        <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
          Supervised crop-condition classification for Apple, Tomato, and Potato. In this mock demo phase, local images are previewed strictly in-browser and are never transmitted or evaluated by a model.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: LOCAL IMAGE PREVIEW ── */}
        <div className="space-y-4">
          <div className="bg-parchment-50 border border-line-border rounded-xl p-5 shadow-instrument">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-editorial text-base font-bold text-ink">Local Image Preview</h3>
              <span className="text-[11px] font-mono text-ink-subtle">Transient in-browser only</span>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-clay-subtle border border-clay/30 text-xs text-clay-dark">
                ⚠ {errorMessage}
              </div>
            )}

            {!localImageUrl ? (
              <label
                htmlFor="leaf-upload-input"
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-line-border rounded-xl hover:border-sage-600 hover:bg-parchment-100/50 cursor-pointer transition-colors text-center"
              >
                <div className="w-12 h-12 rounded-full bg-parchment-200 flex items-center justify-center text-ink-muted mb-2 font-mono text-lg">
                  📷
                </div>
                <span className="text-xs font-semibold text-ink mb-1">
                  Choose a leaf photo or drop here
                </span>
                <span className="text-[11px] text-ink-subtle">
                  JPEG, PNG, or WebP · Max 10 MB · Up to 16 Megapixels
                </span>
                <input
                  id="leaf-upload-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-line-border bg-black/5 flex items-center justify-center max-h-64">
                  <img
                    src={localImageUrl}
                    alt="Local leaf preview"
                    className="max-h-64 object-contain"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-ink-muted truncate max-w-[200px]" title={localImageName || ''}>
                    {localImageName}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearPreview}
                    className="text-clay hover:underline text-xs"
                  >
                    Remove image
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 p-3 rounded-lg bg-parchment-200/50 border border-line-subtle text-[11px] text-ink-subtle leading-relaxed">
              <span className="font-semibold text-ink-muted block mb-0.5">Privacy &amp; Data Boundary</span>
              This image is held in client memory only. No image is uploaded, saved, or fed into any ML model. In the mock demo, image preview is entirely detached from the canned example.
            </div>
          </div>

          {/* Supported Labels Reference Grid */}
          <div className="bg-parchment-50 border border-line-border rounded-xl p-5 shadow-instrument">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-editorial text-sm font-bold text-ink">Supported Class Hierarchy</h3>
              <span className="text-[11px] font-mono text-ink-subtle">17 Audited Classes</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-sage-800 text-[11px] block border-b border-line-subtle pb-0.5">
                  Apple (4)
                </span>
                {PLANT_VILLAGE_17_CLASSES.filter((c) => c.crop === 'Apple').map((c) => (
                  <div key={c.id} className="text-ink-muted text-[11px]">
                    • {c.condition}
                  </div>
                ))}

                <span className="font-semibold text-sage-800 text-[11px] block border-b border-line-subtle pb-0.5 pt-2">
                  Potato (3)
                </span>
                {PLANT_VILLAGE_17_CLASSES.filter((c) => c.crop === 'Potato').map((c) => (
                  <div key={c.id} className="text-ink-muted text-[11px]">
                    • {c.condition}
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-sage-800 text-[11px] block border-b border-line-subtle pb-0.5">
                  Tomato (10)
                </span>
                {PLANT_VILLAGE_17_CLASSES.filter((c) => c.crop === 'Tomato').map((c) => (
                  <div key={c.id} className="text-ink-muted text-[11px]">
                    • {c.condition}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: CANNED SAMPLE RESULT ── */}
        <div className="space-y-4">
          <div className="bg-parchment-50 border border-line-border rounded-xl p-5 shadow-instrument">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-editorial text-base font-bold text-ink">Prepared Sample Result</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amberGold-subtle border border-amberGold/30 text-amberGold font-medium">
                MOCK FIXTURE
              </span>
            </div>

            {!isSampleLoaded ? (
              <div className="py-12 text-center text-xs text-ink-subtle space-y-3">
                <p className="font-editorial text-sm text-ink-muted">
                  No sample classifier result loaded
                </p>
                <p className="max-w-xs mx-auto">
                  Click below to inspect the prepared 17-class sample fixture and metadata layout.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSampleLoaded(true)}
                  className="py-2 px-4 rounded-lg bg-sage-700 hover:bg-sage-800 text-parchment-50 font-semibold text-xs transition-colors shadow-sm"
                >
                  Show Prepared Sample
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Persistent Notice */}
                <div className="p-2.5 rounded-lg bg-amberGold-subtle border border-amberGold/30 text-xs text-amberGold font-medium">
                  MOCK OUTPUT — no model ran; completely unrelated to preview image
                </div>

                {/* Top Class Callout */}
                <div className="p-3.5 rounded-xl bg-parchment-100 border border-line-border flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-ink-subtle">Top Ranked Class</span>
                    <div className="text-base font-editorial font-bold text-ink">
                      {MOCK_LEAF_SAMPLE.topClass}
                    </div>
                    <div className="text-xs text-ink-muted italic font-serif">
                      Pathogen: {MOCK_LEAF_SAMPLE.pathogen}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-mono font-bold text-verdigris">
                      {(MOCK_LEAF_SAMPLE.modelScore * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] font-mono text-ink-subtle block">model score</span>
                  </div>
                </div>

                {/* Score Breakdown Bars */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-ink-muted block">Top Candidate Scores</span>
                  {MOCK_LEAF_SAMPLE.secondaryClasses.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs text-ink">
                        <span>{item.label}</span>
                        <span className="font-mono tabular-nums text-ink-muted">{item.score.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-parchment-200 overflow-hidden">
                        <div
                          className="h-full bg-verdigris rounded-full"
                          style={{ width: `${item.score * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Architecture & Review State */}
                <div className="p-3 rounded-lg bg-parchment-200/60 border border-line-subtle text-xs space-y-1.5">
                  <div className="flex justify-between text-ink-muted">
                    <span>Architecture:</span>
                    <span className="font-mono text-ink font-medium">MobileNetV3-Small</span>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <span>Weights:</span>
                    <span className="font-mono text-ink font-medium">ImageNet Pretrained</span>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <span>Measured Latency:</span>
                    <span className="italic text-amberGold">Not measured yet</span>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <span>Calibration:</span>
                    <span className="italic text-amberGold">Not evaluated</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsSampleLoaded(false)}
                    className="text-xs text-ink-subtle hover:text-ink underline"
                  >
                    Clear sample
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
