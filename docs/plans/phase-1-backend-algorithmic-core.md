# Phase 1: Backend Algorithmic Core

**Scope:** `services/zoning/app/` — Python backend  
**Depends on:** Nothing (this is the foundation)  
**Produces:** 6 new Python modules + updated API endpoints + test suites  
**Estimated effort:** Week 1

---

## 1.1 Overview & Rationale

The current backend (`services/zoning/app/service.py`) accepts a flat array of pre-filled `SoilCell` objects from the frontend, z-score normalizes them, runs K-Means++ or FCM, and returns zone labels. This is Step 2.5 of the Phase 1 Algorithm PDF — but Steps 2.1–2.4, 2.6–2.8, and 2.10 are completely absent.

Phase 1 fills every algorithmic gap between the current code and the paper. After this phase, the backend will accept a field boundary polygon + sparse soil sample points, and produce a complete `ZoningDeploymentPlan` including interpolated surfaces, SHI scores, optimal zones, stability metrics, and WSN node coordinates.

### What stays vs. what changes

| File | Action |
|---|---|
| `algorithms.py` | **KEEP AS-IS.** K-Means++ and Bezdek FCM are mathematically correct. |
| `schemas.py` | **EXTEND.** Add new request/response models for the redesigned pipeline. |
| `service.py` | **REFACTOR.** Rewire `run_zoning()` to use the new pipeline stages. Keep the old endpoint temporarily for backward compatibility during UI migration. |
| `crop_fit.py` | **KEEP AS-IS.** Crop Fit consumes zone summaries — its interface doesn't change. |
| `soilgrids.py` | **KEEP AS-IS.** Remains optional Phase 0 regional context. |
| `main.py` | **EXTEND.** Add new API endpoints for the redesigned pipeline. |

---

## 1.2 New Module: `spatial.py` — Boundary Discretization Engine

### Purpose
Accept a GeoJSON polygon representing the field boundary, project it from WGS84 (lat/lon) to a local metric coordinate reference system (UTM), and discretize the interior into a regular grid of square cells. Only cells whose centers fall inside the polygon are retained.

### Input Contract

```python
class FieldBoundaryRequest(BaseModel):
    """GeoJSON polygon defining the field boundary."""
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]  # GeoJSON ring(s): [[[lon, lat], ...]]
    crs: str = "EPSG:4326"               # Input CRS (default WGS84)
    cell_size_m: float = 10.0            # Grid cell edge length in meters (5 or 10)
```

### Processing Steps

1. **Parse & Validate Polygon:**
   - Verify the polygon is closed (first coordinate == last coordinate).
   - Verify the polygon is simple (no self-intersections).
   - Use `shapely.geometry.Polygon` for validation.
   - Compute and report polygon area in hectares.

2. **Project to Local Metric CRS:**
   - Determine the appropriate UTM zone from the polygon centroid.
     - Formula: `utm_zone = int((centroid_lon + 180) / 6) + 1`
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
   - For each candidate center `(x, y)`, test if it lies inside the projected polygon using Shapely's `polygon.contains(Point(x, y))`.
   - Assign each interior cell a sequential ID: `cell-001`, `cell-002`, ...
   - Also assign a `(row, column)` index relative to the bounding box grid for adjacency computation.

4. **Output:**
   ```python
   @dataclass
   class DiscretizedField:
       polygon_wgs84: list[list[float]]     # Original WGS84 coordinates
       polygon_utm: list[list[float]]       # Projected UTM coordinates
       utm_crs: str                         # e.g. "EPSG:32643"
       cell_size_m: float                   # 5.0 or 10.0
       area_hectares: float                 # Polygon area
       cells: list[GridCell]                # Interior cells only
       total_cells: int                     # len(cells)
       bounding_box_utm: dict               # {min_x, min_y, max_x, max_y}
   
   @dataclass
   class GridCell:
       id: str                              # "cell-001"
       row: int                             # Grid row index
       column: int                          # Grid column index
       center_utm: tuple[float, float]      # (easting, northing) in meters
       center_wgs84: tuple[float, float]    # (lon, lat) back-projected
   ```

