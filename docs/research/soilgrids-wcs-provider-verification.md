# SoilGrids WCS provider verification

**Provider-status check:** 2026-10-14  
**Scope:** Primary-source verification for the in-progress SoilGrids adapter. This note separates provider documentation from live endpoint observations; a smoke test is not an uptime guarantee.

## Access route and WCS request

ISRIC says SoilGrids maps are available through OGC Web Coverage Service (WCS), and recommends WCS for obtaining spatial subsets for use in other modelling pipelines. The property-specific endpoint pattern is `https://maps.isric.org/mapserv?map=/map/<property>.map`. WCS has `GetCapabilities` (discover coverages and service metadata), `DescribeCoverage` (inspect one coverage), and `GetCoverage` (retrieve a subset). [ISRIC WCS guide](https://docs.isric.org/globaldata/soilgrids/wcs.html) describes these operations; the [OGC WCS 2.0 Interface Standard](https://docs.ogc.org/is/09-110r3/09-110r3.pdf) defines the coverage-service core.

For WCS 2.0.1, ISRIC's documented `GetCoverage` request uses `COVERAGEID`, `FORMAT`, two `SUBSET` dimensions, and optional `SUBSETTINGCRS` and `OUTPUTCRS`. ISRIC's example uses its native Homolosine CRS identifier `http://www.opengis.net/def/crs/EPSG/0/152160`. That is a pseudo-EPSG identifier—EPSG did not assign a code to this projection. ISRIC also documents EPSG:4326 as an alternative WCS SRS. Use the CRS and axis labels together; a live `Lat`/`Long` EPSG:4326 request is recorded below. [WCS request example](https://docs.isric.org/globaldata/soilgrids/wcs.html), [ISRIC projection/CRS FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html).

Coverage IDs use the pattern `{property}_{depth interval}_{statistic}`, for example `nitrogen_5-15cm_Q0.5`; the six standard intervals are `0-5cm`, `5-15cm`, `15-30cm`, `30-60cm`, `60-100cm`, and `100-200cm`. The median is named `Q0.5` in WCS coverage IDs (equivalent to the documentation's `Q0.50`). [ISRIC coverage naming, depths, and quantiles](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html).

## Resolution, supported properties, and value scaling

SoilGrids 2.0 is a global digital soil-mapping product at **250 m spatial resolution**, with six depth intervals. It is a modeled regional background layer, not a measurement of an individual field or a substitute for local samples. ISRIC says results are best suited to continental or macro-region analyses and explicitly advises against local/farm-level use. It reports model variation explained of about 30–70%, depending on the property and context. [Overview](https://docs.isric.org/globaldata/soilgrids/index.html), [accuracy FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html), [scale limitation](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html).

ISRIC stores mapped values as integers. To get the conventional units below, **divide the mapped value by the conversion factor**. The first eight rows are the current adapter's property subset; the remaining rows are other properties listed by ISRIC, not enabled by this adapter.

| Code | Property | Mapped unit | Divide by | Conventional unit |
| --- | --- | --- | ---: | --- |
| `bdod` | Bulk density | cg/cm³ | 100 | kg/dm³ |
| `cec` | CEC buffered at pH 7 | mmol(c)/kg | 10 | cmol(c)/kg |
| `clay` | Clay | g/kg | 10 | g/100g (%) |
| `nitrogen` | Total nitrogen | cg/kg | 100 | g/kg |
| `phh2o` | pH in water | pH × 10 | 10 | pH |
| `sand` | Sand | g/kg | 10 | g/100g (%) |
| `silt` | Silt | g/kg | 10 | g/100g (%) |
| `soc` | Soil organic carbon | dg/kg | 10 | g/kg |
| `cfvo` | Coarse fragments | cm³/dm³ (vol‰) | 10 | cm³/100cm³ (vol%) |
| `ocd` | Organic carbon density | hg/m³ | 10 | kg/m³ |
| `ocs` | Organic carbon stocks | t/ha | 10 | kg/m² |
| `wv0010` | Volumetric water content at 10 kPa | 10⁻³ cm³/cm³ | 10 | 10⁻² cm³/cm³ (%) |
| `wv003` | Volumetric water content at 33 kPa | 10⁻³ cm³/cm³ | 10 | 10⁻² cm³/cm³ (%) |
| `wv1500` | Volumetric water content at 1500 kPa | 10⁻³ cm³/cm³ | 10 | 10⁻² cm³/cm³ (%) |

These factors and unit labels are transcribed from ISRIC's [SoilGrids layer table](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html); do not infer units from a property name or display the raw integer as a conventional value.

## Prediction summaries and uncertainty

For each property and standard depth, ISRIC documents `Q0.05`, `Q0.50` (median), `mean`, and `Q0.95`. `Q0.05` to `Q0.95` is the stated 90% prediction interval. The mean and median are distinct summaries: ISRIC describes the mean as the expected value and notes that it can differ from the median for skewed distributions. A response should identify which statistic it displays and should not label a modeled prediction as a measured value. The separate `uncertainty` coverage is the scaled ratio `(Q0.95 - Q0.05) / Q0.50 × 10`; it is not another soil-property value. [ISRIC quantile and uncertainty definitions](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html).

## License and attribution

ISRIC makes the SoilGrids maps available under **CC BY 4.0**. Attribute the source and cite the SoilGrids 2.0 paper as ISRIC requests: Poggio et al. (2021), “SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty,” *SOIL* 7, 217–240. [ISRIC reuse/citation FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html), [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/).

## REST beta status and provider limitations

On the provider-status check date above, ISRIC's access page stated that the REST API was temporarily paused due to issues, with no restoration estimate; the same notice calls it an actively developed beta service without an uptime or support guarantee. ISRIC identifies WCS as the preferred route for map subsets and lists WebDAV as a way to obtain global VRT maps. The access page itself says it was last updated 2025-12-18, so treat the status as what the provider page stated when checked, not a live service-level guarantee. [ISRIC access/status page](https://docs.isric.org/globaldata/soilgrids/index.html#data-access).

ISRIC further notes that SoilGrids is assembled from available soil-profile observations and environmental covariates, has spatially uneven input coverage, and can have property-specific missing tiles. It says the product has no single reference year because it uses the available WoSIS data (and some source data that cannot be shared due to licensing). These are additional reasons to disclose provenance and avoid implying parcel-scale or current-season measurements. [Accuracy FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html), [provider FAQ](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html).

## Live smoke-test observations (2026-10-14)

These are observations from read-only requests to ISRIC's public service, not claims made by the documentation:

- `GetCapabilities` returned HTTP 200 for all eight adapter properties: `phh2o`, `nitrogen`, `soc`, `cec`, `bdod`, `clay`, `sand`, and `silt`. Each response listed 30 coverages and included the matching `{property}_0-5cm_Q0.5` ID. For `phh2o`, the live list also showed `Q0.05`, `Q0.95`, `mean`, and `uncertainty` for the topsoil depth. This is 5 coverage layers × 6 depths; the WCS guide's generic “typically 24” description counts the four prediction summaries, while the currently observed service also exposes the uncertainty layer.
- A `phh2o_0-5cm_Q0.5` `GetCoverage` request for a small Bengaluru-area extent, with `SUBSETTINGCRS` and `OUTPUTCRS` set to EPSG:4326 and `Lat`/`Long` subsets, returned HTTP 200, `image/tiff`, 612 bytes, and a TIFF signature. This verifies that this specific geographic subset request worked at test time; it does not validate raster values, georeferencing, no-data handling, or long-term availability.
- A point request to the REST endpoint did not complete within a 12-second client timeout. That timeout alone does not establish the REST service's status; the paused status above comes from the provider's access notice.

No data were persisted by these checks.

## Follow-up adapter verification

The smoke test above only establishes that the documented subset request returned a TIFF; it does not establish correct pixel selection or value decoding. Those were checked separately during implementation: [Decision 0010](../decisions/0010-soilgrids-wcs-context-adapter.md) records live cell/quantile and eight-property conversion checks plus automated GeoTIFF parsing, bounds, and failure tests. Neither the smoke test nor the adapter tests guarantee future WCS availability.
