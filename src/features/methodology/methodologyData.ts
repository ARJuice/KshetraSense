export interface PipelineStage {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  iconName: string;
  inputDescription: string;
  outputDescription: string;
  mathematicalBasis: string;
  algorithmSummary: string;
  keyFormulas?: Array<{
    name: string;
    latex: string;
    description: string;
    variables: Array<{ symbol: string; meaning: string; unit?: string }>;
  }>;
  operationalLimits: string[];
  scientificRationale: string;
}

export interface DefenseQA {
  id: string;
  questionNumber: number;
  category: 'Spatial ML' | 'Time Series' | 'Computer Vision' | 'Agronomy' | 'System Architecture';
  question: string;
  briefAnswer: string;
  deepScientificDefense: string[];
  primaryCitations: string[];
  keyRiskOrLimitation: string;
}

export interface TestMatrixEntry {
  scope: string;
  command: string;
  status: 'passed' | 'bounded' | 'manual-pending';
  passedCount: string;
  keyEvidence: string;
  scientificBoundary: string;
}

// ==========================================
// MODULE 1: SOIL ZONING & SPATIAL ML CORE
// ==========================================
export const soilZoningStages: PipelineStage[] = [
  {
    id: 'boundary-projection',
    stepNumber: 1,
    title: 'Boundary Ingestion & Metric UTM Projection',
    subtitle: 'WGS84 Polygon parsing, topological validation & conformal projection',
    iconName: 'MapPin',
    inputDescription: 'GeoJSON Polygon with coordinates [[lon, lat], ...] in EPSG:4326',
    outputDescription: 'Metric CRS projection (e.g., UTM Zone 43N EPSG:32643) with calculated surface area (ha)',
    mathematicalBasis: 'Transverse Mercator projection clamped to 6° longitudinal zones: utm_zone = floor((lon + 180)/6) + 1',
    algorithmSummary: 'Validates polygon closure, checks for self-intersections using Shapely 2.x, determines local metric UTM zone, and projects all coordinates from degrees to meters to avoid spherical distortion in area and distance calculations.',
    keyFormulas: [
      {
        name: 'UTM Zone Determination',
        latex: '\\text{zone} = \\left\\lfloor \\frac{\\lambda_{\\text{interior}} + 180^{\\circ}}{6^{\\circ}} \\right\\rfloor + 1',
        description: 'Calculates the Universal Transverse Mercator (UTM) zone from the polygon representative interior point.',
        variables: [
          { symbol: '\\lambda_{\\text{interior}}', meaning: 'Representative interior longitude of the field boundary', unit: 'degrees' },
          { symbol: '\\text{zone}', meaning: 'Clamped UTM projection zone (1 to 60)', unit: 'integer' }
        ]
      }
    ],
    operationalLimits: [
      'Field boundary must be a valid, simple, non-self-intersecting closed polygon ring.',
      'Parcels spanning multiple UTM zone boundaries are projected to the dominant centroid zone; maximum area capped at 500 ha.',
      'Cadastral maps or digitized traces represent operational working areas, not legal ownership guarantees.'
    ],
    scientificRationale: 'Spatial distance calculations (Euclidean metric) in degrees latitude/longitude suffer from latitude-dependent longitudinal foreshortening. Projecting to local UTM meters guarantees isotropic distance calculations for IDW interpolation and spatial clustering.'
  },
  {
    id: 'grid-discretization',
    stepNumber: 2,
    title: 'Regular Metric Grid Discretization',
    subtitle: '5m / 10m regular mesh generation with boundary polygon clipping',
    iconName: 'Grid',
    inputDescription: 'Projected UTM boundary polygon and target cell resolution (5m or 10m)',
    outputDescription: 'List of regular square GridCells with centroid UTM coordinates, row/col indices, and boundary-clipped surface area (m²)',
    mathematicalBasis: '2D Axis-aligned bounding box discretized at regular intervals Δx = Δy = cell_size_m, filtered via Shapely contains_xy',
    algorithmSummary: 'Generates candidate centroid points across the bounding box. Retains strictly interior cell centers. For perimeter boundary cells, intersects the cell square with the polygon boundary to report exact clipped area in m².',
    keyFormulas: [
      {
        name: 'Regular Grid Coordinates',
        latex: 'x_j = x_{\\min} + \\frac{\\Delta x}{2} + j \\cdot \\Delta x, \\quad y_i = y_{\\max} - \\frac{\\Delta y}{2} - i \\cdot \\Delta y',
        description: 'Matrix coordinates where row zero starts at the northernmost edge and column zero at the westernmost edge.',
        variables: [
          { symbol: '\\Delta x, \\Delta y', meaning: 'Selected grid cell spacing (5.0 m or 10.0 m)', unit: 'meters' },
          { symbol: 'i, j', meaning: 'Row and column indices in the raster matrix', unit: 'integers' }
        ]
      }
    ],
    operationalLimits: [
      'Grid generation enforces safety limits: maximum 100,000 bounding-box candidates and 5,000 retained interior cells.',
      'Fields with zero interior centers at selected resolution raise a validation error rather than inventing fake cells.',
      'Cell size must reflect physical sample density: 10m spacing is standard for 5-10 core surveys.'
    ],
    scientificRationale: 'A regular discretization converts irregular boundary geometry into an indexed spatial matrix suitable for vectorized interpolation and graph-based spatial postprocessing.'
  },
  {
    id: 'idw-interpolation',
    stepNumber: 3,
    title: 'Inverse Distance Weighting (IDW p=2) Interpolation',
    subtitle: 'Deterministic spatial estimation with Leave-One-Out Cross-Validation (LOOCV)',
    iconName: 'Activity',
    inputDescription: '3 to 50 georeferenced laboratory soil core samples (pH, EC, N, P, K) with uniform sample depth',
    outputDescription: 'Interpolated continuous property maps across all grid cells with LOOCV RMSE and MAE cross-validation metrics',
    mathematicalBasis: 'IDW formulation with fixed power p=2 and Euclidean distance metric in UTM meters',
    algorithmSummary: 'For each cell center x₀ and each soil property Z, computes the weighted average of observed sample points inversely proportional to squared Euclidean distance. Coincident sample locations (d < 0.01m) receive exact measured values.',
    keyFormulas: [
      {
        name: 'Inverse Distance Weighting Formulation',
        latex: '\\hat{Z}(x_0) = \\frac{\\sum_{i=1}^{N} w_i \\cdot Z_i}{\\sum_{i=1}^{N} w_i}, \\quad w_i = \\frac{1}{\\left(d(x_0, x_i)\\right)^p}',
        description: 'Computes estimated property value at cell center x₀ from N surrounding lab soil core samples.',
        variables: [
          { symbol: 'p', meaning: 'Power parameter (fixed at p = 2.0 in KshetraSense)', unit: 'dimensionless' },
          { symbol: 'd(x_0, x_i)', meaning: 'Euclidean distance in metric UTM coordinates', unit: 'meters' },
          { symbol: 'Z_i', meaning: 'Laboratory analyzed property measurement at core sample i', unit: 'various (pH, dS/m, mg/kg)' }
        ]
      },
      {
        name: 'Leave-One-Out Cross-Validation (LOOCV)',
        latex: '\\text{RMSE} = \\sqrt{\\frac{1}{N} \\sum_{i=1}^N \\left( Z_i - \\hat{Z}_{-i}(x_i) \\right)^2}',
        description: 'Systematically excludes core i, interpolates from remaining N-1 cores, and computes prediction residual.',
        variables: [
          { symbol: '\\hat{Z}_{-i}(x_i)', meaning: 'Estimate at location x_i excluding core i', unit: 'property unit' },
          { symbol: 'N', meaning: 'Number of laboratory soil samples (3 <= N <= 50)', unit: 'count' }
        ]
      }
    ],
    operationalLimits: [
      'IDW is an exact interpolator bounded by the minimum and maximum of observed sample values; it cannot extrapolate beyond the sample range.',
      'Sparse samples (N < 5) trigger an explicit low-density warning.',
      'All input samples must declare the exact same sampling-depth interval (e.g., 0-15 cm). Mixed depths are strictly rejected.'
    ],
    scientificRationale: 'IDW is chosen over Ordinary Kriging because with sparse field datasets (5-10 samples), fitting a defensible empirical semivariogram (sill, range, nugget) is mathematically ill-posed and prone to severe overfitting. IDW provides transparent, deterministic spatial smoothing.'
  },
  {
    id: 'shi-scoring',
    stepNumber: 4,
    title: 'KshetraSense Nonlinear Soil Health Index (SHI)',
    subtitle: 'Sigmoidal & Gaussian nonlinear indicator curves with weighted composite scoring',
    iconName: 'BarChart2',
    inputDescription: 'Interpolated raw cell properties: pH, EC (dS/m), N (mg/kg), P (mg/kg), K (mg/kg)',
    outputDescription: 'Dimensionless indicator scores S_j in [0, 1] and composite Soil Health Index (0 to 100) per cell',
    mathematicalBasis: 'Bell curve for optimum pH + logistic sigmoid curves for salinity and macronutrients',
    algorithmSummary: 'Raw agronomic parameters carry non-comparable dimensions and non-linear biological effects. Each parameter is transformed via a biological response curve: pH uses a Gaussian centered at 6.5; EC uses a decreasing logistic curve; N, P, K use increasing logistic curves.',
    keyFormulas: [
      {
        name: 'pH Gaussian Optimum Curve',
        latex: 'S_{\\text{pH}}(\\text{pH}) = \\exp\\left( -\\frac{(\\text{pH} - 6.5)^2}{2 \\cdot (0.8)^2} \\right)',
        description: 'Centered at near-neutral pH 6.5; scores drop sharply in strongly acidic (<5.0) or alkaline (>8.0) soils.',
        variables: [
          { symbol: '\\mu = 6.5', meaning: 'Optimum curve midpoint assumption', unit: 'dimensionless' },
          { symbol: '\\sigma = 0.8', meaning: 'Gaussian curve dispersion factor', unit: 'dimensionless' }
        ]
      },
      {
        name: 'EC Less-is-Better Sigmoid',
        latex: 'S_{\\text{EC}}(\\text{EC}) = \\frac{1}{1 + \\exp\\left(2.5 \\cdot (\\text{EC} - 2.0)\\right)}',
        description: 'Decreasing logistic sigmoid penalizing osmotic stress from high soluble salts.',
        variables: [
          { symbol: 'x_0 = 2.0', meaning: 'Inflection threshold midpoint', unit: 'dS/m' },
          { symbol: 'k = 2.5', meaning: 'Logistic steepness parameter', unit: 'dimensionless' }
        ]
      },
      {
        name: 'Composite Weighted SHI',
        latex: '\\text{SHI} = 100 \\times \\left( 0.25 S_{\\text{pH}} + 0.20 S_{\\text{EC}} + 0.20 S_N + 0.15 S_P + 0.20 S_K \\right)',
        description: 'Weighted combination bounded strictly in [0, 100]. Note: SHI does NOT dictate spatial clustering.',
        variables: [
          { symbol: 'w_j', meaning: 'Normalized property weights (sum to 1.0)', unit: 'fraction' }
        ]
      }
    ],
    operationalLimits: [
      'SHI is a project-defined screening metric, NOT an official USDA/NRCS or SMAF certified soil health index.',
      'Weights and curve parameters are versioned engineering assumptions, not locally calibrated yield response functions.',
      'Crucially: SHI is NOT a feature for clustering. Clustering uses the standardized raw multivariate profiles directly.'
    ],
    scientificRationale: 'A single composite index provides intuitive exploratory guidance to the grower, but clustering on scalar SHI would cause severe information loss (e.g. an acidic high-nitrogen soil and an alkaline low-nitrogen soil could have identical SHI scores despite requiring opposite management).'
  },
  {
    id: 'clustering-autok',
    stepNumber: 5,
    title: 'Multivariate Auto-K* Clustering (K-Means++ / FCM)',
    subtitle: 'Standardized z-score space clustering with automated silhouette score sweep',
    iconName: 'Cpu',
    inputDescription: 'Multivariate feature vectors [z_pH, z_EC, z_N, z_P, z_K] for all grid cells; tested K range (2 to 6)',
    outputDescription: 'Selected optimal K*, cluster labels, fuzzy partition coefficients (FCM), and diagnostic curves',
    mathematicalBasis: 'K-Means++ centroid initialization or Bezdek Fuzzy C-Means (fuzziness m=2.0) with Rousseeuw silhouette metric',
    algorithmSummary: 'Each property is standardized to zero mean and unit variance. Sweeps K from 2 through maxK (default 6). Evaluates mean silhouette score s(K) across candidate partitions. Optimal K* is chosen as the argmax silhouette score (ties broken by selecting smaller K).',
    keyFormulas: [
      {
        name: 'Mean Silhouette Width',
        latex: 's(i) = \\frac{b(i) - a(i)}{\\max(a(i), b(i))}, \\quad K^* = \\arg\\max_{K \\in [2, 6]} \\bar{s}(K)',
        description: 'Measures how tightly grouped cell i is to its own cluster vs the nearest neighboring cluster.',
        variables: [
          { symbol: 'a(i)', meaning: 'Mean intra-cluster distance between cell i and all other points in the same cluster', unit: 'z-score distance' },
          { symbol: 'b(i)', meaning: 'Smallest mean distance from cell i to any other cluster', unit: 'z-score distance' },
          { symbol: 's(i)', meaning: 'Individual silhouette coefficient in [-1, +1]', unit: 'dimensionless' }
        ]
      },
      {
        name: 'Fuzzy C-Means Objective Function',
        latex: 'J_m = \\sum_{i=1}^{N} \\sum_{k=1}^{K} u_{ik}^m \\| x_i - c_k \\|^2, \\quad m = 2.0',
        description: 'Minimizes weighted squared errors allowing partial membership u_{ik} across cluster boundaries.',
        variables: [
          { symbol: 'u_{ik}', meaning: 'Fuzzy membership grade of cell i in cluster k (sum over k equals 1.0)', unit: 'probability/grade' },
          { symbol: 'm', meaning: 'Fuzziness exponent (fixed at 2.0)', unit: 'dimensionless' }
        ]
      }
    ],
    operationalLimits: [
      'Silhouette score is an unsupervised cluster separation heuristic, not a guarantee of agronomic management utility.',
      'Identical uniform profiles raise ClusteringValidationError rather than inventing artificial boundaries.',
      'FCM membership grades represent mathematical cluster proximity, NOT crop suitability or cultivation confidence.'
    ],
    scientificRationale: 'K-means++ provides crisp operational boundaries for tractor guidance, while FCM exposes transitional boundary uncertainty where soil chemistry blends gradually.'
  },
  {
    id: 'adjacency-merging',
    stepNumber: 6,
    title: 'Adjacency-Aware Graph Merge & Contiguity Enforcement',
    subtitle: '4-connected spatial graph merging of similar profiles & isolated component splitting',
    iconName: 'GitFork',
    inputDescription: 'Initial cluster labels, cell grid coordinates, standardized feature matrix, mergeThresholdZ (0.5)',
    outputDescription: 'Contiguous management zone polygons, adjacency merge log, and distinct connected component IDs',
    mathematicalBasis: 'Spatial graph G=(V, E) where edge (A, B) exists if cells share a grid edge; iterative greedy centroid distance merge',
    algorithmSummary: 'Standard clustering ignores physical space. This step builds an adjacency contact graph between touching clusters. Iteratively merges adjacent clusters if their standardized centroid Euclidean distance is <= 0.5 z-scores. Disconnected islands of the same cluster are subsequently split into separate operational zones.',
    keyFormulas: [
      {
        name: 'Adjacent Centroid Z-Distance',
        latex: 'D_{\\text{adj}}(A, B) = \\| \\bar{\\mathbf{z}}_A - \\bar{\\mathbf{z}}_B \\|_2 \\le \\theta_{\\text{merge}} = 0.5',
        description: 'Condition under which adjacent spatial clusters A and B are merged into a single management zone.',
        variables: [
          { symbol: '\\bar{\\mathbf{z}}_A, \\bar{\\mathbf{z}}_B', meaning: 'Multivariate centroid vectors in standardized z-score space', unit: 'std dev units' },
          { symbol: '\\theta_{\\text{merge}}', meaning: 'Merge threshold (0.5 z-score units)', unit: 'dimensionless' }
        ]
      }
    ],
    operationalLimits: [
      'Merging requires BOTH physical spatial contact (shared grid edges) AND multivariate soil profile similarity.',
      'Non-adjacent clusters with similar chemistry are NEVER merged, preserving local physical management integrity.',
      'Every distinct four-connected island is retained and assigned an independent zone ID.'
    ],
    scientificRationale: 'Agricultural machinery cannot navigate checkerboard micro-patches. Merging similar touching clusters and isolating disconnected pockets creates tractor-operable Management Zones (MZ).'
  },
  {
    id: 'stability-perturbation',
    stepNumber: 7,
    title: 'Monte Carlo Sample Perturbation & Stability Testing',
    subtitle: 'Noise model simulation & Adjusted Rand Index (ARI) robustness evaluation',
    iconName: 'ShieldCheck',
    inputDescription: 'Original sample observations, noise assumptions (pH: σ=0.1, EC/NPK: 5%), T=10 (up to 50) perturbation runs',
    outputDescription: 'Mean ARI score, ARI distribution, per-cell zone flip rates, and SHI variance',
    mathematicalBasis: 'Hubert-Arabie Adjusted Rand Index comparing partition agreement under measurement uncertainty',
    algorithmSummary: 'Perturbs sample values using Gaussian noise reflecting real laboratory analytical tolerances. Re-runs the full pipeline (IDW + Auto-K + Merge) at fixed seed. Measures label-invariant partition agreement between original and perturbed zone outputs.',
    keyFormulas: [
      {
        name: 'Adjusted Rand Index (ARI)',
        latex: '\\text{ARI} = \\frac{\\sum_{ij} \\binom{n_{ij}}{2} - \\left[ \\sum_i \\binom{a_i}{2} \\sum_j \\binom{b_j}{2} \\right] / \\binom{n}{2}}{\\frac{1}{2} \\left[ \\sum_i \\binom{a_i}{2} + \\sum_j \\binom{b_j}{2} \\right] - \\left[ \\sum_i \\binom{a_i}{2} \\sum_j \\binom{b_j}{2} \\right] / \\binom{n}{2}}',
        description: 'Corrects Rand Index for chance agreement: 1.0 indicates perfect partition match, 0.0 indicates chance.',
        variables: [
          { symbol: 'n_{ij}', meaning: 'Number of grid cells common to zone i in run 0 and zone j in run t', unit: 'count' },
          { symbol: 'n', meaning: 'Total number of interior grid cells', unit: 'count' }
        ]
      }
    ],
    operationalLimits: [
      'ARI measures conditional stability against the declared noise model, NOT ground truth classification accuracy.',
      'No arbitrary pass/fail cutoff is enforced; the full distribution is transparently displayed in diagnostics.',
      'High cell flip rates near zone boundaries are natural and identify transition zones requiring on-site scouting.'
    ],
    scientificRationale: 'Demonstrates to agronomists and defense committees that management zone boundaries are mathematically robust against minor laboratory titration/spectrometry variations.'
  },
  {
    id: 'wsn-medoids',
    stepNumber: 8,
    title: 'Zone Medoid & Geometric Gateway Placement',
    subtitle: 'Representative in-situ sensor location & Weiszfeld geometric median hub',
    iconName: 'Radio',
    inputDescription: 'Final contiguous management zone polygons and interior cell centroids',
    outputDescription: 'Selected zone medoid cells (WSN node candidates) and projected gateway coordinates',
    mathematicalBasis: 'Discrete in-zone medoid minimization + iterative Weiszfeld algorithm for L1 geometric median',
    algorithmSummary: 'For each zone, finds the actual cell center that minimizes the sum of Euclidean distances to all other cells in that zone (medoid). The telemetry gateway is placed at the geometric median of all zone medoids, projected to the parcel boundary if outside.',
    keyFormulas: [
      {
        name: 'Zone Medoid Formulation',
        latex: 'm_k = \\arg\\min_{i \\in \\text{Zone}_k} \\sum_{j \\in \\text{Zone}_k} \\| c_i - c_j \\|_2',
        description: 'Guarantees the candidate telemetry node is an actual interior cell within the designated zone.',
        variables: [
          { symbol: 'c_i, c_j', meaning: 'Metric UTM coordinates of cell centers in zone k', unit: 'meters' },
          { symbol: 'm_k', meaning: 'Selected representative medoid cell coordinate', unit: 'meters' }
        ]
      },
      {
        name: 'Weiszfeld Gateway Iteration',
        latex: 'x^{(t+1)} = \\frac{\\sum_{k} \\frac{m_k}{\\| x^{(t)} - m_k \\|}}{\\sum_{k} \\frac{1}{\\| x^{(t)} - m_k \\|}}',
        description: 'Iteratively converges to the Weber geometric median of all zone medoid sensor positions.',
        variables: [
          { symbol: 'x^{(t)}', meaning: 'Gateway position estimate at iteration t', unit: 'meters' }
        ]
      }
    ],
    operationalLimits: [
      'Medoids and gateway coordinates are purely geometric candidates; RF propagation (LoRa/Zigbee), Fresnel zone, foliage attenuation, power access, and field machinery traffic are unvalidated.',
      'Does NOT claim a deployed, ready-to-stream IoT network without on-site radio site survey.',
      'Gateway projection onto boundary ensures the candidate stays on the grower land but does not guarantee RF line-of-sight.'
    ],
    scientificRationale: 'Centroid of a non-convex shape can fall outside the zone or even outside the field polygon. Medoids guarantee that the candidate sensor physically resides in the representative soil of that zone.'
  }
];

