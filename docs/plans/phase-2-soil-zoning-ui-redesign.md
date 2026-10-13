# Phase 2: Soil Zoning UI Redesign

**Scope:** `src/features/zoning/` — React / TypeScript frontend & 3D WebGL Canvas  
**Depends on:** Phase 1 (`/v2/zoning/run` endpoint)  
**Produces:** Redesigned interactive zoning workflow, replacement of synthetic brush painting, boundary selector, layer heatmaps, optimal $K^*$ charts, and WSN deployment visualization  
**Estimated effort:** Week 2

---

## 2.1 Overview & Design Rationale

The current Soil Zoning UI (`src/features/zoning/ZoningWorkspace.tsx`) treats the farm as a synthetic rectangular $14 \times 18$ grid and forces the user to manually "paint" soil properties cell-by-cell with a brush tool. This does not represent real-world agronomy or the Phase 1 research paper.

In Phase 2, the UI is overhauled to reflect actual precision farming:
1. **Field Boundary & Geometry:** Load real-world polygon boundaries (GeoJSON) or pick from 3 realistic benchmark farm presets.
2. **Sparse Soil Testing Interface:** Place 5–10 georeferenced soil core sample pins across the field or import an official laboratory soil test card.
3. **Interpolated Heatmap Exploration:** Seamlessly toggle continuous spatial surfaces for pH, EC, N, P, K, and composite Soil Health Index (SHI).
4. **Optimal Zone Formation & Diagnostics:** View the automated $K^*$ Silhouette sweep curve, inspect Fuzzy C-Means membership transitions, and review adjacency merge logs.
5. **WSN Deployment Overlay:** Automatically highlight the calculated **WSN Sensor Node locations (zone medoids)** and the **Cluster Head / LoRa Gateway**, with a one-click action to export the `ZoningDeploymentPlan` directly into the Field Monitoring console.

---

## 2.2 Component Hierarchy & Architecture

```
src/features/zoning/
├── ZoningWorkspace.tsx                 # Main container orchestrating state & steps
├── components/
│   ├── FieldBoundarySelector.tsx       # Presets (Parma, Punjab, Bangalore) + GeoJSON upload
│   ├── SparseSampleTable.tsx           # 5–10 Lab test points table & coordinates
│   ├── InterpolationLayerControls.tsx  # Toggle: pH | EC | N | P | K | Composite SHI
│   ├── SilhouetteOptimizationChart.tsx # Sweep curve across K=2..6 highlighting K*
│   ├── ZoneProfilesDrawer.tsx          # Zone summaries, nutrient means & variance
│   ├── StabilityDiagnosticsModal.tsx   # Monte Carlo perturbation & ARI score view
│   └── DeploymentExportCard.tsx        # WSN deployment plan summary & hand-off button
└── field/
    ├── FieldScene3D.tsx                # R3F 2.5D/3D field renderer (Kept & extended)
    ├── FieldSurfaceMesh.tsx            # Polygon-clipped mesh with continuous shader/color mapping
    ├── SamplePins3D.tsx                # 3D interactive marker pins for sparse soil samples
    └── WsnNodesOverlay3D.tsx           # 3D Sensor Nodes (Medoids) & LoRa Gateway Mast
```

---

## 2.3 Detailed Feature Specifications

### 2.3.1 Boundary Presets & Custom Boundary Loader

To support both instant testing and custom real-world boundaries, provide a dropdown selector with three pre-configured benchmark farms alongside a custom GeoJSON file importer:

1. **Preset 1: Parma Tomato Field (Italy)** — *4.2 hectares*
   - Direct spatial boundary matching the Belli et al. (2022) tomato research plot.
   - 3 distinct irrigation regimes (100%, 60%, 30% Irriframe lines).
   - Pre-loaded with 8 realistic soil core points (pH 7.1–7.9, EC 0.8–2.4 mS/cm, clay-loam texture).
2. **Preset 2: Punjab Alluvial Wheat Plot (Ludhiana, India)** — *6.5 hectares*
   - Indo-Gangetic alluvial plain geometry.
   - Pre-loaded with 10 soil test points exhibiting moderate alkalinity (pH 7.8–8.4) and nitrogen deficiency typical of intensive cereal cropping.
3. **Preset 3: Bangalore Horticulture Testbed (Karnataka, India)** — *3.8 hectares*
   - Red sandy-loam soil with acidic pockets (pH 5.4–6.6) and high potassium variance.
4. **Custom GeoJSON Importer:**
   - Drag-and-drop `.geojson` or `.json` file containing a `Polygon` feature.
   - Validates closure, non-intersection, and area ($0.5\text{ ha} \le \text{Area} \le 50\text{ ha}$).
   - Automatically re-centers the 3D scene camera to the polygon's bounding box.

### 2.3.2 Sparse Sample Pinning & Table Editor

- Users can either use the preset soil sample points or click anywhere within the 3D/2.5D field surface to place a new sample pin (clamped to the boundary polygon).
- Pin limit: Enforced between **3 and 15 samples** (recommended 5–10).
- Clicking a pin opens a modal/drawer displaying the lab test parameters:
  - $\text{pH}$ (3.5 – 9.5)
  - $\text{EC}$ ($0.0 - 5.0\text{ dS/m}$)
  - $\text{Nitrogen } N$ ($0 - 300\text{ kg/ha}$)
  - $\text{Phosphorus } P$ ($0 - 150\text{ kg/ha}$)
  - $\text{Potassium } K$ ($0 - 500\text{ kg/ha}$)
  - Sampling Depth (e.g. $0-15\text{ cm}$)

