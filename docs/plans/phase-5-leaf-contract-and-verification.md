# Phase 5: Leaf Diagnosis Contract, System Integration & Academic Defense Strategy

**Status:** Contract and defense materials prepared; leaf-model implementation remains a separate task. No leaf model, inference route, or model results are implemented.
**Scope:** Cross-module verification, Leaf Diagnosis interface freeze, end-to-end integration walkthrough, and academic defense preparation  
**Depends on:** Phases 1–4  
**Produces:** Frozen Leaf Diagnosis API contract, cross-module verification matrix with current test evidence, release demonstration walkthrough, and professor defense documentation. Leaf-specific runtime tests remain gated on the separate classifier implementation.

---

## 5.1 Leaf Diagnosis API Specification & Boundary Freeze

Per the user request, the Leaf Diagnosis model will be trained and implemented separately. This section freezes its REST contract and architectural boundary without adding a route, model weights, or prediction UI. The proposed path is not live until the separate classifier implementation passes its acceptance gate.

### 5.1.1 Architectural Boundary (PR-07 / Decision 0004)
- **Image-Only Inference:** The leaf disease model consumes **raw image pixels only**. It receives **zero** soil features, zero zone IDs, zero NDVI values, and zero crop fit scores.
- **Why this separation is academically essential:**
  - If soil chemistry or weather were fed directly into a computer vision classifier, the model would learn spurious statistical correlations (e.g. associating low pH with fungal blight simply because of dataset co-occurrence) rather than identifying visual symptomatology.
  - This project does not define an automatic multimodal-fusion layer. Soil, satellite, and zoning context may be shown separately in the UI, but cannot change the image model's inputs or output.
- **Privacy/input handling:** Accept only a bounded JPEG/PNG upload, validate the actual file signature and decode it safely, remove or ignore EXIF/location metadata, and do not persist image bytes or include them in logs by default. The 10 MiB upload cap does not replace decoded-image dimension/resource limits.
- **Preprocessing freeze:** One RGB image is transformed to 224 × 224 using the versioned MobileNetV3-Small preprocessing packaged with the model artifact. The implementation must not silently use a different resize, color, normalization, or crop policy.

### 5.1.2 REST API Specification

```http
POST /v1/leaf/predict
Content-Type: multipart/form-data
```

**Request Form Data:**
- `file`: Image binary (`image/jpeg` or `image/png`, maximum 10 MiB). Reject unsupported or mismatched file content; validate decoded dimensions and malformed images before inference.

**Response semantics:**
- `topClass` and each `rankedClasses[].className` are stable class IDs from the versioned class map; `crop`, `condition`, and `isHealthy` are derived from that map, not independently guessed by the model.
- Return every one of the 17 supported classes ordered by descending score. The shortened array below is illustrative only. The semantic 17-class set is defined in the [PRD](../PRD.md); exact dataset folder-to-ID mapping must be audited and frozen before training.
- `score` is the model's versioned softmax output in `[0,1]`; it is **not** a calibrated probability or a guarantee of correctness. Calibration must be evaluated separately before probability/confidence language is allowed.
- `reviewRequired` must be computed from a versioned review policy using supported-image checks and a validated rejection threshold. Until such a threshold/policy has been evaluated, every prediction is review-required; do not choose a threshold by intuition.
- `inferenceLatencyMs` is measured server-side for this request, excluding upload time unless the field is explicitly renamed to total latency. `null` in the contract example means not yet measured; a production response must return a measured number.
- Return all 17 class scores even when a UI presents only the top few. No treatment/dose, disease severity, yield, or crop-fit conclusion is part of this endpoint.

