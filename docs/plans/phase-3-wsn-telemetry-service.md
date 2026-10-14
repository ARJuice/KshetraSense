# Phase 3: Historical Telemetry Replay & Soil-Signal Forecast

**Status:** Implemented and verified on 2026-10-14.
**Scope:** `services/telemetry/`, mounted under the existing local FastAPI service.
**Depends on:** Phase 1–2 zoning service; the attributed Mendeley tomato telemetry dataset.
**Produces:** A clearly labeled historical replay, a trained two-layer GRU for a raw soil-sensor humidity signal, unsupervised anomaly candidates, and a separate unit-checked FAO-56 MAD advisory calculator.
**Decision records:** [Decision 0007](../decisions/0007-phase-3-telemetry-evidence-and-boundaries.md) · [Decision 0008](../decisions/0008-gru-holdout-quality-and-use.md)

The implementation is mounted in the existing FastAPI service. The pinned source/model artifacts are present. At the Phase 3 completion checkpoint, the Python suite passed **62 tests** (including telemetry API, parser, playback, FAO-56, and the then-existing zoning tests); the current full-suite result is recorded in the [Phase 5 verification matrix](phase-5-leaf-contract-and-verification.md). The trained GRU was worse than persistence on all three holdout horizons: MAE 0.378/1.265/0.980 `%RH` at +6/+12/+24h versus 0.083/0.140/0.204 for persistence. It remains an evaluation artifact only; see Decision 0008.

---

## 3.1 User and product contract

Field Monitoring will let a user replay a real, published research dataset and see what a local telemetry/forecasting pipeline does. It is a historical benchmark, not a live KshetraSense farm connection. It must carry a persistent label such as **“Historical research replay · Parma tomato trial · 2023 · not live telemetry.”**

The replay has three measured soil-sensor lines and one shared environmental station. Dataset treatment line IDs are retained as research identifiers; they are **not** mapped to the user's KshetraSense zones or WSN placement suggestions. A future deployment can replace the replay adapter with actual validated sensors without changing the forecast/advisory data contracts.

The forecast predicts only the source sensor's soil-humidity `%RH` signal. It must not be presented as volumetric water content (VWC), root-zone water storage, an irrigation quantity, or a crop-success prediction. The FAO-56 calculator is independently usable only with explicitly supplied/calibrated VWC and site parameters. It returns an advisory, never a valve command.

---

## 3.2 Source dataset and evidence

