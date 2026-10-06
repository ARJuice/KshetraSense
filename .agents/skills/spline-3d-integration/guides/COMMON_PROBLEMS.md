# Common Problems & Debugging

### 1. Page Scroll Lock (`overflow: hidden`)
Spline default exports can disable page scrolling.
**Fix**: In CSS, force `body { overflow: auto !important; }` or uncheck "Page Scroll" in Spline export settings.

### 2. Opaque Background
Default scenes may render an opaque canvas.
**Fix**: Check "Hide Background" in Spline export settings and use `background="transparent"` or `alpha: true` in Three.js renderer.

### 3. Spline CDN Latency / Failure Fallback
Network hiccups can delay `.splinecode` download.
**Fix**: Add timeout fallback:
```javascript
const loadTimeout = setTimeout(() => {
  showFallback2D();
}, 8000);
```

### 4. Spline Three.js Integration Mismatches
When importing into Three.js with `@splinetool/loader`, certain Spline shaders or event triggers might need Three.js-native equivalents. Test meshes after load:
```javascript
loader.load(url, (splineScene) => {
  splineScene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
});
```
