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
    outputDescription: 'Metric CRS projection (e.g., UTM Zone 43N) with computed parcel area (ha)',
    mathematicalBasis: 'Universal Transverse Mercator projection clamped to 6° longitudinal zones',
    algorithmSummary: 'Validates polygon closure, computes local metric UTM zone, and projects coordinates from spherical degrees to meters to ensure accurate area and Euclidean distance calculations.',
    keyFormulas: [
      {
        name: 'UTM Zone Determination',
        latex: '\\text{zone} = \\left\\lfloor \\frac{\\lambda_{\\text{interior}} + 180^{\\circ}}{6^{\\circ}} \\right\\rfloor + 1',
        description: 'Calculates the metric UTM projection zone from the parcel representative interior longitude.',
        variables: [
          { symbol: '\\lambda_{\\text{interior}}', meaning: 'Representative interior longitude', unit: 'degrees' },
          { symbol: '\\text{zone}', meaning: 'Clamped UTM projection zone (1 to 60)', unit: 'integer' }
        ]
      }
    ],
    operationalLimits: [
      'Field boundary must be a valid closed polygon ring.',
      'Recommended parcel area up to 500 hectares for high-resolution processing.'
    ],
    scientificRationale: 'Converting geographic coordinates to metric UTM meters eliminates longitudinal foreshortening, ensuring true isotropic Euclidean distances for spatial interpolation.'
  },
  {
    id: 'grid-discretization',
    stepNumber: 2,
    title: 'Regular Metric Grid Discretization',
    subtitle: '5m / 10m regular mesh generation with boundary polygon clipping',
    iconName: 'Grid',
    inputDescription: 'Projected UTM boundary polygon and chosen cell resolution (5m or 10m)',
    outputDescription: 'Indexed square GridCells with centroid UTM coordinates and clipped surface area (m²)',
    mathematicalBasis: 'Discretized 2D axis-aligned bounding box filtered by polygon containment',
    algorithmSummary: 'Generates regular grid points across the bounding box, retaining points strictly inside the parcel boundary and computing exact clipped cell areas at field perimeters.',
    keyFormulas: [
      {
        name: 'Regular Grid Coordinates',
        latex: 'x_j = x_{\\min} + \\frac{\\Delta x}{2} + j \\Delta x, \\quad y_i = y_{\\max} - \\frac{\\Delta y}{2} - i \\Delta y',
        description: 'Matrix coordinates where row zero starts at the northernmost edge and column zero at the westernmost edge.',
        variables: [
          { symbol: '\\Delta x, \\Delta y', meaning: 'Selected grid cell spacing (5.0 m or 10.0 m)', unit: 'meters' },
          { symbol: 'i, j', meaning: 'Row and column indices in the spatial raster matrix', unit: 'integers' }
        ]
      }
    ],
    operationalLimits: [
      'Enforces safety upper bound of 5,000 retained interior cells.',
      'Cell resolution (5m vs 10m) can be configured based on survey sampling density.'
    ],
    scientificRationale: 'A regular discretization transforms irregular parcel boundaries into an indexed matrix suitable for vectorized interpolation and zone mapping.'
  },
  {
    id: 'idw-interpolation',
    stepNumber: 3,
    title: 'Inverse Distance Weighting (IDW p=2.0) Interpolation',
    subtitle: 'Deterministic spatial estimation with Leave-One-Out Cross-Validation (LOOCV)',
    iconName: 'Activity',
    inputDescription: '3 to 50 georeferenced laboratory soil core samples (pH, EC, N, P, K)',
    outputDescription: 'Continuous property rasters across all grid cells with cross-validation summary',
    mathematicalBasis: 'IDW formulation with fixed power p=2.0 and Euclidean distance metric in UTM meters',
    algorithmSummary: 'For each cell center and each chemical parameter, calculates the weighted average of measured sample points inversely proportional to squared Euclidean distance, honoring exact values at sample locations.',
    keyFormulas: [
      {
        name: 'Inverse Distance Weighting Formulation',
        latex: '\\hat{Z}(x_0) = \\frac{\\sum_{i=1}^{N} w_i Z_i}{\\sum_{i=1}^{N} w_i}, \\quad w_i = \\frac{1}{\\left(d(x_0, x_i)\\right)^p}',
        description: 'Calculates estimated property value at cell center x₀ from surrounding lab soil samples.',
        variables: [
          { symbol: 'p', meaning: 'Power parameter (fixed at p = 2.0)', unit: 'dimensionless' },
          { symbol: 'd(x_0, x_i)', meaning: 'Euclidean distance in metric UTM coordinates', unit: 'meters' },
          { symbol: 'Z_i', meaning: 'Laboratory analyzed chemical measurement at core sample i', unit: 'various' }
        ]
      }
    ],
    operationalLimits: [
      'Requires at least 3 georeferenced soil core samples with uniform depth.',
      'Estimates are bounded within the convex range of observed sample values.'
    ],
    scientificRationale: 'IDW with p=2.0 provides an exact, transparent interpolator that avoids unstable variogram parameter fitting on typical 5-10 core farm surveys.'
  },
  {
    id: 'spatial-clustering',
    stepNumber: 4,
    title: 'Unsupervised Spatial Clustering & Auto-K* Sweep',
    subtitle: 'Multivariate z-scoring, automated Silhouette evaluation, and contiguity smoothing',
    iconName: 'Layers',
    inputDescription: 'Interpolated multi-property matrix across all grid cells',
    outputDescription: 'Categorical management zone labels (1 to K*) with contiguous boundaries',
    mathematicalBasis: 'K-Means++ & Fuzzy C-Means clustering with Silhouette validation across K in [2, 6]',
    algorithmSummary: 'Normalizes chemical properties to zero mean and unit variance, tests candidate cluster counts from K=2 to 6, selects optimal K* by maximizing silhouette coefficient, and applies spatial smoothing to eliminate isolated micro-patches.',
    keyFormulas: [
      {
        name: 'Silhouette Coefficient',
        latex: 's(i) = \\frac{b(i) - a(i)}{\\max(a(i), b(i))}, \\quad K^* = \\arg\\max_{K \\in [2, 6]} \\bar{s}_K',
        description: 'Quantifies how well each cell fits its assigned cluster relative to neighboring clusters.',
        variables: [
          { symbol: 'a(i)', meaning: 'Mean intra-cluster distance of sample i to all points in same cluster', unit: 'dimensionless' },
          { symbol: 'b(i)', meaning: 'Mean nearest-cluster distance of sample i to points in closest neighboring cluster', unit: 'dimensionless' },
          { symbol: 'K^*', meaning: 'Optimal number of management zones', unit: 'integer' }
        ]
      }
    ],
    operationalLimits: [
      'Auto-K evaluates candidate partitionings from 2 to 6 zones.',
      'Minimum zone area threshold prevents overly fragmented management units.'
    ],
    scientificRationale: 'Evaluating silhouette scores across multiple K candidates discovers natural soil groupings dynamically rather than imposing an arbitrary fixed number of zones.'
  },
  {
    id: 'shi-scoring',
    stepNumber: 5,
    title: 'Soil Health Index (SHI) Multi-Factor Screening',
    subtitle: 'Non-linear biological response curves and weighted composite scoring',
    iconName: 'Droplets',
    inputDescription: 'Observed or zone-average soil chemical attributes (pH, EC, N, P, K)',
    outputDescription: 'Composite Soil Health Index (0 to 100) and factor sub-scores',
    mathematicalBasis: 'Gaussian bell curve for pH, inverted logistic sigmoid for salinity, logistic curves for macronutrients',
    algorithmSummary: 'Evaluates each chemical parameter using established non-linear biological response curves, then calculates a weighted composite health score from 0 to 100.',
    keyFormulas: [
      {
        name: 'Composite Soil Health Index (SHI)',
        latex: '\\text{SHI} = 100 \\sum_{k=1}^{5} w_k S_k(X_k), \\quad \\sum_{k=1}^{5} w_k = 1.0',
        description: 'Weighted sum of 5 non-linear biological response sub-scores.',
        variables: [
          { symbol: 'w_k', meaning: 'Agronomic parameter weights (pH: 0.25, EC: 0.20, N: 0.20, P: 0.15, K: 0.20)', unit: 'dimensionless' },
          { symbol: 'S_k(X_k)', meaning: 'Individual non-linear sub-score for parameter X_k', unit: 'interval [0, 1]' }
        ]
      }
    ],
    operationalLimits: [
      'Serves as an exploratory agronomic screening indicator.',
      'Operates independently of spatial clustering to preserve orthogonal multi-dimensional soil chemistry.'
    ],
    scientificRationale: 'Non-linear response curves reflect plant physiology, penalizing both extreme acidity and alkalinity while modeling nutrient saturation thresholds.'
  }
];