// ==========================================
// MODULE 2: FIELD TELEMETRY & GRU FORECASTER
// ==========================================
export const telemetryStages: PipelineStage[] = [
  {
    id: 'provenance-ingestion',
    stepNumber: 1,
    title: 'Historical Research Ingestion & Attribution',
    subtitle: 'Attributed 2023 Parma tomato trial dataset with integrity checksums',
    iconName: 'Database',
    inputDescription: 'Mendeley v2 dataset (Belli et al., Data in Brief 2025), DOI 10.17632/35wh56287y.2, CC BY 4.0',
    outputDescription: '3 treatment irrigation lines (Line 1: 100%, Line 2: 60%, Line 3: 30% Irriframe) + 1 shared station',
    mathematicalBasis: 'SHA-256 cryptographic verification of raw CSV files; timezone normalization from ts_generation to UTC',
    algorithmSummary: 'Loads raw telemetry data from HEINZ 1301 processing tomato trial in Parma, Italy. Excludes duplicated header rows, checks numeric bounds, and preserves line treatment identifiers without auto-binding them to user field polygons.',
    operationalLimits: [
      'Strictly historical research data; this is NOT live telemetry from the user farm.',
      'Battery voltage is absent in >95% of rows and is not synthetically filled.',
      'Water meter records are preserved in source m³ without converting to inferred flow or valve actuation.'
    ],
    scientificRationale: 'Establishes clear scientific provenance and prevents misleading users into believing a mock or research replay is a live connection to their field.'
  },
  {
    id: 'temporal-resampling',
    stepNumber: 2,
    title: 'Temporal Resampling & Grid Cadence Alignment',
    subtitle: '10-minute UTC uniform grid with explicit gap bridging limits',
    iconName: 'Clock',
    inputDescription: 'Non-uniform timestamped raw sensor packets from soil probe (20 cm depth) and weather station',
    outputDescription: 'Aligned 10-minute time series grid with explicit interpolation flags and gap preservation',
    mathematicalBasis: 'Linear interpolation bridging only gaps <= 30 minutes; longer intervals flagged as unavailable',
    algorithmSummary: 'Resamples raw readings onto 10-minute UTC boundaries. Bridges short sensor jitter (<30 min) while strictly preserving genuine dropouts as missing data. Never extrapolates across missing ends.',
    operationalLimits: [
      'Gaps exceeding 30 minutes return forecast: unavailable rather than inventing fake data.',
      'Interpolation counts are exposed transparently in API diagnostics.',
      'Aligned grid preserves distinct identity from raw measured observations.'
    ],
    scientificRationale: 'Recurrent neural networks require uniform temporal time steps (dt = constant) to model physical soil thermal and moisture dynamics accurately.'
  },
  {
    id: 'gru-forecasting',
    stepNumber: 3,
    title: 'Two-Layer GRU Residual Soil Signal Forecaster',
    subtitle: 'Gated Recurrent Unit neural network predicting sensor %RH delta above persistence',
    iconName: 'Layers',
    inputDescription: '144-step sequence (24h at 10-min dt) x 5 features: [Soil %RH, Soil Temp, Soil EC, Air Temp, Air RH]',
    outputDescription: 'Point forecasts of soil humidity sensor signal (%RH) at +6h, +12h, and +24h horizons',
    mathematicalBasis: 'GRU(64) -> Dropout(0.1) -> GRU(32) -> Dense(3) residual head with persistence baseline addition',
    algorithmSummary: 'The network outputs future-minus-current delta estimates Δy_h which are added to the last observed value y_t. Trained chronologically (70/15/15 train/val/test split) using Huber loss to resist outliers.',
    keyFormulas: [
      {
        name: 'GRU Residual Forecast Formulation',
        latex: '\\hat{y}_{t+h} = y_t + \\mathbf{W}_{\\text{dense}} \\cdot \\mathbf{h}_{\\text{GRU2}} + b, \\quad h \\in \\{6\\text{h}, 12\\text{h}, 24\\text{h}\\}',
        description: 'Zero-initialized residual linear head ensures untrained model defaults exactly to persistence.',
        variables: [
          { symbol: 'y_t', meaning: 'Last observed soil humidity instrument signal', unit: '%RH' },
          { symbol: '\\hat{y}_{t+h}', meaning: 'Forecasted instrument signal at future horizon h', unit: '%RH' },
          { symbol: '\\mathbf{h}_{\\text{GRU2}}', meaning: 'Hidden state vector from second GRU layer (dim=32)', unit: 'vector' }
        ]
      }
    ],
    operationalLimits: [
      'Target is the instrument soil-humidity signal in %RH; it is explicitly NOT volumetric water content (VWC m³/m³).',
      'The trained GRU failed to beat persistence on the held-out test split (see Evidence Table below).',
      'Disclosed transparently as an experimental evaluation artifact; NOT an operational irrigation controller.'
    ],
    scientificRationale: 'A residual formulation centered on persistence prevents runaway drift and reflects physical capacitive sensor continuity in deep soil.'
  },
  {
    id: 'anomaly-detection',
    stepNumber: 4,
    title: 'Unsupervised Isolation Forest Review Screening',
    subtitle: 'Anomaly candidate ranking from raw signals & short-term temporal differences',
    iconName: 'AlertTriangle',
    inputDescription: 'Sensor readings and first differences [x_t, |x_t - x_{t-1}|] fitted on training period only',
    outputDescription: 'Anomaly candidate flags with continuous anomaly scores and review rationale',
    mathematicalBasis: 'Ensemble of random isolation trees isolating outliers with shorter average path lengths',
    algorithmSummary: 'Detects sudden electrical dropouts, sensor disconnects, or anomalous spikes. Outputs candidates for agronomic human review; strictly does not claim definitive hardware failure diagnosis.',
    operationalLimits: [
      'Unsupervised model: cannot distinguish hardware failures from genuine physical events (e.g. heavy storm irrigation).',
      'Does NOT emit confidence or failure probability.',
      'Cannot autonomously shut off valves or suppress telemetry.'
    ],
    scientificRationale: 'In-situ sensor networks in agricultural fields experience frequent biological, moisture, and pest interference. Screening candidates assists maintenance scouting.'
  },
  {
    id: 'fao-water-balance',
    stepNumber: 5,
    title: 'Decoupled FAO-56 MAD Advisory Calculator',
    subtitle: 'Standardized soil water balance requiring explicit calibrated VWC inputs',
    iconName: 'Droplets',
    inputDescription: 'Explicit caller-supplied: θ_FC, θ_WP, θ_current (all in m³/m³), root depth Z_r (m), depletion factor p',
    outputDescription: 'Total Available Water (TAW mm), Readily Available Water (RAW mm), stress threshold, and advisory status',
    mathematicalBasis: 'FAO Irrigation & Drainage Paper 56: TAW = 1000(θ_FC - θ_WP) Z_r, RAW = p * TAW',
    algorithmSummary: 'Standalone agronomic calculation. Validates physical bounds: 0 <= θ_WP < θ_FC <= 1.0. Strictly rejects uncalibrated %RH telemetry inputs. Emits human review advisories only.',
    keyFormulas: [
      {
        name: 'FAO-56 Available Water & Stress Threshold',
        latex: '\\text{TAW} = 1000 (\\theta_{\\text{FC}} - \\theta_{\\text{WP}}) Z_r, \\quad \\theta_{\\text{threshold}} = \\theta_{\\text{FC}} - p (\\theta_{\\text{FC}} - \\theta_{\\text{WP}})',
        description: 'Computes readily available root-zone reservoir before plant transpiration stress occurs.',
        variables: [
          { symbol: '\\theta_{\\text{FC}}', meaning: 'Field capacity volumetric water content', unit: 'm³/m³' },
          { symbol: '\\theta_{\\text{WP}}', meaning: 'Permanent wilting point volumetric water content', unit: 'm³/m³' },
          { symbol: 'Z_r', meaning: 'Effective crop rooting depth', unit: 'meters' },
          { symbol: 'p', meaning: 'Depletion fraction without stress (typically 0.4 to 0.6 for vegetables)', unit: 'fraction' }
        ]
      }
    ],
    operationalLimits: [
      'Requires laboratory-calibrated volumetric water content (m³/m³); cannot use %RH sensor replay.',
      'API-only endpoint; returns advisories, NEVER automated valve commands or volumetric liter doses.',
      'Does not substitute for on-site hydraulic soil testing.'
    ],
    scientificRationale: 'Soil %RH measures relative humidity in soil pore air, which approaches 98-100% long before field capacity is reached due to the Kelvin equation. Converting %RH to VWC requires soil water retention curves (van Genuchten), which are site-specific.'
  }
];

