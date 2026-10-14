# Phase 1: Backend Algorithmic Core

**Scope:** `services/zoning/app/` — Python backend  
**Depends on:** Nothing (this is the foundation)  
**Produces:** 6 new Python modules + updated API endpoints + test suites  
**Status:** Implemented and validated on 2026-10-14. The legacy `/v1/zoning/run` contract remains available for compatibility; the Phase 2 workspace now uses `/v2/zoning/run`.

---

## 1.1 Overview & Rationale

The existing `/v1/zoning/run` endpoint accepts pre-filled grid cells. Phase 1 adds a separate field-scale workflow that starts from a GeoJSON boundary and georeferenced laboratory samples, then returns spatial estimates, soil-profile zones, diagnostics, and suggested sensor/gateway locations.

This is a runnable, versioned implementation of the scoped field pipeline—not a claim that every method in the attached research paper has been reproduced or independently validated. Results are screening outputs from sparse samples; no field validation, calibrated agronomic thresholds, crop probability, radio-coverage guarantee, or deployment artifact persistence is claimed.

### What stays vs. what changes

| File | Action |
|---|---|
| `algorithms.py` | Retain the NumPy K-Means++ and Bezdek FCM implementations; use a bounded-memory exact silhouette calculation and a vectorized FCM membership update. Keep existing `/v1` behavior. |
| `schemas.py` | **EXTEND.** Add new request/response models for the redesigned pipeline. |
| `service.py` | Keep `run_zoning()` for `/v1`; add `run_field_zoning()` to orchestrate the new pipeline behind `/v2`. |
| `crop_fit.py` | **KEEP AS-IS.** Crop Fit consumes zone summaries — its interface doesn't change. |
| `soilgrids.py` | Outside Phase 1's field pipeline. It now provides optional public ISRIC WCS regional context; see [Decision 0010](../decisions/0010-soilgrids-wcs-context-adapter.md). |
| `main.py` | **EXTEND.** Add new API endpoints for the redesigned pipeline. |

---

## 1.2 New Module: `spatial.py` — Boundary Discretization Engine

### Purpose
Accept a GeoJSON Polygon representing the field boundary, project it from WGS84 (longitude/latitude) to a local UTM CRS, and discretize it into a 5 m or 10 m square-cell grid. Cells are retained when their centers are strictly inside the polygon; holes are excluded. Edge-cell areas and returned zone geometries are clipped to the boundary.

### Input Contract

```python
class FieldBoundaryInput(BaseModel):
    """GeoJSON polygon defining the field boundary."""
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]  # GeoJSON ring(s): [[[lon, lat], ...]]
    crs: Literal["EPSG:4326", "OGC:CRS84"] = "EPSG:4326"

class FieldZoningRequest(BaseModel):
    boundary: FieldBoundaryInput
    cellSizeM: Literal[5.0, 10.0] = 10.0
```

### Processing Steps

1. **Parse & Validate Polygon:**
   - Verify the polygon is closed (first coordinate == last coordinate).
   - Verify the polygon is simple (no self-intersections).
   - Use `shapely.geometry.Polygon` for validation.
   - Compute and report polygon area in hectares.

2. **Project to Local Metric CRS:**
   - Determine the UTM zone from the polygon's representative interior point.
     - Formula: `utm_zone = int((representative_lon + 180) / 6) + 1`, clamped to zones 1–60.
     - For India (77°E): UTM Zone 43N → EPSG:32643
     - For Italy/Parma (10°E): UTM Zone 32N → EPSG:32632
   - Transform all polygon coordinates from WGS84 to the UTM CRS.
   - Use `pyproj.Transformer` for coordinate transformation.
   - Record the CRS and transformation in the output for provenance.

3. **Generate Internal Grid:**
   - Compute the polygon's axis-aligned bounding box in UTM meters.
   - Generate a regular grid of candidate cell centers at `cell_size_m` spacing:
     ```
     x_coords = np.arange(bbox_min_x + cell_size/2, bbox_max_x, cell_size)
     y_coords = np.arange(bbox_min_y + cell_size/2, bbox_max_y, cell_size)
     ```
   - Test candidate centers with Shapely `contains_xy`; row zero is at the north edge and column zero at the west edge.
   - Assign sequential IDs (`cell-0001`, …), row/column indices, WGS84 and UTM centers, and boundary-clipped cell area.
   - Reject a grid with no interior centers, more than 100,000 bounding-box candidates, or more than 5,000 retained cells.