// ==========================================
// MODULE 2: FIELD TELEMETRY & GRU MODEL
// ==========================================
export const telemetryStages: PipelineStage[] = [
  {
    id: 'gru-ingestion',
    stepNumber: 1,
    title: 'WSN Telemetry Stream Ingestion & Resampling',
    subtitle: 'Time-series parsing, validation, and regular 10-minute binning',
    iconName: 'Radio',
    inputDescription: 'In-situ telemetry observations with timestamps and sensor channels',
    outputDescription: 'Clean, chronological 10-minute resampled multivariate time series',
    mathematicalBasis: 'Uniform temporal binning with forward-fill interpolation across gaps',
    algorithmSummary: 'Ingests multi-channel sensor readings (soil moisture, temperature, EC, ambient climate), resamples irregular packet streams to regular 10-minute bins, and screens for sensor anomalies.',
    keyFormulas: [
      {
        name: 'Regular Temporal Resampling',
        latex: '\\bar{x}_t = \\frac{1}{|B_t|} \\sum_{k \\in B_t} x_k, \\quad B_t = [t - 5\\text{min}, t + 5\\text{min})',
        description: 'Aggregates irregular sensor packets falling within each 10-minute temporal window.',
        variables: [
          { symbol: 'B_t', meaning: 'Time interval centered at time step t', unit: 'minutes' },
          { symbol: '\\bar{x}_t', meaning: 'Mean sensor observation for bin t', unit: 'sensor units' }
        ]
      }
    ],
    operationalLimits: [
      'Requires sequential timestamped sensor packets.',
      'Handles short sensor dropouts via forward-fill within 30-minute bounds.'
    ],
    scientificRationale: 'Recurrent neural architectures require uniform time steps to learn meaningful temporal dependencies without bias from irregular sampling intervals.'
  },
  {
    id: 'gru-windowing',
    stepNumber: 2,
    title: 'Sliding Sequence Window Formulation',
    subtitle: '24-hour temporal sliding window construction and train/test splitting',
    iconName: 'Clock',
    inputDescription: 'Resampled 10-minute sensor series',
    outputDescription: 'Sliding sequence matrices (144 timesteps × 5 channels)',
    mathematicalBasis: 'Chronological sliding window formulation without future lookahead leakage',
    algorithmSummary: 'Constructs 144-step sequence windows (24 hours at 10-minute resolution) and normalizes features using training-set statistics.',
    keyFormulas: [
      {
        name: 'Window Sequence Matrix',
        latex: '\\mathbf{X}_t = [\\mathbf{x}_{t-143}, \\mathbf{x}_{t-142}, \\dots, \\mathbf{x}_t] \\in \\mathbb{R}^{144 \\times 5}',
        description: 'Sliding input window containing 24 hours of multi-channel sensor observations.',
        variables: [
          { symbol: '\\mathbf{X}_t', meaning: 'Input sequence matrix at time t', unit: 'normalized tensor' },
          { symbol: '\\mathbf{x}_t', meaning: '5-channel sensor feature vector at step t', unit: 'vector' }
        ]
      }
    ],
    operationalLimits: [
      'Enforces strict chronological splitting to preserve valid temporal validation.',
      'Feature scalers are fitted exclusively on the historical training segment.'
    ],
    scientificRationale: 'Chronological sequence windowing maintains real-world forward temporal order, preventing artificial lookahead bias.'
  },
  {
    id: 'gru-recurrent',
    stepNumber: 3,
    title: 'Two-Layer GRU Sequence Modeling',
    subtitle: 'Gated Recurrent Unit network with residual delta forecasting head',
    iconName: 'Cpu',
    inputDescription: '144×5 sequence tensor',
    outputDescription: 'Multi-horizon predicted residual changes (+6h, +12h, +24h)',
    mathematicalBasis: 'Gated Recurrent Unit cell with update and reset gates',
    algorithmSummary: 'Processes 24-hour sequential patterns through stacked GRU layers (64 and 32 units) to extract latent temporal representations, then outputs future changes via a Dense head.',
    keyFormulas: [
      {
        name: 'Residual Multi-Horizon Forecast',
        latex: '\\hat{y}_{t+h} = y_t + \\mathbf{W}_{\\text{dense}} \\mathbf{h}_{\\text{GRU2}} + b, \\quad h \\in \\{6\\text{h}, 12\\text{h}, 24\\text{h}\\}',
        description: 'Predicts future values by adding estimated residual changes to the latest observation.',
        variables: [
          { symbol: 'y_t', meaning: 'Current measured soil moisture reading', unit: '%RH' },
          { symbol: '\\mathbf{h}_{\\text{GRU2}}', meaning: 'Final latent hidden state from GRU Layer 2', unit: 'vector' },
          { symbol: 'h', meaning: 'Forecast horizon (+6 hours, +12 hours, +24 hours)', unit: 'hours' }
        ]
      }
    ],
    operationalLimits: [
      'Forecasts up to 24 hours into the future.',
      'Designed for advisory tracking and trend screening.'
    ],
    scientificRationale: 'Predicting the residual change Δy rather than absolute levels improves numerical convergence and keeps predictions tightly bounded.'
  },
  {
    id: 'gru-evaluation',
    stepNumber: 4,
    title: 'Multi-Horizon Evaluation & Benchmarking',
    subtitle: 'Model verification on held-out test windows across forecasting horizons',
    iconName: 'CheckCircle2',
    inputDescription: 'Model forecasts and observed test set measurements',
    outputDescription: 'MAE and RMSE error metrics across +6h, +12h, and +24h horizons',
    mathematicalBasis: 'Mean Absolute Error and Root Mean Squared Error across held-out test windows',
    algorithmSummary: 'Evaluates multi-step forecasting accuracy on held-out test data, verifying stable numerical performance with MAE consistently below 1.3 %RH across all horizons.',
    keyFormulas: [
      {
        name: 'Mean Absolute Error (MAE)',
        latex: '\\text{MAE}_h = \\frac{1}{M} \\sum_{i=1}^{M} \\left| \\hat{y}_{i+h} - y_{i+h} \\right|',
        description: 'Quantifies average prediction error across M held-out evaluation windows.',
        variables: [
          { symbol: 'M', meaning: 'Number of held-out test sequence windows', unit: 'integer' },
          { symbol: '\\hat{y}_{i+h}, y_{i+h}', meaning: 'Forecasted and ground truth values at horizon h', unit: '%RH' }
        ]
      }
    ],
    operationalLimits: [
      'Subsoil conditions exhibit natural thermal and moisture buffering.',
      'Results provide transparent trend monitoring for farm managers.'
    ],
    scientificRationale: 'Rigorous multi-horizon evaluation confirms that the recurrent model maintains bounded, stable predictions across full diurnal cycles.'
  }
];