// ====================================================
// MODULE 3: VEGETATION MONITORING & REGIONAL CONTEXT
// ====================================================
export const remoteSensingStages: PipelineStage[] = [
  {
    id: 'sentinel-acquisition',
    stepNumber: 1,
    title: 'Copernicus Sentinel-2 MSI Surface Reflectance',
    subtitle: 'Level-2A Bottom-Of-Atmosphere (BOA) multispectral acquisition at 10m resolution',
    iconName: 'Satellite',
    inputDescription: 'Center coordinates, circular Area of Interest (AOI), and temporal acquisition window',
    outputDescription: 'Cloud-masked BOA reflectance tiles in B04 (Red, 665nm) and B08 (NIR, 842nm)',
    mathematicalBasis: 'COPERNICUS/S2_SR_HARMONIZED Level-2A collection with QA60 / SCL cloud screening',
    algorithmSummary: 'Queries Google Earth Engine API for cloud-free multispectral scenes over the target AOI during the designated crop growth window. Applies scene classification masks (SCL) to eliminate cloud cover and cloud shadows.',
    operationalLimits: [
      'Nominal 5-day revisit at equator; usable cloud-free scenes may be weeks apart during monsoon seasons.',
      'Native pixel resolution is 10m (100 m² per pixel); smallholder plots (<1 ha) suffer from mixed boundary pixels.',
      'Requires active Google Earth Engine authentication and project quotas.'
    ],
    scientificRationale: 'Level-2A surface reflectance corrects for atmospheric aerosol scattering, ensuring temporal comparability of vegetation indices across different acquisition dates.'
  },
  {
    id: 'ndvi-median-composite',
    stepNumber: 2,
    title: 'NDVI Computation & Temporal Median Composite',
    subtitle: 'Normalized Difference Vegetation Index & per-scene time series aggregation',
    iconName: 'TrendingUp',
    inputDescription: 'Filtered multi-temporal surface reflectance scenes over AOI',
    outputDescription: 'NDVI time series, seasonal median composite, and CHIRPS rainfall context',
    mathematicalBasis: 'NDVI = (NIR - Red) / (NIR + Red) bounded in [-1.0, +1.0]',
    algorithmSummary: 'Computes normalized difference between chlorophyll-absorbing red light and cellular-reflecting NIR light. Aggregates scenes via temporal median reduction to minimize transient shadow artifacts.',
    keyFormulas: [
      {
        name: 'Normalized Difference Vegetation Index',
        latex: '\\text{NDVI} = \\frac{\\rho_{\\text{B08}} - \\rho_{\\text{B04}}}{\\rho_{\\text{B08}} + \\rho_{\\text{B04}}} = \\frac{\\text{NIR} - \\text{Red}}{\\text{NIR} + \\text{Red}}',
        description: 'Quantifies relative canopy greenness and photosynthetically active biomass.',
        variables: [
          { symbol: '\\rho_{\\text{B08}}', meaning: 'Surface reflectance in Band 8 (Near-Infrared: 842 nm)', unit: 'ratio' },
          { symbol: '\\rho_{\\text{B04}}', meaning: 'Surface reflectance in Band 4 (Red: 665 nm)', unit: 'ratio' }
        ]
      }
    ],
    operationalLimits: [
      'NDVI is an optical reflectance signal, NOT a diagnosis of disease, nutrient deficiency, or water stress.',
      'Vegetation index saturates at high Leaf Area Index (LAI > 3).',
      'Soil background reflectance in sparse canopies alters apparent index values.'
    ],
    scientificRationale: 'Chlorophyll absorbs red photons for photosynthesis while mesophyll cell structure strongly scatters NIR photons. The normalized ratio isolates vegetative vigor from general illumination changes.'
  },
  {
    id: 'cropsight-contract-limits',
    stepNumber: 3,
    title: 'CropSight API Aggregate Response Contract',
    subtitle: 'Strict verification of actual API outputs vs unsupported marketing claims',
    iconName: 'ShieldAlert',
    inputDescription: 'CropSight backend service response payload',
    outputDescription: 'Verified aggregate statistics: mean NDVI, standard deviation, time series, and rainfall',
    mathematicalBasis: 'Scalar statistics over circular buffer AOI; explicit absence of spatial raster layers',
    algorithmSummary: 'The KshetraSense UI validates the exact JSON response returned by CropSight. Because the API returns aggregate statistics rather than spatial raster grids or zone polygons, the UI strictly displays aggregate charts and refuses to fabricate fake spatial vegetation zones.',
    operationalLimits: [
      'The current CropSight API returns NO raster arrays, NO pixel labels, and NO spatial zone polygons.',
      'Cannot generate variable-rate fertilizer prescriptions or spatial zone overlays from current outputs.',
      'DBSCAN and clustering parameters in the request do NOT return distinct spatial layers in the current contract.'
    ],
    scientificRationale: 'Academic integrity requires matching UI presentation to actual verified service capabilities rather than synthesizing fictional precision maps.'
  },
  {
    id: 'soilgrids-wcs-adapter',
    stepNumber: 4,
    title: 'ISRIC SoilGrids 2.0 Regional Context Adapter',
    subtitle: 'Public OGC WCS queries for nominal 250m global soil property quantiles',
    iconName: 'Globe',
    inputDescription: 'WGS84 field coordinates, standard depth interval (0-5, 5-15, 15-30, 30-60, 60-100, 100-200 cm)',
    outputDescription: 'Nominal 250m regional modeled context with Q0.05, Q0.50 (median), and Q0.95 quantiles',
    mathematicalBasis: 'ISRIC machine-learning covariates model at 250m resolution queried via Web Coverage Service (WCS)',
    algorithmSummary: 'Connects to ISRIC public WCS to retrieve global modeled soil properties (pH, organic carbon, nitrogen, sand, silt, clay, bulk density, CEC). Applies official scale factors. Displays as background regional context alongside local lab tests.',
    operationalLimits: [
      'SoilGrids is a global 250m model (6.25 ha per cell); ISRIC explicitly cautions against farm-scale decision making.',
      'NEVER used as a substitute for lab soil tests or injected into within-field zoning.',
      'If WCS is unreachable or masked, returns HTTP 503 rather than fabricating fake local values.'
    ],
    scientificRationale: 'Provides high-level pedagogical context on regional soil classification while respecting the resolution mismatch between 250m continental models and 10m field management.'
  }
];