### Dependencies
- `shapely>=2.0` — polygon operations, point-in-polygon
- `pyproj>=3.6` — CRS projection (WGS84 ↔ UTM)
- `numpy` — grid generation

### Test Cases (`tests/test_spatial.py`)

| Test | Input | Expected |
|---|---|---|
| Square field 100m×100m at 10m cell size | 4-vertex square polygon | 100 interior cells |
| Irregular L-shaped field | 6-vertex L polygon | Cells only inside the L; corner cells outside are excluded |
| Tiny field (< 4 cells at chosen size) | Small triangle | Raises `ValidationError`: field too small for chosen cell size |
| Polygon with hole | Outer ring + inner ring | Cells in the hole are excluded |
| Self-intersecting polygon | Bowtie shape | Raises `ValidationError`: invalid polygon |
| All cell centers lie inside polygon | Any valid polygon | `all(polygon.contains(Point(c.center_utm)) for c in cells)` |

---

## 1.3 New Module: `interpolation.py` — IDW Spatial Interpolation

### Purpose
Given 5–10 georeferenced soil laboratory sample points with measured values (pH, EC, N, P, K), predict the value of each soil property at every internal grid cell center using Inverse Distance Weighting (IDW).

### Why IDW and Not Kriging

With only 5–10 sample points:
- **Kriging** requires fitting an empirical semivariogram by estimating semivariance at 10–15 lag distance bins. With N<15, there are insufficient degrees of freedom — the variogram model is underdetermined and produces unstable covariance matrices.
- Cressie (1993, *Statistics for Spatial Data*) recommends N ≥ 30–50 for reliable variogram modeling.
- **IDW** is deterministic, non-parametric, and stable regardless of sample count. It's standard practice in commercial precision agriculture where lab tests cost $30–50 per sample.

### Mathematical Formulation

For a prediction point $x_0$ and sample points $x_1, x_2, \ldots, x_N$ with measured values $Z_1, Z_2, \ldots, Z_N$:

$$\hat{Z}(x_0) = \frac{\sum_{i=1}^{N} w_i \cdot Z_i}{\sum_{i=1}^{N} w_i}$$

where the weight $w_i$ is the inverse of the distance raised to power $p$:

$$w_i = \frac{1}{d(x_0, x_i)^p}$$

- **Power parameter:** $p = 2$ (standard modified Shepard formulation).
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
    depth_cm: str = "0-15"                     # Sampling depth
    collection_date: str | None = None         # ISO date
    lab_method: str | None = None              # e.g. "Walkley-Black", "Kjeldahl"

class InterpolationRequest(BaseModel):
    samples: list[SoilSample]                  # 5–10 sample points
    target_cells: list[GridCell]               # From spatial.py output
    properties: list[str] = ["pH", "ec", "nitrogen", "phosphorus", "potassium"]
    power: float = 2.0                         # IDW power parameter
```

### Processing Steps

1. **Validate Sample Count:** Require 3 ≤ N ≤ 50. Warn if N < 5 (minimal coverage).
2. **Project Samples:** Transform sample lat/lon to UTM using the same CRS as the grid.
3. **Check Sample Spread:** Verify samples are not all co-located. If all pairwise distances < `cell_size`, raise `ValidationError`.
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
    cells: list[InterpolatedCell]              # One per grid cell
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
```

### Test Cases (`tests/test_interpolation.py`)

| Test | Description | Pass Criteria |
|---|---|---|
| Exact at sample points | IDW prediction at a sample's own location | $\hat{Z} = Z_i$ exactly |
| Known analytic function | 2D Franke test function with 10 known points | RMSE < 8% of function range |
| Uniform field | All samples have identical pH=6.5 | All cell predictions = 6.5 |
| Edge effect | Samples clustered in one corner | Cells far from samples trend toward nearest sample value (no extrapolation artifacts) |
| LOOCV metrics | 8 sample points | RMSE reported per property; RMSE < 12% of property range |

---

## 1.4 New Module: `shi.py` — USDA Soil Health Index