// ==========================================
// MODULE 3: REMOTE SENSING & SOILGRIDS
// ==========================================
export const remoteSensingStages: PipelineStage[] = [
  {
    id: 'satellite-indices',
    stepNumber: 1,
    title: 'Sentinel-2 Multispectral Retrieval & Canopy NDVI',
    subtitle: 'Copernicus Level-2A surface reflectance ingestion and vegetative index calculation',
    iconName: 'Satellite',
    inputDescription: 'Sentinel-2 L2A BOA reflectance bands B04 (Red, 665nm) and B08 (NIR, 842nm)',
    outputDescription: 'Normalized Difference Vegetation Index (NDVI) summary across parcel AOI',
    mathematicalBasis: 'Standard normalized difference vegetation index formulation',
    algorithmSummary: 'Ingests 10m surface reflectance bands, computes NDVI to evaluate canopy photosynthetic activity, and summarizes vegetative vigor across the parcel area of interest.',
    keyFormulas: [
      {
        name: 'Normalized Difference Vegetation Index (NDVI)',
        latex: '\\text{NDVI} = \\frac{\\rho_{\\text{B08}} - \\rho_{\\text{B04}}}{\\rho_{\\text{B08}} + \\rho_{\\text{B04}}} = \\frac{\\text{NIR} - \\text{Red}}{\\text{NIR} + \\text{Red}}',
        description: 'Measures vegetative greenness and canopy chlorophyll density.',
        variables: [
          { symbol: '\\rho_{\\text{B08}}', meaning: 'Sentinel-2 Band 8 Near-Infrared reflectance (842 nm)', unit: 'reflectance [0, 1]' },
          { symbol: '\\rho_{\\text{B04}}', meaning: 'Sentinel-2 Band 4 Red reflectance (665 nm)', unit: 'reflectance [0, 1]' }
        ]
      }
    ],
    operationalLimits: [
      'Constrained by satellite revisit cadence (typically 5 days with constellation).',
      'Provides aggregate canopy vigor indicators across the chosen parcel buffer.'
    ],
    scientificRationale: 'Photosynthetically active vegetation strongly absorbs red light for photosynthesis while scattering near-infrared light through leaf mesophyll cell structures, providing a robust vigor signal.'
  },
  {
    id: 'qa60-filtering',
    stepNumber: 2,
    title: 'QA60 Cloud Bitmask & Quality Filtering',
    subtitle: 'Automated pixel-level cloud and cirrus screening',
    iconName: 'Globe',
    inputDescription: 'Sentinel-2 QA60 quality assessment band',
    outputDescription: 'Clear-sky filtered acquisition dates and valid scene masks',
    mathematicalBasis: 'Bitwise masking for opaque clouds (bit 10) and cirrus clouds (bit 11)',
    algorithmSummary: 'Inspects QA60 quality flags to screen out cloud-contaminated scenes, ensuring vegetation index calculations reflect genuine ground canopy conditions.',
    keyFormulas: [
      {
        name: 'QA60 Clear-Sky Condition',
        latex: '\\text{Valid} = \\left( \\text{QA60} \\ \& \\ 0\\text{x0C00} \\right) == 0',
        description: 'Verifies that both bit 10 (opaque cloud) and bit 11 (cirrus) are unset.',
        variables: [
          { symbol: '\\text{QA60}', meaning: 'Sentinel-2 60m quality assessment bitmask', unit: 'integer flags' }
        ]
      }
    ],
    operationalLimits: [
      'Heavy cloud cover during monsoon periods requires selecting the nearest clear-sky scene.',
      'Partial cloud shadows are flagged for agronomist review.'
    ],
    scientificRationale: 'Cloud reflectance mimics high near-infrared and red return, which would severely corrupt vegetation index calculations without quality bitmask filtering.'
  },
  {
    id: 'soilgrids-covariates',
    stepNumber: 3,
    title: 'Regional ISRIC SoilGrids 2.0 Ingestion',
    subtitle: 'Global 250m digital soil mapping layers for regional context',
    iconName: 'Layers',
    inputDescription: 'Parcel centroid coordinates and regional depth profiles (0-30 cm)',
    outputDescription: 'Regional soil context covariates (clay %, sand %, organic carbon, pH)',
    mathematicalBasis: 'Web Coverage Service (WCS) regional raster retrieval at native 250m resolution',
    algorithmSummary: 'Queries global digital soil mapping rasters to provide regional pedological context without artificially downscaling coarse rasters into localized farm maps.',
    keyFormulas: [
      {
        name: 'Regional Soil Property Retrieval',
        latex: 'Z_{\\text{regional}}(\\mathbf{x}) = \\text{WCS}(\\text{dataset}, \\mathbf{x}, \\text{depth}=0\\text{-}30\\text{cm})',
        description: 'Queries native 250m resolution regional soil properties from ISRIC digital soil mapping.',
        variables: [
          { symbol: '\\mathbf{x}', meaning: 'Parcel geographic centroid coordinates', unit: 'lon, lat' }
        ]
      }
    ],
    operationalLimits: [
      'Displayed strictly as regional background context at native 250m resolution.',
      'Does not substitute for localized laboratory soil sampling.'
    ],
    scientificRationale: 'A 250m pixel spans 6.25 hectares. Retaining native resolution prevents fabricating false high-resolution gradients on smallholder parcels.'
  }
];

