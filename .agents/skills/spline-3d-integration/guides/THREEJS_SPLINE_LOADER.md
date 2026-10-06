# Three.js + Spline Loader Integration

Bridging Spline's visual design with Three.js code control.

## Installation

```bash
npm install three @splinetool/loader
```

## Basic Three.js Scene with Spline

```javascript
import * as THREE from 'three';
import SplineLoader from '@splinetool/loader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// 1. Scene, Camera, Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 2. Load Spline Scene into Three.js
const loader = new SplineLoader();
const SPLINE_SCENE_URL = 'https://prod.spline.design/REPLACE_WITH_YOUR_ID/scene.splinecode';

loader.load(
  SPLINE_SCENE_URL,
  (splineScene) => {
    console.log('Spline scene loaded into Three.js:', splineScene);
    scene.add(splineScene);

    // You can query and manipulate objects inside splineScene:
    const myObject = splineScene.getObjectByName('Cube');
    if (myObject) {
      myObject.position.y += 2;
    }
  },
  (progress) => {
    console.log('Loading progress:', (progress.loaded / progress.total) * 100, '%');
  },
  (error) => {
    console.error('Error loading Spline scene:', error);
  }
);

// 3. Render Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// 4. Handle Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

## Key Differences between Spline Runtime and Three.js SplineLoader

1. **`@splinetool/loader`**:
   - Imports raw meshes, materials, and hierarchy into standard Three.js Object3D / Scene.
   - You control animations, physics, rendering loops, and shaders using Three.js APIs.
2. **`@splinetool/runtime`**:
   - Self-contained engine running Spline's native animation states, transitions, mouse interactions, and camera choreography.