### Purpose
Transform raw soil property values into normalized, unitless scores using non-linear scoring functions based on the USDA Soil Management Assessment Framework (SMAF, Andrews et al. 2004), then combine them into a single composite Soil Health Index (SHI) per cell.

### Why Non-Linear Scoring

Raw values are in different units (pH has no unit, EC is dS/m, N is kg/ha). Simple min-max normalization would assume linear relationships, but:
- pH has a **bell-shaped** optimum at ~6.5 — both 4.0 and 9.0 are equally bad.
- EC is **less-is-better** — salinity beyond 2.0 dS/m damages crops.
- NPK are **more-is-better** with diminishing returns — going from 20→60 kg N/ha matters hugely; going from 200→240 barely matters.

### Individual Scoring Functions

Each function maps a raw value to a score $S \in [0, 1]$:

#### pH — Optimum Bell Curve
$$S_{\text{pH}}(\text{pH}) = \exp\left(-\frac{(\text{pH} - \mu)^2}{2\sigma^2}\right)$$
- $\mu = 6.5$ (optimal pH for most crops)
- $\sigma = 0.8$ (controls width)
- pH=6.5 → S=1.0; pH=5.0 → S≈0.33; pH=4.0 → S≈0.01; pH=8.5 → S≈0.05

#### EC — Less-is-Better Sigmoid
$$S_{\text{EC}}(\text{EC}) = \frac{1}{1 + \exp(k \cdot (\text{EC} - x_0))}$$
- $k = 2.5$ (steepness)
- $x_0 = 2.0$ dS/m (inflection point)
- EC=0.5 → S≈0.98; EC=2.0 → S=0.50; EC=4.0 → S≈0.007

#### Nitrogen — More-is-Better Sigmoid
$$S_N(N) = \frac{1}{1 + \exp(-0.06 \cdot (N - 60))}$$
- N=20 → S≈0.08; N=60 → S=0.50; N=120 → S≈0.98

#### Phosphorus — More-is-Better Sigmoid
$$S_P(P) = \frac{1}{1 + \exp(-0.12 \cdot (P - 25))}$$
- P=10 → S≈0.12; P=25 → S=0.50; P=50 → S≈0.96

#### Potassium — More-is-Better Sigmoid
$$S_K(K) = \frac{1}{1 + \exp(-0.03 \cdot (K - 150))}$$
- K=80 → S≈0.11; K=150 → S=0.50; K=250 → S≈0.95

### Composite SHI

$$\text{SHI} = \left(w_{\text{pH}} \cdot S_{\text{pH}} + w_{\text{EC}} \cdot S_{\text{EC}} + w_N \cdot S_N + w_P \cdot S_P + w_K \cdot S_K\right) \times 100$$

Default weights (sum to 1.0):

| Property | Weight | Rationale |
|---|---|---|
| pH | 0.25 | Governs nutrient availability across the board |
| EC | 0.20 | Salt stress inhibits water uptake |
| N | 0.20 | Primary macronutrient for vegetative growth |
| P | 0.15 | Root development and energy transfer |
| K | 0.20 | Disease resistance and water regulation |

SHI ranges from 0 (worst) to 100 (perfect). A cell with pH=6.5, EC=0.5, N=100, P=40, K=200 would score ~95.

### API

```python
def score_property(property_name: str, raw_value: float) -> float:
    """Return unitless score S ∈ [0, 1] for a single soil property."""

def compute_shi(values: dict[str, float], weights: dict[str, float] | None = None) -> dict:
    """Return individual scores and composite SHI for a cell."""
    # Returns: {"scores": {"pH": 0.92, "ec": 0.85, ...}, "shi": 87.4, "weights": {...}}

def compute_field_shi(cells: list[InterpolatedCell]) -> list[CellWithSHI]:
    """Compute SHI for every cell in the interpolated field."""
```

### Test Cases (`tests/test_shi.py`)