**Response JSON Schema:**
```json
{
  "topClass": "Tomato___Early_blight",
  "reviewRequired": true,
  "crop": "Tomato",
  "condition": "Early blight",
  "isHealthy": false,
  "rankedClasses": [
    { "className": "Tomato___Early_blight", "score": 0.942 },
    { "className": "Tomato___Target_Spot", "score": 0.038 },
    { "className": "Tomato___healthy", "score": 0.012 }
  ],
  "modelMetadata": {
    "architecture": "MobileNetV3-Small",
    "weightsVersion": "to-be-versioned",
    "classesCount": 17,
    "inputResolution": [224, 224, 3],
    "preprocessingVersion": "versioned-with-artifact",
    "classMapVersion": "versioned-with-artifact",
    "inferenceLatencyMs": null
  },
  "limitations": ["Single-label image classification; not a severity estimate or treatment recommendation."]
}
```

The example scores are illustrative schema values, not model performance results; the production response must contain all 17 entries. Return `413` for payloads over the size limit, `415` for unsupported media types, `422` for malformed/undecodable images, and `503` when verified model weights are unavailable. Keep raw scores out of confidence/probability wording unless a separate calibration analysis supports that language. Do not return treatment advice or an agronomic action based solely on the predicted class.

---

## 5.2 Integration narrative and module boundaries

Use the following evidence-bounded walkthrough for professors and project evaluators. These are independent decision-support workflows, not an automated closed loop; no result silently feeds another module:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                 KSHETRASENSE INDEPENDENT DECISION-SUPPORT MODULES                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  STEP 1: PRE-SEASON PLANNING (Soil Zoning Module)                                      │
│  • Input: Farm boundary polygon + 8 georeferenced laboratory soil core samples.        │
│  • IDW Spatial Interpolation: Generates continuous 10m rasters for pH, EC, N, P, K.    │
│  • Project-defined SHI is a provisional screen, not an official USDA/NRCS index.       │
│  • Auto-K evaluates silhouette; the selected K is data-dependent, not fixed at 3.       │
│  • Adjacent zones merge by standardized multivariate profile distance, not SHI alone.  │
│  • WSN outputs are geometric candidates; radio coverage is not validated.              │
│  • Crop Fit separately evaluates the selected cell/zone and never changes clustering. │
│                                                                                        │
│  STEP 2: HISTORICAL TELEMETRY REPLAY (Field Monitoring, implemented Phase 4 UI)         │
│  • Replays the attributed Parma tomato trial from 2023; it is not a live farm feed.    │
│  • Soil humidity is source-reported %RH signal, not calibrated VWC or root-zone water. │
│  • Isolation Forest emits unsupervised review candidates, not confirmed sensor faults. │
│  • GRU predicts the %RH signal; the current model loses to persistence at all horizons.│
│  • A separate FAO-56 endpoint requires explicit calibrated VWC/site values; advisory only.│
│  • No KshetraSense zone binding, live gateway, valve, flow inference, or actuation.     │
│                                                                                        │
│  STEP 3: VEGETATION MONITORING (independent CropSight API workflow)                     │
│  • CropSight retains its own circular area and date inputs; its work is not zone-bound.│
│  • Current response: aggregate NDVI statistics/time series, optional rainfall only.   │
│  • No raster/zone geometry is returned; no patch map or prescription is shown.         │
│  • Earth Engine setup is deferred to the user; live analysis is not yet verified.      │
│                                                                                        │
│  STEP 4: TARGETED PLANT PATHOLOGY (Leaf Diagnosis Module)                              │
│  • Future operator image upload is independent; no soil/zone/NDVI context is passed.   │
│  • MobileNetV3-Small is fixed; classifier, API route, weights, and UI are not built.   │
│  • Latency, supported-domain behavior, and score calibration remain unmeasured.        │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5.3 Automated Testing & Acceptance Verification Matrix

Phase 4 automated checks pass. The leaf contract is documentation-only until the separate classifier is built; there are no leaf routes, weights, inference results, or leaf-specific runtime tests in the repository.

