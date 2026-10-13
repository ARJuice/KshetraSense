# KshetraSense Engineering & Redesign Master Plan

**Status:** Approved five-phase architecture; Phases 1–4 implemented and verified on 2026-10-14. Phase 5 leaf contract/verification remains planned. Earth Engine credentials and a real SoilGrids provider are external setup/integration gates, not reasons to fabricate output.
**Target Goal:** Build a defense-ready, evidence-bounded Precision Agriculture Decision-Support System. The current plan demonstrates sensing, analysis, and human review; it does not claim a deployed closed-loop actuator system:

$$\textbf{Soil (Sparse Lab Cores)} \longrightarrow \textbf{Zone (Spatial ML)} \longrightarrow \textbf{Review (Independent Monitoring Evidence)}$$

---

## Detailed Phase Documentation Index

| Phase | Title | File | Primary Focus |
|---|---|---|---|
| **Phase 1 — complete** | **Backend Algorithmic Core** | [`phase-1-backend-algorithmic-core.md`](phase-1-backend-algorithmic-core.md) | GeoJSON-to-UTM field grid, IDW $p=2$, project-defined KshetraSense SHI, Auto-K silhouette sweep, multivariate adjacent-cluster merge, disconnected-component split, sample-perturbation ARI, and suggested WSN/gateway coordinates. |
| **Phase 2 — complete** | **Soil Zoning UI Redesign** | [`phase-2-soil-zoning-ui-redesign.md`](phase-2-soil-zoning-ui-redesign.md) | Boundary/sample entry, `/v2/zoning/run`, returned layer/zone/diagnostic inspection, selected-cell/zone Crop Fit, and actual-response JSON export. |
| **Phase 3 — complete** | **Historical Telemetry Replay & Soil-Signal Forecast** | [`phase-3-wsn-telemetry-service.md`](phase-3-wsn-telemetry-service.md) | Provenance-checked Parma trial API, `%RH` soil-signal GRU with disclosed failure to beat persistence, anomaly review candidates, and a separate calibrated-VWC-only FAO-56 advisory; no zone binding or actuation. |
| **Phase 4 — complete** | **Field Monitoring UI Transformation** | [`phase-4-field-monitoring-transformation.md`](phase-4-field-monitoring-transformation.md) | Empty-by-default Soil Investigation, clearly attributed historical replay, and independent live CropSight aggregate analysis; no fake SoilGrids values or synthetic zones. Earth Engine setup remains a later manual action. |
| **Phase 5 — planned** | **Leaf Contract, Verification & Defense** | [`phase-5-leaf-contract-and-verification.md`](phase-5-leaf-contract-and-verification.md) | MobileNetV3-Small 17-class image contract, end-to-end verification, demonstration narrative, and academic defense materials. |

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
│  │ Tab B: Soil Investigation (manual/CSV samples; SoilGrids currently unavailable)  │  │
│  │ Tab C: Independent CropSight workflow: circular AOI + date window                │  │
│  │ • Current endpoint returns aggregate NDVI statistics/time series, not a raster  │  │
│  │ • No pixel labels, zone polygons, per-zone output, or implicit module join       │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             MODULE 3: LEAF DIAGNOSIS (Planned Targeted Plant Pathology)                 │
│  • Handheld mobile photo of symptomatic foliage in depleted/low-vigor zone             │
│  • Lightweight MobileNetV3-Small on-device classification (<30ms latency)              │
│  • Consumes raw pixels ONLY — strictly isolated from soil/satellite features           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

Phase 2 is the completed zoning browser workflow: the user supplies a WGS84 GeoJSON boundary and measured samples; there is no preloaded practice farm or fabricated result. The accessible 2D map is the complete default, while a lazily loaded 3D view is optional and capped by both cell count and estimated scene triangles. Crop Fit is contextual to a selected returned cell or zone and remains a separate rules evaluation. Phase 3 provides a provenance-checked historical telemetry API and Phase 4 adds its replay UI. The benchmark does not imply live hardware or couple the Parma research lines to a KshetraSense field. The current GRU is experimental and did not beat persistence at any horizon. Soil Investigation starts with no sample presets; historical synthetic rows are archived. SoilGrids stays unavailable until a real ISRIC WCS/WebDAV-backed provider is verified. CropSight displays only outputs actually returned by its API; because the response has no raster or zone geometry, the UI does not claim spatial zoning from NDVI. See [Decision 0009](../decisions/0009-monitoring-data-provenance-and-provider-readiness.md).