| Test | Input | Expected |
|---|---|---|
| Perfect soil | pH=6.5, EC=0.3, N=120, P=50, K=220 | SHI ≥ 95 |
| Acidic soil | pH=4.0, EC=0.5, N=80, P=30, K=180 | SHI < 40 (pH score tanks it) |
| Saline soil | pH=6.5, EC=4.5, N=80, P=30, K=180 | SHI < 50 (EC score tanks it) |
| Nutrient-depleted | pH=6.5, EC=0.5, N=10, P=5, K=40 | SHI < 30 (NPK scores tank it) |
| Score symmetry | pH=5.0 vs pH=8.0 | Both score similarly low (bell curve) |
| Weight normalization | Custom weights summing to 1.2 | Auto-normalized to sum=1.0 |
| All zeros | N=0, P=0, K=0 | Scores near 0; SHI near 0; no crash |

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
1. For each $K \in [2, \min(\text{max\_k}, N-1)]$:
   - Run the clustering algorithm.
   - Compute mean Silhouette Score $\bar{s}(K)$.
   - If FCM, also compute Fuzzy Partition Coefficient $\text{FPC}(K)$.
2. Select $K^* = \arg\max_{K} \bar{s}(K)$.
3. Return the full sweep curve for UI visualization.

**Output:**
```python
@dataclass
class AutoKResult:
    optimal_k: int                           # The selected K*
    sweep: list[KSweepEntry]                 # Results for each K tested
    selection_criterion: str                  # "max_silhouette"
    selected_result: KMeansResult | FcmResult # The clustering result at K*

@dataclass
class KSweepEntry:
    k: int
    silhouette: float
    fpc: float | None                        # Only for FCM
    inertia: float | None                    # Only for K-Means
```

### 1.5.2 Adjacency-Aware Zone Merging

After clustering, some zones may have isolated "island" pixels or adjacent zones that are virtually identical in soil health. The paper's Step 2.7 merges them.

**Algorithm:**

1. **Build Adjacency Graph $G = (V, E)$:**
   - Vertices $V$ = zone IDs.
   - Edge $(A, B) \in E$ if any cell in zone $A$ is 4-connected (up/down/left/right) to a cell in zone $B$.
   - Edge weight = number of shared grid edges (contact length).

