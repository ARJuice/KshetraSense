# Soil zoning demo inputs

These ten paired GeoJSON/CSV bundles are **synthetic software-test and demonstration data**. They do not describe real farms, cadastral parcels, laboratory reports, or agronomic recommendations. Coordinates are illustrative points near Bengaluru; they were chosen for mapping tests and must not be treated as a real property boundary. Sample dates and uncertainty values are illustrative as well.

Each pair contains a closed WGS84 GeoJSON Polygon and five complete, co-located-in-boundary topsoil sample records. Every CSV has pH, generic EC, N, P, K, a common `0-15` depth label, a past ISO collection date, a method disclaimer, and illustrative standard-uncertainty columns. “Synthetic method unspecified” is not a laboratory method. The current field-zoning contract accepts only pH, EC, N, P, and K; it does not accept moisture or soil temperature.

| Pair | Demonstration contrast | Collection date |
| --- | --- | --- |
| `balanced-reference` | Moderate mixed values around common pH context | 2026-06-15 |
| `acidic-low-nutrients` | Lower pH and lower nutrient values | 2026-04-12 |
| `alkaline-high-phosphorus` | Higher pH and higher P values | 2025-12-18 |
| `salinity-gradient` | Spatial EC contrast with otherwise varied values | 2026-05-21 |
| `low-nitrogen` | Low illustrative N values | 2026-01-30 |
| `low-phosphorus` | Low illustrative P values | 2026-03-03 |
| `low-potassium` | Low illustrative K values | 2025-11-06 |
| `high-nutrient-mixed-ec` | Higher nutrient values with a mixed EC profile | 2026-02-17 |
| `contrasting-ph-patches` | Low-to-high pH contrast across sample points | 2026-07-07 |
| `mixed-nutrient-field` | Contrasting nutrient and EC patterns | 2026-08-22 |

## Load a pair

1. In Soil Zoning, upload the matching `.geojson` boundary.
2. Import its paired `.csv` sample file.
3. Inspect the sample provenance and run the field analysis. The resulting cells are IDW estimates from these synthetic samples, not observations.
4. Select a cell or zone and build the Crop Fit reference report. A zone displays the area-weighted mean of its returned IDW-estimated cells.

The samples intentionally span different pH/EC/N/P/K patterns so the workflow can be exercised. They are not validated to make a crop suitable or unsuitable. Crop Fit reports values and limited source context; it does not decide what should be planted.
