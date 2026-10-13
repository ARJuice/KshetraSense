import type { ComparableGroup, SoilMeasurement } from './types';

export type MeasurableParameter =
  | 'ph'
  | 'ecDsM'
  | 'nitrogenMgKg'
  | 'phosphorusMgKg'
  | 'potassiumMgKg'
  | 'temperatureC'
  | 'moisturePercentage';

export interface ParameterMeta {
  key: MeasurableParameter;
  label: string;
  defaultUnit: string;
}

export const PARAMETER_METAS: Record<MeasurableParameter, ParameterMeta> = {
  ph: { key: 'ph', label: 'Soil pH', defaultUnit: 'pH scale' },
  ecDsM: { key: 'ecDsM', label: 'Electrical Conductivity (EC)', defaultUnit: 'dS/m' },
  nitrogenMgKg: { key: 'nitrogenMgKg', label: 'Available Nitrogen (N)', defaultUnit: 'mg/kg' },
  phosphorusMgKg: { key: 'phosphorusMgKg', label: 'Available Phosphorus (P)', defaultUnit: 'mg/kg' },
  potassiumMgKg: { key: 'potassiumMgKg', label: 'Available Potassium (K)', defaultUnit: 'mg/kg' },
  moisturePercentage: { key: 'moisturePercentage', label: 'Soil Moisture', defaultUnit: '%' },
  temperatureC: { key: 'temperatureC', label: 'Soil Temperature', defaultUnit: '°C' },
};

/**
 * Checks whether two soil observations are comparable according to FM-02:
 * "Repeated soil readings are graphed only when their parameters, units, methods, depths,
 * and time context are comparable; otherwise they remain separate observations."
 */
export const checkObservationComparability = (
  sampleA: SoilMeasurement,
  sampleB: SoilMeasurement,
  parameter: MeasurableParameter,
): { comparable: boolean; reason?: string } => {
  const valA = sampleA[parameter];
  const valB = sampleB[parameter];

  if (valA === undefined || valB === undefined) {
    return { comparable: false, reason: 'One or both observations lack this parameter reading.' };
  }

  // Normalize depth description
  const depthA = sampleA.depthInterval?.toLowerCase().trim() || (sampleA.depthCm !== undefined ? `${sampleA.depthCm}cm` : 'unspecified-depth');
  const depthB = sampleB.depthInterval?.toLowerCase().trim() || (sampleB.depthCm !== undefined ? `${sampleB.depthCm}cm` : 'unspecified-depth');

  if (depthA !== depthB) {
    return {
      comparable: false,
      reason: `Sampling depths differ: “${sampleA.depthInterval || `${sampleA.depthCm}cm` || 'Unspecified'}” vs “${sampleB.depthInterval || `${sampleB.depthCm}cm` || 'Unspecified'}”. Different soil strata cannot be trended as a single continuum.`,
    };
  }

  // Normalize method
  const methodA = sampleA.method?.toLowerCase().trim() || 'unspecified-method';
  const methodB = sampleB.method?.toLowerCase().trim() || 'unspecified-method';

  if (methodA !== methodB && methodA !== 'unspecified-method' && methodB !== 'unspecified-method') {
    return {
      comparable: false,
      reason: `Analytical methods differ: “${sampleA.method}” vs “${sampleB.method}”. Chemical extractants or measurement methods produce non-comparable values.`,
    };
  }

  // Check moisture units if parameter is moisture
  if (parameter === 'moisturePercentage') {
    const unitA = sampleA.moistureUnit?.toLowerCase().trim() || '% gravimetric';
    const unitB = sampleB.moistureUnit?.toLowerCase().trim() || '% gravimetric';
    if (unitA !== unitB) {
      return {
        comparable: false,
        reason: `Moisture units differ: “${sampleA.moistureUnit}” vs “${sampleB.moistureUnit}”. Gravimetric and volumetric moisture cannot be merged without bulk density conversion.`,
      };
    }
  }

  return { comparable: true };
};

/**
 * Groups a collection of samples by location and checks comparability for a chosen parameter.
 * Returns comparable groups (where repeated readings share depth, method, and unit) and
 * isolated groups (flagged with explicit incomparability explanations).
 */