Use [Mendeley dataset version 2](https://data.mendeley.com/datasets/35wh56287y/2), DOI `10.17632/35wh56287y.2`, published 5 November 2024, CC BY 4.0. Cite Laura Belli, Luca Davoli, Giulia Oddi, Luca Preite, Martina Galaverni, Tommaso Ganino, and Gianluigi Ferrari. The associated source paper is *Smart agriculture dataset in a tomato cultivation under different irrigation regimes*, Data in Brief 60 (2025), DOI `10.1016/j.dib.2025.111521`.

The trial is a HEINZ 1301 tomato crop at Azienda Sperimentale Stuard, Parma, Italy. The published trial period is 29 June–13 September 2023. Experimental lines received 100%, 60%, and 30% of the Irriframe-recommended water quantity. The paper describes one environmental sensor, one soil sensor and one water meter per line, 10-minute sampling, and once-daily agronomic indicators. It identifies soil sensors at 20 cm depth and soil humidity as `%RH`; source tables list soil EC in µS/cm, soil/air temperature in °C, air RH in `%RH`, and the meter field in m³.

### Source-to-app data contract

| Source | Use | Canonical display name/unit | Known limitation |
|---|---|---|---|
| `stuard_soil_data.csv` | Three line-specific soil records | Soil humidity signal `%RH`, EC `µS/cm`, soil temperature `°C` at 20 cm | `%RH` is not VWC. Battery `%` is absent in nearly all rows. |
| `stuard_environmental_data.csv` | Shared weather context for all lines | Air humidity `%RH`, air temperature `°C` | One station; not three independent readings. Battery `%` is mostly absent. |
| `stuard_water_meter_data.csv` | Optional raw meter observation only | `current_volume`, source-reported `m³` | Values are not converted to L/min or liters. Do not infer valve state, irrigation rate, or use for model features until scale/semantics are verified. |
| `indicators.csv` | Dataset provenance/context only | Daily GDD and heat-unit fields as supplied | Does not provide rainfall, ETc time series, root-zone VWC, or field-specific hydraulic parameters. |

The unchanged source files live in `services/telemetry/data/raw/`; `services/telemetry/data/README.md` records attribution, CC BY 4.0, original file sizes, and verified SHA-256 values. The downloaded files are about 7.8 MB total, small enough to load locally; do not add a database or Parquet conversion without a measured need. The source files include repeated header rows inside two CSVs; the loader must reject/count malformed rows rather than silently treating them as observations. Device identifiers must not be returned by the API.

---

## 3.3 Preprocessing and replay integrity

1. Parse `ts_generation` as Unix milliseconds and expose normalized API timestamps as timezone-aware UTC; display the original trial date in Europe/Rome in the UI.
2. Validate required headers, numeric fields, and line IDs; count excluded malformed rows and expose data-quality metadata.
3. Keep a time-aligned 10-minute model grid. Linear interpolation resamples the nominal 10-minute sensor cadence onto UTC grid boundaries; bridge only valid bracketing observations no more than 30 minutes apart and never extrapolate at dataset edges. The interpolation count includes cadence alignment as well as short-gap bridging. Keep replayed source observations and their timestamps distinguishable from model-preprocessing values.
4. Join the single environmental stream as shared context. If an input is unavailable or an input window crosses a longer gap, return `forecast: unavailable` with a reason instead of filling it with zero or fabricating continuity.
5. Preserve line 1/2/3 as historical treatment groups (100/60/30% Irriframe recommendation). Never auto-bind them to KshetraSense zoning IDs or sensor-placement candidates.
6. Keep source-meter readings in the source-stated m³ unit and include only when an observed value is available near the selected replay time. No differencing, conversion, or inferred flow/valve state is part of Phase 3.

---

## 3.4 GRU: forecast the instrument signal

### Model contract

- **Target:** soil-humidity `%RH` sensor output only (the published sensor signal, not VWC).
- **Input window:** last 144 grid steps (24 hours at a nominal 10-minute interval) for one line.
- **Feature order:** soil humidity `%RH`, soil temperature `°C`, soil EC `µS/cm`, shared air temperature `°C`, shared air humidity `%RH`.
- **Architecture:** GRU(64, `return_sequences=True`) → dropout 0.1 → GRU(32) → zero-initialized linear Dense(3) residual head. The head predicts future-minus-current signal deltas and adds them to a persistence baseline; outputs are point estimates for +6h, +12h, and +24h. This baseline-centered head prevents an untrained model from starting far from the last observation.
- **Runtime:** Keras 3 with the CPU PyTorch backend for the repository's Python 3.14 Windows environment. This is a local CPU implementation; Raspberry Pi, Jetson, GPU, and edge-latency claims are out of scope until measured.
- **Scaling:** train-only MinMax fit, persisted with model metadata; target inversion returns `%RH` signal units.
- **Training:** chronological 70/15/15 season split by timestamp, no random temporal split; deterministic seed; Huber loss; early stopping against the validation segment. Mini-batch shuffling is allowed only inside the training split. Do not let windows/targets cross the split boundary.
- **Training efficiency:** use forecast origins every 12 grid steps (two hours) because 10-minute overlapping windows are highly redundant; replay and inference remain on the full 10-minute grid.
- **Evaluation:** record MAE, RMSE, and R² separately at each horizon and by line where sample counts permit; compare with a persistence baseline (last observed humidity signal). Record split dates, sample counts, package versions, feature order, dataset hashes, seed, and training parameters in a versioned JSON sidecar.
- **Presentation:** show the held-out metrics and baseline comparison. No unmeasured target such as “RMSE < 1.8% VWC” is an acceptance criterion. No confidence interval or probability is emitted. If the GRU does not outperform persistence for a horizon, disclose that and do not call that horizon operationally predictive.

Keep the compact trained `.keras` model and its metadata under `services/telemetry/models/`. Provide one reproducible training command/script; the API loads the committed artifact and must fail with a clear health state if it is missing/incompatible rather than silently retraining on user startup.

---

## 3.5 Optional FAO-56 MAD advisory (separate from replay)

FAO-56 defines `TAW = 1000(θFC − θWP) Zr` (mm) and `RAW = p × TAW`, where field-capacity and wilting-point water contents are in m³/m³, root depth is in metres, and `p` depends on crop and atmospheric demand. This service must implement the formula only from an explicit, unit-validated request. It must not use the replay's `%RH` target as `θ`, nor fill in generic clay-loam values, a fixed root depth, ETc, or field area.

The advisory request supplies current/forecast VWC fractions, field capacity, wilting point, effective rooting depth, depletion fraction `p`, and a calibration/source note. Validate `0 ≤ θWP < θFC ≤ 1`, all VWC values in `[0,1]`, and positive rooting depth. Return TAW, RAW, the threshold `θFC − p(θFC−θWP)`, whether the measured or forecast value crosses that threshold, and an explicit human-review advisory status. No liters, flow rate, valve state, actuation, or irrigation schedule is returned. The API rejects incomplete requests with 422; the UI must show “not configured” until complete explicit inputs are supplied, never defaults.

---

## 3.6 Isolation Forest: review candidates, not diagnoses

Fit a deterministic Isolation Forest on training-period sensor values and absolute changes. Emit `anomalyCandidate` plus its non-probabilistic model score and a review explanation. Since there are no fault labels, the output must not say a node **is faulty**, claim confidence/probability, suppress an actuator, or imply that every candidate is a hardware defect. Document the configured contamination fraction as a ranking threshold, not measured failure prevalence.

---

## 3.7 Playback/API contract

Mount an `APIRouter` below `/v1/telemetry/` in the existing local FastAPI process, preserving the current zoning API and one local backend command. Playback state is in-memory and process-local; it resets on restart and is intended for the single-worker local demo.

| Route | Contract |
|---|---|
| `GET /health` and `GET /v1/telemetry/health` | Existing backend health stays lightweight/compatible; the telemetry health route verifies its data/model readiness without requiring external provider setup. |
| `GET /v1/telemetry/metadata` | Dataset identity, historical period, line treatment labels, feature units, model version/metrics, quality counts, and the historical-not-live banner text. |
| `GET /v1/telemetry/state` | Current playback timestamp, play/pause, speed, and available range. |
| `POST /v1/telemetry/control` | `play`, `pause`, `seek`, or `set_speed`; speeds are `1`, `10`, `60`, and `360`; reject timestamps outside the available range. |
| `GET /v1/telemetry/stream?line_id=1` | Current raw soil observation and source timestamp, shared air observation, optional source-meter reading, GRU point forecasts with input-resampling count and holdout disposition, and anomaly review candidate. Omit `line_id` to return all three lines. |
| `GET /v1/telemetry/history?line_id=1&start=…&end=…` | Bounded historical observations for charts; cap returned points and preserve source units/status. |
| `WS /v1/telemetry/ws` | Read-only snapshots while connected; playback changes still use the REST control endpoint. Disconnects must release the loop cleanly. |
| `POST /v1/telemetry/water-balance/advisory` | Independent calibrated-VWC FAO-56 calculation; never fed by the `%RH` benchmark replay. |

At end-of-data, playback stops without wrapping. Seeking is deterministic and does not mutate source data. The API must not expose device identifiers, emit a “live gateway connected” badge, or report an actuator state.

---

## 3.8 Verification and acceptance

1. **Provenance:** source URL/DOI/license/attribution are present; each downloaded file matches the recorded SHA-256; raw CSVs remain unchanged.
2. **Parsing:** repeated header rows are counted/excluded, invalid line IDs/timestamps are rejected, original units survive JSON serialization, and battery/meter missingness is represented as missing.
3. **Alignment:** timestamps are UTC and sorted; only ≤30-minute interpolation bridges are allowed; long gaps/end extrapolation stay unavailable; interpolation flags match the transformed input.
4. **Replay:** pause freezes time; each allowed speed advances by the correct simulated duration; seek range validation works; end-of-data stops; each line keeps the source 100/60/30 label and never acquires a zoning ID.
5. **Forecast:** model loads from its artifact; input shape/feature order is checked; insufficient history or long gaps return unavailable; target units remain `%RH`; the temporal split is disjoint; metrics and persistence baseline are regenerated from the pinned data.
6. **FAO-56:** test formula and units against hand calculations; reject VWC/unit/range inversion; threshold crossing is only an advisory; missing config never becomes a default.
7. **Anomalies:** deterministic fit and candidate output; no field named `confidence`, `faultProbability`, `sensorFault`, or `valveOpen` in the contract.
8. **Regression:** all current zoning, Crop Fit, SoilGrids, and CropSight health tests/build checks remain passing.

### Explicitly out of scope for Phase 3

- Real WSN hardware, radio coverage validation, physical or simulated valve actuation, live IoT credentials, and operational safety interlocks.
- Applying the Parma research lines to KshetraSense cadastral parcels, management zones, or a user's farm.
- VWC conversion/calibration, field-capacity/wilting-point estimates, crop-specific ET scheduling, application volume, liters/minute, water savings, or yield estimation.
- Google Earth Engine authentication/setup; it remains a later manual user step for CropSight and is not needed to run this local replay.
- Field Monitoring UI replacement; Phase 4 owns that work and must follow these corrected data semantics.