2. **Iterative Merge (greedy, most-similar-first):**
   - For each edge $(A, B)$ in the graph:
     - Compute $\Delta = |\overline{\text{SHI}}_A - \overline{\text{SHI}}_B|$.
   - Sort edges by ascending $\Delta$.
   - While the smallest $\Delta < \varepsilon$ (default $\varepsilon = 5.0$ on SHI's 0–100 scale):
     - Merge zones $A$ and $B$ into a single zone.
     - Recompute the merged zone's mean SHI.
     - Update the adjacency graph (combine edges, remove self-loops).
   - Stop when all remaining adjacent pairs have $\Delta \geq \varepsilon$.

3. **Post-Merge Cleanup:**
   - Re-label zones sequentially: 0, 1, 2, ...
   - Recompute zone centroids and summaries.
   - Record the merge log: which zones were merged and why.

**Input/Output:**
```python
def merge_adjacent_zones(
    cells: list[CellWithSHI],
    labels: np.ndarray,
    epsilon: float = 5.0,
) -> MergeResult:

@dataclass
class MergeResult:
    labels: np.ndarray                       # Updated zone labels
    zone_count: int                          # Final number of zones (≤ original K)
    merge_log: list[dict]                    # [{"merged": [2, 4], "delta_shi": 3.2}, ...]
    original_k: int                          # K before merging
```

### Test Cases (`tests/test_clustering.py`)

| Test | Input | Expected |
|---|---|---|
| Auto-K on 3-cluster synthetic data | 3 well-separated Gaussian blobs | K*=3 selected; silhouette > 0.7 |
| Auto-K on 2-cluster data | 2 clear clusters | K*=2 selected |
| Merge identical adjacent zones | Two adjacent zones with SHI 75 and 77 (Δ=2 < ε=5) | Merged into 1 zone |
| No merge when dissimilar | Two adjacent zones with SHI 30 and 80 (Δ=50 > ε) | No merge |
| Isolated island elimination | Zone with 1 cell surrounded by another zone | Merged into surrounding zone |
| Merge log correctness | Any merge scenario | Log contains original zone IDs, delta SHI, and new label |

---

## 1.6 New Module: `validation.py` — Perturbation Stability

### Purpose
Test whether the zoning result is robust to small measurement errors. If a farmer's pH reading is off by ±0.1 (normal lab precision), does the zone map change dramatically? If yes, the result is unreliable.

### Algorithm: Monte Carlo Perturbation Testing

1. **Noise Model (based on typical lab instrument tolerances):**
   | Property | σ (std dev) | Justification |
   |---|---|---|
   | pH | 0.1 | Standard pH meter precision |
   | EC | 5% of value | Conductivity probe tolerance |
   | Nitrogen | 5% of value | Kjeldahl method precision |
   | Phosphorus | 5% of value | Olsen method precision |
   | Potassium | 5% of value | Flame photometer precision |

2. **Procedure:**
   - Take the original interpolated field data $X$.
   - For $t = 1, 2, \ldots, T$ (default $T = 50$):
     - Generate perturbed data: $X' = X + \mathcal{N}(0, \sigma^2)$ per property.
     - Clamp values to valid physical ranges (e.g., pH ∈ [3.0, 10.0], EC ≥ 0).
     - Re-run the full pipeline (SHI → clustering at same K* → merging).
     - Record the resulting label vector $L_t$.
   - Compute pairwise **Adjusted Rand Index (ARI)** between the original labels $L_0$ and each perturbed $L_t$.

3. **Adjusted Rand Index (ARI):**
   - ARI = 1.0 → identical partitions.
   - ARI = 0.0 → random agreement.
   - ARI < 0 → less than random (very bad).
   - **Target: mean ARI ≥ 0.85** (strong stability).

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
       stability_grade: str                    # "Excellent" (≥0.90), "Good" (≥0.85), "Fair" (≥0.70), "Unstable" (<0.70)
       per_cell_flip_rate: dict[str, float]    # How often each cell changes zone
   ```

### Test Cases (`tests/test_validation.py`)

| Test | Input | Expected |
|---|---|---|
| Well-separated clusters | 3 blobs with large gap | Mean ARI > 0.95 ("Excellent") |
| Overlapping clusters | 3 blobs with overlap | Mean ARI 0.70–0.85 ("Fair" to "Good") |
| Per-cell flip rate | Any scenario | Boundary cells flip more often than interior cells |
| Zero noise | σ=0 for all properties | ARI = 1.0 for every perturbation |

---

## 1.7 New Module: `wsn_placement.py` — WSN Node & Cluster Head Placement

### Purpose
For each zone produced by clustering + merging, determine the optimal location to place a wireless sensor node (WSN) and identify the best Cluster Head (CH) / LoRa Gateway position.

### Algorithm

#### WSN Node Position: Zone Medoid

The **medoid** is the actual cell within the zone that minimizes the sum of distances to all other cells in the zone. Unlike the centroid (arithmetic mean of coordinates), the medoid is always a real cell — you can physically place a sensor there.

$$\text{medoid}_k = \arg\min_{i \in \text{Zone}_k} \sum_{j \in \text{Zone}_k} \|c_i - c_j\|_2$$

where $c_i$ is the UTM coordinate of cell $i$'s center.

#### Cluster Head / Gateway Position

The Cluster Head (CH) is the central aggregation point that communicates with all WSN nodes via LoRa. Its optimal location minimizes total transmission distance:

$$\text{CH} = \arg\min_{x \in \text{Field}} \sum_{k=1}^{K} \|x - \text{medoid}_k\|_2$$

This is the **geometric median** (Weber point) of the medoid set, computed iteratively via Weiszfeld's algorithm:

$$x^{(t+1)} = \frac{\sum_k \frac{\text{medoid}_k}{\|x^{(t)} - \text{medoid}_k\|}}{\sum_k \frac{1}{\|x^{(t)} - \text{medoid}_k\|}}$$

### Output

```python
@dataclass
class ZoningDeploymentPlan:
    """The complete output of Phase 1 — consumed by Field Monitoring."""
    field_boundary_wgs84: list[list[float]]
    utm_crs: str
    cell_size_m: float
    area_hectares: float
    zones: list[ZoneProfile]
    wsn_nodes: list[WsnNodePlacement]
    cluster_head: ClusterHeadPlacement
    stability: StabilityReport
    auto_k_sweep: AutoKResult
    created_at: str                          # ISO timestamp
    pipeline_versions: dict[str, str]

@dataclass
class ZoneProfile:
    zone_id: int
    cell_count: int
    area_m2: float
    mean_shi: float
    mean_values: dict[str, float]            # {"pH": 6.3, "ec": 1.1, ...}
    std_values: dict[str, float]

@dataclass
class WsnNodePlacement:
    zone_id: int
    cell_id: str                             # The medoid cell
    position_utm: tuple[float, float]
    position_wgs84: tuple[float, float]      # Back-projected lat/lon
    zone_mean_shi: float

@dataclass
class ClusterHeadPlacement:
    position_utm: tuple[float, float]
    position_wgs84: tuple[float, float]
    total_distance_to_nodes_m: float
    algorithm: str                           # "weiszfeld_geometric_median"
```

### Test Cases (`tests/test_wsn_placement.py`)

| Test | Input | Expected |
|---|---|---|
| Medoid correctness | 3-zone field | Each medoid is an actual cell; minimizes intra-zone distance |
| CH position | 3 medoids forming a triangle | CH is near the geometric center of the triangle |
| Single zone | K=1 (no merging needed) | WSN node = medoid; CH = same position |
| Large field | 500+ cells | Completes in < 2 seconds |

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
    {"id": "s1", "latitude": 12.972, "longitude": 77.583, "measurements": {"pH": 6.2, "ec": 1.1, "nitrogen": 75, "phosphorus": 32, "potassium": 165}},
    {"id": "s2", "latitude": 12.975, "longitude": 77.587, "measurements": {"pH": 5.8, "ec": 2.3, "nitrogen": 45, "phosphorus": 18, "potassium": 120}}
  ],
  "cellSizeM": 10,
  "method": "fcm",
  "maxK": 6,
  "mergeEpsilon": 5.0,
  "perturbationRuns": 50,
  "seed": 42
}
```

**Response:** Full `ZoningDeploymentPlan` as JSON.

### Backward Compatibility

Keep the existing `POST /v1/zoning/run` endpoint during Phase 2 UI migration. Once the new UI is wired to `/v2/zoning/run`, deprecate the v1 endpoint.

---

## 1.9 Dependencies to Add

Add to `services/zoning/requirements.txt`:

```
shapely>=2.0
pyproj>=3.6
```

Both are pure Python / binary wheels available for Windows and are compatible with Python 3.14.

---

## 1.10 File Structure After Phase 1

```
services/zoning/
├── app/
│   ├── algorithms.py          # KEPT — K-Means++, FCM, silhouette
│   ├── clustering.py          # NEW — Auto-K* sweep, adjacency merging
│   ├── crop_fit.py            # KEPT
│   ├── crop_profiles.py       # KEPT
│   ├── interpolation.py       # NEW — IDW spatial interpolation
│   ├── main.py                # EXTENDED — /v2/zoning/run endpoint
│   ├── schemas.py             # EXTENDED — new request/response models
│   ├── service.py             # REFACTORED — new pipeline orchestration
│   ├── shi.py                 # NEW — USDA SHI scoring
│   ├── soilgrids.py           # KEPT
│   ├── spatial.py             # NEW — boundary discretization
│   ├── validation.py          # NEW — perturbation stability
│   └── wsn_placement.py       # NEW — zone medoid + cluster head
├── tests/
│   ├── test_algorithms.py     # KEPT
│   ├── test_api.py            # EXTENDED
│   ├── test_clustering.py     # NEW
│   ├── test_crop_fit.py       # KEPT
│   ├── test_interpolation.py  # NEW
│   ├── test_monitoring_api.py # KEPT
│   ├── test_shi.py            # NEW
│   ├── test_spatial.py        # NEW
│   ├── test_validation.py     # NEW
│   └── test_wsn_placement.py  # NEW
├── pytest.ini
└── requirements.txt           # UPDATED — add shapely, pyproj
```