export const groupSamplesForTrend = (
  samples: SoilMeasurement[],
  parameter: MeasurableParameter,
): ComparableGroup[] => {
  const meta = PARAMETER_METAS[parameter];
  const validSamples = samples.filter((s) => s[parameter] !== undefined && Number.isFinite(s[parameter] as number));

  if (validSamples.length === 0) return [];

  // Group by spatial proximity (coordinates within ~0.005 deg / ~500m) or explicit site
  const clusters: Array<{ lat: number; lon: number; samples: SoilMeasurement[] }> = [];

  validSamples.forEach((sample) => {
    let matchedCluster = clusters.find(
      (c) => Math.abs(c.lat - sample.latitude) < 0.008 && Math.abs(c.lon - sample.longitude) < 0.008,
    );
    if (!matchedCluster) {
      matchedCluster = { lat: sample.latitude, lon: sample.longitude, samples: [] };
      clusters.push(matchedCluster);
    }
    matchedCluster.samples.push(sample);
  });

  const result: ComparableGroup[] = [];

  clusters.forEach((cluster, clusterIndex) => {
    const siteLabel = `Site ${String.fromCharCode(65 + clusterIndex)} (${cluster.lat.toFixed(4)}, ${cluster.lon.toFixed(4)})`;

    // Group within cluster by (depth + method)
    const subGroups = new Map<string, SoilMeasurement[]>();

    cluster.samples.forEach((sample) => {
      const depthKey = sample.depthInterval?.toLowerCase().trim() || (sample.depthCm !== undefined ? `${sample.depthCm}cm` : 'unspecified');
      const methodKey = sample.method?.toLowerCase().trim() || 'unspecified';
      const key = `${depthKey}::${methodKey}`;

      if (!subGroups.has(key)) {
        subGroups.set(key, []);
      }
      subGroups.get(key)!.push(sample);
    });

    if (subGroups.size === 1) {
      // All samples in this cluster share depth and method!
      const groupSamples = Array.from(subGroups.values())[0];
      groupSamples.sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));

      const first = groupSamples[0];
      const unit = parameter === 'moisturePercentage' ? first.moistureUnit || '%' : meta.defaultUnit;
      const depth = first.depthInterval || (first.depthCm !== undefined ? `${first.depthCm} cm` : 'Unspecified depth');
      const method = first.method || 'Standard protocol';

      result.push({
        groupKey: `cluster-${clusterIndex}-shared`,
        siteLabel,
        parameter: meta.label,
        unit,
        depth,
        method,
        isComparable: true,
        readings: groupSamples.map((s) => ({
          sampleId: s.sampleId,
          collectedAt: s.collectedAt,
          value: s[parameter] as number,
          depth,
          method,
          unit,
        })),
      });
    } else {
      // Subgroups differ in depth or method!
      // Emit each subgroup, with an explanation of incomparability if someone tries to merge them.
      let subIdx = 1;
      subGroups.forEach((groupSamples, key) => {
        groupSamples.sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));
        const first = groupSamples[0];
        const unit = parameter === 'moisturePercentage' ? first.moistureUnit || '%' : meta.defaultUnit;
        const depth = first.depthInterval || (first.depthCm !== undefined ? `${first.depthCm} cm` : 'Unspecified depth');
        const method = first.method || 'Standard protocol';

        const hasDifferentStrata = subGroups.size > 1;
        result.push({
          groupKey: `cluster-${clusterIndex}-sub-${subIdx++}`,
          siteLabel: `${siteLabel} · Layer ${key}`,
          parameter: meta.label,
          unit,
          depth,
          method,
          isComparable: groupSamples.length > 1,
          incomparabilityReason: hasDifferentStrata
            ? `Site contains observations at different depths or methods (${Array.from(subGroups.keys()).join(' vs ')}). Displayed as separate series to prevent false trend collation.`
            : undefined,
          readings: groupSamples.map((s) => ({
            sampleId: s.sampleId,
            collectedAt: s.collectedAt,
            value: s[parameter] as number,
            depth,
            method,
            unit,
          })),
        });
      });
    }
  });

  return result;
};