// ==========================================
// MODULE 4: LEAF PATHOLOGY CNN
// ==========================================
export const leafVisionStages: PipelineStage[] = [
  {
    id: 'image-preprocessing',
    stepNumber: 1,
    title: 'Foliar Image Preprocessing & Normalization',
    subtitle: 'Aspect-ratio preserving crop, resizing to 224×224, and tensor standardization',
    iconName: 'Leaf',
    inputDescription: 'Single RGB leaf photograph from mobile camera or field device',
    outputDescription: 'Standardized 3×224×224 input tensor normalized for inference',
    mathematicalBasis: 'Affine bilinear interpolation and channel-wise ImageNet z-scoring',
    algorithmSummary: 'Preprocesses leaf photographs to standard 224×224 resolution, applies ImageNet normalization, and checks image clarity.',
    keyFormulas: [
      {
        name: 'Channel Standardization',
        latex: 'x_{\\text{norm}}^{(c)} = \\frac{x^{(c)} / 255 - \\mu_c}{\\sigma_c}, \\quad c \\in \\{R, G, B\\}',
        description: 'Standardizes pixel intensities using standard convolutional normalization parameters.',
        variables: [
          { symbol: '\\mu_c, \\sigma_c', meaning: 'ImageNet RGB channel means and standard deviations', unit: 'constants' }
        ]
      }
    ],
    operationalLimits: [
      'Requires a clear, focused photograph of the affected leaf.',
      'Processes a single leaf image per diagnostic request.'
    ],
    scientificRationale: 'Standardized preprocessing ensures visual lesion features match the distribution learned by the convolutional neural network.'
  },
  {
    id: 'mobilenet-inference',
    stepNumber: 2,
    title: 'MobileNetV3-Small Convolutional Feature Extraction',
    subtitle: 'Inverted residual bottlenecks with squeeze-and-excitation attention',
    iconName: 'Cpu',
    inputDescription: 'Preprocessed 224×224×3 tensor',
    outputDescription: 'Top-3 candidate disease conditions with calibrated softmax probabilities',
    mathematicalBasis: 'MobileNetV3-Small architecture with Hard-Swish activations and SE modules',
    algorithmSummary: 'Extracts multiscale visual features using inverted residual bottleneck blocks, then computes class probabilities across 17 audited foliar conditions.',
    keyFormulas: [
      {
        name: 'Softmax Probability Distribution',
        latex: 'P(y = c \\mid \\mathbf{x}) = \\frac{\\exp(z_c)}{\\sum_{j=1}^{17} \\exp(z_j)}, \\quad c \\in \\{1, \\dots, 17\\}',
        description: 'Converts raw model logits z into a normalized probability distribution across 17 disease classes.',
        variables: [
          { symbol: 'z_c', meaning: 'Raw classifier logit for candidate class c', unit: 'real number' },
          { symbol: 'P(y = c)', meaning: 'Posterior probability of candidate condition c', unit: 'probability [0, 1]' }
        ]
      }
    ],
    operationalLimits: [
      'Trained across 17 audited crop-disease conditions with 92.97% test accuracy.',
      'Designed for fast on-device inference with low memory overhead.'
    ],
    scientificRationale: 'Squeeze-and-excitation attention channels computational capacity to key lesion characteristics while maintaining lightweight edge efficiency.'
  },
  {
    id: 'decision-support-output',
    stepNumber: 3,
    title: 'Diagnostic Decision Support & Verification',
    subtitle: 'Transparent confidence reporting with human agronomist review workflow',
    iconName: 'Eye',
    inputDescription: 'Top-3 softmax probability distribution and class metadata',
    outputDescription: 'Actionable diagnostic report with symptom descriptions and review mandate',
    mathematicalBasis: 'Confidence margin evaluation and human-in-the-loop decision gating',
    algorithmSummary: 'Presents the top-3 identified conditions with clear confidence percentages and symptom guidance, keeping the agronomist in full control of field treatments.',
    keyFormulas: [
      {
        name: 'Confidence Margin',
        latex: '\\Delta P_{\\text{margin}} = P_{(1)} - P_{(2)}',
        description: 'Difference between top candidate probability and runner-up probability.',
        variables: [
          { symbol: 'P_{(1)}, P_{(2)}', meaning: 'Probabilities of the highest and second-highest candidate conditions', unit: 'probabilities' }
        ]
      }
    ],
    operationalLimits: [
      'Delivered as an agronomic decision support aid, not an autonomous prescription.',
      'Flagged for agronomist confirmation before applying chemical treatments.'
    ],
    scientificRationale: 'Preserving human agronomist oversight prevents misclassification in ambiguous field lighting and ensures responsible chemical application.'
  }
];

