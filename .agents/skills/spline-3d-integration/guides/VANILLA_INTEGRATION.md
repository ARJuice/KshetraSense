# Vanilla JS / HTML Integration

Two methods depending on your application structure:

## Method A — Web Component `<spline-viewer>`

Zero configuration, ideal for quick embedding:

```html
<!-- In HTML head -->
<script type="module" src="https://unpkg.com/@splinetool/viewer/build/spline-viewer.js"></script>

<!-- In body -->
<spline-viewer
  url="https://prod.spline.design/REPLACE_WITH_YOUR_ID/scene.splinecode"
  background="transparent"
  events-target="global">
</spline-viewer>
```

## Method B — Runtime API (`@splinetool/runtime`)

When programmatic control of camera, animations, or meshes is needed:

```html
<canvas id="canvas3d"></canvas>

<script type="module">
  import { Application } from '@splinetool/runtime';

  const canvas = document.getElementById('canvas3d');
  const spline = new Application(canvas);

  spline.load('https://prod.spline.design/REPLACE_WITH_YOUR_ID/scene.splinecode')
    .then(() => {
      console.log('Spline scene initialized');
      const obj = spline.findObjectByName('FieldMesh');
      if (obj) {
        obj.rotation.y = Math.PI / 4;
      }
    })
    .catch((err) => {
      console.error('Failed to load Spline scene:', err);
    });
</script>
```
