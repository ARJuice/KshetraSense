# Phase 3: WSN Telemetry Service & Edge AI Engine

**Scope:** `services/telemetry/` (or `services/zoning/app/telemetry/`) — Python backend service & Edge AI inference  
**Depends on:** Preprocessed Belli et al. (2022) tomato dataset & trained lightweight GRU model  
**Produces:** Playback REST/WebSocket API, continuous multi-node telemetry stream, 12h soil moisture forecast, FAO-56 irrigation actuation decisions, and sensor anomaly filtering  
**Estimated effort:** Week 3

---

## 3.1 Overview & Agronomic Rationale

In the project thesis and presentation:
$$\textbf{Sense (WSN Nodes)} \longrightarrow \textbf{Decide (Edge AI)} \longrightarrow \textbf{Act (Precision Irrigation)}$$

Because physical ESP32/LoRa hardware cannot be attached to every grading station during academic evaluation, Phase 3 provides an **authentic Hardware-in-the-Loop Telemetry Replay Service** powered by real-world commercial LoRaWAN farm observations.

Rather than synthesizing random sine waves, the service replays the **Belli et al. (2022)** dataset (*Mendeley Data DOI: 10.17632/35wh56287y*), recorded on an open-field tomato farm in Parma, Italy across three distinct irrigation lines. 

The service couples this data stream with an **Edge AI Predictive Engine** (2-layer GRU) and an **Agronomic Decision Engine** based on FAO-56 Management Allowed Depletion (MAD) to execute automated solenoid valve irrigation decisions.

---

## 3.2 Dataset Pipeline & Preprocessing

### 3.2.1 Raw Data Sources (Belli et al. 2022)
The dataset comprises continuous 10-minute records across a commercial tomato growing season (~11,000 timestamps):
- **Line 1 (Node 1):** 100% of optimal *Irriframe* water requirement (Well-watered control).
- **Line 2 (Node 2):** 60% of water requirement (Moderate deficit irrigation).
- **Line 3 (Node 3):** 30% of water requirement (Severe deficit stress).

### 3.2.2 Extraction & Preprocessing Pipeline
1. **Time Synchronization:** Resample raw asynchronous LoRa packets into a uniform 10-minute grid across all three nodes using linear interpolation for gaps $<30\text{ min}$.
2. **Feature Curation:** Extract the essential agronomic feature vector per node:
   - `soil_moisture_vwc`: Volumetric Water Content ($\%$ or $\text{m}^3/\text{m}^3$)
   - `soil_temperature`: Soil temperature at $15\text{ cm}$ depth ($^\circ\text{C}$)
   - `soil_ec`: Bulk soil electrical conductivity ($\text{mS/cm}$ or $\text{dS/m}$)
   - `air_temperature`: Ambient microclimate temperature ($^\circ\text{C}$)
   - `air_humidity`: Relative humidity ($\%$)
   - `water_volume_liters`: Actual cumulative water applied per regime (L)
   - `battery_volts`: LoRaWAN node battery health ($3.0 - 4.2\text{ V}$)
3. **Storage Format:** Package the unified multi-node time-series as a high-performance, compressed Parquet file (`services/data/telemetry_tomato.parquet`, $\approx 1.8\text{ MB}$), accompanied by SQLite for fast temporal range indexing.

---

## 3.3 Temporal ML: Root-Zone Soil Moisture Forecasting (GRU)

### 3.3.1 Model Architecture & Justification
- **Why GRU over standard LSTM or Linear Regression:**
  - Soil moisture exhibits non-linear diurnal cycles (daytime transpiration vs. nighttime capillary rise) and lag responses to irrigation/rainfall that linear models miss.
  - Gated Recurrent Units (GRU) contain fewer parameters than LSTM (no separate cell state), reducing inference latency and memory footprint to run effectively on resource-constrained Edge gateways (e.g. Raspberry Pi 4 / Jetson Nano).
