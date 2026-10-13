# Decision 0004: independent Field Monitoring module and direct functional build

**Status:** accepted
**Date:** 2026-10-11

## Decision

Keep Soil Zoning, Crop Fit, and Leaf Diagnosis as separate analytical modules. Add a separate **Field Monitoring** destination with two distinct capabilities: **Soil Investigation** for dated measured-sample records and optional SoilGrids context, and **Vegetation Monitoring** for Sentinel-2/NDVI analysis using the pinned CropSight project as an independent sub-application. CropSight uses its own area-of-interest inputs (center latitude/longitude, radius, and date window); it does not consume or modify KshetraSense zoning, crop-fit, or leaf results. Do not silently combine their data or results.

Use CropSight's existing files as-is for the independent vegetation workflow where they support it. Preserve source provenance and the inspected revision (`05083d810e3df64c8c2f49c0dcf4342a890a1b63`). The inspected revision has no root license file despite its README's MIT claim; this decision records the user's direction to use it for a non-public college project, not a finding that reuse is legally authorized. Do not remove existing notices or claim an MIT grant. If distribution/publication scope changes, stop and review rights before release. Keep the app's own third-party services and credentials isolated from KshetraSense analysis modules.

The initial Field Monitoring outcomes are seasonal NDVI tracking and highlighting relatively underperforming patches for human scouting. These are exploratory vegetation signals, not diagnoses. Variable-rate prescriptions, irrigation decisions, and yield estimation remain future work until supported by the required field-specific data, agronomic rules or crop models, and independent validation. SoilGrids is optional, coarse regional modeled context (250 m), not a field-cell measurement or input to Soil Zoning/Crop Fit.

Replace the earlier mock-data-demo-first milestone with a direct build of functional product slices in the order defined by [Delivery](../DELIVERY.md). There is no presentational mock phase and no canned output presented as a real result. Synthetic data remains allowed for automated tests and benchmark evaluation, clearly separated from user-visible production output. The existing mock UX is superseded; its source files are not deleted as part of this documentation change.

## Consequences

- Field Monitoring may be reached from the KshetraSense shell but retains its own state and data provenance. The CropSight area remains a circle until a separately approved boundary adapter is designed.
- Live CropSight use depends on compatible Earth Engine project configuration and external service availability. Failures must be visible and must not be replaced by sample results.
- The current CropSight source has known code/data-contract limitations. Only outputs and methods whose displayed results are verified may be described as supported; the DBSCAN display path and unvalidated recommendation strings are not evidence of agronomic correctness.
- The detailed product contract belongs in the [PRD](../PRD.md); technical seams in the [TRD](../TRD.md); screen behavior in the [UX specification](../UX-SPEC.md). This decision records the durable boundaries without duplicating those specifications.

## Phase 4 implementation clarification (2026-10-14)

The implemented UI preserves these boundaries: new Soil Investigation sessions start empty, old synthetic seed-preset rows are archived rather than counted as measurements, SoilGrids remains unavailable until a real ISRIC provider is verified, CropSight displays only aggregate values returned by its API (which currently has no raster or spatial-zone output), and historical replay keeps `%RH` forecasts and anomaly candidates explicitly non-operational. The implementation findings and autonomous choices are recorded in [Decision 0009](0009-monitoring-data-provenance-and-provider-readiness.md).

## Alternatives considered

| Option | Decision |
| --- | --- |
| Merge NDVI, SoilGrids, soil zoning, and Crop Fit into a single score or classifier | Rejected: the products have different measurement meanings, resolution, time context, and evidence. |
| Rewrite CropSight as a native KshetraSense pipeline immediately | Not selected for the independent first integration; preserve and use the existing application where it works. Add a separate boundary-linked adapter only after an explicit scope decision. |
| Build a visual mock before functional services | Rejected: user requested direct functional implementation. Design exploration may inform implementation, but fake outputs are not a product phase. |