| Scope | Command | Target Pass Criteria |
|---|---|---|
| **Python backend** | From `services/zoning`, `python -m pytest tests -q` | **Passed:** 62 tests. Covers zoning, SoilGrids unavailable/no-fallback behavior, and telemetry; not USDA SHI, live devices, valve actuation, or CropSight Earth Engine execution. |
| **Frontend unit tests** | `npm test` | **Passed:** 45 tests across 13 files, including Soil Investigation storage, CropSight response/error contract, telemetry API client and timestamp/gap view model. No leaf model/API tests exist yet. |
| **TypeScript typecheck** | `npm run typecheck` | **Passed:** no TypeScript errors. |
| **Production build** | `npm run build` | **Passed:** build succeeds; existing 824.24 kB `FieldScene3D` chunk exceeds Vite's 500 kB advisory threshold. |
| **Telemetry model evidence** | `services/telemetry/models/soil_signal_gru_metadata.json` and [Decision 0008](../decisions/0008-gru-holdout-quality-and-use.md) | Existing chronological held-out results are recorded; GRU is worse than persistence at 6/12/24 hours. Regenerating the model is not required for this documentation milestone. |
| **Live providers** | Manual Earth Engine setup; future SoilGrids WCS/WebDAV adapter | **Not run/not available:** user setup is deferred; SoilGrids endpoint returns 503 without a verified provider. |
| **Leaf API/model** | Future classifier implementation and contract tests | **Not implemented by design:** audit dataset/classes, train/version MobileNetV3-Small, implement route, test preprocessing/calibration/resource limits, then integrate UI. |

---

## 5.4 Comprehensive Professor Q&A Defense Guide

Use these rigorous mathematical, agronomic, and architectural answers during review:

### Question 1: "Why support both K-means and Fuzzy C-means (FCM), and why not DBSCAN for soil zoning?"
> **Defense Answer:**
> “Both implemented methods cluster standardized pH, EC, N, P, and K profiles. K-means assigns each cell to one cluster; FCM retains a membership vector for each cell, which can express ambiguity near cluster boundaries. Auto-K uses silhouette as a diagnostic, and a membership is not confidence, crop suitability, or a prescription. We chose to support both so users can compare crisp and fuzzy partitions; we do not claim one method is universally superior or use its output to set input rates.”

---

### Question 2: "How can you justify spatial interpolation with only a few soil samples? Why not Kriging?"
> **Defense Answer:**
> “The API accepts 3–50 samples and recommends 5–10 for the intended workflow. IDW with fixed power $p=2$ is a transparent deterministic baseline that avoids fitting a variogram from a small sample set. The service reports leave-one-out errors and nearest-sample distances so users can see limitations. These diagnostics are not validation against dense field truth; sparse samples may miss local variation. Kriging can be evaluated when enough spatial observations support a defensible variogram, but this project does not claim it is impossible or universally unsuitable.”

---

### Question 3: "Why is Soil Health Index (SHI) scored with non-linear functions instead of simple Min-Max scaling?"
> **Defense Answer:**
> “The implemented KshetraSense SHI is a separate project-defined composite with nonlinear indicator curves and explicit weights. It is not USDA/NRCS-endorsed, crop-specific, locally calibrated, or validated against yield or soil-health outcomes. The curves are an explanatory screening choice, not a claim that one universal response curve applies to every crop or production system. Clustering consumes the multivariate soil features directly; SHI does not drive cluster selection or Crop Fit.”

---

### Question 4: "How did you evaluate the soil-signal GRU without temporal leakage?"
> **Defense Answer:**
> “The telemetry benchmark uses chronological 70/15/15 train/validation/test periods, and the scaler is fit on training-period rows only. The target is the trial's soil-humidity `%RH` signal—not VWC or root-zone water. On 352 held-out windows the current GRU MAE is 0.378/1.265/0.980 `%RH` at +6/+12/+24 hours, while persistence gives 0.083/0.140/0.204; the GRU loses at all horizons. We disclose that and keep the model evaluation-only rather than claim useful forecasting.”

