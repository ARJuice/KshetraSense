# Historical telemetry replay service

This package provides a local, read-only replay of the attributed Parma tomato-trial dataset. It is mounted under `/v1/telemetry/` by `services/zoning/app/main.py`; it does not connect to sensors, bind records to a cadastral field or zone, or operate irrigation hardware.

## Data and interpretation

The five unchanged source files are pinned by size and SHA-256 in [`data/manifest.json`](data/manifest.json) and documented in [`data/README.md`](data/README.md). They come from [Mendeley Data v2, DOI 10.17632/35wh56287y.2](https://data.mendeley.com/datasets/35wh56287y/2), listed as CC BY 4.0. Cite Laura Belli et al. and the DOI when redistributing or reusing the data.

The trial is from Parma, Italy (2023), not a current KshetraSense farm. Soil humidity is the source's `%RH` sensor signal, not volumetric water content (VWC); soil EC is µS/cm. The shared air station is not three independent readings. Source meter values are preserved as reported and are not interpreted as flow or applied irrigation volume. Missing battery values remain missing. The replay banner and line-treatment labels must stay visible in any UI.

Raw observations and their source timestamps are distinct from the nominal 10-minute model input grid. Model features are linearly interpolated only between valid observations no more than 30 minutes apart; there is no edge extrapolation. The forecast reports how many input values were resampled/interpolated. An incomplete or long-gap input window returns an unavailable forecast.

## HTTP contract

The API is part of the existing local FastAPI process at port 8000:

| Route | Purpose |
| --- | --- |
| `GET /v1/telemetry/health` | Load/check the local dataset and trained model; this is readiness, not live-device status. |
| `GET /v1/telemetry/metadata` | Provenance, units, treatments, data quality, model architecture, holdout metrics, and capabilities. |
| `GET /v1/telemetry/state` | Current process-local playback state and range. |
| `POST /v1/telemetry/control` | `play`, `pause`, timezone-aware `seek`, or speed `1`, `10`, `60`, `360`. |
| `GET /v1/telemetry/stream?line_id=1` | Current original observations, shared environment, optional source meter reading, forecast, and anomaly review. Omit the line ID for all three trial lines. |
| `GET /v1/telemetry/history?line_id=1&start=…&end=…&limit=…` | Bounded original observations for charts (maximum 2,000 points). |
| `WS /v1/telemetry/ws` | Read-only snapshots; control remains an HTTP action. |
| `POST /v1/telemetry/water-balance/advisory` | Independent FAO-56 TAW/RAW screening from explicit calibrated VWC and site inputs. |

Playback state is in memory, shared within one process, and resets on restart. Run a single local worker for the replay demo. No endpoint returns a valve state or action. The FAO-56 endpoint rejects invalid/unbounded units but cannot independently verify the caller's calibration source; its output is advisory only.

## GRU and anomaly screen

The trained Keras 3 / PyTorch CPU model consumes 144 ten-minute steps of soil humidity signal, soil temperature, soil EC, shared air temperature, and shared air humidity. It predicts the same `%RH` sensor signal at +6, +12, and +24 hours. Splits are chronological 70/15/15; scaling is fit only on training rows; evaluation is compared with persistence. The model artifact is [`models/soil_signal_gru.keras`](models/soil_signal_gru.keras), and its full reproducibility/evaluation record is [`models/soil_signal_gru_metadata.json`](models/soil_signal_gru_metadata.json).

The held-out GRU MAE is 0.378, 1.265, and 0.980 `%RH` at 6/12/24 hours, respectively; persistence MAE is 0.083, 0.140, and 0.204. The GRU therefore fails to beat persistence at all horizons. It is retained as an educational model-evaluation artifact and must not be presented as an irrigation forecast or operational recommendation. The Isolation Forest score is an unsupervised review signal; there are no ground-truth fault labels.

To retrain intentionally from the repository root:

```powershell
.\services\zoning\.venv\Scripts\python.exe -m services.telemetry.train_forecaster
```

Training overwrites the model and metadata artifacts; verify the new hashes, temporal split, metrics, and baseline comparison before accepting a changed artifact.

## Verification

From `services/zoning` run `python -m pytest tests -q`. Telemetry checks cover source-file hashes and units, malformed/header row handling, interpolation gaps, playback semantics, FAO-56 arithmetic/validation, REST and WebSocket behavior, and truthful forecast/anomaly labels.