4. **Output:**
   ```python
   @dataclass
   class DiscretizedField:
       polygon_wgs84: list[list[float]]     # Original WGS84 coordinates
       polygon_utm: Polygon                 # Projected boundary used internally
       utm_crs: str                         # e.g. "EPSG:32643"
       cell_size_m: float                   # 5.0 or 10.0
       area_hectares: float                 # Polygon area
       cells: list[GridCell]                # Interior-center cells with clipped area
       bounding_box_utm: dict               # {min_x, min_y, max_x, max_y}
   
   @dataclass
   class GridCell:
       id: str                              # "cell-0001"
       row: int                             # Grid row index
       column: int                          # Grid column index
       center_utm: tuple[float, float]      # (easting, northing) in meters
       center_wgs84: tuple[float, float]    # (lon, lat) back-projected
       area_m2: float                       # Cell footprint clipped to field boundary
   ```

### Dependencies
- `shapely>=2.1.2,<3.0` — polygon operations and vectorized point-in-polygon
- `pyproj>=3.8,<4.0` — CRS projection (WGS84 ↔ UTM)
- `numpy` — grid generation

### Test Cases (`tests/test_spatial.py`)

| Test | Input | Expected |
|---|---|---|
| Square field 100m×100m at 10m cell size | 4-vertex square polygon | 100 interior cells, correct area and stable row/column indices |
| Polygon with hole | Outer ring + inner ring | Cell centers in the hole are excluded |
| Self-intersecting polygon | Bowtie shape | Raises `SpatialValidationError` |

---

## 1.3 New Module: `interpolation.py` — IDW Spatial Interpolation

### Purpose
Given 3–50 georeferenced soil laboratory sample points (5–10 recommended for the intended workflow) with pH, EC, N, P, and K measurements, predict each property at every retained grid-cell center using inverse-distance weighting (IDW). Every sample must declare the same sampling-depth interval. Missing collection date or laboratory method is preserved and surfaced as a warning rather than silently inferred.

### Why IDW and Not Kriging

IDW is selected for its transparent, deterministic behavior and small input contract. This is a pragmatic project choice, not a claim that IDW is universally more accurate than kriging or suitable for every field. Sample layout and spatial autocorrelation affect quality; the API therefore reports leave-one-out errors and nearest-sample distances, and it labels cell values as interpolated estimates.

### Mathematical Formulation

For a prediction point $x_0$ and sample points $x_1, x_2, \ldots, x_N$ with measured values $Z_1, Z_2, \ldots, Z_N$:

$$\hat{Z}(x_0) = \frac{\sum_{i=1}^{N} w_i \cdot Z_i}{\sum_{i=1}^{N} w_i}$$

where the weight $w_i$ is the inverse of the distance raised to power $p$:

$$w_i = \frac{1}{d(x_0, x_i)^p}$$

- **Power parameter:** $p = 2$ (fixed for this pipeline version).
- **Distance:** Euclidean distance in UTM meters between cell center and sample point.
- **Coincident point guard:** If $d(x_0, x_i) < \epsilon$ (e.g., $\epsilon = 0.01$ m), assign $\hat{Z}(x_0) = Z_i$ directly (exact interpolation at sample locations).

### Input Contract

```python
class SoilSample(BaseModel):
    """A georeferenced laboratory soil test point."""
    id: str                                    # "sample-1"
    latitude: float                            # WGS84 latitude
    longitude: float                           # WGS84 longitude
    measurements: dict[str, float]             # {"pH": 6.5, "ec": 1.2, "nitrogen": 85, ...}
    depthCm: str                              # Required; same interval for every sample
    collection_date: str | None = None         # ISO date
    lab_method: str | None = None              # e.g. "Walkley-Black", "Kjeldahl"

class InterpolationRequest(BaseModel):
    samples: list[SoilSample]                  # 3–50 samples; 5–10 recommended
    target_cells: list[GridCell]               # From spatial.py output
    properties: list[str] = ["pH", "ec", "nitrogen", "phosphorus", "potassium"]
    power: float = 2.0                         # IDW power parameter
```

