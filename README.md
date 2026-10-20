# KshetraSense (क्षेत्रSense)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.14+-EE4C2C.svg?logo=pytorch&logoColor=white)](https://pytorch.org)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Three.js](https://img.shields.io/badge/Three.js-r160-000000.svg?logo=three.js&logoColor=white)](https://threejs.org)
[![Tests](https://img.shields.io/badge/Tests-163%20Passing-brightgreen.svg)](docs/DELIVERY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Precision Agriculture Spatial Soil Zoning & Field Intelligence Platform**  
> A local-first, defense-grade decision-support system that decouples sparse laboratory soil measurements, spatial clustering algorithms, computer vision leaf pathology diagnosis, regional soil context, and remote sensing telemetry.

---

## 🌾 Overview

**KshetraSense** is an open-source, desktop-first precision agriculture platform designed to provide transparent, scientifically grounded spatial decision support for farmers, agronomists, and researchers.

Modern digital agriculture frequently suffers from opaque "black-box" models, disguised synthetic results, and conflation between direct field measurements and modeled estimates. KshetraSense addresses these issues through strict architectural boundaries, explicit data provenance, and honest uncertainty disclosure:

- **Spatial Soil Management Zoning**: Transforms georeferenced sparse laboratory soil cores into contiguous management zones using Inverse Distance Weighting (IDW), non-linear Soil Health Index (SHI) modeling, and Auto-K K-means++ / Fuzzy C-means clustering.
- **Factor-by-Factor Crop Fit Matrix**: Evaluates soil zones against peer-reviewed regional agronomic reference intervals (Finger Millet / Ragi, Tomato, Groundnut) without fabricating artificial cultivation probabilities or planting verdicts.
- **Image-Only Leaf Pathology Diagnosis**: Fine-tuned MobileNetV3-Small classifier trained on 23,483 audited PlantVillage images (17 Apple, Tomato, and Potato classes) with 92.97% test accuracy and mandatory manual-review protocol.
- **Field Monitoring Workflows**:
  - **Soil Investigation**: Local historical sample tracking paired with on-demand ISRIC SoilGrids 2.0 Web Coverage Service (WCS) regional context.
  - **Historical Telemetry Replay**: Attributed 2023 Parma tomato trial replay with GRU soil-signal (%RH) forecasting, Isolation Forest anomaly review flags, and FAO-56 MAD water balance screening.
  - **Vegetation Remote Sensing (CropSight)**: Independent Google Earth Engine integration analyzing Sentinel-2 Harmonized surface reflectance (NDVI) and CHIRPS precipitation trends.
- **Interactive Methodology & Defense Explorer**: Visualizes algorithmic graphs, mathematical formulations, model topologies, and decoupling boundaries directly within the application.

---

## 📐 System Architecture

KshetraSense is designed with strict boundaries: soil measurements, satellite indices, weather telemetry, and leaf images remain independent evidence streams and are never merged into an arbitrary composite "farm health score".

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER CLIENT (React 18 + TS)                            │
│  ┌───────────────────────┬────────────────────────┬─────────────────────────────────┐  │
│  │ Field Lab & Zoning    │ Crop Fit Reference     │ Leaf Diagnosis (MobileNetV3)    │  │
│  │ • 2D Interactive SVG  │ • Factor-by-factor     │ • 17-class PlantVillage model   │  │
│  │ • Procedural 3D (R3F) │ • Interval comparisons │ • Uncalibrated softmax scores   │  │
│  │ • Layer inspection    │ • Region-relevant data │ • Latency & metadata audit      │  │
│  └───────────────────────┴────────────────────────┴─────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Field Monitoring Hub                                                             │  │
│  │ • Soil Investigation Register  • ISRIC SoilGrids WCS  • Parma Telemetry Replay  │  │
│  │ • Sentinel-2 CropSight Remote Sensing (Google Earth Engine)                      │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │ HTTP / JSON API
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     KSHETRASENSE FASTAPI BACKEND (Python 3.10+)                        │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ POST /v2/zoning/run                                                              │  │
│  │ 1. GeoJSON WGS84 ➔ Local UTM Grid Discretization (5m / 10m cells)                │  │
│  │ 2. Spatial IDW Interpolation (p=2, 3–50 soil samples)                            │  │
│  │ 3. Sigmoidal KshetraSense Soil Health Index (SHI) formulation                    │  │
│  │ 4. Auto-K Silhouette Sweep (K=2..6) with K-Means++ or Fuzzy C-Means              │  │
│  │ 5. Contiguous Zone Polygonization, Disjoint Component Splitting & Adjacency Merge │  │
│  │ 6. Perturbation Sensitivity (ARI) & WSN Medoid / Gateway Placement Suggestions   │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  ┌────────────────────────┬─────────────────────────┬───────────────────────────────┐  │
│  │ POST /v1/crop-fit/     │ POST /v1/leaf/predict   │ GET /v1/monitoring/soilgrids  │  │
│  │ evaluate               │ • MobileNetV3-Small     │ • ISRIC WCS GeoTIFF adapter   │  │
│  │ • Cell / Zone Scope    │ • 10 MiB upload ceiling │ • 8 properties, 6 depth bands │  │
│  │ • Karnataka Catalog    │ • EXIF stripping        │ • Q0.05 / Q0.50 / Q0.95       │  │
│  └────────────────────────┴─────────────────────────┴───────────────────────────────┘  │
│                                                                                        │
│  ┌──────────────────────────────────────────────────┬───────────────────────────────┐  │
│  │ Historical Telemetry Replay (/v1/telemetry/)     │ CropSight Sub-App (/cropsight)│  │
│  │ • Parma 2023 Tomato Trial Dataset Playback       │ • Google Earth Engine API     │  │
│  │ • GRU %RH Sensor Forecast vs. Persistence        │ • Sentinel-2 Harmonized NDVI  │  │
│  │ • Isolation Forest Anomaly Review Candidates     │ • CHIRPS Daily Precipitation  │  │
│  │ • Separate FAO-56 TAW/RAW Water-Balance Advisory │ • NDVI Time Series & Clusters │  │
│  └──────────────────────────────────────────────────┴───────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Key Capabilities

### 1. Spatial Soil Zoning (`POST /v2/zoning/run`)
- **Boundary & Sampling Inputs**: Accepts a WGS84 GeoJSON field polygon and 3–50 georeferenced laboratory soil cores (pH, EC, Nitrogen, Phosphorus, Potassium at a common depth).
- **Inverse Distance Weighting (IDW)**: Spatial interpolation onto a regular UTM grid with distance decay parameter $p = 2$.
- **KshetraSense Soil Health Index (SHI)**: Non-linear sigmoidal score mapping soil properties into agronomic sufficiency curves:
  $$\text{SHI} = \frac{1}{N} \sum_{i=1}^{N} \frac{1}{1 + e^{-k_i (x_i - x_{0,i})}}$$
- **Unsupervised Auto-K Clustering**: Evaluates candidate clusters $K \in [2, 6]$ using silhouette coefficient maximization for both **K-means++** and **Fuzzy C-means (FCM)**.
- **Spatial Post-Processing**: Disconnected cell components are split; adjacent zones with low multivariate distance are merged into clean, contiguous management zones.
- **Robustness Audit**: Evaluates zoning stability via sample leave-one-out perturbation using the Adjusted Rand Index (ARI).
- **WSN Deployment Candidates**: Proposes geometric sensor medoid and gateway coordinates within identified zones (clearly marked as geometric suggestions prior to radio-frequency site validation).
- **Dual Visualizer**: Full-fidelity accessible 2D SVG rendering paired with an optional, high-performance procedural Three.js / React Three Fiber 3D isometric terrain view.

### 2. Sourced Crop Fit Factor Matrix (`POST /v1/crop-fit/evaluate`)
- Evaluates individual cell estimates or zone-level aggregate means against peer-reviewed regional agronomic requirements.
- Currently supports regional cultivars: **Finger Millet (Ragi)**, **Tomato**, and **Groundnut**.
- Factors evaluated: pH, Electrical Conductivity (EC), Nitrogen (N), Phosphorus (P), and Potassium (K).
- Strict scientific honesty: Only pH receives a direct interval verdict; method-dependent N/P/K and uncalibrated EC values are presented with raw values and regional context without fabricating arbitrary pass/fail badges.

### 3. Deep Learning Leaf Pathology (`POST /v1/leaf/predict`)
- **Architecture**: ImageNet-initialized **MobileNetV3-Small** with custom dense classification head.
- **Dataset**: Audited PlantVillage corpus (CC BY-SA 3.0), trained with physical leaf-disjoint splits across 23,483 images.
- **Classes**: 17 conditions across Apple, Tomato, and Potato (healthy leaves, early/late blight, scab, rust, mosaic virus, leaf mold, bacterial spot, etc.).
- **Held-Out Test Performance** (4,653 images):
  - **Accuracy**: `92.97%`
  - **Macro-F1**: `93.52%`
  - **Macro-Precision**: `93.14%`
  - **Macro-Recall**: `94.22%`
- **Safety Protocol**: Fast CPU PyTorch inference (~20–40ms), upload validation (signature verification, metadata/EXIF stripping, 10 MiB ceiling), uncalibrated softmax disclosure, and mandatory manual review requirement.

### 4. Independent Field Monitoring
- **Soil Investigation**: Local observational log for field soil records with unit and depth comparability validation.
- **ISRIC SoilGrids 2.0 Integration**: Direct WCS GeoTIFF queries fetching nominal 250m resolution regional modeled quantiles (Q0.05, Q0.50, Q0.95) across 8 properties and 6 standard depth layers.
- **Historical Telemetry Replay**: Attributed 2023 Parma tomato trial dataset with speed control (1× to 360×), chronological GRU sensor-signal forecast comparison, and Isolation Forest anomaly screening.
- **CropSight Remote Sensing**: Real-time Sentinel-2 Harmonized surface reflectance queries via Google Earth Engine, computing composite NDVI and CHIRPS precipitation trends over user-defined circular areas of interest.

---

## 📁 Repository Structure

```text
KshetraSense/
├── .env.example                     # Environment configuration template
├── package.json                     # Frontend dependencies & scripts
├── tsconfig.json                    # TypeScript compiler configuration
├── vite.config.ts                   # Vite build & proxy setup
├── tailwind.config.js               # Tailwind design system tokens
│
├── src/                             # React 18 / TypeScript frontend
│   ├── app/                         # App shell, navigation & routing
│   ├── components/ui/               # Reusable primitives (MathView, FieldReticle, CountUp)
│   ├── domain/                      # Domain interfaces & types
│   ├── features/
│   │   ├── zoning/                  # Field Lab, boundary/sample entry, 2D/3D map
│   │   ├── leaf/                    # Leaf pathology upload & inference inspector
│   │   ├── monitoring/              # Soil Investigation, Telemetry Replay, CropSight
│   │   └── methodology/             # Methodology explorer, math formulas, defense Q&A
│   └── services/                    # Typed API client services
│
├── services/                        # Modular backend microservices
│   ├── zoning/                      # Core FastAPI service (Zoning, Crop Fit, Gateway)
│   │   ├── app/                     # Algorithms (IDW, FCM, K-Means, SHI, WSN)
│   │   ├── tests/                   # Pytest suite (99 comprehensive tests)
│   │   └── requirements.txt         # Core backend dependencies
│   ├── leaf/                        # Leaf diagnosis model inference & training
│   │   ├── models/                  # Pinned MobileNetV3-Small artifact & metadata
│   │   └── train.py                 # Reproducible GPU training pipeline
│   ├── telemetry/                   # Historical telemetry replay & forecasting
│   │   ├── app/                     # GRU inference, playback engine, FAO-56
│   │   └── data/                    # Pinned Parma trial dataset & SHA-256 manifest
│   └── cropsight/                   # Google Earth Engine remote sensing sub-service
│       ├── main.py                  # FastAPI sub-application for Sentinel-2 NDVI
│       └── requirements.txt         # CropSight dependencies
│
├── data/
│   └── demo/soil-zoning/            # 10 paired GeoJSON boundaries & CSV soil lab samples
│
└── docs/                            # Comprehensive architectural documentation
    ├── plans/                       # Five-phase engineering master plans (Phases 1–5)
    ├── decisions/                   # Architecture Decision Records (ADRs 0001–0012)
    ├── research/                    # Deep-dive research papers & benchmarks
    ├── PRD.md                       # Product Requirements Document
    ├── TRD.md                       # Technical Requirements Document
    ├── DELIVERY.md                  # Release acceptance checklist & verification record
    ├── PROJECT-GUIDE.md             # End-to-end system and data flow guide
    └── GLOSSARY.md                  # Canonical precision agriculture terminology
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10, v3.11, or v3.12 (Python 3.10+ recommended)
- **Git**

---

### Step 1: Clone & Configure Environment

```powershell
git clone https://github.com/ArjunS-04/KshetraSense.git
cd KshetraSense

# Copy environment configuration template
Copy-Item .env.example .env
```

Review `.env` to customize settings. By default, the application runs fully locally without external API keys:
- `VITE_ZONING_API_URL=http://127.0.0.1:8000`
- `SOILGRIDS_WCS_URL=https://maps.isric.org/mapserv`
- `EARTHENGINE_PROJECT=kshetrasense-earth-engine` *(required only for live CropSight satellite queries)*

---

### Step 2: Launch Backend API Service

```powershell
# Navigate to the zoning service directory
cd services/zoning

# Create and activate a Python virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies (CPU PyTorch, FastAPI, NumPy, Scikit-Learn, Keras)
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Start the FastAPI gateway server
python -m uvicorn app.main:app --reload --port 8000
```

The interactive OpenAPI / Swagger contract is accessible at:  
👉 **`http://127.0.0.1:8000/docs`**

---

### Step 3: Launch React Frontend

In a second terminal:

```powershell
# From the repository root
npm install
npm run dev
```

Open your browser at:  
👉 **`http://localhost:3000/`** (or `http://127.0.0.1:3000/`)

---

### Step 4 (Optional): Google Earth Engine Authentication

To enable live Copernicus Sentinel-2 satellite queries in **Vegetation Monitoring (CropSight)**:

```powershell
# Run Google Earth Engine authentication in your terminal
earthengine authenticate
```

Set your authorized GCP Project ID in `.env`:
```env
EARTHENGINE_PROJECT=your-gcp-project-id
```

*(If unauthenticated, the application displays an honest initialization prompt rather than falling back to fabricated satellite images).*

---

## 🧪 Verification & Test Suite

KshetraSense maintains rigorous automated test coverage across frontend and backend modules:

### Backend Test Suite (Python / Pytest)
Includes full contract tests for IDW interpolation, K-means++, Fuzzy C-means, SHI formulation, WSN medoid placement, Leaf MobileNetV3 inference, SoilGrids WCS queries, and Parma telemetry replay:

```powershell
services\zoning\.venv\Scripts\python.exe -m pytest services/zoning/tests -v
```
> **Result: `99 passed, 0 failed` in ~23s**

### Frontend Test Suite (Vitest)
Validates UI models, GeoJSON parsers, CSV importers, comparability logic, and view components:

```powershell
npm test
```
> **Result: `16 test files, 64 passed, 0 failed`**

### TypeScript Typecheck
```powershell
npm run typecheck
```
> **Result: `0 errors`**

---

## 📊 Demonstration Datasets

Ten paired, georeferenced demonstration datasets are bundled in [`data/demo/soil-zoning/`](data/demo/soil-zoning/) for instant exploration:

| Dataset | GeoJSON Polygon | CSV Lab Samples | Agronomic Pattern |
|---|---|---|---|
| **01** | `baseline-field.geojson` | `baseline-field.csv` | Balanced baseline nutrient distribution |
| **02** | `alkaline-corridor.geojson` | `alkaline-corridor.csv` | pH gradient with alkaline eastern corridor |
| **03** | `acidic-pocket.geojson` | `acidic-pocket.csv` | Acidic southwest depression ($pH < 5.5$) |
| **04** | `high-salinity.geojson` | `high-salinity.csv` | Elevated EC gradient across northern boundary |
| **05** | `salinity-gradient.geojson` | `salinity-gradient.csv` | Linear salinity transition |
| **06** | `low-nitrogen.geojson` | `low-nitrogen.csv` | Nitrogen deficiency in center zone |
| **07** | `low-phosphorus.geojson` | `low-phosphorus.csv` | Phosphorus deficiency across outer cells |
| **08** | `low-potassium.geojson` | `low-potassium.csv` | Potassium depletion in sandy region |
| **09** | `mixed-nutrient-field.geojson` | `mixed-nutrient-field.csv` | Complex multi-nutrient spatial heterogeneity |
| **10** | `high-organic-matter.geojson` | `high-organic-matter.csv` | High nutrient density with optimal SHI |

*(Load these directly via the **Demo Datasets** dropdown in the Soil Zoning workspace).*

---

## 📚 Documentation Index

For in-depth architectural and scientific documentation, consult the `docs/` directory:

| Document | Description |
|---|---|
| [**Project Guide**](docs/PROJECT-GUIDE.md) | Comprehensive plain-language guide detailing data flows, algorithms, and interpretation. |
| [**Master Plan**](docs/plans/README.md) | Engineering roadmap and status across all five implementation phases. |
| [**Phase 1 Plan**](docs/plans/phase-1-backend-algorithmic-core.md) | Algorithmic specification: UTM grid, IDW, SHI, Auto-K, and WSN placement. |
| [**Phase 2 Plan**](docs/plans/phase-2-soil-zoning-ui-redesign.md) | Spatial Soil Zoning UI/UX architecture and Crop Fit integration. |
| [**Phase 3 Plan**](docs/plans/phase-3-wsn-telemetry-service.md) | Historical telemetry replay API, Parma trial dataset, and GRU model specification. |
| [**Phase 4 Plan**](docs/plans/phase-4-field-monitoring-transformation.md) | Field Monitoring hub, SoilGrids WCS adapter, and CropSight remote sensing. |
| [**Phase 5 Plan**](docs/plans/phase-5-leaf-contract-and-verification.md) | Leaf pathology MobileNetV3-Small classifier contract, evaluation, and defense guide. |
| [**Product Requirements (PRD)**](docs/PRD.md) | Product scope, user outcomes, and explicit evidence boundaries. |
| [**Technical Requirements (TRD)**](docs/TRD.md) | System contracts, performance budgets, WebGL limits, and security constraints. |
| [**Delivery Plan**](docs/DELIVERY.md) | Milestone acceptance criteria, test matrices, and verification status. |
| [**Architecture Decision Records (ADRs)**](docs/decisions/) | Key architectural decisions (ADRs 0001–0012). |
| [**Glossary**](GLOSSARY.md) | Canonical definitions for precision agriculture and remote sensing terminology. |

---

## ⚖️ Scientific Rigor & Responsible AI

1. **No Disguised Data**: The application starts empty by default. Synthetic demonstration datasets are explicitly marked and never represented as genuine lab reports or farm measurements.
2. **Uncalibrated Model Scores**: The leaf classifier outputs raw softmax probability scores across 17 trained conditions. These are not calibrated posterior probabilities; every output carries a mandatory manual review warning.
3. **Sensor Signal vs. Volumetric Water Content**: Telemetry soil humidity is preserved as `%RH` sensor signal from the source instrumentation; it is not converted to calibrated Volumetric Water Content (VWC) without sensor calibration curves.
4. **Model Performance Disclosure**: The experimental GRU humidity forecaster did not beat the persistence baseline across evaluated horizons (+6h, +12h, +24h); this weakness is explicitly presented in the UI to prevent reliance for irrigation scheduling.
5. **Advisory Scope**: KshetraSense provides decision support only. It does not actuate field valves, dispense agrochemicals, or substitute for certified agronomist counsel.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