// ==========================================
// MODULE 4: LEAF PATHOLOGY COMPUTER VISION
// ==========================================
export const leafVisionStages: PipelineStage[] = [
  {
    id: 'architectural-decoupling',
    stepNumber: 1,
    title: 'Architectural Decoupling & Multimodal Isolation',
    subtitle: 'Raw pixel ingestion strictly isolated from soil, satellite, and zoning context',
    iconName: 'ShieldAlert',
    inputDescription: 'Single JPEG or PNG leaf image file upload (max 10 MiB)',
    outputDescription: 'Zero soil features, zero zone IDs, and zero NDVI values passed to vision model',
    mathematicalBasis: 'Strict feature isolation to prevent spurious dataset co-occurrence correlations',
    algorithmSummary: 'The leaf disease classifier operates on raw image pixels only. Soil chemistry or field location is intentionally withheld from the computer vision model to ensure predictions depend solely on visual pathology rather than learned spatial biases.',
    operationalLimits: [
      'Image-only classifier; does NOT integrate weather, historical soil tests, or seasonal stage.',
      'Single-label model: cannot classify leaves with multiple simultaneous co-infections.',
      'EXIF metadata and GPS coordinates are stripped before inference.'
    ],
    scientificRationale: 'If soil data were fused directly into a leaf classifier, the deep network would memorize spurious correlations (e.g. associating low pH with fungal blight because of dataset collection locations) rather than learning visual foliar lesions.'
  },
  {
    id: 'vision-preprocessing',
    stepNumber: 2,
    title: 'Deterministic Image Preprocessing',
    subtitle: 'EXIF transpose normalization & bilinear 224x224 RGB resizing',
    iconName: 'Sliders',
    inputDescription: 'Uploaded image binary; validated image header signature and dimension bounds',
    outputDescription: 'Normalized 224 x 224 x 3 tensor with MobileNetV3 standard RGB scaling',
    mathematicalBasis: 'Pillow bilinear interpolation in [0, 255] range with EXIF orientation correction',
    algorithmSummary: 'Decodes JPEG/PNG safely. Applies EXIF orientation to correct smartphone rotation. Resizes to 224x224 pixels using bilinear interpolation. Packages into standard model input tensor.',
    operationalLimits: [
      'Max upload size 10 MiB; extreme aspect ratios (>4:1) or malformed bytes rejected with HTTP 422.',
      'Bilinear downsampling can blur fine microscopic foliar structures (e.g. tiny spider mites).',
      'Single leaf centered framing assumed by dataset.'
    ],
    scientificRationale: 'Controlled preprocessing guarantees that inference matches the exact image normalization used during PyTorch model training.'
  },
  {
    id: 'mobilenet-inference',
    stepNumber: 3,
    title: 'MobileNetV3-Small Neural Architecture & Softmax',
    subtitle: 'Depthwise separable CNN with hard-swish & squeeze-and-excitation blocks',
    iconName: 'Cpu',
    inputDescription: '224x224x3 normalized image tensor',
    outputDescription: 'Ranked list of 17 audited class scores from versioned class map plantvillage-apple-potato-tomato-17-v1',
    mathematicalBasis: 'MobileNetV3-Small backbone with global average pooling and 17-class linear classification head',
    algorithmSummary: 'Extracts hierarchical visual features using efficient depthwise separable convolutions. Passes features through squeeze-and-excitation attention blocks and outputs logits converted to scores via softmax.',
    keyFormulas: [
      {
        name: 'Softmax Class Score Formulation',
        latex: 'P(y = c \\mid \\mathbf{x}) = \\frac{\\exp(z_c)}{\\sum_{j=1}^{17} \\exp(z_j)}, \\quad c \\in \\{1, \\dots, 17\\}',
        description: 'Transforms raw logit outputs z into uncalibrated class scores summing to 1.0.',
        variables: [
          { symbol: 'z_c', meaning: 'Model logit output for disease class c', unit: 'dimensionless' },
          { symbol: 'P(y = c \\mid \\mathbf{x})', meaning: 'Uncalibrated softmax score (NOT guaranteed probability)', unit: 'fraction in [0, 1]' }
        ]
      }
    ],
    operationalLimits: [
      'Scores are uncalibrated softmax outputs; they are NOT true Bayesian posterior probabilities.',
      'Trained exclusively on laboratory PlantVillage images with uniform backgrounds.',
      'Field photos with complex backgrounds, harsh sunlight, or shadows suffer significant distribution shift.'
    ],
    scientificRationale: 'MobileNetV3-Small offers an optimal balance between edge computational efficiency (low latency on CPU) and feature extraction capacity for mobile deployment.'
  },
  {
    id: 'mandatory-human-review',
    stepNumber: 4,
    title: 'Mandatory Human Review Policy & Validation Bounds',
    subtitle: 'Enforced reviewRequired flag on 100% of outputs; zero chemical prescriptions',
    iconName: 'AlertCircle',
    inputDescription: 'Model top class and ranked confidence scores',
    outputDescription: 'Clinical review card with mandatory reviewRequired: true and explicit limitations',
    mathematicalBasis: 'Policy all-predictions-reviewed-v1; no calibrated rejection threshold exists',
    algorithmSummary: 'Because laboratory-trained vision models cannot reliably detect out-of-distribution real field photos, every API prediction requires manual confirmation by a qualified extension officer or agronomist.',
    operationalLimits: [
      'reviewRequired is permanently true for all predictions.',
      'Does NOT provide pesticide dosage, chemical spray recommendations, or disease severity percentages.',
      'PlantDoc and in-field smartphone photo accuracy remains completely unmeasured.'
    ],
    scientificRationale: 'Prematurely automating agricultural chemical spraying based on uncalibrated computer vision risks severe crop damage, chemical resistance, and environmental contamination.'
  }
];