### Processing Steps

1. **Validate Sample Count and Context:** Require 3 ≤ N ≤ 50; warn if N < 5. Require an explicit, common sampling-depth interval. Report incomplete or mixed collection-date/laboratory-method metadata as warnings.
2. **Project Samples:** Transform sample lat/lon to UTM using the same CRS as the grid.
3. **Check Sample Spread:** Reject sample locations separated by 0.01 m or less. Samples are not required to be one cell-size apart.
4. **Interpolate Each Property Independently:**
   - For each property (pH, EC, N, P, K), for each cell center, compute the IDW-weighted prediction.
   - Store as a property-keyed dictionary per cell.
5. **Compute Cross-Validation Metrics (Leave-One-Out):**
   - For each sample $i$, remove it, interpolate its location from the remaining $N-1$ samples, compute the error $e_i = Z_i - \hat{Z}_{-i}$.
   - Report LOOCV RMSE and MAE per property.

### Output

```python
@dataclass
class InterpolatedField:
    cells: list[InterpolatedCell]              # One per retained grid cell
    sample_locations: list[dict]               # Sample points in UTM
    cross_validation: dict[str, dict]          # Per-property LOOCV metrics
    interpolation_method: str                  # "IDW"
    power_parameter: float                     # 2.0

@dataclass
class InterpolatedCell:
    cell_id: str
    row: int
    column: int
    center_utm: tuple[float, float]
    values: dict[str, float]                   # {"pH": 6.42, "ec": 1.15, "nitrogen": 78.3, ...}
    nearest_sample_distance_m: float
    area_m2: float
```

### Test Cases (`tests/test_interpolation.py`)

| Test | Description | Pass Criteria |
|---|---|---|
| Exact points and midpoint | Predict at a sample and between two points | Coincident point returns its sample value; the midpoint returns the inverse-distance weighted result |
| Interpolation range | Targets around bounded sample values | Predictions remain within the observed sample range |
| Invalid numerical inputs | Non-finite values or invalid power | Raises `InterpolationValidationError` |
| End-to-end LOOCV | Valid field pipeline request | RMSE and MAE are present for every requested property; no quality threshold is claimed |

---

## 1.4 New Module: `shi.py` — KshetraSense Soil Health Index

### Purpose
Transform pH, EC, nitrogen, phosphorus, and potassium readings into unitless nonlinear indicator scores, then combine them into the project-defined **KshetraSense Soil Health Index (SHI)** per cell. This is not an official USDA/NRCS or SMAF index and is not crop-specific or locally calibrated.

### Why Non-Linear Scoring

Raw values use different units (pH is dimensionless, EC is dS/m, N/P/K are mg/kg). The curve shapes and parameters below are provisional project assumptions, not empirically fitted response functions:
- pH uses a **bell-shaped curve centered at 6.5**; that center is a scoring parameter, not a universal crop optimum.
- EC uses a **decreasing logistic curve** with midpoint 2.0 dS/m; its score behavior is not a crop-specific salt-tolerance threshold.
- N/P/K use **increasing logistic curves**; this is a chosen score mapping, not evidence that more nutrient is always better or that any reading is sufficient for a crop.

### Individual Scoring Functions

Each function maps a raw value to a score $S \in [0, 1]$:

#### pH — Optimum Bell Curve
$$S_{\text{pH}}(\text{pH}) = \exp\left(-\frac{(\text{pH} - \mu)^2}{2\sigma^2}\right)$$
- $\mu = 6.5$ (provisional curve center)
- $\sigma = 0.8$ (controls width)
- pH=6.5 → S=1.0; pH=5.0 → S≈0.33; pH=4.0 → S≈0.01; pH=8.5 → S≈0.05

#### EC — Less-is-Better Sigmoid
$$S_{\text{EC}}(\text{EC}) = \frac{1}{1 + \exp(k \cdot (\text{EC} - x_0))}$$
- $k = 2.5$ (steepness)
- $x_0 = 2.0$ dS/m (inflection point)
- EC=0.5 → S≈0.98; EC=2.0 → S=0.50; EC=4.0 → S≈0.007

