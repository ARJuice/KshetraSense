# Phase 5: Leaf Diagnosis Contract, System Integration & Academic Defense Strategy

**Status:** Planned; no leaf model, inference route, or model results are implemented by this document. The classifier implementation remains a separate task.
**Scope:** Cross-module verification, Leaf Diagnosis interface freeze, end-to-end integration walkthrough, and academic defense preparation  
**Depends on:** Phases 1–4  
**Produces:** Frozen Leaf Diagnosis API contract, end-to-end automated test suite, release demonstration walkthrough, and professor defense documentation  

---

## 5.1 Leaf Diagnosis API Specification & Boundary Freeze

Per the user request, the Leaf Diagnosis module will be trained and implemented separately shortly. However, to guarantee strict system modularity and prevent future architectural refactors, its **REST API contract and architectural boundary are frozen here**.

### 5.1.1 Architectural Boundary (PR-07 / Decision 0004)
- **Image-Only Inference:** The leaf disease model consumes **raw image pixels only**. It receives **zero** soil features, zero zone IDs, zero NDVI values, and zero crop fit scores.
- **Why this separation is academically essential:**
  - If soil chemistry or weather were fed directly into a computer vision classifier, the model would learn spurious statistical correlations (e.g. associating low pH with fungal blight simply because of dataset co-occurrence) rather than identifying visual symptomatology.
  - This project does not define an automatic multimodal-fusion layer. Soil, satellite, and zoning context may be shown separately in the UI, but cannot change the image model's inputs or output.

### 5.1.2 REST API Specification

```http
POST /v1/leaf/predict
Content-Type: multipart/form-data
```

**Request Form Data:**
- `file`: Image binary (`image/jpeg` or `image/png`, max $10\text{ MB}$).

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

The example scores are illustrative schema values, not model performance results. Keep all 17 supported classes in the response. Raw scores are not called calibrated probabilities; include confidence/probability wording only if a separate calibration analysis supports it. Do not return treatment advice or an agronomic action based solely on the predicted class.

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
│  STEP 2: HISTORICAL TELEMETRY REPLAY (Field Monitoring, Phase 4 UI)                    │
│  • Replays the attributed Parma tomato trial from 2023; it is not a live farm feed.    │
│  • Soil humidity is source-reported %RH signal, not calibrated VWC or root-zone water. │
│  • Isolation Forest emits unsupervised review candidates, not confirmed sensor faults. │
│  • GRU predicts the %RH signal; the current model loses to persistence at all horizons.│
│  • A separate FAO-56 endpoint requires explicit calibrated VWC/site values; advisory only.│
│  • No KshetraSense zone binding, live gateway, valve, flow inference, or actuation.     │
│                                                                                        │
│  STEP 3: VEGETATION MONITORING (Independent CropSight workflow)                         │
│  • CropSight retains its own circular area and date inputs; its work is not zone-bound.│
│  • NDVI is an exploratory relative vegetation signal, not causal diagnosis or yield.   │
│                                                                                        │
│  STEP 4: TARGETED PLANT PATHOLOGY (Leaf Diagnosis Module)                              │
│  • Operator submits a leaf image independently; no soil/zone/NDVI output is inferred.  │
│  • Captures smartphone photo of symptomatic foliage.                                   │
│  • MobileNetV3-Small is the fixed architecture; latency and score calibration are TBD. │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5.3 Automated Testing & Acceptance Verification Matrix

Before code freeze, the entire repository must satisfy the automated testing gates:

| Scope | Command | Target Pass Criteria |
|---|---|---|
| **Python backend** | From `services/zoning`, `python -m pytest tests -q` | Current suite covers zoning and telemetry contracts; no claim of USDA SHI, live-device, valve, or physical actuation validation. |
| **Frontend unit tests** | `npm test` | Current UI/API tests pass; add Phase 4 replay interaction and Phase 5 image-contract cases when those modules are implemented. |
| **TypeScript typecheck** | `npm run typecheck` | No TypeScript errors. |
| **Production build** | `npm run build` | Build succeeds; existing 3D code-split chunk warning is tracked for performance review, not treated as a clean-bundle claim. |
| **Telemetry model evaluation** | `python -m services.telemetry.train_forecaster` from repository root | Regenerate the chronological split, source hashes, holdout scores, and persistence comparison; report the current GRU as worse than persistence. |

---

## 5.4 Comprehensive Professor Q&A Defense Guide

Use these rigorous mathematical, agronomic, and architectural answers during review:

### Question 1: "Why did you use Fuzzy C-Means (FCM) instead of K-Means or DBSCAN for soil zoning?"
> **Defense Answer:**  
> “Both implemented methods cluster standardized pH, EC, N, P, and K profiles. K-means assigns each cell to one cluster; FCM retains a membership vector for each cell, which can express ambiguity near cluster boundaries. Auto-K uses silhouette as a diagnostic, and a membership is not confidence, crop suitability, or a prescription. We chose to support both so users can compare crisp and fuzzy partitions; we do not claim one method is universally superior or use its output to set input rates.”

---

### Question 2: "How can you justify spatial interpolation with only 5 to 10 soil samples? Why not Kriging?"
> **Defense Answer:**  
> “IDW with fixed power $p=2$ is a transparent deterministic baseline that avoids fitting a variogram from the small number of samples this workflow accepts. The service reports leave-one-out errors and sample distances so users can see limitations. These diagnostics are not validation against dense field truth; sparse samples may miss local variation. Kriging can be evaluated when enough spatial observations support a defensible variogram, but this project does not claim it is impossible or universally unsuitable.”

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
> “This project does not open a valve. The benchmark target is not VWC, and its GRU does not beat the persistence baseline, so it cannot drive an irrigation decision. A separate FAO-56 calculator accepts explicit VWC, field-capacity/wilting-point, rooting-depth, and depletion inputs and returns TAW/RAW plus a human-review advisory. The caller must supply a calibration source, which the software does not independently verify. No delivery volume, actuator state, or physical safety claim is produced.”

---

### Question 6: "Since you don't have physical ESP32 boards on the table today, how is this a valid hardware engineering project?"
> **Defense Answer:**  
> “Phase 3 is a local historical-data replay and model-evaluation service, not hardware-in-the-loop. The source is Belli et al.'s Parma tomato trial, collected in 2023 and published with a 2025 Data in Brief article. Its soil humidity field is `%RH`, battery readings are mostly absent, and the source-meter scale is not independently validated. The software does not implement a gateway receiver, MQTT/LoRaWAN ingestion, energy model, or actuation. A physical deployment would require a separate sensor protocol, calibration, security, safety, and field-validation project.”
