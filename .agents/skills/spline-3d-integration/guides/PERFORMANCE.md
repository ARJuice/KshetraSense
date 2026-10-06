# Performance & Mobile Optimization for Spline & Three.js

## Scene Optimization Guidelines
1. **Scene File Size**:
   - Keep `< 3MB` for fast mobile downloads.
   - Files `> 10MB` should be optimized in Spline (Export -> Play Settings -> Geometry Quality: Performance).
2. **Lighting**:
   - Limit real-time lights (prefer 1-2 directional/ambient lights or Matcap materials).
3. **Polygon Budget**:
   - Desktop target: < 500K triangles, 60fps.
   - Mobile target: < 100K triangles, 30-60fps.
4. **Device Capability Gating**:
   ```javascript
   export function isDeviceCapableFor3D() {
     const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
     const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
     return !lowCores;
   }
   ```
5. **Loading Strategy**:
   - Preload the `.splinecode` link:
     ```html
     <link rel="preload" href="https://prod.spline.design/.../scene.splinecode" as="fetch" crossorigin>
     ```
   - Lazy load when visible using `IntersectionObserver`.