#### Nitrogen — More-is-Better Sigmoid
$$S_N(N) = \frac{1}{1 + \exp(-0.06 \cdot (N - 60))}$$
- N=20 mg/kg → S≈0.08; N=60 mg/kg → S=0.50; N=120 mg/kg → S≈0.98

#### Phosphorus — More-is-Better Sigmoid
$$S_P(P) = \frac{1}{1 + \exp(-0.12 \cdot (P - 25))}$$
- P=10 mg/kg → S≈0.14; P=25 mg/kg → S=0.50; P=50 mg/kg → S≈0.95

#### Potassium — More-is-Better Sigmoid
$$S_K(K) = \frac{1}{1 + \exp(-0.03 \cdot (K - 150))}$$
- K=80 mg/kg → S≈0.11; K=150 mg/kg → S=0.50; K=250 mg/kg → S≈0.95

### Composite SHI

$$\text{SHI} = \left(w_{\text{pH}} \cdot S_{\text{pH}} + w_{\text{EC}} \cdot S_{\text{EC}} + w_N \cdot S_N + w_P \cdot S_P + w_K \cdot S_K\right) \times 100$$

Default weights (sum to 1.0):

| Property | Default design weight |
|---|---:|
| pH | 0.25 |
| EC | 0.20 |
| N | 0.20 |
| P | 0.15 |
| K | 0.20 |

The weighted average is bounded from 0 to 100. The weights and curve parameters are versioned implementation assumptions; they are not official scoring guidance, validated soil-health thresholds, or a suitability/probability model. The API returns the component scores and limitations alongside the total.

### API

```python
def score_property(property_name: str, raw_value: float) -> float:
    """Return unitless score S ∈ [0, 1] for a single soil property."""

def compute_shi(values: dict[str, float], weights: dict[str, float] | None = None) -> dict:
    """Return individual scores and composite SHI for a cell."""
    # Returns scores, normalized weights, indexName and interpretation with the 0–100 shi.
```

### Test Cases (`tests/test_shi.py`)

| Test | Input | Expected |
|---|---|---|
| Bell-shaped pH and custom weights | Compare pH 5.7 and 7.3; apply pH/EC weights | Symmetry and normalized weights; known result checked |
| Default weighting and EC response | Compare otherwise-identical low-EC and high-EC profiles | Default weights sum to 1 and higher EC lowers this project's score |
| Input validation | Non-finite values, negative EC, zero-total weights | Clear validation error |

---

## 1.5 Updated Module: `clustering.py` — Auto-K* & Adjacency Merging

### Purpose
Extend the existing K-Means++/FCM in `algorithms.py` with two critical missing features:
1. **Automatic optimal K* selection** via silhouette sweep.
2. **Adjacency-aware zone merging** to eliminate fragmented micro-zones.

### 1.5.1 Auto-K* Sweep

Instead of the user guessing K, sweep K from 2 to `max_k` (default 6) and pick the best:

```python
def auto_select_k(
    data: np.ndarray,
    method: str,           # "kmeans" or "fcm"
    seed: int,
    max_k: int = 6,
    fuzziness: float = 2.0,
) -> AutoKResult:
```

**Algorithm:**
1. For each $K \in [2, \min(\text{maxK}, N-1, \text{distinct profiles})]$:
   - Run the clustering algorithm.
   - Compute mean Silhouette Score $\bar{s}(K)$.
   - If FCM, also compute Fuzzy Partition Coefficient $\text{FPC}(K)$.
2. Select $K^* = \arg\max_{K} \bar{s}(K)$; exact ties choose the smaller K.
3. FPC and K-means inertia are diagnostics only; silhouette is the implemented selection criterion. Return the tested curve, including null silhouettes when no defined score exists.

**Output:**
```python
@dataclass
class AutoKResult:
    optimal_k: int                           # The selected K*
    sweep: list[KSweepEntry]                 # Results for each K tested
    selection_criterion: str                  # maximum silhouette; ties choose smaller K
    selected_result: KMeansResult | FcmResult # The clustering result at K*

@dataclass
class KSweepEntry:
    k: int
    silhouette: float
    fpc: float | None                        # Only for FCM
    inertia: float | None                    # Only for K-Means
```

