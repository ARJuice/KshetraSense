import type {
  CircularAreaOfInterest,
  CropSightAnalysisResult,
  SoilGridsContextData,
} from '../features/monitoring/types';

const BASE_URL = import.meta.env.VITE_ZONING_API_URL ?? 'http://127.0.0.1:8000';
const CROPSIGHT_URL = import.meta.env.VITE_CROPSIGHT_API_URL ?? `${BASE_URL}/cropsight`;

export class MonitoringApiError extends Error {
  constructor(message: string, public readonly status?: number, public readonly isAuthError = false) {
    super(message);
    this.name = 'MonitoringApiError';
  }
}

/**
 * Fetch regional SoilGrids 2.0 modeled context for coordinates, property, and depth layer.
 */
export async function fetchSoilGridsContext(
  latitude: number,
  longitude: number,
  property = 'phh2o',
  depth = '0-5cm',
): Promise<SoilGridsContextData> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new MonitoringApiError('SoilGrids requires a valid latitude (−90 to 90) and longitude (−180 to 180).');
  }
  const url = `${BASE_URL}/v1/monitoring/soilgrids?latitude=${latitude}&longitude=${longitude}&property=${encodeURIComponent(property)}&depth=${encodeURIComponent(depth)}`;
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw new MonitoringApiError(error instanceof Error ? error.message : 'SoilGrids service is unreachable.');
  }
  if (!response.ok) {
    const errText = await response.text();
    let message = errText || 'Failed to retrieve SoilGrids context from server.';
    try {
      message = JSON.parse(errText).detail ?? message;
    } catch {
      // Keep the provider's plain-text error.
    }
    throw new MonitoringApiError(message, response.status);
  }
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new MonitoringApiError('SoilGrids service returned an invalid response.');
  }
  const q05 = data.quantiles?.['Q0.05'] ?? data.quantiles?.Q0_05;
  const q50 = data.quantiles?.['Q0.50'] ?? data.quantiles?.Q0_50;
  const q95 = data.quantiles?.['Q0.95'] ?? data.quantiles?.Q0_95;
  if (
    ![data.mappedValue, q05, q50, q95, data.latitude, data.longitude].every(Number.isFinite) ||
    q05 > q50 || q50 > q95 || data.mappedValue !== q50 ||
    !['property', 'propertyName', 'depth', 'nativeResolution', 'unit', 'source', 'retrievalDate', 'modeledContextLabel', 'uncertaintyDisclosure', 'disclaimer'].every((key) => typeof data[key] === 'string')
  ) {
    throw new MonitoringApiError('SoilGrids service response did not include a consistent estimate, quantiles, and provenance.');
  }
  return {
    property: data.property,
    propertyName: data.propertyName,
    depth: data.depth,
    nativeResolution: data.nativeResolution,
    quantiles: {
      q05,
      q50,
      q95,
    },
    unit: data.unit,
    mappedValue: data.mappedValue,
    source: data.source,
    retrievalDate: data.retrievalDate,
    modeledContextLabel: data.modeledContextLabel,
    uncertaintyDisclosure: data.uncertaintyDisclosure,
    disclaimer: data.disclaimer,
    latitude: data.latitude,
    longitude: data.longitude,
  };
}

/**
 * Check CropSight service health.
 */
