# Phase 4: Field Monitoring UI Transformation

**Scope:** `src/features/monitoring/` — React frontend & real-time telemetry console  
**Depends on:** Phase 3 Telemetry API & Phase 2 `ZoningDeploymentPlan`  
**Produces:** Complete replacement of manual sample forms with a live WSN Telemetry & Automation Dashboard, combined with CropSight Satellite Vegetation Monitoring  
**Estimated effort:** Week 4

---

## 4.1 Overview & UI/UX Vision

In Phase 4, the **Field Monitoring** module is transformed from an administrative manual data-entry form into an **interactive operations center**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FIELD MONITORING MODULE                         │
├──────────────────────────────────┬─────────────────────────────────────┤
│ Tab A: WSN Telemetry Console     │ Tab B: Satellite Canopy Health      │
│ (Ground Root-Zone LoRaWAN Stream)│ (CropSight Sentinel-2 Space View)   │
└──────────────────────────────────┴─────────────────────────────────────┘
```

The user can observe real-time telemetry streaming from the sensor nodes placed in each management zone, inspect early water-stress signals predicted by the Edge AI GRU model, watch the automated solenoid irrigation valve open and close, and switch to Tab B to corroborate these ground signals with spaceborne Sentinel-2 NDVI canopy imagery.

---

## 4.2 Component Architecture (`src/features/monitoring/`)

```
src/features/monitoring/
├── FieldMonitoringView.tsx             # Parent tab switcher (WSN Console vs Satellite View)
├── wsn/
│   ├── WsnTelemetryConsole.tsx         # Main operations dashboard container
│   ├── TelemetryPlaybackBar.tsx        # Play/Pause, speed selector (1x/10x/60x), timeline scrubber
│   ├── MultiNodeGaugeCards.tsx         # Real-time circular dials for Moisture, Temp, EC, Battery
│   ├── TelemetryTrendChart.tsx         # 24h historical curve + MAD threshold + 12h GRU forecast
│   ├── ActuatorStatusPanel.tsx         # Solenoid Valve LED, flow rate (L/min), volume accumulator
│   └── AnomalyAlertBanner.tsx          # Warning banner if Isolation Forest flags sensor drift
└── vegetation/
    ├── VegetationMonitoringView.tsx    # CropSight sub-application (Kept & enhanced)
    ├── FieldPolygonAoiCanvas.tsx       # Upgraded from circular AOI to field polygon mask
    ├── EarthEngineSetupModal.tsx       # Transparent GEE Community Tier guidance
    └── OfflineBenchmarkViewer.tsx      # Pre-rendered Sentinel-2 L2A fallback for offline demos