### 1.5.2 Adjacency-Aware Zone Merging

After clustering, merge only touching clusters whose mean standardized multivariate soil-profile centroids are sufficiently close. Then split any disconnected pieces into separate contiguous management zones. This is an explicit spatial post-process; it does not merge by SHI alone and does not remove small components.

**Algorithm:**

1. **Build Adjacency Graph $G = (V, E)$:**
   - Vertices $V$ = zone IDs.
   - Edge $(A, B) \in E$ if any cell in zone $A$ is 4-connected (up/down/left/right) to a cell in zone $B$.
   - Edge weight = number of shared grid edges.

2. **Iterative Merge (greedy, most-similar-first):**
   - For each edge $(A, B)$ in the graph, compute the Euclidean distance between cluster centroids in the standardized, non-constant soil-feature space.
   - While the smallest adjacent profile distance is at most `mergeThresholdZ` (default 0.5 z-score units):
     - Merge zones $A$ and $B$ into a single zone.
     - Recompute cluster contacts and profile centroids.
     - Update the adjacency graph (combine edges, remove self-loops).
   - Stop when all remaining adjacent pairs exceed the threshold.

3. **Post-Merge Cleanup:**
   - Re-label zones sequentially: 0, 1, 2, ...
   - Split disconnected four-connected components into distinct zone IDs; retain every component regardless of size.
   - Record the merge log with source clusters, standardized profile distance, and shared edge count.

**Input/Output:**
```python
def merge_adjacent_zones(
    standardized_features: np.ndarray,
    labels: np.ndarray,
    rows: np.ndarray,
    columns: np.ndarray,
    merge_threshold_z: float = 0.5,
) -> MergeResult:

@dataclass
class MergeResult:
    labels: np.ndarray                       # Updated zone labels
    zone_count: int                          # Final number of zones (≤ original K)
    merge_log: list[dict]                    # profileDistanceZ and sharedGridEdges
    original_k: int                          # K before merging
```

### Test Cases (`tests/test_algorithms.py`, `tests/test_clustering.py`)

| Test | Input | Expected |
|---|---|---|
| K-means empty-cluster recovery | Multi-feature profiles with a deterministic empty-cluster case | Farthest eligible point is reseeded without dropping a zone or crashing |
| Auto-K on separated profiles | Three distinct feature groups | K*=3 selected on the deterministic fixture |
| FCM Auto-K | Two separated groups | K*=2 and normalized fuzzy memberships are returned |
| Merge similar adjacent profiles | Adjacent clusters within the configured multivariate z-distance threshold | Merged; log records distance and shared edges |
| Keep dissimilar adjacent profiles | Adjacent clusters beyond threshold | Not merged |
| Split disconnected cluster | One cluster has separated four-connected components | Components receive distinct zone IDs |
| No feature variation | Every input profile is identical | Raises `ClusteringValidationError` rather than inventing zones |

---

## 1.6 New Module: `validation.py` — Perturbation Stability

### Purpose
Estimate conditional sensitivity to the declared sample-measurement noise scenario. These assumptions do not establish lab accuracy, calibrated confidence intervals, or a universal reliability grade.

### Algorithm: Monte Carlo Perturbation Testing

1. **Noise Model (project defaults, not validated instrument tolerances):**
   | Property | σ (standard deviation) | Default assumption |
   |---|---|---|
   | pH | 0.1 | Standard pH meter precision |
   | EC | 5% of value | Project sensitivity assumption |
   | Nitrogen | 5% of value | Project sensitivity assumption |
   | Phosphorus | 5% of value | Project sensitivity assumption |
   | Potassium | 5% of value | Project sensitivity assumption |
   - A reported per-sample standard uncertainty overrides the default for that property/sample.

2. **Procedure:**
   - For each run (default $T=10$, configurable from 0 to 50), perturb the original sample measurements, preserving sample locations. Ten is an interactive default; request up to 50 for a more detailed sensitivity analysis.
   - Re-run IDW and the clustering/adjacency/component steps at the already selected K and same clustering seed. K is held fixed, so the result is conditional on the original Auto-K selection.
   - Clamp pH to [0,14] and non-pH measurements to non-negative values; record the noise assumptions and any supplied standard uncertainty.
   - Compute SHI again for sensitivity summaries; SHI does not enter clustering.
   - Record the final contiguous-zone labels $L_t$.
   - Compute pairwise **Adjusted Rand Index (ARI)** between the original labels $L_0$ and each perturbed $L_t$.