export async function checkCropSightHealth(): Promise<{ online: boolean; message: string }> {
  try {
    const response = await fetch(`${CROPSIGHT_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
      return { online: false, message: `Service returned HTTP ${response.status}` };
    }
    const data = await response.json();
    return { online: true, message: data.status || 'healthy' };
  } catch (error) {
    return {
      online: false,
      message: error instanceof Error ? error.message : 'CropSight service unreachable at configured endpoint.',
    };
  }
}

export interface CropSightAnalysisParams {
  aoi: CircularAreaOfInterest;
  clusteringMethod: 'K-Means' | 'DBSCAN';
  numZones: number;
  cropType: string;
  cropGrowthStage: string;
}

/**
 * Execute live CropSight field analysis against the sub-application backend.
 * Provides transparent error handling per FM-07:
 * "No-image, inadequate-coverage, unavailable-provider, and authentication/quota failures do not display stale/prepared output as current."
 */
export async function runCropSightAnalysis(params: CropSightAnalysisParams): Promise<CropSightAnalysisResult> {
  const { aoi, clusteringMethod, numZones, cropType, cropGrowthStage } = params;

  if (
    aoi.latitude === null || aoi.longitude === null ||
    !Number.isFinite(aoi.latitude) || aoi.latitude < -90 || aoi.latitude > 90 ||
    !Number.isFinite(aoi.longitude) || aoi.longitude < -180 || aoi.longitude > 180
  ) {
    throw new MonitoringApiError('Valid latitude (−90 to 90) and longitude (−180 to 180) are required to run satellite analysis.');
  }
  if (!Number.isFinite(aoi.radiusMeters) || aoi.radiusMeters < 10 || aoi.radiusMeters > 10000) {
    throw new MonitoringApiError('Circular AOI radius must be between 10 and 10,000 metres.');
  }
  if (!aoi.startDate || !aoi.endDate || Number.isNaN(Date.parse(aoi.startDate)) || Number.isNaN(Date.parse(aoi.endDate)) || aoi.startDate > aoi.endDate) {
    throw new MonitoringApiError('Enter a valid date window with the start date on or before the end date.');
  }
  if (clusteringMethod !== 'K-Means') {
    throw new MonitoringApiError('Only the CropSight K-Means path is enabled; other labels do not match the pinned implementation.');
  }
  if (!Number.isInteger(numZones) || numZones < 2 || numZones > 7) {
    throw new MonitoringApiError('CropSight K-Means cluster count must be between 2 and 7.');
  }

  const payload = {
    latitude: aoi.latitude,
    longitude: aoi.longitude,
    buffer_size: aoi.radiusMeters,
    start_date: aoi.startDate,
    end_date: aoi.endDate,
    clustering_method: clusteringMethod,
    num_zones: numZones,
    crop_type: cropType,
    crop_growth_stage: cropGrowthStage,
    eps_value: 0.05,
    min_samples: 10,
    bandwidth: 0.1,
  };

  let response: Response;
  try {
    response = await fetch(`${CROPSIGHT_URL}/analyze-field`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new MonitoringApiError(
      `CropSight / Google Earth Engine service unreachable at ${CROPSIGHT_URL}. Ensure the service process is running.`,
      undefined,
      false,
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    let detail = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      detail = parsed.detail || errorBody;
    } catch {
      // Keep raw body
    }

    const lower = detail.toLowerCase();
    const isAuth =
      lower.includes('authenticate') ||
      lower.includes('credentials') ||
      lower.includes('quota') ||
      lower.includes('project') ||
      lower.includes('not initialized') ||
      lower.includes('ee-auth') ||
      lower.includes('earth engine') ||
      lower.includes('earthengine') ||
      lower.includes('eeexception');

    if (isAuth) {
      throw new MonitoringApiError(
        `Google Earth Engine Authentication / Project Error: ${detail}. Configure the CropSight Earth Engine project and authentication before retrying.`,
        response.status,
        true,
      );
    }

    if (detail.toLowerCase().includes('no ndvi data') || detail.toLowerCase().includes('no image')) {
      throw new MonitoringApiError(
        `No cloud-free Sentinel-2 scenes found for the selected circular AOI and date window (${aoi.startDate} to ${aoi.endDate}). Try expanding the date window or adjusting the cloud filter.`,
        response.status,
      );
    }

    throw new MonitoringApiError(`CropSight analysis failed (HTTP ${response.status}): ${detail}`, response.status);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new MonitoringApiError('CropSight returned an invalid JSON response.');
  }
  const stats = data?.ndvi_stats;
  const series = data?.ndvi_time_series;
  if (
    !stats || !series ||
    !['mean', 'stddev', 'min', 'max'].every((key) => Number.isFinite(stats[key])) ||
    !Array.isArray(series.dates) || !Array.isArray(series.ndvi_values) ||
    series.dates.length !== series.ndvi_values.length ||
    !series.ndvi_values.every((value: unknown) => Number.isFinite(value))
  ) {
    throw new MonitoringApiError('CropSight response is missing valid NDVI statistics or a matching date/value series.');
  }

  return {
    source: 'COPERNICUS/S2_HARMONIZED via Google Earth Engine (CropSight sub-application)',
    provider: 'Google Earth Engine',
    aoi: {
      latitude: aoi.latitude,
      longitude: aoi.longitude,
      radiusMeters: aoi.radiusMeters,
      startDate: aoi.startDate,
      endDate: aoi.endDate,
    },
    clusteringMethod,
    processingTime: Number.isFinite(data.processing_time) ? data.processing_time : null,
    ndviStats: {
      mean: data.ndvi_stats.mean,
      stddev: data.ndvi_stats.stddev,
      min: data.ndvi_stats.min,
      max: data.ndvi_stats.max,
    },
    ndviTimeSeries: {
      dates: data.ndvi_time_series.dates,
      ndviValues: data.ndvi_time_series.ndvi_values,
      meanNdvi: data.ndvi_time_series.mean_ndvi,
      trend: data.ndvi_time_series.trend,
    },
    rainfallData: data.rainfall_data
      ? {
          dates: data.rainfall_data.dates,
          rainfallValues: data.rainfall_data.rainfall_values,
          totalRainfall: data.rainfall_data.total_rainfall,
          avgDailyRainfall: data.rainfall_data.avg_daily_rainfall,
          maxDailyRainfall: data.rainfall_data.max_daily_rainfall,
        }
      : null,
    recommendations: data.recommendations ?? [],
    responseReceivedAt: new Date().toISOString(),
  };
}