// ==========================================
// MODULE 5: CROP FIT & AGRONOMIC DSS
// ==========================================
export const cropFitStages: PipelineStage[] = [
  {
    id: 'parameter-extraction',
    stepNumber: 1,
    title: 'Observed Soil Chemistry Profile Extraction',
    subtitle: 'Aggregating chemical and physical indicators per management unit',
    iconName: 'Sprout',
    inputDescription: 'In-situ or interpolated soil attributes (pH, EC, N, P, K) for target zone',
    outputDescription: 'Structured zone agronomic profile ready for suitability matching',
    mathematicalBasis: 'Zone median aggregation of interpolated continuous properties',
    algorithmSummary: 'Extracts representative chemical and soil properties for each management unit to evaluate crop requirements.',
    keyFormulas: [
      {
        name: 'Zone Representative Profile',
        latex: '\\bar{Z}_{k} = \\text{median}\\left(\\{ Z(x) \\mid x \\in \\text{Zone}_k \\}\\right)',
        description: 'Robust median property value within management zone k.',
        variables: [
          { symbol: '\\bar{Z}_k', meaning: 'Representative chemical value for zone k', unit: 'parameter units' }
        ]
      }
    ],
    operationalLimits: [
      'Operates on verified zone soil profiles.',
      'Evaluates conditions against calibrated regional crop requirements.'
    ],
    scientificRationale: 'Zone-level aggregation smooths local measurement noise, yielding representative profiles for variable-rate farm planning.'
  },
  {
    id: 'boundary-matching',
    stepNumber: 2,
    title: 'Agronomic Factor Boundary Evaluation',
    subtitle: 'Factor-by-factor compatibility matching against reference requirements',
    iconName: 'Sliders',
    inputDescription: 'Zone soil profile and crop requirement reference matrix',
    outputDescription: 'Factor-level compatibility ratings (Optimal, Moderate, Limiting)',
    mathematicalBasis: 'Multi-criteria boundary checking across independent agronomic parameters',
    algorithmSummary: 'Compares soil properties against established agronomic ranges for regional benchmark crops (Finger Millet, Tomato, Groundnut) to identify limiting factors.',
    keyFormulas: [
      {
        name: 'Independent Factor Evaluation',
        latex: '\\text{Status}(F, c) = \\begin{cases} \\text{Optimal} & \\text{if } F \\in [\\text{Opt}_{\\min}, \\text{Opt}_{\\max}] \\\\ \\text{Moderate} & \\text{if } F \\in [\\text{Mod}_{\\min}, \\text{Mod}_{\\max}] \\\\ \\text{Limiting} & \\text{otherwise} \\end{cases}',
        description: 'Evaluates each soil parameter independently against reference criteria for crop c.',
        variables: [
          { symbol: 'F', meaning: 'Measured soil factor (e.g., pH, EC, available N)', unit: 'parameter units' }
        ]
      }
    ],
    operationalLimits: [
      'Calibrated against regional agricultural extension guidelines.',
      'Identifies specific soil remediation targets (e.g., lime for low pH).'
    ],
    scientificRationale: 'Independent factor matching clearly identifies specific limiting factors so agronomists know exactly which soil parameters require remediation.'
  },
  {
    id: 'decision-support',
    stepNumber: 3,
    title: 'Multi-Crop Decision Support & Viability',
    subtitle: 'Multi-label suitability screening and advisory reporting',
    iconName: 'BookOpen',
    inputDescription: 'Evaluated factor status across candidate crop profiles',
    outputDescription: 'Actionable crop suitability report and management recommendations',
    mathematicalBasis: 'Multi-label classification without mutually exclusive probability constraints',
    algorithmSummary: 'Generates comprehensive crop recommendations for each field zone, reporting independent suitability for each crop without artificial mathematical constraints.',
    keyFormulas: [
      {
        name: 'Multi-Label Crop Viability',
        latex: '\\sum_{c \\in \\{\\text{Ragi}, \\text{Tomato}, \\text{Groundnut}\\}} P(\\text{Suitable}_c) \\neq 1.0',
        description: 'Suitability states are independent: a field can be suitable for multiple crops simultaneously.',
        variables: [
          { symbol: 'P(\\text{Suitable}_c)', meaning: 'Viability status for crop c', unit: 'independent binary/score' }
        ]
      }
    ],
    operationalLimits: [
      'Provides advisory screening to support agricultural decision-making.',
      'Recommendations should be paired with local market and weather forecasts.'
    ],
    scientificRationale: 'Crop suitability is inherently multi-label. Land can be well-suited for multiple crops at the same time, or poorly suited for all, making independent evaluation essential.'
  }
];

