# Architecture Decision Records (ADRs)

This directory documents key architectural decisions taken during the design and implementation of **KshetraSense**, recording context, rationale, evidence, and consequences.

---

## Decision Index

| ADR | Title | Status | Date | Core Summary |
|---|---|---|---|---|
| [**0001**](0001-functional-field-and-assets.md) | **Functional Field and 3D Assets** | Accepted | 2026-10-06 | Adopted procedural Three.js / React Three Fiber data geometry paired with an accessible 2D SVG default. Zero external 3D model files bundled. |
| [**0002**](0002-mock-data-demo-first.md) | **Desktop Mock-Data Field Demo** | Superseded | 2026-10-07 | Early mock-first prototype milestone; superseded by ADR 0004 (direct functional build). |
| *0003* | *Decorative Kenney Assets* | Retired | — | Removed; superseded by ADR 0001's pure procedural Three.js data geometry policy. |
| [**0004**](0004-field-monitoring-and-direct-build.md) | **Independent Field Monitoring & Direct Build** | Accepted | 2026-10-11 | Established strict decoupling between Soil Zoning, Crop Fit, Leaf Diagnosis, and Field Monitoring. Mandated real functional slices rather than placeholder UI. |
| [**0005**](0005-phase-1-zoning-scientific-contracts.md) | **Phase 1 Soil Zoning Scientific Contracts** | Accepted | 2026-10-12 | Defined UTM grid discretization, IDW $p=2$, sigmoidal KshetraSense SHI, Auto-K silhouette selection, adjacent merge, component split, and ARI perturbation. |
| [**0006**](0006-phase-2-soil-field-ui.md) | **Phase 2 Soil Field UI** | Accepted | 2026-10-13 | Defined boundary-and-sample entry, clipped-cell GeoJSON rendering, stale-state preservation, and selected-cell/zone Crop Fit evaluation. |
| [**0007**](0007-phase-3-telemetry-evidence-and-boundaries.md) | **Phase 3 Telemetry Evidence & Boundaries** | Accepted | 2026-10-13 | Governed pinned 2023 Parma trial replay, `%RH` sensor-signal semantics (not VWC), and separate FAO-56 MAD water balance screening. |
| [**0008**](0008-gru-holdout-quality-and-use.md) | **GRU Holdout Quality and Educational Use** | Accepted | 2026-10-14 | Documented the experimental GRU's failure to beat persistence baseline (+6h, +12h, +24h), prohibiting operational use for irrigation actuation. |
| [**0009**](0009-monitoring-data-provenance-and-provider-readiness.md) | **Monitoring Data Provenance & Provider Readiness** | Accepted | 2026-10-14 | Mandated empty-by-default Soil Investigation, archived legacy synthetic rows, and enforced truthful provider error surfacing. |
| [**0010**](0010-soilgrids-wcs-context-adapter.md) | **SoilGrids WCS Context Adapter** | Accepted | 2026-10-14 | Implemented public ISRIC Web Coverage Service (WCS) GeoTIFF adapter (nominal 250 m resolution, Q0.05/Q0.50/Q0.95), completely isolated from zoning. |
| [**0011**](0011-crop-reference-report-and-autok.md) | **Crop Reference Report & Auto-K** | Accepted | 2026-10-14 | Fixed Auto-K ceiling at $K=6$; removed arbitrary suitability scoring in favor of neutral factor-by-factor agronomic reference comparisons. |
| [**0012**](0012-karnataka-crop-reference-catalog.md) | **Karnataka Crop Reference Catalog** | Accepted | 2026-10-14 | Grounded crop reference intervals in UAS Bengaluru / ICAR regional data for Finger Millet (Ragi), Tomato, and Groundnut; applied uniform -0.10 pH demo offset. |
