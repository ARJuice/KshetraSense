import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeafApiError, runLeafDiagnosis } from './leafApi';

const classIds = Array.from({ length: 17 }, (_, index) => `Class_${index}`);

function prediction() {
  const rankedClasses = classIds.map((className, index) => ({ className, score: (17 - index) / 153 }));
  return {
    topClass: rankedClasses[0].className,
    reviewRequired: true,
    crop: 'Tomato',
    condition: 'Early blight',
    isHealthy: false,
    rankedClasses,
    modelMetadata: {
      architecture: 'MobileNetV3-Small',
      weightsVersion: 'test-model-v1',
      classesCount: 17,
      inputResolution: [224, 224, 3],
      preprocessingVersion: 'preprocessing-v1',
      classMapVersion: 'class-map-v1',
      reviewPolicyVersion: 'all-predictions-reviewed-v1',
      inferenceLatencyMs: 42.5,
    },
    limitations: ['Manual review required.'],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('runLeafDiagnosis', () => {
  it('sends only the chosen image and accepts the complete ranked response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(prediction()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File([Uint8Array.of(1, 2, 3)], 'leaf.png', { type: 'image/png' });

    const result = await runLeafDiagnosis(file);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/v1/leaf/predict');
    expect(request.method).toBe('POST');
    expect(request.headers).toBeUndefined();
    expect([...(request.body as FormData).keys()]).toEqual(['file']);
    expect(result.rankedClasses).toHaveLength(17);
    expect(result.reviewRequired).toBe(true);
  });

  it('surfaces the model-unavailable contract without returning a stale prediction', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'weights missing' }), { status: 503 })));
    const file = new File([Uint8Array.of(1)], 'leaf.png', { type: 'image/png' });

    await expect(runLeafDiagnosis(file)).rejects.toMatchObject({
      name: 'LeafApiError',
      status: 503,
      message: 'Verified leaf model weights are unavailable.',
    });
  });

  it('rejects a result with a mismatched top class or unsorted scores', async () => {
    const invalid = prediction();
    invalid.rankedClasses[0].score = 0.01;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(invalid), { status: 200 })));
    const file = new File([Uint8Array.of(1)], 'leaf.png', { type: 'image/png' });

    await expect(runLeafDiagnosis(file)).rejects.toBeInstanceOf(LeafApiError);
  });

  it('rejects a response that bypasses the required manual review policy', async () => {
    const invalid = prediction();
    invalid.reviewRequired = false;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(invalid), { status: 200 })));
    const file = new File([Uint8Array.of(1)], 'leaf.png', { type: 'image/png' });

    await expect(runLeafDiagnosis(file)).rejects.toBeInstanceOf(LeafApiError);
  });
});