// ==========================================
// SYSTEM SCOPE & KEY FAQS
// ==========================================
export const defenseQAList: DefenseQA[] = [
  {
    id: 'q1-idw-interpolation',
    questionNumber: 1,
    category: 'Spatial ML',
    question: 'Why does KshetraSense use IDW (p=2.0) instead of complex variogram kriging for soil interpolation?',
    briefAnswer: 'IDW with p=2.0 is an exact, transparent, and deterministic interpolator that reliably preserves measured values without requiring 50+ samples to fit empirical variograms.',
    deepScientificDefense: [
      'In practical agricultural soil surveys, farmers typically collect 5 to 10 georeferenced cores across a field parcel.',
      'Fitting empirical semivariograms with fewer than 50 samples is mathematically unstable and sensitive to minor sample noise.',
      'IDW p=2.0 provides an intuitive distance-weighted estimate, passes exactly through measured sample cores, and includes Leave-One-Out Cross-Validation (LOOCV) for transparent quality checks.'
    ],
    primaryCitations: ['Shepard, D. (1968). A two-dimensional interpolation function for irregularly-spaced data.'],
    keyRiskOrLimitation: 'Estimates are bounded within the range of observed field sample values.'
  },
  {
    id: 'q2-autok-clustering',
    questionNumber: 2,
    category: 'Spatial ML',
    question: 'How does the system determine the optimal number of management zones?',
    briefAnswer: 'KshetraSense automatically evaluates clustering candidates from K=2 to 6 using silhouette coefficients, selecting the optimal K* that maximizes natural cluster separation.',
    deepScientificDefense: [
      'Rather than arbitrarily fixing a hardcoded number of zones (such as 3), the system sweeps candidate zone counts from K=2 to 6.',
      'It computes the mean silhouette score for each candidate, picking the argmax K* that best reflects true soil chemistry variations.',
      'A spatial contiguity smoothing pass ensures that small isolated micro-cells are cleanly merged into coherent management units.'
    ],
    primaryCitations: ['Rousseeuw, P. J. (1987). Silhouettes: a graphical aid to the interpretation and validation of cluster analysis.'],
    keyRiskOrLimitation: 'Evaluates between 2 to 6 management zones based on field variability.'
  },
  {
    id: 'q3-modular-architecture',
    questionNumber: 3,
    category: 'System Architecture',
    question: 'How are the analytical modules decoupled and why is this beneficial?',
    briefAnswer: 'Each of the 5 modules operates under independent, validated data contracts, ensuring high reliability, clear auditability, and local-first execution.',
    deepScientificDefense: [
      'Separating soil zoning, time-series telemetry, satellite remote sensing, foliar vision, and crop fit prevents cascading cross-domain errors.',
      'For example, the foliar vision classifier operates strictly on visual RGB leaf features without uncalibrated soil chemistry inputs, avoiding spurious correlations.',
      'All spatial algorithms and ML inference can run locally, preserving farmer data privacy.'
    ],
    primaryCitations: ['Martin, R. C. (2002). Agile Software Development: Principles, Patterns, and Practices.'],
    keyRiskOrLimitation: 'Requires clean input data formats conforming to specified module schemas.'
  },
  {
    id: 'q4-mobilenet-foliar',
    questionNumber: 4,
    category: 'Computer Vision',
    question: 'How does the MobileNetV3-Small classifier perform on leaf disease identification?',
    briefAnswer: 'The lightweight convolutional network achieves 92.97% test accuracy across 17 crop conditions with low millisecond latency and top-3 confidence reporting.',
    deepScientificDefense: [
      'MobileNetV3-Small utilizes inverted residual bottlenecks with squeeze-and-excitation attention blocks to capture localized lesion characteristics.',
      'Outputs provide the top-3 candidate conditions with calibrated confidence percentages rather than a single forced prediction.',
      'Designed as a decision support aid for agronomists, encouraging field confirmation before applying chemical treatments.'
    ],
    primaryCitations: ['Howard, A., et al. (2019). Searching for MobileNetV3. ICCV.'],
    keyRiskOrLimitation: 'Works best with clear, focused photographs of affected leaf surfaces.'
  },
  {
    id: 'q5-crop-suitability',
    questionNumber: 5,
    category: 'Agronomy',
    question: 'What regional crops are supported for agronomic suitability matching?',
    briefAnswer: 'The crop suitability engine is calibrated for regional Karnataka cropping systems, including Finger Millet (Ragi), Tomato, and Groundnut.',
    deepScientificDefense: [
      'Each crop profile defines agronomic ranges for pH, salinity (EC), drainage, and macronutrients based on regional university extension benchmarks.',
      'Evaluations are multi-label: land can be suitable for multiple crops simultaneously without forcing artificial sum-to-100% constraints.',
      'The engine highlights specific limiting factors (e.g., soil acidity) to provide actionable soil amendment advice.'
    ],
    primaryCitations: ['University of Agricultural Sciences, Bangalore (UASB) Package of Practices.'],
    keyRiskOrLimitation: 'Recommendations serve as agronomic guidance to be paired with local market considerations.'
  },
  {
    id: 'q6-gru-telemetry',
    questionNumber: 6,
    category: 'Time Series',
    question: 'How does the GRU sequence model forecast multi-horizon telemetry trends?',
    briefAnswer: 'The 2-layer GRU ingests regular 10-minute sensor series and predicts residual changes across +6h, +12h, and +24h horizons with low absolute error.',
    deepScientificDefense: [
      'The network ingests a 144-step sliding window (24 hours at 10-min resolution) across 5 channels (soil moisture, temperature, EC, microclimate).',
      'Stacked GRU layers (64 and 32 units) capture recurrent temporal patterns while keeping parameter count lightweight (~32.8k weights).',
      'The Dense residual head forecasts change deltas rather than raw levels, maintaining smooth and bounded multi-step trajectories.'
    ],
    primaryCitations: ['Cho, K., et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder. EMNLP.'],
    keyRiskOrLimitation: 'Provides trend tracking to support irrigation and sensor monitoring workflows.'
  }
];

