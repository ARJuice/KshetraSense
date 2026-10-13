# Phase 4: Field Monitoring UI Transformation

**Status:** Ready to implement; Phase 3 telemetry service is complete.
**Scope:** `src/features/monitoring/` — Soil Investigation, historical telemetry replay, and the independent CropSight vegetation workflow.
**Depends on:** Phase 3 telemetry API; existing SoilGrids and CropSight integrations.
**Manual setup:** Google Earth Engine authentication/project configuration is deferred until the user performs it; the rest of the Field Monitoring UI must work without it.

---

## 4.1 Product contract

Field Monitoring is a desktop-first work area with three distinct tasks:

1. **Soil Investigation:** review locally stored measured samples and optional SoilGrids regional context.
2. **Historical Telemetry Replay:** inspect the Parma tomato research trial supplied by Phase 3. This is historical data, not the user's farm, not a live WSN connection, and not bound to Soil Zoning or cadastral boundaries.
3. **Vegetation Monitoring:** use CropSight/Sentinel-2 for its own area and date inputs. It remains separate from Soil Investigation, the telemetry benchmark, soil zoning, and Crop Fit.

Do not remove the existing Soil Investigation workflow or its sample forms to make room for replay. A user can switch among these work areas without silently sharing values or presenting one module's data as another's.

---

## 4.2 Historical replay workflow

1. Open **Field Monitoring → Telemetry Replay**. Before data appears, show the persistent source badge: **“Historical research replay · Parma tomato trial · 2023 · not live telemetry.”**
2. Review the source, trial period, CC BY 4.0 attribution, feature units, and data-quality notes.
3. Choose **Trial line 1, 2, or 3**. Explain the published 100% / 60% / 30% Irriframe treatment labels; never rename them “Zone 1/2/3” or attach them to a field polygon.
4. Use Play/Pause, a bounded date-time scrubber, and `1× / 10× / 60× / 360×` playback speeds. Seeking outside the dataset range is rejected. End-of-data stops without looping.
5. Inspect raw observations with their actual source timestamps and units:
   - Soil humidity sensor output `%RH` (explicitly **not VWC**).
   - Soil EC `µS/cm` and soil temperature `°C` at 20 cm.
   - Shared air temperature `°C` and relative humidity `%RH` from the single environmental station.
   - Optional battery `%` only when present; missingness is common and must not be filled or changed to volts.
   - Optional `current_volume` meter field in its source-stated m³ unit, with an adjacent warning that scale/semantics are not independently validated. Never derive liters, L/min, an open valve, or a watering event from it.
6. Show the two-layer GRU output at +6/+12/+24 hours as a **soil humidity signal forecast (`%RH`, not VWC)**. Include the model/version, input-window completeness and interpolation count, held-out metrics, and persistence-baseline comparison. If a horizon does not beat persistence, state that plainly. Forecast points are exploratory and have no calibrated interval.
7. Show Isolation Forest results only as **review candidates** with an unsupervised score and the explanation that a candidate is not a diagnosed sensor fault or probability.
8. The replay screen never presents water-stress thresholds, irrigation need, valve state, flow, water deficit, gateway connectivity, or water savings based on this dataset. The existing calibrated-VWC FAO-56 endpoint may be exposed as a separate advisory form only; it must require user-supplied site parameters, remain separate from replay, and say human review/advisory only.

### Chart and data presentation

- Plot original soil humidity readings as measured points with their observation times; do not style them as VWC or silently connect long gaps. Air observations are identified as shared station context.
- Mark gaps and show the loader's interpolation count for model inputs. The forecast model's regularly aligned/interpolated matrix is not relabeled as a measured chart series.
- Allow a line-specific view and an all-lines comparison, but keep the treatment labels visible and do not imply transferability to another site.
- Display GDD/heat-unit source data only if a later task defines useful scope; Phase 4 does not infer ETc, rainfall, yield, crop stress, or irrigation scheduling from them.

---

## 4.3 Component architecture

Keep the UI organized around the existing monitoring feature and use existing house controls/chart dependencies where available. Proposed component boundaries (names may follow the current codebase):

```text
src/features/monitoring/
├── FieldMonitoringView.tsx
├── investigation/                 # Existing Soil Investigation workflow; retained
├── telemetry/
│   ├── TelemetryReplayView.tsx
│   ├── ReplaySourceNotice.tsx
│   ├── TelemetryPlaybackBar.tsx
│   ├── TrialLineSelector.tsx
│   ├── TelemetryReadingsPanel.tsx
│   ├── TelemetryHistoryChart.tsx
│   ├── SignalForecastPanel.tsx
│   └── AnomalyReviewPanel.tsx
└── vegetation/                    # Existing independent CropSight workflow; retained
```

The API client consumes Phase 3 `/v1/telemetry/metadata`, `/state`, `/control`, `/stream`, `/history`, and read-only WebSocket snapshots. API errors must preserve the selected screen and show retryable status; never substitute fabricated telemetry.

---

## 4.4 Visual and interaction requirements

- Preserve the app's clean ERP-style shell, restrained color system, and readable scientific units. Use badges and concise warnings for provenance; avoid decorative gauges or glowing status colors that imply a live system.
- Make playback controls keyboard accessible; expose play/pause state and current time to assistive technology; respect reduced motion.
- Use line patterns/labels as well as color in the comparison chart. Tooltips include units, source, observation timestamp, and whether a value is absent.
- Keep this view useful at the target desktop width and provide a clean narrow viewport fallback; the overall project remains desktop-first.
- Do not add 3D/GLB/Spline decoration to telemetry unless it communicates a real measured field geometry. This benchmark has no field polygon suitable for a KshetraSense 3D map.

---

## 4.5 Verification and acceptance

1. The badge, attribution, trial dates, line treatments, source units, and `%RH`-not-VWC caveat are visible before or alongside telemetry.
2. Play/pause, allowed speeds, seeking, end-of-data, and disconnection states match the API; switching to Soil Investigation or CropSight does not reset or cross-contaminate source state.
3. Raw chart points preserve sensor timestamps and units. Long gaps remain visible; interpolated model inputs are disclosed separately.
4. Forecast status, three horizons, input completeness, chronological holdout metrics, and persistence comparison match the API response. Poor horizons are not marketed as predictive.
5. Anomaly output is presented as a review candidate only. No UI contains a live gateway badge, valve open/close state, L/min flow, VWC threshold, or actuation control for the benchmark.
6. Soil Investigation and CropSight continue to work independently when the telemetry service is unavailable; CropSight clearly distinguishes missing Earth Engine setup from other failures.
7. Accessibility, responsive layout, keyboard operation, and production build are checked without requiring Earth Engine credentials.
