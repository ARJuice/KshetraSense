# Decision 0010: Use ISRIC's public WCS for regional SoilGrids context

**Status:** accepted and implemented  
**Date:** 2026-10-14  
**Scope:** Field Monitoring → Soil Investigation → optional SoilGrids panel

## Context

Decision 0009 correctly removed an invented coordinate formula and left SoilGrids unavailable until a real source could be verified. ISRIC still reports its beta REST API paused, but its official access documentation identifies Web Coverage Service (WCS) as the preferred way to retrieve spatial subsets. The user asked that work continue autonomously, with manual credential/setup tasks such as Earth Engine deferred rather than used to block unrelated functionality.

## Autonomous questions considered and decisions

| Question considered without interrupting the user | Decision |
| --- | --- |
| Should SoilGrids stay unavailable because its beta REST API is paused? | No. Use ISRIC's documented public WCS subset service; it requires no project credentials and returned current GeoTIFF subsets in a live smoke test. Keep outages and no-data explicit. |
| Should the selector be reduced to pH until the whole property list is ready? | No. Keep the eight already-present properties and six standard depths, using the conversion factors ISRIC publishes for each property. Test all mappings. |
| What should the estimate and uncertainty show? | Request the Q0.05, Q0.5 (median), and Q0.95 coverages for the same property/depth/cell. Display Q0.5 as the estimate and preserve all three values. Reject crossed quantiles. |
| How should the requested coordinate map to a value? | Request a small WGS84 subset, read its GeoTIFF scale/tiepoint, and select the pixel containing that coordinate. Do not average nearby pixels or imply within-field resolution. |
| What if the returned pixel is zero or the service fails? | Return HTTP 503 and no estimate. The queried WCS INT16 output exposes masked cells as zero without a usable NoData tag; source VRT metadata uses -32768. Treat zero conservatively as masked rather than risk presenting a mask as soil. |
| Should SoilGrids enrich zoning, Crop Fit, or sample summaries? | No. Keep it as an independently queried regional covariate panel, never a field measurement or automatic input to another module. |

## Implementation

- `services/zoning/app/soilgrids.py` calls the public WCS `GetCoverage` operation with WGS84 subset/output CRSs. It requests only a bounded area around one coordinate and validates content type, download size, raster dimensions before pixel decoding, georeferencing, cell coverage, valid values, and quantile order.
- The eight supported properties use ISRIC's mapped-integer conversion factors and conventional display units:

  | Property | Factor | Returned unit |
  | --- | ---: | --- |
  | pH in water (`phh2o`) | 10 | pH |
  | Total nitrogen (`nitrogen`) | 100 | g/kg |
  | Soil organic carbon (`soc`) | 10 | g/kg |
  | Cation exchange capacity (`cec`) | 10 | cmol(c)/kg |
  | Bulk density (`bdod`) | 100 | kg/dm³ |
  | Clay, sand, and silt | 10 | % |

- The endpoint reports product, property, depth, nominal 250 m resolution, quantiles, retrieval time, source, and modeled-context disclosure. The UI identifies WCS as the live source and handles provider/no-data errors without stale or local fallback values.
- `GET /health` reports that the adapter is configured; it does **not** probe or guarantee current ISRIC uptime. Requests time out and return an explicit provider error when WCS cannot be reached.
- `tifffile` is the only new dependency. No global raster, paid service, user credential, database, or cache is added.

## Consequences and limitations

- This is a nominal 250 m global model cell, not a soil test and not a farm-scale zoning layer. Do not use it to fill the field grid, validate IDW, or determine crop suitability.
- Three WCS subsets are queried per user request. The public endpoint can be slow or unavailable; no result is fabricated during an outage. No cache is used, so retrieval metadata continues to describe each query.
- The WCS output's observed zero-as-mask behavior is conservative. A true zero model value, if one occurs for a supported property/quantile, will be treated as unavailable rather than shown. This favors not misreporting masked land/water as soil data.
- Attribute derived data to ISRIC/SoilGrids under CC BY 4.0, as shown in the result and UI.
- Earth Engine authentication/project setup remains the user's later action for live CropSight; it does not block this public SoilGrids query.

## Validation

- Queried live Q0.5 WCS GeoTIFF subsets for all eight supported properties at a mapped Punjab location; requests returned georeferenced rasters with values and the documented scale conversion was applied.
- Queried live pH Q0.05/Q0.5/Q0.95 coverages and validated the ordered response.
- Automated tests cover all eight unit/scale mappings, requested-cell selection from GeoTIFF georeferencing, oversized-raster rejection before decoding, endpoint response shape, masked data, crossed quantiles, non-GeoTIFF content, and upstream HTTP errors.
- The research note [`soilgrids-wcs-provider-verification.md`](../research/soilgrids-wcs-provider-verification.md) records the first-party source facts and live-check boundary.

## Sources

- [ISRIC SoilGrids WCS](https://docs.isric.org/globaldata/soilgrids/wcs.html) — WCS operations, subset behavior, and CRS parameters.
- [ISRIC WCS from Python](https://docs.isric.org/globaldata/soilgrids/WCS_from_Python.html) — WCS 2.0 coverage requests and GeoTIFF output.
- [ISRIC SoilGrids layers](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html) — properties, mapped units, conversion factors, quantiles, standard depths, and nominal resolution.
- [ISRIC SoilGrids access FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html) — REST beta status, WCS/WebDAV alternatives, scale guidance, and CC BY 4.0 data policy.