// ==========================================
// MODULE 5: AGRONOMIC CROP FIT & DSS
// ==========================================
export const cropFitStages: PipelineStage[] = [
  {
    id: 'crop-catalog-selection',
    stepNumber: 1,
    title: 'Karnataka Agronomic 3-Crop Reference Catalog',
    subtitle: 'Regionally relevant demonstration set: Finger Millet (Ragi), Tomato, and Groundnut',
    iconName: 'BookOpen',
    inputDescription: 'Area-weighted management zone soil means [pH, EC, N, P, K] from spatial IDW',
    outputDescription: 'Factor-by-factor agronomic comparison against published institutional reference literature',
    mathematicalBasis: 'Decision 0012 alignment: NIFTEM-T (Ragi), TNAU/ICAR (Tomato), TNAU (Groundnut)',
    algorithmSummary: 'Replaced former Apple/Tomato/Potato catalog with Karnataka-adapted crops. Evaluates zone soil chemistry against published extension ranges from UAS Bengaluru and ICAR research stations.',
    operationalLimits: [
      'Representative reference demonstration; NOT an exhaustive agricultural crop recommendation.',
      'Does not consider climate, seasonality, rainfall, slope, water table, or market pricing.',
      'Zone mean is the area-weighted average of IDW cell estimates, not a fresh physical core.'
    ],
    scientificRationale: 'Finger Millet (Eleusine coracana) and Groundnut (Arachis hypogaea) represent authentic regional crops grown extensively in Karnataka dryland zones, replacing irrelevant temperate crops like Apple.'
  },
  {
    id: 'factor-by-factor-evaluation',
    stepNumber: 2,
    title: 'Factor-by-Factor Reference Comparison',
    subtitle: 'Non-compensatory evaluation avoiding composite score obfuscation',
    iconName: 'CheckCircle2',
    inputDescription: 'Observed zone pH, EC, N, P, K values vs published reference literature',
    outputDescription: 'Individual factor comparison states with neutral, non-prescriptive visual indicators',
    mathematicalBasis: 'Direct numeric interval check for pH only; contextual display for EC and macronutrients',
    algorithmSummary: 'Compares soil factors individually. Only pH has standard universal cited intervals. EC is displayed alongside root-zone saturated extract ECe context without threshold classification. N/P/K are displayed with laboratory units (mg/kg) without inventing universal sufficiency bands.',
    operationalLimits: [
      'Only pH receives an inside/below/above interval comparison.',
      'Generic field EC cannot be compared to FAO ECe thresholds (saturated paste extract required).',
      'N/P/K lack extractant metadata (Bray vs Olsen P, Mehlich vs Ammonium Acetate K).'
    ],
    scientificRationale: 'A high nitrogen reading cannot compensate for extreme soil acidity. Factor-by-factor presentation preserves agronomic transparency and prevents deceptive composite averages.'
  },
  {
    id: 'probability-independence',
    stepNumber: 3,
    title: 'Crop Independence & Non-100% Probability Proof',
    subtitle: 'Why crop suitability percentages must never sum to 100%',
    iconName: 'HelpCircle',
    inputDescription: '3 independent crop compatibility evaluations for a single management zone',
    outputDescription: 'Independent compatibility reports with separate multi-label evaluation semantics',
    mathematicalBasis: 'Probability of independent events: P(A ∩ B) ≠ 0; multi-label marginals do not sum to 1.0',
    algorithmSummary: 'A given parcel of land can be simultaneously suitable for Tomato AND Groundnut, or suitable for NONE. Forcing crop compatibility scores to sum to 100% would commit a fundamental mathematical error by treating independent events as mutually exclusive categorical choices.',
    keyFormulas: [
      {
        name: 'Multi-Label Event Independence',
        latex: '\\sum_{c \\in \\{\\text{Ragi}, \\text{Tomato}, \\text{Groundnut}\\}} P(\\text{Suitable}_c) \\neq 1.0',
        description: 'Suitability of multiple crops are independent non-exclusive events.',
        variables: [
          { symbol: 'P(\\text{Suitable}_c)', meaning: 'Marginal probability that crop c is agronomically viable', unit: 'probability in [0, 1]' }
        ]
      }
    ],
    operationalLimits: [
      'KshetraSense displays factor status, NOT cultivation probabilities or yield guarantees.',
      'The software provides decision support; the grower makes the ultimate planting choice.',
      'No single composite score is emitted.'
    ],
    scientificRationale: 'Mutually exclusive distributions (summing to 1.0) apply only to categorical classification where exactly one outcome can occur (e.g. leaf disease type). Crop suitability across land is a multi-label condition.'
  }
];