3. **Adjusted Rand Index (ARI):**
   - ARI = 1.0 → identical partitions.
   - ARI = 0.0 → random agreement.
   - ARI can be negative; interpret the distribution in context of sample coverage and the noise assumptions.
   - No pass/fail threshold or stability grade is assigned.

4. **Output:**
   ```python
   @dataclass
   class StabilityReport:
       num_perturbations: int                  # 50
       noise_model: dict[str, float]           # {"pH": 0.1, "nitrogen": "5%", ...}
       ari_scores: list[float]                 # 50 ARI values
       mean_ari: float                         # Mean across all perturbations
       std_ari: float                          # Standard deviation
       min_ari: float                          # Worst case
       per_cell_shi_std_dev: dict[str, float]    # Spread across baseline and simulated runs; not a confidence interval
       per_cell_flip_rate: dict[str, float]    # How often each cell changes zone
   ```

### Test Cases (`tests/test_validation.py`)

| Test | Input | Expected |
|---|---|---|
| Label-invariant comparison | Same partition under different numeric labels | ARI = 1.0 |
| Deterministic perturbation | Same source measurements and seed | Repeated perturbations match and the source sample is unchanged |
| Reported uncertainty | Supplied property uncertainty | It overrides the default for that sample/property |
| End-to-end sensitivity | Field request with nonzero perturbation count | Response includes the requested run count and ARI values |

---

## 1.7 New Module: `wsn_placement.py` — WSN Node & Cluster Head Placement

### Purpose
For each final contiguous zone, suggest an in-zone medoid cell as a candidate sensor location and calculate a geometric gateway candidate. These are geometry-only planning points; the pipeline does not evaluate radio propagation, field access, power, terrain, safety, or installation feasibility.

### Algorithm

#### WSN Node Position: Zone Medoid

The **medoid** is the actual grid cell within a zone that minimizes the sum of Euclidean distances to the other cell centers. It is a spatial candidate only; whether a sensor can or should be installed there requires field verification.

$$\text{medoid}_k = \arg\min_{i \in \text{Zone}_k} \sum_{j \in \text{Zone}_k} \|c_i - c_j\|_2$$

where $c_i$ is the UTM coordinate of cell $i$'s center.

#### Cluster Head / Gateway Position

The gateway candidate is the unconstrained geometric median of the zone medoids. If that point lies outside the field polygon, the implementation projects it to the nearest point on the field geometry. This projection is not guaranteed to be the globally optimal constrained solution for a non-convex field; it is not evidence of LoRa coverage or a network plan.

The unconstrained point is the **geometric median** (Weber point) of the medoid set, computed iteratively via Weiszfeld's algorithm:

$$x^{(t+1)} = \frac{\sum_k \frac{\text{medoid}_k}{\|x^{(t)} - \text{medoid}_k\|}}{\sum_k \frac{1}{\|x^{(t)} - \text{medoid}_k\|}}$$

### Output

`POST /v2/zoning/run` returns a `FieldZoningResponse` JSON object containing a run ID/fingerprint, creation time, and measured processing duration, plus:

- Field boundary, local UTM CRS, cell size, area, cell count, and grid-area coverage.
- Sample locations, values, depth/date/method metadata, uncertainty, and data-context warnings.
- Per-cell IDW estimates, SHI and component scores, nearest-sample distance, cluster/zone IDs, FCM memberships when selected, and a WGS84 footprint clipped to the field boundary. The footprint was added in Phase 2 for map fidelity; it is an additive response field.
- Per-zone area, geometry, soil-profile means/standard deviations, SHI, source cluster IDs, and mean FCM membership where applicable.
- Auto-K silhouette/FPC/inertia diagnostics, adjacency-merge log, sample-perturbation sensitivity report, and WSN/gateway candidates.

The service does not persist a `ZoningDeploymentPlan`, create a Field Monitoring hand-off, or claim that sensor installation is ready.