---

### Question 5: "Why not use an End-to-End Deep Neural Network that directly predicts when to open the irrigation valve?"
> **Defense Answer:**
> “This project does not open a valve. The benchmark target is not VWC, and its GRU does not beat the persistence baseline, so it cannot drive an irrigation decision. A separate API-only FAO-56 calculator accepts explicit VWC, field-capacity/wilting-point, rooting-depth, and depletion inputs and returns TAW/RAW plus a human-review advisory. The caller must supply a calibration source, which the software does not independently verify. No replay UI input, delivery volume, actuator state, or physical safety claim is produced.”

---

### Question 6: "Since you don't have physical ESP32 boards on the table today, how is this a valid hardware engineering project?"
> **Defense Answer:**  
> “Phase 3 is a local historical-data replay and model-evaluation service, not hardware-in-the-loop. The source is Belli et al.'s Parma tomato trial, collected in 2023 and published with a 2025 Data in Brief article. Its soil humidity field is `%RH`, battery readings are mostly absent, and the source-meter scale is not independently validated. The software does not implement a gateway receiver, MQTT/LoRaWAN ingestion, energy model, or actuation. A physical deployment would require a separate sensor protocol, calibration, security, safety, and field-validation project.”

---

### Question 7: "Why don't Apple, Tomato, and Potato fit scores add up to 100%?"
> **Defense Answer:**
> “They are independent crop-profile evaluations, not mutually exclusive probabilities. A field can be compatible with multiple crops or none. The current rule implementation assesses pH and marks unsupported factors as not assessed; it has no labeled field-by-crop yield/outcome dataset from which to estimate calibrated cultivation probabilities. Cluster membership and SHI are not crop-success probabilities either.”

---

### Question 8: "Can CropSight generate variable-rate prescriptions from the current vegetation view?"
> **Defense Answer:**
> “Not from the current API contract. The host validates and displays aggregate NDVI statistics, per-scene mean NDVI, and optional rainfall returned by CropSight. It receives no raster, pixel labels, zone polygons, or per-zone summaries, so it cannot show spatial patches or generate a prescription. The requested K-means count is only request configuration, not evidence that a spatial result was returned. A future prescription would require spatial outputs, calibrated input rates, agronomic rules, and independent field validation. Earth Engine setup is also still pending.”

---

### Question 9: "Why is SoilGrids shown as unavailable instead of filling gaps in the soil sample register?"
> **Defense Answer:**
> “A previous local implementation generated coordinate-derived numbers without querying ISRIC, so it was removed rather than presented as modeled data. ISRIC currently reports its beta REST API paused and identifies WCS for subsets and WebDAV for global VRT access. Until a real provider is configured and its property, depth, units, quantiles, and provenance are tested, the product returns unavailable and does not treat regional predictions as field samples. ([ISRIC access FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html))”

---

### Question 10: "Why choose MobileNetV3-Small, and is its accuracy already known?"
> **Defense Answer:**
> “MobileNetV3-Small is the fixed project architecture, not a claim that it is the best model for these images. The classifier, dataset audit, weights, latency, calibration, and evaluation are not implemented in the current build. The separate model task must audit the 17 supported labels, use group-preserving splits, compare against suitable baselines, and report measured per-class metrics and external-domain limitations before any accuracy claim is made.”

---

### Question 11: "What can we demonstrate today, and what still needs external setup?"
> **Defense Answer:**
> “The soil-zoning workflow and Crop Fit use the local service, and historical telemetry can be replayed with its source/unit/model limitations visible. Soil Investigation accepts manual/CSV samples but starts empty. SoilGrids currently reports unavailable because no real data adapter is configured. CropSight needs its mounted sub-application/dependencies and Earth Engine project/authentication; its current API is aggregate-only. Leaf diagnosis has a frozen image-only contract but no route or model weights. These are explicit gates, not hidden simulated successes.”
