# React & Vite Integration for Spline

## Installation

```bash
npm install @splinetool/react-spline @splinetool/runtime
```

## Basic Component

```tsx
import Spline from '@splinetool/react-spline';

export default function SplineHero() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Spline scene="https://prod.spline.design/REPLACE_WITH_YOUR_ID/scene.splinecode" />
    </div>
  );
}
```

## Interactive Event & Runtime Control

```tsx
import { useRef } from 'react';
import Spline from '@splinetool/react-spline';
import type { Application } from '@splinetool/runtime';

export default function InteractiveSpline() {
  const splineRef = useRef<Application | null>(null);

  function onLoad(splineApp: Application) {
    splineRef.current = splineApp;
  }

  function triggerHover() {
    if (splineRef.current) {
      splineRef.current.emitEvent('mouseHover', 'Plant');
    }
  }

  return (
    <div className="relative w-full h-[600px]">
      <Spline
        scene="https://prod.spline.design/REPLACE_WITH_YOUR_ID/scene.splinecode"
        onLoad={onLoad}
        onMouseDown={(e) => console.log('Clicked object:', e.target.name)}
      />
      <button
        onClick={triggerHover}
        className="absolute bottom-4 left-4 px-4 py-2 bg-emerald-600 text-white rounded"
      >
        Interact with 3D Object
      </button>
    </div>
  );
}
```

## Lazy Loaded with Fallback (Recommended)

```tsx
import { lazy, Suspense } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

export default function SplineLazy({ sceneUrl }: { sceneUrl: string }) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center bg-stone-900 text-stone-400">
          Loading 3D Experience...
        </div>
      }
    >
      <Spline scene={sceneUrl} />
    </Suspense>
  );
}
```