### 2.3.3 Continuous Interpolation Layer Viewer

Once samples are placed, clicking **"Interpolate Soil Surfaces"** calls the Phase 1 backend IDW engine. The user can switch between multi-spectral surface heatmaps using a segmented control:

- **Composite Soil Health Index (SHI):** Colormap ranging from Burnt Sienna (Low SHI, $<40$) to Olive Ochre (Medium, $40–70$) to Lush Emerald (High, $>70$).
- **Soil pH:** Standard agronomic gradient (Red = Acidic $<5.5$, Green = Neutral $6.0–7.2$, Blue/Purple = Alkaline $>8.0$).
- **Electrical Conductivity (EC):** Salinity warning gradient (Pale Yellow = Low $<1.0$, Orange = Moderate $1.0–2.0$, Crimson = Saline $>2.5$).
- **Nutrients (N, P, K):** Viridis/Cividis continuous scales showing deficit vs. sufficiency zones.

### 2.3.4 Automated Zone Optimization & Clustering

- The zoning panel replaces the manual slider with an **"Auto-Detect Optimal Zones ($K^*$)"** toggle:
  - When enabled, it executes the silhouette sweep across $K \in [2, 6]$ and renders an interactive line chart showing the Silhouette score and Fuzzy Partition Coefficient (FPC) per $K$.
  - The peak $K^*$ is automatically selected with an indicator: e.g., *"Optimal $K^*=3$ detected (Silhouette: 0.742)"*.
  - Users can still manually override $K$ if desired for agronomic reasons.
- **FCM Transition Contours:**
  - Displays fuzzy cluster membership gradients ($u_{ik}$).
  - Cells near zone borders with mixed memberships (e.g., $u_1 = 0.45, u_2 = 0.55$) are rendered with dotted boundary hatching to indicate physical transition zones rather than sharp barriers.
- **Adjacency Merge Confirmation:**
  - If two adjacent zones have $|\Delta\text{SHI}| < \varepsilon$, a banner explains: *"Zones 2 and 4 merged automatically ($\Delta\text{SHI} = 3.2 < 5.0$) to avoid fragmented micro-management."*

### 2.3.5 WSN Deployment Overlay in 3D Scene

The 3D canvas (`FieldScene3D.tsx`) renders the agronomic hardware deployment plan:
- **Zone Medoid Nodes:** Each management zone displays a realistic 3D sensor node marker (pole with solar panel and soil probe into the terrain) placed at the exact calculated medoid cell.
- **Cluster Head (LoRa Gateway):** Rendered as a communications mast with directional antenna placed at the Weiszfeld geometric median.
- **Coverage Dashed Lines:** Light dashed vectors connecting each sensor node to the Cluster Head with the distance in meters displayed on hover.

### 2.3.6 "Export Deployment Plan" Hand-Off Action

A prominent action button **"Deploy to Field Monitoring"**:
- Generates an immutable `ZoningDeploymentPlan` JSON artifact.
- Persists this deployment in application state / local storage.
- Navigates the user directly to the **Field Monitoring $\to$ WSN Telemetry Console** tab with the zones and node coordinates pre-loaded.

---

## 2.4 Data Models & TypeScript Interfaces

```typescript
export interface FieldBoundary {
  name: string;
  source: 'preset' | 'custom_geojson';
  polygonWgs84: [number, number][]; // [lon, lat] pairs
  areaHectares: number;
  utmCrs: string;
}

export interface SparseSoilSample {
  id: string;
  latitude: number;
  longitude: number;
  depthCm: string;
  values: {
    ph: number;
    ec: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
  };
}

export interface ZoningDeploymentPlan {
  planId: string;
  createdAt: string;
  boundary: FieldBoundary;
  zones: {
    zoneId: number;
    label: string;
    cellCount: number;
    areaM2: number;
    areaPercentage: number;
    meanShi: number;
    meanValues: Record<string, number>;
  }[];
  wsnNodes: {
    zoneId: number;
    cellId: string;
    positionWgs84: [number, number]; // [lon, lat]
    positionUtm: [number, number];
    assignedTelemetryLine: string; // e.g. "Line 1 (100% Irriframe)"
  }[];
  clusterHead: {
    positionWgs84: [number, number];
    positionUtm: [number, number];
    totalDistanceM: number;
  };
  stabilityScore: {
    meanAri: number;
    grade: 'Excellent' | 'Good' | 'Fair' | 'Unstable';
  };
}
```

---

## 2.5 Verification & Acceptance Criteria

1. **No Canvas Painting:** Verify that all manual cell brush tools, pencil sliders, and synthetic matrix generators are removed from the main workflow.
2. **Preset Loading:** Selecting *Parma Tomato Farm* loads the exact boundary and 8 sample points in $<100\text{ms}$.
3. **Heatmap Transitions:** Toggling between pH, EC, NPK, and SHI updates the 3D surface shader without re-triggering network requests.
4. **Auto-K Accuracy:** On the benchmark field, auto-selection picks $K^*=3$ and matches the backend Python response.
5. **Node Placement Inspection:** Clicking a 3D WSN node pin opens an inspector card showing its zone ID, coordinate, and target sensor metrics.
6. **Export Verification:** Clicking "Deploy to Field Monitoring" properly writes the `ZoningDeploymentPlan` to state and unlocks the WSN Telemetry Console.
