# KshetraSense Engineering & Redesign Master Plan

**Status:** Approved five-phase architecture; Phases 1–5 core implementations are complete. All 99 backend tests and 64 frontend tests pass. The filtered PlantVillage test reached 92.97% accuracy and 93.52% macro-F1 on 4,653 images. Field-photo performance and PlantDoc external evaluation remain open. CropSight's live Earth Engine path was smoke-tested successfully in the local environment; other machines need their own authorized project and authentication. Provider failures never produce substitute output.
**Target Goal:** Build a defense-ready, evidence-bounded Precision Agriculture Decision-Support System. The current plan demonstrates sensing, analysis, and human review; it does not claim a deployed closed-loop actuator system:

$$\textbf{Soil (Sparse Lab Cores)} \longrightarrow \textbf{Zone (Spatial ML)} \longrightarrow \textbf{Review (Independent Monitoring Evidence)}$$

---

## Detailed Phase Documentation Index

| Phase | Title | File | Primary Focus |
|---|---|---|---|
| **Phase 1 — complete** | **Backend Algorithmic Core** | [`phase-1-backend-algorithmic-core.md`](phase-1-backend-algorithmic-core.md) | GeoJSON-to-UTM field grid, IDW $p=2$, project-defined KshetraSense SHI, Auto-K silhouette sweep, multivariate adjacent-cluster merge, disconnected-component split, sample-perturbation ARI, and suggested WSN/gateway coordinates. |
| **Phase 2 — complete** | **Soil Zoning UI Redesign** | [`phase-2-soil-zoning-ui-redesign.md`](phase-2-soil-zoning-ui-redesign.md) | Boundary/sample entry, `/v2/zoning/run`, returned layer/zone/diagnostic inspection, selected-cell/zone Crop Fit, and actual-response JSON export. |
| **Phase 3 — complete** | **Historical Telemetry Replay & Soil-Signal Forecast** | [`phase-3-wsn-telemetry-service.md`](phase-3-wsn-telemetry-service.md) | Provenance-checked Parma trial API, `%RH` soil-signal GRU with disclosed failure to beat persistence, anomaly review candidates, and a separate calibrated-VWC-only FAO-56 advisory; no zone binding or actuation. |
| **Phase 4 — complete** | **Field Monitoring UI Transformation** | [`phase-4-field-monitoring-transformation.md`](phase-4-field-monitoring-transformation.md) | Empty-by-default Soil Investigation, real nominal-250 m ISRIC WCS context, clearly attributed historical replay, and an independent CropSight aggregate-response interface; SoilGrids and CropSight were live-smoke-tested locally. Per-machine Earth Engine access is still required. No coordinate-derived SoilGrids values or synthetic zones. |
| **Phase 5 — implemented; external validation open** | **Leaf Contract, Verification & Defense** | [`phase-5-leaf-contract-and-verification.md`](phase-5-leaf-contract-and-verification.md) | Image-only MobileNetV3-Small training, model artifact and metadata, `/v1/leaf/predict`, upload UI, automated contract tests, held-out PlantVillage evaluation, and defense guide. Manual review is required for every result; no field-photo or PlantDoc performance is claimed. |

---

## Architecture Blueprint & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      MODULE 1: SOIL ZONING (Pre-Season Planning)                       │
│  Input: GeoJSON Farm Boundary + 3–50 Georeferenced Lab Samples (5–10 recommended)      │
│  Pipeline: IDW Interpolation ➔ KshetraSense SHI ➔ Auto-K* K-Means/FCM ➔ Zone Postprocess│
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                              The Phase 2 workspace submits a versioned request and displays its returned JSON result:
                              • Interpolated estimates and contiguous zone polygons
                              • Zone profiles, SHI components, Auto-K and stability diagnostics
                              • Exact WGS84-clipped cell footprints for consistent 2D/3D rendering
                              • Suggested medoid/gateway candidates (radio coverage unvalidated)
                              Results are request-local; persistence and Monitoring hand-off are not implemented
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               MODULE 2: FIELD MONITORING (Independent Evidence Workflows)               │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Tab A: Historical Telemetry Replay (not live, not this user's farm)              │  │
│  │ • Parma tomato research dataset (2023): 3 treatment lines + shared air sensor    │  │
│  │ • GRU forecasts soil humidity sensor signal (%RH), not calibrated VWC            │  │
│  │ • Isolation Forest flags unsupervised review candidates, not confirmed faults    │  │
│  │ • Separate FAO-56 MAD endpoint requires explicit calibrated VWC/site parameters  │  │
│  │ • No zone mapping, live gateway, flow estimate, or valve actuation               │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Tab B: Soil Investigation (manual/CSV samples + separate ISRIC WCS context)     │  │
│  │ Tab C: Independent CropSight workflow: circular AOI + date window                │  │
│  │ • Current endpoint returns aggregate NDVI statistics/time series, not a raster  │  │
│  │ • No pixel labels, zone polygons, per-zone output, or implicit module join       │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│              MODULE 3: LEAF DIAGNOSIS (independent image-only workflow)                │
│  • `POST /v1/leaf/predict`: bounded JPEG/PNG upload; raw image pixels only             │
│  • Fine-tuned MobileNetV3-Small, route, versioned weights, and upload UI are built      │
│  • Test split: 92.97% accuracy / 93.52% macro-F1; scores are uncalibrated              │
│  • Every output needs manual review; field-photo and PlantDoc results are unmeasured   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

Phase 2 is the completed zoning browser workflow: the user supplies a WGS84 GeoJSON boundary and measured samples; there is no implicit demo field or fabricated analysis. Ten explicitly labeled synthetic boundary/sample pairs are available for deliberate demonstrations and parser validation. The accessible 2D map is the complete default, while a lazily loaded 3D view is optional and capped by both cell count and estimated scene triangles. Crop Fit is a selected-cell/zone factor-reference report, not a crop-level verdict; zone values are the field service's area-weighted means of IDW cell estimates. Auto-K automatically chooses final K using the silhouette sweep; the current UI fixes the maximum tested K at 6. Phase 3 provides a provenance-checked historical telemetry API and Phase 4 adds its replay UI. The benchmark does not imply live hardware or couple the Parma research lines to a KshetraSense field. The current GRU is experimental and did not beat persistence at any horizon. Soil Investigation starts with no sample presets; historical synthetic rows are archived. SoilGrids retrieves ISRIC WCS quantiles for the requested nominal-250 m cell; it is contextual and never an automatic zoning/crop-fit input. CropSight displays only outputs actually returned by its API; because the response has no raster or zone geometry, the UI does not claim spatial zoning from NDVI. Phase 5 implements a separate image-only 17-class Leaf Diagnosis workflow. Its filtered PlantVillage test result is 92.97% accuracy and 93.52% macro-F1; every result requires manual review, and PlantDoc/field-photo performance has not been measured. See [Decision 0009](../decisions/0009-monitoring-data-provenance-and-provider-readiness.md), [Decision 0010](../decisions/0010-soilgrids-wcs-context-adapter.md), and [Decision 0011](../decisions/0011-crop-reference-report-and-autok.md).