### Test Cases (`tests/test_wsn_placement.py`)

| Test | Input | Expected |
|---|---|---|
| Medoid correctness | Small synthetic zone | Selected node is an actual in-zone cell with minimum summed distance |
| Gateway candidate | Single zone and multiple-node cases | Candidate stays within the boundary; radio coverage remains false/unvalidated |

---

## 1.8 Updated API Endpoints

### New Endpoint: Full Pipeline

```
POST /v2/zoning/run
```

**Request Body:**
```json
{
  "boundary": {
    "type": "Polygon",
    "coordinates": [[[77.58, 12.97], [77.59, 12.97], [77.59, 12.98], [77.58, 12.98], [77.58, 12.97]]]
  },
  "samples": [
    {"id": "s1", "latitude": 12.972, "longitude": 77.583, "depthCm": "0-15", "measurements": {"pH": 6.2, "ec": 1.1, "nitrogen": 75, "phosphorus": 32, "potassium": 165}},
    {"id": "s2", "latitude": 12.975, "longitude": 77.587, "depthCm": "0-15", "measurements": {"pH": 5.8, "ec": 2.3, "nitrogen": 45, "phosphorus": 18, "potassium": 120}},
    {"id": "s3", "latitude": 12.978, "longitude": 77.584, "depthCm": "0-15", "measurements": {"pH": 6.7, "ec": 0.9, "nitrogen": 90, "phosphorus": 40, "potassium": 190}}
  ],
  "cellSizeM": 10,
  "method": "fcm",
  "maxK": 6,
  "mergeThresholdZ": 0.5,
  "perturbationRuns": 10,
  "seed": 42
}
```

**Response:** `FieldZoningResponse` JSON. N, P, and K are in mg/kg; EC is in dS/m; pH is dimensionless. Input measurements are laboratory samples, while returned cell values are IDW estimates. `selectedK` is chosen by silhouette; the request sets the maximum K, not a manual fixed K.

### Backward Compatibility

Keep the existing `POST /v1/zoning/run` endpoint and its compatibility alias unchanged for existing consumers. The Phase 2 frontend uses `/v2`; deprecation/removal of `/v1` requires a separate consumer check and is not part of this implementation.

---

## 1.9 Dependencies to Add

Add to `services/zoning/requirements.txt`:

```
shapely>=2.1.2,<3.0
pyproj>=3.8,<4.0
```

The pinned ranges are installed and exercised in the current Windows/Python 3.14.7 environment.

---

## 1.10 File Structure After Phase 1

```
services/zoning/
├── app/
│   ├── algorithms.py          # K-Means++, FCM, bounded-memory silhouette
│   ├── clustering.py          # NEW — Auto-K* sweep, adjacency merging
│   ├── crop_fit.py            # KEPT
│   ├── crop_profiles.py       # KEPT
│   ├── interpolation.py       # NEW — IDW spatial interpolation
│   ├── main.py                # EXTENDED — /v2/zoning/run endpoint
│   ├── schemas.py             # EXTENDED — new request/response models
│   ├── service.py             # Legacy /v1 plus new /v2 orchestration
│   ├── shi.py                 # NEW — provisional KshetraSense SHI
│   ├── soilgrids.py           # OPTIONAL ISRIC WCS CONTEXT (outside Phase 1)
│   ├── spatial.py             # NEW — boundary discretization
│   ├── validation.py          # NEW — perturbation stability
│   └── wsn_placement.py       # NEW — zone medoid + cluster head
├── tests/
│   ├── test_algorithms.py     # KEPT
│   ├── test_api.py            # Existing /v1 contract
│   ├── test_clustering.py     # NEW
│   ├── test_crop_fit.py       # KEPT
│   ├── test_interpolation.py  # NEW
│   ├── test_monitoring_api.py # KEPT
│   ├── test_shi.py            # NEW
│   ├── test_spatial.py        # NEW
│   ├── test_field_pipeline_api.py # New /v2 end-to-end contract
│   ├── test_validation.py     # NEW
│   └── test_wsn_placement.py  # NEW
├── pytest.ini
└── requirements.txt           # UPDATED — add shapely, pyproj
```