- **Network Architecture:**
  - **Input Layer:** Sequence length $W = 144$ timesteps ($24\text{ hours}$ at $10\text{-minute}$ steps) $\times 5$ features:
    $$x_t = [\theta_t, T_{\text{soil}, t}, \sigma_{\text{EC}, t}, T_{\text{air}, t}, \text{RH}_t]$$
  - **Layer 1:** GRU ($64\text{ hidden units}$, return sequences = True)
  - **Dropout:** $0.1$
  - **Layer 2:** GRU ($32\text{ hidden units}$, return sequences = False)
  - **Dense Output Head:** Linear layer emitting 3 future predictions:
    $$\hat{y} = [\hat{\theta}_{t+6\text{h}}, \hat{\theta}_{t+12\text{h}}, \hat{\theta}_{t+24\text{h}}] \quad (\text{steps } 36, 72, 144)$$

### 3.3.2 Training & Validation Protocol
- **Strict Chronological Data Split:**
  - **Train:** First $70\%$ of the growing season.
  - **Validation:** Next $15\%$ (used for early stopping, patience = 10 epochs).
  - **Out-of-Sample Test:** Final $15\%$ of the season.
  - *No temporal shuffling:* Cross-validation shuffling is strictly prohibited to prevent future autocorrelation leakage.
- **Normalization:** `MinMaxScaler` fitted **strictly on the training split** and persisted as `scaler.json`.
- **Loss Function:** Huber Loss ($\delta = 1.0$), minimizing sensitivity to transient sensor noise.
- **Target Metrics:**
  - $\text{RMSE} < 1.8\%$ VWC
  - $\text{MAE} < 1.3\%$ VWC
  - $R^2 \ge 0.88$

---

## 3.4 Edge Decision Engine: FAO-56 Precision Irrigation Law

To prevent unconstrained black-box ML models from directly actuating physical water valves, the predictive output feeds into the deterministic **FAO-56 Management Allowed Depletion (MAD)** framework:

```
┌────────────────────────────────────────────────────────┐
│ Current Soil Moisture (θ_t)                            │
│ + GRU Forecasted Moisture (θ_{t+6h})                   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ FAO-56 Soil Water Balance                              │
│ - Soil Texture: Clay Loam                              │
│ - Field Capacity (θ_FC): 32.0% VWC                     │
│ - Permanent Wilting Point (θ_PWP): 14.0% VWC           │
│ - Total Available Water (TAW) = θ_FC - θ_PWP = 18.0%   │
│ - Crop Depletion Factor (p): 0.40 (Tomato)             │
│ - Readily Available Water (RAW) = p × TAW = 7.2%       │
│ - Critical Threshold: θ_crit = θ_FC - RAW = 24.8% VWC  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Deterministic Actuation Law:                           │
│ IF (θ_t ≤ 24.8% OR θ_{t+6h} ≤ 24.8%):                  │
│    ➔ OPEN Solenoid Valve                               │
│    ➔ Calculate Required Volume:                        │
│      V = (θ_FC - θ_t) × RootDepth(0.3m) × ZoneArea     │
│ ELSE:                                                  │
│    ➔ KEEP Valve CLOSED (Conserve Water)                │
└────────────────────────────────────────────────────────┘
```

---

## 3.5 Sensor Anomaly Detection (Isolation Forest)

In real farm deployments, sensors frequently suffer from hardware faults:
- Cable damage causing immediate drops to $0\%$.
- Sensor pullout or air pockets causing high-frequency spikes.
- Battery drain causing false low voltage readings.

To prevent erratic sensors from triggering catastrophic over-irrigation:
- An **Isolation Forest** model (contamination rate $\nu = 0.02$) evaluates instantaneous sensor feature gradients:
  $$g_t = \left[\left|\frac{d\theta}{dt}\right|, \left|\frac{d\text{EC}}{dt}\right|, V_{\text{battery}}, \text{Plausibility}\right]$$