// ==========================================
// TEST MATRIX DATA
// ==========================================
export const testMatrixData: TestMatrixEntry[] = [
  {
    scope: 'Spatial Zoning & Metric GIS Core',
    command: 'npm run test (frontend) & pytest (backend)',
    status: 'passed',
    passedCount: '56 TS / 42 Py Verified',
    keyEvidence: 'Verified UTM projections, regular metric grid clipping, IDW p=2 interpolation, and Auto-K silhouette selection.',
    scientificBoundary: 'Full test suite passing with deterministic execution.'
  },
  {
    scope: 'Field Telemetry & Sequence Model',
    command: 'pytest services/telemetry',
    status: 'passed',
    passedCount: '28 Py Tests Verified',
    keyEvidence: 'Chronological time-series resampling, sliding window generation, and multi-horizon GRU delta forecasts verified.',
    scientificBoundary: 'Evaluated against baselines with MAE < 1.3 %RH across horizons.'
  },
  {
    scope: 'Sentinel-2 & Remote Sensing Pipeline',
    command: 'pytest services/monitoring',
    status: 'passed',
    passedCount: '18 Py Tests Verified',
    keyEvidence: 'QA60 cloud bitmask filtering, multispectral NDVI calculation, and regional 250m SoilGrids WCS retrieval verified.',
    scientificBoundary: 'Cloud-screened clear-sky observations verified.'
  },
  {
    scope: 'MobileNetV3 Leaf Pathology Classifier',
    command: 'pytest services/leaf',
    status: 'passed',
    passedCount: '16 Py Tests Verified',
    keyEvidence: 'Input tensor normalization, forward inference across 17 classes, and top-3 probability output verified.',
    scientificBoundary: '92.97% test accuracy on held-out evaluation set.'
  }
];
