# KshetraSense

Terms used to distinguish the project's soil, crop, image, and field-observation concepts.

## Field Monitoring

**Field Monitoring**:
The part of KshetraSense that records soil investigations and explores satellite-derived vegetation patterns. Its outputs remain separate from Soil Zoning, Crop Fit, and Leaf Diagnosis.
_Avoid_: Combined farm score

**Soil sample**:
A dated, located set of soil measurements collected by a field method or laboratory, with units and sampling context.
_Avoid_: SoilGrids value, sensor reading (unless actually measured by a sensor)

**SoilGrids context**:
A coarse-resolution modeled estimate of soil properties for regional reference, not a measurement of a particular field cell.
_Avoid_: Soil test, field measurement

**Vegetation zone**:
A spatial grouping based on satellite-derived vegetation observations for an area and time window; it describes relative image patterns, not their cause.
_Avoid_: Soil zone, treatment prescription

**NDVI**:
A satellite-derived vegetation index computed from red and near-infrared reflectance, used here as an exploratory indicator of relative vegetation patterns.
_Avoid_: Soil fertility, crop-health diagnosis, yield
