# KshetraSense

Terms used to distinguish the project's soil, crop, image, and field-observation concepts.

## Field Monitoring

**Field Monitoring**:
The part of KshetraSense that records soil investigations, replays an attributed historical telemetry benchmark, and explores satellite-derived vegetation patterns. These outputs remain separate from Soil Zoning, Crop Fit, and Leaf Diagnosis.
_Avoid_: Combined farm score

**Historical telemetry replay**:
A controlled playback of dated observations from a documented research trial. It is not a live connection, a measurement from the user's farm, or a zoning input.
_Avoid_: Live sensor feed, farm telemetry

**Soil humidity signal (`%RH`)**:
The unit reported by the Parma trial's soil sensor. It is a sensor signal, not volumetric water content (VWC), and must not be converted to a water-balance input without a validated calibration.
_Avoid_: Soil moisture VWC, root-zone water content

**Persistence baseline**:
A time-series forecast baseline that predicts each future target as the latest observed value. It is used to check whether a more complex model adds predictive value.
_Avoid_: No-change irrigation recommendation

**Anomaly review candidate**:
An observation flagged as unusual by an unsupervised model. It is a prompt for human inspection, not a confirmed fault or probability.
_Avoid_: Fault diagnosis, fault confidence

**Soil sample**:
A dated, located set of soil measurements collected by a field method or laboratory, with units and sampling context.
_Avoid_: SoilGrids value, sensor reading (unless actually measured by a sensor)

**Interpolated soil estimate**:
A modeled estimate of a soil property between measured sample locations. It is not a laboratory measurement, and its apparent map resolution does not imply equivalent measurement accuracy.
_Avoid_: measured cell value

**KshetraSense Soil Health Index (SHI)**:
A project-defined composite screening score made from soil-property indicator scores. It is not an official USDA/NRCS index, a crop-specific suitability assessment, or a probability of yield or success.
_Avoid_: USDA SHI, crop-fit probability

**Management zone**:
A contiguous field area grouped by similarity in its standardized soil-property profile. The numeric cluster label is an algorithm output, not a crop, quality grade, or treatment prescription.
_Avoid_: crop zone, prescription zone

**SoilGrids context**:
A coarse-resolution modeled estimate of soil properties for regional reference, not a measurement of a particular field cell.
_Avoid_: Soil test, field measurement

**Vegetation zone**:
A spatial grouping based on satellite-derived vegetation observations for an area and time window; it describes relative image patterns, not their cause.
_Avoid_: Soil zone, treatment prescription

**NDVI**:
A satellite-derived vegetation index computed from red and near-infrared reflectance, used here as an exploratory indicator of relative vegetation patterns.
_Avoid_: Soil fertility, crop-health diagnosis, yield
