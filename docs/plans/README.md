# KshetraSense Engineering & Redesign Master Plan

**Status:** Approved Architectural Blueprint  
**Target Goal:** Transform KshetraSense into an authentic, defense-ready Precision Agriculture Decision-Support System aligning with the Phase 1 Algorithm paper and closed-loop IoT thesis:

$$\textbf{Soil (Sparse Lab Cores)} \longrightarrow \textbf{Zone (Spatial ML)} \longrightarrow \textbf{Sense (WSN Telemetry)} \longrightarrow \textbf{Decide (Edge AI)} \longrightarrow \textbf{Act (Precision Irrigation)}$$

---

## Detailed Phase Documentation Index

| Phase | Title | File | Primary Focus |
|---|---|---|---|
| **Phase 1** | **Backend Algorithmic Core** | [`phase-1-backend-algorithmic-core.md`](phase-1-backend-algorithmic-core.md) | GeoJSON boundary clipping, IDW spatial interpolation ($p=2$), USDA Soil Health Index (SHI), Auto-$K^*$ Silhouette sweep, adjacency-aware zone merging, perturbation stability (ARI), WSN medoids & Gateway placement. |
| **Phase 2** | **Soil Zoning UI Redesign** | [`phase-2-soil-zoning-ui-redesign.md`](phase-2-soil-zoning-ui-redesign.md) | Replacement of synthetic grid painting, field boundary selector (3 benchmark presets + GeoJSON), interactive 5–10 sample pinning, continuous interpolated heatmaps, optimal $K^*$ charts, 3D WSN node markers, and `ZoningDeploymentPlan` export. |
| **Phase 3** | **WSN Telemetry Service & Edge AI** | [`phase-3-wsn-telemetry-service.md`](phase-3-wsn-telemetry-service.md) | Belli et al. (2022) LoRaWAN tomato dataset integration, multi-node streaming/playback API, 2-layer GRU 12h soil moisture forecasting, FAO-56 Management Allowed Depletion (MAD) actuation, Isolation Forest anomaly detection. |
| **Phase 4** | **Field Monitoring UI Transformation** | [`phase-4-field-monitoring-transformation.md`](phase-4-field-monitoring-transformation.md) | Replacement of manual CRUD forms with the WSN Telemetry Operations Console, playback scrubber (1x/10x/60x), real-time node dials, 24h trend chart with 12h GRU forecast, solenoid valve lamp + flow meter, CropSight satellite canopy corroboration. |
| **Phase 5** | **Leaf Contract, Verification & Defense** | [`phase-5-leaf-contract-and-verification.md`](phase-5-leaf-contract-and-verification.md) | Frozen 17-class MobileNetV3-Small REST API contract (raw pixels only), end-to-end precision farming demonstration narrative, automated test suite criteria, and professor Q&A defense cheat sheet with mathematical proofs. |

---

## Architecture Blueprint & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      MODULE 1: SOIL ZONING (Pre-Season Planning)                       │
│  Input: GeoJSON Farm Boundary + 5–10 Georeferenced Lab Samples (pH, EC, N, P, K)       │
│  Pipeline: IDW Interpolation ➔ USDA SHI ➔ Auto-K* FCM ➔ Adjacency Merging              │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                              Exports immutable artifact:
                              ZoningDeploymentPlan
                              • Zone Polygons & Profiles (SHI, pH, NPK, EC)
                              • WSN Node Coordinates (Zone Medoids)
                              • Cluster Head / LoRa Gateway Position
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   MODULE 2: FIELD MONITORING (Seasonal Operations)                     │
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
│                MODULE 3: LEAF DIAGNOSIS (Targeted Plant Pathology)                     │
│  • Handheld mobile photo of symptomatic foliage in depleted/low-vigor zone             │
│  • Lightweight MobileNetV3-Small on-device classification (<30ms latency)              │
│  • Consumes raw pixels ONLY — strictly isolated from soil/satellite features           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