// ==========================================
// ACADEMIC DEFENSE Q&A GUIDE (Phase 5)
// ==========================================
export const defenseQAList: DefenseQA[] = [
  {
    id: 'q1-kmeans-fcm-dbscan',
    questionNumber: 1,
    category: 'Spatial ML',
    question: 'Why support both K-Means and Fuzzy C-Means (FCM), and why not DBSCAN for soil zoning?',
    briefAnswer: 'Both cluster standardized soil profiles; K-means yields crisp tractor zones while FCM quantifies boundary transition ambiguity. DBSCAN is unsuitable because it treats low-density soil transition cells as noise and discards them.',
    deepScientificDefense: [
      'K-Means++ partitions the field into discrete, non-overlapping management units required for variable-rate fertilizer applicators (VRFA) and tractor prescription maps.',
      'Fuzzy C-Means (Bezdek, m=2.0) computes continuous membership grades u_ik across cluster centroids. Because soil chemical properties vary continuously across pedological gradients, FCM reveals fuzzy transition zones where adjacent soil types intergrade.',
      'DBSCAN relies on local spatial density (epsilon and MinPts). In precision agriculture, our spatial sampling is regular and sparse (5-10 cores across a parcel). DBSCAN would classify transitional or perimeter cells as "noise/outliers" and drop them from the field map, which is unacceptable for agricultural zoning where 100% of the field area must be managed.'
    ],
    primaryCitations: ['Bezdek, J. C. (1981). Pattern Recognition with Fuzzy Objective Function Algorithms.', 'Rousseeuw, P. J. (1987). Silhouettes: a graphical aid to the interpretation and validation of cluster analysis.'],
    keyRiskOrLimitation: 'Neither K-means nor FCM considers spatial contiguity inherently. That is why KshetraSense implements an explicit spatial postprocessing step (4-connected adjacency graph merge) to eliminate fragmented micro-patches.'
  },
  {
    id: 'q2-idw-vs-kriging',
    questionNumber: 2,
    category: 'Spatial ML',
    question: 'How can you justify spatial interpolation with only 5 to 10 soil samples? Why not Ordinary Kriging?',
    briefAnswer: 'IDW (p=2) is an exact, transparent deterministic baseline. Fitting an empirical variogram (sill, range, nugget) for Kriging with only 5-10 points is mathematically ill-posed and produces spurious spatial artifacts.',
    deepScientificDefense: [
      'Geostatistical rules of thumb (Webster & Oliver, 1990) require at least 50 to 100 spatial sample pairs to reliably fit an empirical semivariogram γ(h) = (1/2N) Σ (Z(x) - Z(x+h))².',
      'Attempting to fit a spherical or exponential variogram model on 5-10 points results in unstable parameter estimates, where minor sample noise drastically shifts the fitted range and sill, leading to false confidence intervals.',
      'IDW with fixed power p=2.0 operates without parameter fitting. To remain transparent, our API calculates Leave-One-Out Cross-Validation (LOOCV) RMSE and MAE, computes nearest-sample distances for every cell, and explicitly labels all grid values as mathematical interpolations rather than physical measurements.'
    ],
    primaryCitations: ['Webster, R., & Oliver, M. A. (1990). Statistical methods in soil and land resource survey.', 'Shepard, D. (1968). A two-dimensional interpolation function for irregularly-spaced data.'],
    keyRiskOrLimitation: 'IDW cannot estimate values outside the convex hull of observed sample values and cannot estimate prediction variance without Monte Carlo perturbation.'
  },
  {
    id: 'q3-nonlinear-shi',
    questionNumber: 3,
    category: 'Agronomy',
    question: 'Why is the Soil Health Index (SHI) scored using non-linear functions instead of simple Min-Max scaling?',
    briefAnswer: 'Biological crop response to soil chemistry is fundamentally non-linear: optimal pH follows a Gaussian bell curve, salinity has an osmotic threshold, and nutrients follow diminishing returns (Mitscherlich law).',
    deepScientificDefense: [
      'Linear Min-Max normalization assumes that higher is always better or worse at a constant marginal rate. In soil chemistry, this is biologically false: a soil pH of 9.0 is just as harmful to nutrient uptake as a pH of 4.0.',
      'We model pH using a Gaussian bell curve centered at 6.5 (σ=0.8), where S_pH = exp(-(pH - 6.5)² / 2(0.8)²), correctly penalizing both extreme acidity and alkalinity.',
      'Electrical Conductivity (EC) uses a decreasing logistic sigmoid with an inflection point at 2.0 dS/m, reflecting root osmotic stress thresholds described in USDA Salinity Lab guidelines (Richards, 1954).',
      'Macronutrients (N, P, K) follow logistic curves that model Mitscherlich diminishing marginal returns, ensuring that excess nutrient concentrations do not artificially inflate the health index to infinity.'
    ],
    primaryCitations: ['Andrews, S. S., et al. (2004). The Soil Management Assessment Framework (SMAF). SSSAJ.', 'Richards, L. A. (1954). Diagnosis and Improvement of Saline and Alkali Soils. USDA Handbook 60.'],
    keyRiskOrLimitation: 'The curves are versioned project engineering assumptions, not locally calibrated yield-response models. Crucially, SHI is kept out of the clustering vector so it does not distort multivariate zone formation.'
  },
  {
    id: 'q4-gru-temporal-leakage',
    questionNumber: 4,
    category: 'Time Series',
    question: 'How did you evaluate the soil-signal GRU without temporal leakage, and why does it lose to persistence?',
    briefAnswer: 'We used a strict chronological 70/15/15 train/val/test split with train-only MinMax scaling. The GRU lost to persistence at all horizons (+6h, +12h, +24h), and we disclose that failure transparently.',
    deepScientificDefense: [
      'Random k-fold cross-validation or random temporal shuffling in time series creates catastrophic lookahead bias (temporal leakage), because adjacent 10-minute time steps are highly autocorrelated.',
      'We split the 2023 Parma tomato trial chronologically by timestamp (June-July train, August validation, September test). The MinMaxScaler was fit strictly on the training period.',
      'On the 352 held-out test windows, the GRU achieved MAE of 0.378 %RH (+6h), 1.265 %RH (+12h), and 0.980 %RH (+24h). In contrast, a naive persistence baseline (y_{t+h} = y_t) achieved 0.083, 0.140, and 0.204 %RH.',
      'The GRU lost to persistence because deep subsoil moisture (at 20 cm) varies very slowly over 24-hour periods in the absence of rain or irrigation. When dynamics are near-stationary, complex recurrent networks struggle to beat a simple lag-1 identity baseline.'
    ],
    primaryCitations: ['Belli, L., et al. (2025). Smart agriculture dataset in a tomato cultivation under different irrigation regimes. Data in Brief 60.', 'Hyndman, R. J., & Athanasopoulos, G. (2018). Forecasting: principles and practice.'],
    keyRiskOrLimitation: 'The GRU model is preserved as an educational and evaluation artifact only. It must NEVER be used as an autonomous closed-loop irrigation controller.'
  },
  {
    id: 'q5-no-end-to-end-dnn',
    questionNumber: 5,
    category: 'System Architecture',
    question: 'Why not use an end-to-end Deep Neural Network that directly predicts when to open the irrigation valve?',
    briefAnswer: 'An end-to-end black box lacks physical interpretability, cannot provide safety fail-safes, and our sensor target is %RH rather than volumetric water content. Irrigation requires transparent physical water balance.',
    deepScientificDefense: [
      'End-to-end neural networks linking sensor readings directly to valve actuators create massive operational risks: unexpected sensor dropouts, electrical noise, or distribution shifts can trigger catastrophic flooding or drought.',
      'Our benchmark dataset measures soil relative humidity (%RH) in pore spaces, NOT volumetric water content (VWC m³/m³). Using %RH directly in hydraulic equations violates soil physics.',
      'Instead, KshetraSense strictly decouples sensing from advisory. We provide an independent FAO-56 Management Allowed Depletion (MAD) endpoint that calculates physical water balance (TAW, RAW) only when an agronomist supplies calibrated VWC, field capacity, wilting point, and rooting depth.'
    ],
    primaryCitations: ['Allen, R. G., et al. (1998). Crop evapotranspiration: Guidelines for computing crop water requirements. FAO Irrigation and Drainage Paper 56.'],
    keyRiskOrLimitation: 'The FAO-56 endpoint returns human-review advisories only; it does not output valve signals, flow rates, or automated watering schedules.'
  },
  {
    id: 'q6-hardware-and-wsn',
    questionNumber: 6,
    category: 'System Architecture',
    question: 'Since you do not have physical ESP32/LoRa nodes deployed in the field today, how is this valid engineering?',
    briefAnswer: 'We engineered the end-to-end algorithmic contracts, parser integrity, data models, and replay pipelines using published, peer-reviewed in-situ field telemetry datasets, with geometric placement optimization ready for field trials.',
    deepScientificDefense: [
      'Field engineering begins with data contract specification and algorithmic validation before costly hardware deployments.',
      'We built complete ingestion pipelines for the CC BY 4.0 Belli et al. (2025) Parma research trial, verifying SHA-256 hashes, handling missing battery telemetry, parsing duplicated CSV headers, and resampling non-uniform cadences.',
      'Our WSN placement module uses discrete zone medoid optimization and the iterative Weiszfeld algorithm to compute mathematically grounded candidate sensor and gateway locations.',
      'We explicitly disclaim hardware-in-the-loop: we show no fake "live gateway" badges, simulate no fake valve actuation, and state that RF propagation, Fresnel zones, and battery life require a dedicated physical deployment project.'
    ],
    primaryCitations: ['Belli, L., et al. (2024). Smart agriculture dataset... Mendeley Data, V2, doi: 10.17632/35wh56287y.2.'],
    keyRiskOrLimitation: 'Candidate WSN positions are purely geometric and must be validated on-site against radio frequency attenuation from dense crop canopies and terrain obstacles.'
  },
  {
    id: 'q7-crop-fit-percentages',
    questionNumber: 7,
    category: 'Agronomy',
    question: 'Why do Crop Fit scores for Ragi, Tomato, and Groundnut not add up to 100%?',
    briefAnswer: 'They represent independent biological suitability evaluations, not mutually exclusive categories. A soil profile can be suitable for multiple crops simultaneously, or suitable for none.',
    deepScientificDefense: [
      'Probabilities sum to 100% only across an exhaustive set of mutually exclusive outcomes (e.g. rolling a 6-sided die, or single-label disease classification).',
      'Crop suitability is a multi-label condition: whether Finger Millet can grow in Zone 1 is biologically independent of whether Groundnut can grow in Zone 1.',
      'If Zone 1 has a pH of 6.5, adequate moisture, and balanced nutrients, both Tomato (pH 6.5-7.5) and Groundnut (pH 5.3-6.6) find the soil viable. Normalizing their scores to 100% would be a mathematical and agronomic fallacy.',
      'Per Decision 0011 and 0012, we report factor-by-factor observed values against institutional extension intervals without calculating an arbitrary overall percentage.'
    ],
    primaryCitations: ['FAO. (1976). A framework for land evaluation. Soils Bulletin 32.', 'NIST/SEMATECH. (2012). e-Handbook of Statistical Methods.'],
    keyRiskOrLimitation: 'Our reference intervals cover soil pH and salinity references only; climate, seasonal rainfall, temperature regimes, pest pressures, and market prices are not evaluated.'
  },
  {
    id: 'q8-cropsight-prescriptions',
    questionNumber: 8,
    category: 'System Architecture',
    question: 'Can CropSight generate variable-rate fertilizer prescriptions from the current vegetation view?',
    briefAnswer: 'No. The current CropSight API returns aggregate AOI statistics (mean, std dev, time series), not spatial rasters or zone polygons. Generating prescriptions from non-spatial responses would be unscientific fabrication.',
    deepScientificDefense: [
      'Variable-rate prescription maps require 2D spatial raster grids with localized pixel values, geo-referenced zone boundaries, and agronomic fertilizer response equations (e.g. kg N/ha per NDVI decrement).',
      'The mounted CropSight API returns only scalar aggregate statistics over the circular area of interest (e.g. mean NDVI = 0.347, std = 0.158, 38 scenes).',
      'The KshetraSense frontend honors architectural honesty: because no spatial raster is returned, the UI renders time-series charts and aggregate statistics, and explicitly disclaims spatial prescription generation.',
      'Furthermore, NDVI is an optical canopy signal; low NDVI can result from moisture deficit, nitrogen deficiency, fungal blight, weed competition, or shallow bedrock. NDVI alone cannot prescribe fertilizer.'
    ],
    primaryCitations: ['Copernicus Sentinel-2 User Handbook. (2015). ESA.', 'Fontanet, M., et al. (2020). Dynamic irrigation zoning using Sentinel-2... Ag. Water Management.'],
    keyRiskOrLimitation: 'CropSight requires Google Earth Engine credentials and project quotas for live execution. Live smoke tests passed on our development machine, but require independent setup on other machines.'
  },
  {
    id: 'q9-soilgrids-decoupling',
    questionNumber: 9,
    category: 'Spatial ML',
    question: 'Why is ISRIC SoilGrids shown as separate regional context rather than merged into field soil zoning?',
    briefAnswer: 'SoilGrids has a nominal 250m resolution (6.25 hectares per cell). Downscaling it to a 10m farm grid creates false precision and obscures local intra-field variation.',
    deepScientificDefense: [
      'ISRIC SoilGrids 2.0 is a global machine learning prediction product trained on environmental covariates at 250m spatial resolution. ISRIC explicitly warns against using SoilGrids for local farm management.',
      'A single 250m SoilGrids pixel covers 62,500 m²—larger than many entire smallholder farms in India. Resampling a 250m pixel into 10m grid cells would repeat the exact same value 625 times, inventing false spatial detail.',
      'Furthermore, SoilGrids mapped properties (e.g. total nitrogen) are not equivalent to localized agronomic test methods (e.g. plant-available mineral N via alkaline permanganate).',
      'We query SoilGrids via OGC WCS to provide broad regional pedagogical context and prediction quantiles (Q0.05, Q0.50, Q0.95), while keeping local soil zoning strictly driven by measured lab core samples.'
    ],
    primaryCitations: ['Poggio, L., et al. (2021). SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty. SOIL, 7, 217-240.'],
    keyRiskOrLimitation: 'WCS queries depend on ISRIC server availability; if the service is unreachable or coordinates fall in masked areas, our system returns HTTP 503 rather than substituting synthetic values.'
  },
  {
    id: 'q10-mobilenet-audit-accuracy',
    questionNumber: 10,
    category: 'Computer Vision',
    question: 'Why choose MobileNetV3-Small, and how was the 92.97% test accuracy validated against data leakage?',
    briefAnswer: 'MobileNetV3-Small provides high CPU inference speed on modest hardware. We audited the 17 classes, removed 10 duplicate/overlap images across 5 source groups, and evaluated on 4,653 held-out test images.',
    deepScientificDefense: [
      'MobileNetV3-Small leverages hardware-aware Neural Architecture Search (NAS), depthwise separable convolutions, hard-swish non-linearities, and squeeze-and-excitation attention, achieving fast inference on standard CPU servers (84 ms warmed latency).',
      'The original PlantVillage dataset is known to contain duplicate leaf photographs taken from slightly different angles. Training and evaluating on random splits causes severe data leakage.',
      'We performed physical leaf grouping and exact-image hashing, removing 10 duplicate records across 5 source overlap groups. On the clean 4,653-image held-out split, the model achieved 92.97% accuracy, 93.52% macro-F1, and 93.14% macro-precision (vs 23.64% for majority class baseline).',
      'We explicitly disclose that these metrics apply ONLY to controlled laboratory backgrounds. Field photos with cluttered backgrounds and natural lighting remain unmeasured, which is why our system mandates manual review.'
    ],
    primaryCitations: ['Howard, A., et al. (2019). Searching for MobileNetV3. ICCV 2019.', 'Hughes, D. P., & Salathe, M. (2015). An open access repository of images on plant health. arXiv:1511.08060.'],
    keyRiskOrLimitation: 'Softmax scores are uncalibrated; scores must not be interpreted as certified diagnostic probabilities. The system enforces reviewRequired: true on 100% of responses.'
  },
  {
    id: 'q11-demonstration-readiness',
    questionNumber: 11,
    category: 'System Architecture',
    question: 'What parts of KshetraSense work fully offline today, and what requires external credentials?',
    briefAnswer: 'Soil Zoning, Crop Fit, Historical Telemetry Replay, and Leaf Diagnosis run 100% locally with zero cloud dependencies. Only live Sentinel-2 satellite queries (Earth Engine) and SoilGrids (ISRIC WCS) need network access.',
    deepScientificDefense: [
      'Local-First Core: The Soil Zoning engine (/v2/zoning/run), Crop Fit reference catalog, and Leaf Diagnosis classifier (/v1/leaf/predict) run entirely in local Python/PyTorch processes without any cloud API dependency.',
      'Historical Telemetry Replay (/v1/telemetry/stream) reads pinned, cryptographically verified local CSV files and loads our pre-trained PyTorch/Keras GRU model artifact directly from disk.',
      'We provide 10 complete paired synthetic GeoJSON boundaries and lab sample CSV datasets (with complete pH, EC, N, P, K, dates, and uncertainty models) to exercise the full spatial pipeline offline.',
      'External Providers: ISRIC SoilGrids WCS requires outbound internet access. Live CropSight satellite queries require an active Google Earth Engine service account and authenticated project ID.'
    ],
    primaryCitations: ['KshetraSense Master Plan (Phase 1-5). docs/plans/README.md.'],
    keyRiskOrLimitation: 'When external providers are offline or unconfigured, KshetraSense displays clear retryable error states and refuses to synthesize fake satellite or soil data.'
  }
];

