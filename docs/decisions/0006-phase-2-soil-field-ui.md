# Decision 0006: Phase 2 soil-field UI and data contract

**Status:** accepted
**Date:** 2026-10-14

## Context

The new field-scale API starts from a real boundary and sparse laboratory samples, not the old synthetic painting grid. Phase 2 must present that workflow without inventing farm data, misrepresenting clipped edge cells, or making WebGL a prerequisite.

## Autonomous decisions

- Do not ship a visible synthetic farm preset. Start with a clear empty state; accept a GeoJSON Polygon/Polygon Feature and allow manual sample placement or a documented CSV import. Sample measurements and depth stay blank until the user supplies them.
- Add each cell's exact boundary-clipped WGS84 footprint to the `/v2` response. Both 2D SVG and 3D rendering use this same returned geometry, so edge cells and holes are not drawn outside the analyzed field. The response remains request-local and exportable; it is not persisted.
- The 2D map is the default and complete accessible workflow. The optional React Three Fiber view uses one batched procedural surface mesh, no per-cell Three.js objects, and can be disabled when WebGL is unavailable or slow.
- The optional 3D view is limited to 768 cells and a conservative 20,000-triangle scene estimate, including a 1,300-triangle reserve for markers and selection. Larger or more detailed results keep their complete 2D view.
- Cell and zone inspection, including the existing independent Apple/Tomato/Potato Crop Fit checks, stays inside Soil Zoning. Crop Fit receives the exact selected cell values or zone means, never SHI, memberships, or a crop probability.
- The user confirmed that SHI should be used; display it as the project's provisional soil-screening layer, never as an official USDA index, crop-fit input, or probability.
- Input edits preserve the prior result and mark it stale. Only a successful analysis replaces that immutable result. JSON export downloads the actual API response.
- No Google Earth Engine credentials, map tiles, paid provider, or external imagery are needed for Phase 2. Provider linking remains a later manual setup for Vegetation Monitoring.

## Verification seams

- Boundary import and point-in-polygon placement: `parseFieldBoundary`, local map projection, and `isPointInsideFieldBoundary`.
- CSV/manual samples to API payload: `parseSoilSampleCsv` and `buildFieldZoningRequest`.
- Service boundary: `/v2/zoning/run` and `/v1/crop-fit/evaluate`, tested as explicit HTTP contracts.
- Rendering fidelity: both map modes consume the same response cell footprints, selected IDs, layer values, and zone IDs; geometry-derived triangle estimates gate the optional 3D view.

These decisions are implementation defaults, not a request for additional user input. They can be revisited only if field-validation or profiling evidence warrants it.