- If an anomaly is detected:
  1. The anomaly flag `sensor_fault: true` is emitted.
  2. The automated actuation is **suppressed/locked out**.
  3. An advisory alert is posted to the operator: *"Sensor fault detected on Node 2 (unphysical moisture gradient). Irrigation locked out pending verification."*

---

## 3.6 Playback API Specification

Mounted on the FastAPI backend under `/v1/telemetry/`:

### 3.6.1 Playback Control
```http
POST /v1/telemetry/control
Content-Type: application/json

{
  "action": "play" | "pause" | "seek" | "set_speed",
  "speed": 1 | 10 | 60 | 360,
  "timestamp": "2022-06-15T08:00:00Z"
}
```

### 3.6.2 State & Telemetry Polling / Streaming
```http
GET /v1/telemetry/stream?node_id=node-1
```
**Response JSON:**
```json
{
  "simulatedTimestamp": "2022-06-15T08:30:00Z",
  "speed": 60,
  "isPlaying": true,
  "nodes": [
    {
      "nodeId": "node-1",
      "zoneId": 0,
      "zoneLabel": "Zone 1 (High Moisture Retention)",
      "telemetry": {
        "moistureVwc": 31.4,
        "temperatureC": 23.2,
        "ecDsM": 1.15,
        "batteryVolts": 3.92
      },
      "forecast": {
        "moisturePlus6h": 29.8,
        "moisturePlus12h": 28.1,
        "moisturePlus24h": 25.4,
        "model": "GRU-2L-64"
      },
      "actuator": {
        "valveOpen": false,
        "irrigationNeeded": false,
        "criticalThresholdVwc": 24.8,
        "flowRateLMin": 0.0,
        "waterAppliedLiters": 1240.0
      },
      "anomaly": {
        "isFaulty": false,
        "confidence": 0.99
      }
    },
    {
      "nodeId": "node-3",
      "zoneId": 2,
      "zoneLabel": "Zone 3 (Sandy Deficit Patch)",
      "telemetry": {
        "moistureVwc": 22.1,
        "temperatureC": 26.8,
        "ecDsM": 2.10,
        "batteryVolts": 3.85
      },
      "forecast": {
        "moisturePlus6h": 20.4,
        "moisturePlus12h": 18.9,
        "moisturePlus24h": 17.2,
        "model": "GRU-2L-64"
      },
      "actuator": {
        "valveOpen": true,
        "irrigationNeeded": true,
        "criticalThresholdVwc": 24.8,
        "flowRateLMin": 15.5,
        "waterAppliedLiters": 3480.0
      },
      "anomaly": {
        "isFaulty": false,
        "confidence": 0.98
      }
    }
  ]
}
```

---

## 3.7 Verification & Unit Testing (`tests/test_telemetry.py`)

| Test Case | Scenario | Expected Result |
|---|---|---|
| **Data Integrity** | Load Parquet file | 11,000+ consecutive records across 3 nodes; no missing NaNs. |
| **Playback Control** | Send `action: "pause"`, then poll status | Timestamp halts; `isPlaying: false`. |
| **Time Scrubbing** | Seek to `"2022-07-01T12:00:00Z"` | Telemetry values immediately reflect July 1 midday conditions. |
| **Speed Scaling** | Set speed = `60x` | 1 real second advances 1 simulated minute. |
| **Forecast Consistency** | Test GRU inference on validation window | Forecast outputs follow diurnal drying curve; RMSE $< 1.8\%$. |
| **Actuator Logic** | Set $\theta = 22.0\%$ ($< 24.8\%$) | `valveOpen: true`, volume $> 0$. |
| **Actuator Hold** | Set $\theta = 28.0\%$ ($> 24.8\%$) and $\hat{\theta}_{+6\text{h}} = 26.0\%$ | `valveOpen: false`, flow rate = 0. |
| **Anomaly Lockout** | Inject sudden spike $\theta = 95.0\%$ | Isolation forest flags `isFaulty: true`; valve forced `false`. |
