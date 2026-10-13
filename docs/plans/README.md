# KshetraSense Engineering & Redesign Master Plan

**Status:** Approved five-phase architecture; Phase 1 implemented and verified on 2026-10-14. Phases 2–5 are planned, not complete.
**Target Goal:** Transform KshetraSense into an authentic, defense-ready Precision Agriculture Decision-Support System aligning with the Phase 1 Algorithm paper and closed-loop IoT thesis:

$$\textbf{Soil (Sparse Lab Cores)} \longrightarrow \textbf{Zone (Spatial ML)} \longrightarrow \textbf{Sense (WSN Telemetry)} \longrightarrow \textbf{Decide (Edge AI)} \longrightarrow \textbf{Act (Precision Irrigation)}$$

---

## Detailed Phase Documentation Index

| Phase | Title | File | Primary Focus |
|---|---|---|---|
| **Phase 1 — complete** | **Backend Algorithmic Core** | [`phase-1-backend-algorithmic-core.md`](phase-1-backend-algorithmic-core.md) | GeoJSON-to-UTM field grid, IDW $p=2$, project-defined KshetraSense SHI, Auto-K silhouette sweep, multivariate adjacent-cluster merge, disconnected-component split, sample-perturbation ARI, and suggested WSN/gateway coordinates. |
| **Phase 2 — planned** | **Soil Zoning UI Redesign** | [`phase-2-soil-zoning-ui-redesign.md`](phase-2-soil-zoning-ui-redesign.md) | Replace grid painting with boundary/sample entry, call `/v2/zoning/run`, inspect returned continuous layers/zones/diagnostics, and export a clearly labeled analysis result. |
| **Phase 3 — planned** | **WSN Telemetry Service & Edge AI** | [`phase-3-wsn-telemetry-service.md`](phase-3-wsn-telemetry-service.md) | Verify the Belli et al. dataset and playback contract before implementing telemetry replay, GRU moisture forecasting, FAO-56 MAD decision logic, and anomaly filtering. |
| **Phase 4 — planned** | **Field Monitoring UI Transformation** | [`phase-4-field-monitoring-transformation.md`](phase-4-field-monitoring-transformation.md) | Monitoring workflow and evidence presentation for telemetry and independent CropSight vegetation data; provider credentials remain a later manual setup. |
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
                              Phase 1 currently returns a versioned JSON result:
                              • Interpolated estimates and contiguous zone polygons
                              • Zone profiles, SHI components, Auto-K and stability diagnostics
                              • Suggested medoid/gateway candidates (radio coverage unvalidated)
                              Persistence and a hand-off to Monitoring are not implemented yet
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│              MODULE 2: FIELD MONITORING (Planned Seasonal Operations)                   │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Tab A: WSN Telemetry Console (Sense ➔ Decide ➔ Act)                              │  │
│  │ • Replays Belli et al. (2022) LoRaWAN Telemetry across Zone Medoids              │  │
│  │ • Edge AI: 2-Layer GRU predicts Root-Zone Soil Moisture (+12h)                   │  │
│  │ • FAO-56 Decision Law: Opens Solenoid Valve when Moisture ≤ Critical MAD (24.8%) │  │
│  │ • Isolation Forest Anomaly Detection: Suppresses false irrigation on sensor fault│  │
│  │ • Closed-Loop Feedback: Verifies post-irrigation moisture replenishment          │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Tab B: Vegetation Monitoring (CropSight Satellite View)                          │  │
│  │ • Sentinel-2 L2A Cloud-Masked NDVI raster clipped to farm boundary               │  │
│  │ • Macro-Micro Corroboration: Aligns space canopy vigor with ground telemetry     │  │
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