// ==========================================
// TEST VERIFICATION MATRIX
// ==========================================
export const testMatrixData: TestMatrixEntry[] = [
  {
    scope: 'Frontend Unit Tests',
    command: 'npm test (Vitest)',
    status: 'passed',
    passedCount: '56+ passed / 16 test files',
    keyEvidence: 'Covers comparability, soil sample storage, CSV import, CropSight adapter, SoilGrids quantiles, zoning API contract, telemetry view-model, and leaf diagnosis upload contracts.',
    scientificBoundary: 'Zero test mocking of business logic; verifies contract types, data validation, and UI model transformations.'
  },
  {
    scope: 'TypeScript Typecheck',
    command: 'npm run typecheck (tsc --noEmit)',
    status: 'passed',
    passedCount: 'Zero TypeScript errors',
    keyEvidence: 'Strict compilation passes with all types, schemas, props, and API response models validated.',
    scientificBoundary: 'Ensures end-to-end type safety between backend FastAPI schemas and frontend React state.'
  },
  {
    scope: 'Python Backend Algorithmic Suite',
    command: 'python -m pytest tests -q',
    status: 'bounded',
    passedCount: '94 passed / 1 failed (95 total)',
    keyEvidence: 'Validates spatial projection, IDW interpolation, SHI curve calculations, Auto-K silhouette sweep, adjacency merge, Weiszfeld medoids, telemetry replay, and leaf MobileNetV3-Small inference.',
    scientificBoundary: '1 failure in test_cropsight_analyze_field_uninitialized_ee (expected 500, received 200 due to local authenticated EE environment). 15/15 Leaf tests pass.'
  },
  {
    scope: 'MobileNetV3-Small Leaf Classifier',
    command: 'python -m pytest tests/test_leaf_module.py -q',
    status: 'passed',
    passedCount: '15 passed / 15 tests',
    keyEvidence: 'Evaluated on 4,653 held-out test images: 92.97% accuracy, 93.52% macro-F1, 93.14% macro-precision (vs 23.64% baseline). 17 audited classes.',
    scientificBoundary: 'Controlled PlantVillage images only; PlantDoc and field-photo performance unmeasured; reviewRequired: true enforced on all responses.'
  },
  {
    scope: 'Soil-Signal GRU Sequence Forecaster',
    command: 'services/telemetry/models/soil_signal_gru_metadata.json',
    status: 'bounded',
    passedCount: 'Holdout evaluation complete',
    keyEvidence: 'Evaluated on 352 held-out 24h windows: +6h MAE 0.378 %RH, +12h MAE 1.265 %RH, +24h MAE 0.980 %RH.',
    scientificBoundary: 'Loses to persistence baseline (0.083 / 0.140 / 0.204 %RH). Disclosed as non-operational evaluation artifact.'
  },
  {
    scope: 'ISRIC SoilGrids 2.0 Public WCS',
    command: 'GET /v1/monitoring/soilgrids live smoke test',
    status: 'passed',
    passedCount: 'Smoke-tested live',
    keyEvidence: 'Successfully queries GeoTIFF quantiles Q0.05, Q0.50, Q0.95 across 8 properties and 6 depths; applies official scaling factors.',
    scientificBoundary: 'Nominal 250m modeled regional context; never downscaled or substituted for field samples.'
  },
  {
    scope: 'Google Earth Engine & CropSight',
    command: 'Live EE smoke test on local environment',
    status: 'passed',
    passedCount: 'Smoke-tested live locally',
    keyEvidence: 'Parma tomato research coordinates (44.8087, 10.2730) over 2023-06-29 to 2023-09-14 returned 38 Sentinel-2 scenes, mean NDVI 0.347, std 0.158.',
    scientificBoundary: 'Aggregate NDVI statistics and time-series only; no spatial rasters or zone polygons returned by API.'
  }
];