```

---

## 4.3 Detailed Feature Breakdown

### 4.3.1 Playback Control Bar (`TelemetryPlaybackBar.tsx`)
Positioned at the top of the WSN Console, this bar controls the simulation time:
- **Play / Pause Button:** Toggles streaming state with smooth transitions.
- **Speed Selector:** Segmented pill toggle: `1x (Real-time)` | `10x` | `60x (1 sec = 1 min)` | `360x (Fast scrub)`.
- **Timeline Scrubber:** Slider showing the current simulation date/time across the growing season (e.g., *"15 June 2022, 14:20:00"*), allowing scrubbing to major irrigation or drought events.
- **Live Status Indicator:** Pulsing green badge *"LoRaWAN Gateway Active — 3 Nodes Connected"*.

### 4.3.2 Multi-Node Live Gauge Cards (`MultiNodeGaugeCards.tsx`)
Each management zone from the `ZoningDeploymentPlan` is rendered as an independent card:

```
┌────────────────────────────────────────────────────────────────────────┐
│ NODE 2: ZONE 2 (Moderate Stress Line)               [Battery: 3.92V 🔋] │
├──────────────────────────┬──────────────────────────┬──────────────────┤
│ Soil Moisture (VWC)      │ Soil Temperature         │ Soil EC          │
│        21.4%             │         25.8°C           │    1.85 dS/m     │
│ [CRITICAL DEPLETION]     │ [OPTIMAL FOR ROOT GROWTH]│ [SLIGHT SALINITY]│
├──────────────────────────┴──────────────────────────┴──────────────────┤
│ Edge AI Forecast (Next 12h): 19.2% VWC ➔ IRRIGATION ACTION REQUIRED    │
└────────────────────────────────────────────────────────────────────────┘
```

- **Color Dynamics:**
  - Moisture dial turns Amber if within $2\%$ of critical MAD threshold ($24.8\%$).
  - Moisture dial pulses Red if $\le 24.8\%$ (Wilting stress onset).
  - Turns Emerald Green during and immediately following an irrigation event.

### 4.3.3 Telemetry Trend Chart (`TelemetryTrendChart.tsx`)
A high-frequency SVG / Canvas multi-line chart tracking root-zone dynamics over the last $24\text{ hours}$ to $7\text{ days}$:
- **Solid Line:** Measured soil moisture ($\theta_t$) from the LoRa sensor.
- **Red Horizontal Dashed Line:** FAO-56 Management Allowed Depletion threshold ($\theta_{\text{crit}} = 24.8\%$).
- **Blue Horizontal Shaded Band:** Field Capacity range ($30.0\% - 32.0\%$).
- **Dotted Amber Line:** The **Edge AI 12h GRU Forecast** showing predicted soil moisture trajectory into the future.
- **Vertical Shaded Columns:** Historical irrigation events showing duration and liters applied.

### 4.3.4 Actuator Status & Closed-Loop Verification (`ActuatorStatusPanel.tsx`)
Fulfilling the *"Sense $\to$ Decide $\to$ Act $\to$ Verify"* mandate from the presentation:
- **Solenoid Valve Lamp:**
  - Large illuminated badge: `VALVE OPEN (WATERING)` in green, or `VALVE CLOSED (IDLE)` in gray.
- **Real-Time Flow Meter:** Displays instantaneous flow rate (e.g., $18.5\text{ L/min}$).
- **Cumulative Water Meter:** Displays running volume applied (e.g., $4,250\text{ Liters}$).
- **Agronomic Verification Callout:**
  - Shows why the valve opened: *"Triggered by FAO-56 rule: Current moisture (21.4%) < Critical threshold (24.8%). Water deficit: 7.4 mm."*
  - Shows feedback loop: *"Moisture rose by +9.2% VWC 30 minutes post-irrigation. Water intake verified."*

### 4.3.5 Tab B: Satellite Canopy Health (CropSight)
- **Polygon Clipping:** Upgrades the circular canvas to clip the Sentinel-2 NDVI raster directly to the farm polygon defined in Phase 2.
- **Macro-Micro Corroboration:**
  - Displays side-by-side insight badges:
    *"Space Observation (Sentinel-2 NDVI: 0.42 - Low vigor in Zone 3) corroborates ground telemetry (Soil moisture depleted to 21.2%). Scouting priority: HIGH."*
- **GEE Authentication & Benchmark Toggle:**
  - If Google Earth Engine is authenticated, it pulls live Sentinel-2 L2A tiles.
  - If unauthenticated, it seamlessly allows loading the **Verified Offline Benchmark Mode** so the student defense never fails due to network dropouts.

---

## 4.4 Verification & Acceptance Criteria

1. **Zero Manual Forms:** The old manual CSV/sample input tables are completely retired; the WSN Telemetry Console loads by default.
2. **Smooth Playback:** In 60x mode, telemetry updates smoothly at $\ge 30\text{ FPS}$ without UI jank or memory leaks.
3. **Trigger Validation:** When scrubbing to a timestamp where Zone 3 moisture drops below $24.8\%$, the valve status immediately switches to `VALVE OPEN` and the flow rate becomes $>0$.
4. **Recovery Feedback:** As the simulated irrigation completes, the moisture graph reflects recovery, and the valve automatically transitions back to `VALVE CLOSED`.
5. **Cross-Tab Continuity:** Switching between Tab A (WSN Telemetry) and Tab B (CropSight Satellite) preserves active simulation state without reloading.
