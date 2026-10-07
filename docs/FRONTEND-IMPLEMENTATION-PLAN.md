# KshetraSense UI/UX and frontend implementation plan

**Status:** design and implementation brief for the next frontend phase. This document does not itself authorize starting implementation; wait for the user's explicit start prompt.

**Audience:** the implementing agent (Claude or another coding agent) and project maintainers.

**Purpose:** translate the existing product, technical, and UX requirements into a coherent first frontend experience, while giving the implementing agent substantial room to make and defend strong design decisions. This is a creative brief and implementation contract—not a pixel-by-pixel wireframe.

## 1. Read these documents first

- [PRD](PRD.md) — product scope, user outcomes, and claims the product must not make.
- [TRD](TRD.md) — architecture, rendering, accessibility, privacy, and performance boundaries.
- [UX specification](UX-SPEC.md) — detailed interaction behavior and mock-data truthfulness.
- [Delivery plan](DELIVERY.md) — phase boundaries and acceptance expectations.
- [Decision 0001](decisions/0001-functional-field-and-assets.md) — data-responsive procedural field versus decorative assets.
- [Decision 0002](decisions/0002-mock-data-demo-first.md) — desktop-first, mock-data demo before the later real algorithm and model phases.
- [Decision 0003](decisions/0003-decorative-kenney-assets.md) — twelve prepared, decorative-only Kenney GLBs; functional field geometry remains procedural.
- When selecting a decorative model, consult the [3D asset manifest](../assets/3d/asset-manifest.json) and [external asset research](research/external-3d-asset-sources.md) for current files and candidate sources.

### Document precedence and deliberate resolutions

| Topic | Authority for this build |
| --- | --- |
| Product claims, scope, and non-goals | PRD. Never add unsupported cultivation probabilities, crop recommendations, live telemetry, or model results. |
| Technical architecture and budgets | TRD. This plan may elaborate presentation, but does not change the approved stack or later Python/Keras/TensorFlow architecture. |
| Interaction details | UX specification, except for the explicitly approved Crop Fit navigation change below. |
| Mock data and result honesty | Decision 0002 and the UX specification. Prepared samples are fixtures, not calculations. |
| Functional 3D field | Decision 0001: data-driven field cells, zones, and overlays remain procedural and responsive to application state. |
| Crop Fit navigation | The user's latest direction, recorded here, supersedes older wording in UX-SPEC/Decision 0002 that describes Crop Fit as a main navigation destination. Keep it inside Field Lab as contextual UI. The older wording should be reconciled in those documents in a later documentation pass. |
| Decorative assets | Decision 0003 records the user's latest direction and the twelve prepared Kenney GLBs. Poly Haven remains a candidate source, but no Poly Haven model was selected. These local props are for visual character only; they do not replace the functional field or block its data-driven layers. Keep provenance for maintainability, but do not make a licensing review a blocker for this internal prototype. |

If a mismatch is not resolved above, preserve truthfulness, user control, accessibility, and the architecture in the PRD/TRD; identify the mismatch instead of quietly inventing a new product rule.

## 2. The experience to create

Build a polished, desktop-first, interactive 2.5D Field Lab, powered by deterministic demo fixtures. It should feel like a designed product in its own right—not a wireframe, generic admin dashboard, or static mock dressed up with gradients. Treat visual craft, information hierarchy, interaction quality, legibility, and performance as first-class requirements from the first usable screen.

The first-time user's job is:

> Help me explore a clearly synthetic field, make one deliberate soil change, understand its spatial effect, reveal a prepared zoning example, and compare the selected zone's three independent crop-factor examples—without mistaking sample data for a real calculation.

The emotional progression should be: **oriented → curious → in control → surprised by a clear spatial change → confident about what the result does and does not mean.**

The frontend phase is presentation and interaction over mock data. It does **not** implement real K-means, Fuzzy C-means, crop-rule evaluation, image inference, live sensors, or backend APIs. Do not change the fixed MobileNetV3-Small decision or the planned Python/Keras/TensorFlow boundaries. Leaf Diagnosis may preview a local image and separately show its clearly disclosed canned example; it must not imply that the uploaded image was classified.

Do not reuse the old `mock-demo/index.html` implementation. It can inform the journey and visual review only. In particular, do not carry forward its CDN runtime, canvas-only controls, misleading leaf scores, unreliable Undo/cancel behavior, disconnected zoning context, or controls that advertise behavior they do not implement.

## 3. Use design thinking as a working method

Assuming “Ulrich” refers to Karl T. Ulrich: use the spirit of his design process—clarify the job, understand user needs, explore solution concepts, select and test concepts, then prototype and refine. Ulrich describes the concept process as divergent and convergent cycles, not a one-shot styling exercise. See his [Triple-Diamond explanation](https://ktulrich.com/the-triple-diamond-model-of-design/) and the [Product Design and Development chapter structure](https://www.mheducation.com/highered/product/product-design-and-development-7-ulrich.html). Apply that thinking pragmatically to a frontend, not as a ceremonial process or a claim that this project follows a formal certification.

### Before committing to one visual solution

1. **Understand the user and job.** Use the first-time demonstrator/reviewer and curious non-specialist as the primary lenses. Write down their likely questions: “What am I looking at?”, “Is this real data?”, “What can I do first?”, and “Did my edit actually affect the displayed result?”
2. **Frame the design problem.** Make the first two-minute journey obvious and make demo-vs-real boundaries legible without burying the experience in warnings.
3. **Generate genuinely different concepts.** Sketch or prototype at least three directions that vary in composition and interaction—not merely palette. For example, explore an immersive field instrument, an editorial/cartographic atlas, and a more tactile lab bench, or propose better concepts. Each should have a distinct field treatment, information hierarchy, navigation model, motion language, and use of depth.
4. **Choose with reasons.** Compare concepts against first-use comprehension, visual memorability, task speed, information density, 2.5D legibility, accessibility, and render cost. Choose one direction and carry its best ideas forward. Do not spend time implementing three complete products.
5. **Prototype the riskiest moment early.** Validate the real interaction slice—scenario selection, cell inspection, one preset/brush edit, prepared-sample reveal, and contextual Crop Fit—not only a static landing screen. Use a first-time walkthrough and screenshots at the target viewport; observe where a person hesitates or misreads state.
6. **Refine, then build consistently.** Iterate on issues discovered in the walkthrough. Establish a small visual system only after the chosen direction has a clear rationale; use it to make the entire experience coherent.

Use the agent's creative judgment to its full potential within the product constraints. Make strong autonomous choices about art direction, layout, typography, palette, depth, responsive composition, scene dressing, transitions, and micro-interactions. Do not wait for the user to choose every color, icon, spacing value, or animation. If an idea improves comprehension and delight without changing product meaning, explore it. Ask the user only when a decision changes scope, domain meaning, data claims, or a significant product trade-off.

## 4. Creative latitude and non-negotiable guardrails

### The agent should actively explore

- A memorable visual metaphor and signature moment for KshetraSense. A field-cartography instrument or tactile soil atlas is one possible seed, not a mandated theme.
- Contrast, hierarchy, negative space, editorial typography, labels, legends, boundaries, and material response that make a dense scientific tool inviting rather than sterile.
- A carefully composed isometric camera, layered field context, subtle topographic or sampling motifs, and an integrated relationship between 3D canvas and DOM interface.
- Interaction feedback with anticipation, continuity, and satisfying completion: pointer states, focus, selection, brush preview, Undo feedback, zone reveal, drawer transitions, and empty/loading/error states.
- A visual identity that feels intentional and specific to soil analysis—avoid generic SaaS cards, arbitrary neon, gratuitous glassmorphism, decorative clutter, and game-like farm promises.
- Local visual assets and original procedural details where they strengthen the concept. An asset is not automatically good simply because it is 3D.

### The product must still

- Make synthetic data and prepared fixtures unmistakable; distinguish user edits, sample outputs, and any later real results.
- Keep the map readable and editable. Decorative content must not obscure cells, imply live sensors, imply crop growth, or compete with the task.
- Keep the experience desktop-first for this prototype. The review baseline is **1280 × 800 CSS pixels at 100% browser zoom**. Do not spend this phase on phone parity, but do not make later responsive/2D work architecturally impossible.
- Avoid required paid assets, APIs, icon packs, fonts, models, or remote runtime dependencies. Use local system fonts or already available local resources; do not fetch visual dependencies at runtime.
- Respect keyboard operation, visible focus, reduced motion, and the truthfulness constraints in the PRD/UX specification.
- Stay within the TRD's draw-call, geometry, material, texture, transfer, and instance budgets. Profile before adding visual complexity.

## 5. First-time user journey

### Entry and scenario choice

Open directly into **Field Lab**. Put a scenario choice in the user's path immediately, as requested: make the deterministic options easy to discover and choose. **Garden East, Seed #42** may be preloaded as the useful default so the field is never an empty screen; the user should still see and be invited to choose a named scenario, without a blocking welcome wizard.

Show a calm, persistent `SYNTHETIC SCENARIO` disclosure with the chosen name and seed, plus one concise prompt such as: “Inspect a cell, change one soil condition, then explore a prepared zoning sample.” The user should understand that the field is simulated before interacting with it.

### Explore and inspect

- The low-relief field is the visual anchor and occupies most of the workspace.
- Hover provides a restrained reticle/coordinate and a small, legible cell response. Click locks selection and opens or updates the inspector.
- The inspector shows the selected cell's fixture values and units: pH, N/P/K, EC, and soil temperature; moisture only when its fixture context is defined. Values are synthetic, not thresholds or advice.
- Camera behavior is real and discoverable: orbit, pan, zoom, and `F` to fit the field. Camera actions never edit soil values.

### Change the field—without sliders

The user can choose either:

- **Quick Preset:** a named one-click scenario such as Low Nitrogen Patch, High Salinity / EC Pocket, or Acidic Wash. Each preset deterministically changes only its declared feature and cells, with an exact Undo action.
- **Manual Brush:** select a parameter, Raise/Lower, discrete Light/Medium/Strong strength, and 1/3/5-cell footprint, then paint the map.

There are **no soil-value sliders**. The chosen feature becomes the active map encoding, so the user sees the edit immediately. The affected cells visibly respond with a smooth, localized contour/isobar-style ripple. The effect is a visual transition for the edit—not a claim that water, nutrients, or chemicals physically propagated through soil. Make Undo/Redo discoverable and trustworthy; canceling an unfinished brush stroke restores its pre-stroke state.

### Reveal a zoning example

Let the user select K-means or Fuzzy C-means and `k=3` or `k=4`, then choose an action named to convey a prepared result, e.g. **Show prepared sample**. Do not label this action “Run zoning” in the mock-data phase. Show a brief, calm `Revealing prepared fixture` state and a persistent disclosure that the display is mock output, not a calculation.

The zone reveal can be visually rich: the soil-value palette can resolve into zone colors; cells in the same fixture group can settle into a coherent visual family; contour boundaries can draw/assemble around the groups; selected-zone emphasis can then emerge. Keep all animation tied to the loaded fixture assignments. Do not stage fake centroid selection, Euclidean attraction, normalization, iteration counts, algorithm convergence, or elapsed computation progress.

If soil inputs are later edited while a prepared sample is visible, preserve the sample and explain that it remains unchanged and does not reflect those edits. Reserve `Zoning Out of Date — Re-run to compute new zones` for a prior real result only.

### Inspect a zone and compare crops

Selecting a zone opens its summary in the same contextual workspace. Crop Fit belongs inside the Field Lab inspector/drawer or a similarly integrated contextual panel—not the global main-navigation group and not a separate destination. Keep the active zone and field context visible. The panel can use a clear `Inspect / Zoning / Crop Fit` structure if that best fits the chosen concept.

Before a zone is selected, Crop Fit should explain how to load/select a prepared sample zone rather than appearing as an empty page. After a zone is selected, show **three independent crop assessments** for apple, tomato, and potato as equal-weight cards. Keep every example tied to the selected fixture zone and label it mock/illustrative; do not rank crops, recommend one, or present a normalized three-crop cultivation probability.

Leaf Diagnosis and Evidence & Method can be secondary destinations in the application shell. Crop Fit cannot.

## 6. Information architecture and visual composition

Do not copy a fixed wireframe if a stronger composition serves the same journey. The design must make the following hierarchy immediately apparent:

1. **Where am I / what data is this?** Product identity, scenario name, seed, and synthetic-data status.
2. **What can I do now?** Scenario/preset/edit controls and a clear primary action appropriate to the current state.
3. **What is the field showing?** Active feature or zone mode, legend/scale, selection, and current sample state.
4. **What did I select or change?** Contextual inspector with exact values and units, history feedback, and zone detail.
5. **What can I do with this zone?** Crop Fit in the same Field Lab context.

Use a compact shell with Field Lab as the primary experience; secondary routes must not compete with it. Group controls by user intent, not by component type. Keep the field visible when drawers open and avoid losing orientation when the inspector changes between cell, zone, and crop context. Make responsive behavior sensible at narrower desktop widths without adding mobile-specific scope.

The visual direction is intentionally open. Do not treat the previous mock's dark theme, teal accents, or glass panels as approved brand rules. Establish palette, type scale, spacing, surface treatment, elevation, and motion after concept selection. Color cannot be the only channel for feature identity or zone distinction; combine it with patterns, labels, boundary shape, or other accessible cues.

## 7. Motion and interaction quality

Motion is part of the interface design, not a finishing decoration. It should clarify cause-and-effect, make spatial change legible, and reward exploration without slowing repeated work.

| Moment | Good direction | Must not imply |
| --- | --- | --- |
| Hover and selection | Quick cell lift/outline, precise reticle, corner brackets or a design-equivalent, clear inspector transition. | Geographic elevation or live surveying. |
| Preset / brush | Affected cells preview and settle to their actual new value; a short ripple/contour spreads through the touched area; status and history update. | Actual nutrient transport, irrigation, or soil chemistry simulation. |
| Prepared zoning sample | Smooth transformation from active soil feature to the fixture's zone encoding; groups visually cohere; contours assemble; zone labels and summary appear in a sensible order. | A calculation, algorithm iteration, or real-time clustering. |
| Zone selection | Strong selected boundary and pattern; gentle dimming of unrelated cells; relevant drawer context follows. | Crop suitability or field ownership. |
| Undo/Redo | The visual field reverses to the exact prior state and a concise confirmation identifies what was undone/redone. | A partial or approximate rollback. |
| Drawer/panel change | Preserve spatial continuity and keep the selected zone/cell in view. | A route change that loses context. |

Choose timings and easing through the prototype rather than copying numbers blindly. Keep the total sequence responsive; the user should never wait through a showreel to inspect data. Respect `prefers-reduced-motion`: use immediate state changes or brief fades instead of waves, travel, camera drift, shimmer, or loops.

## 8. Technical architecture to honor

| Concern | Required direction |
| --- | --- |
| App | React + TypeScript + Vite; strict typing and a real component/application architecture. |
| Functional 2.5D field | Three.js through React Three Fiber. Keep Three.js/R3F as the renderer for the field; never use Spline for functional cells, editing, selection, zoning, or state. |
| R3F utilities | Use `@react-three/drei` selectively where it simplifies camera, line, or performance work. |
| App state | A small explicit reducer/store or Zustand. Immutable domain snapshots and commands support exact undo/redo; do not store Three.js objects in domain state. |
| Styling | Local CSS Modules or locally built Tailwind with CSS custom properties. Never use a CDN/remote Tailwind runtime. |
| Motion | CSS transitions for DOM; a restrained R3F-compatible interpolation layer for scene changes. Avoid introducing a large animation dependency without need. |
| Icons | Local inline SVG or a locally bundled open-source set such as lucide-react. No paid or remote icon dependency. |
| Verification | Vitest/React Testing Library and a browser journey check as appropriate once implementation starts. Test domain transitions before visual polish hides state errors. |

Keep domain data, fixture adapters, commands, and derived selectors independent from R3F. The renderer consumes derived display state and is never the source of truth. Use an adapter boundary so later real services/results can replace demo fixtures without rebuilding the presentation layer. The final project still needs the TRD's complete 2D/no-WebGL path; the earlier desktop demo may start with R3F, but do not entangle all controls or domain logic inside the WebGL canvas.

Spline remains optional for a small, lazy, decorative scene only. Verify its current free-tier/export/embed behavior before choosing it; a local SVG or lightweight Three.js illustration must remain a complete fallback. Do not let a Spline scene delay the Field Lab.

## 9. Data and state contract for the demo

When frontend coding is explicitly started, create deterministic, versioned fixtures—not runtime-random values. Decision 0002 and the UX specification are the single source of truth for exact fixture shape, values, edit bounds, units, scenario behavior, and mock disclosures; consult them before implementing data or result UI. The frontend needs, at minimum:

- Exact 216-cell data per named scenario, stable fixture IDs/versions, units, bounds, feature display precision, preset deltas, and brush increments.
- Stable prepared sample IDs for every supported `scenario × method × k` combination, with assignments, labels, geometry/contours, zone summaries, and FCM membership strengths only where those are validated and shown.
- Crop Fit values tied to the selected sample-zone fixture. If numeric, label as mock/illustrative and use values validated against that fixture. No hard-coded universal zone summary.
- A separate fixed leaf demo sample unrelated to the local image preview. Do not show fabricated probabilities, confidence, ranked scores, latency, or a model version for inference that did not happen.
- Persistent labels for prepared outputs. If a visible sample and current input state differ, compare their input snapshots and say that the sample is unchanged and does not reflect the edits. Undo back to the exact snapshot clears that mismatch notice.

Conceptual state areas:

```text
scenario: selectedScenarioId, baselineCells, currentCells, activeFeature
selection: hoveredCellId, selectedCellId, selectedZoneId
editing: interactionMode, brush settings, inProgressStroke, undoStack, redoStack
zoning: selectedMethod, selectedK, demoSampleView | realRun | null
cropFit: contextual panel/tab, selectedZone context
leaf: localPreview, demoSample
ui: camera pose, panel state, reduced-motion preference, onboarding state
```

Treat scenario switching and Reset as atomic. Cancel an unfinished brush, clear selection/zone/Crop Fit/sample state and history as specified, load the named fixture, set its declared focus feature, and fit the camera. Undo never crosses scenario boundaries. A prepared-sample view stores the exact input snapshot it was prepared for; it is not recomputed by changing the user's controls.

## 10. Functional 2.5D scene

- Build cells/zones/boundaries from the application data. Use shared low-poly geometry and instancing for the 216 cells; do not mount one heavyweight React mesh/material tree per cell.
- Map renderer `instanceId` to stable fixture cell IDs for selection/brush input. Safely handle pointer capture/cancel so interactions do not create partial edits.
- Use a bounded isometric/orthographic default camera with real orbit/pan/zoom/fit; do not auto-rotate or drift.
- Derive feature color/relief and zone presentation from actual fixture or later result data. Treat height as a bounded analytical visual encoding, not geospatial elevation.
- Render readable labels, controls, legends, history, inspector values, and keyboard guidance in the DOM/SVG layer. The canvas is not the only interface.
- Centralize interpolation and keep draw calls/materials/geometry within the TRD budgets. Avoid per-cell animation components or unbounded particle systems.

Optional sensor-marker primitives may be used sparingly and must say `Illustrative; no live sensor stream`. Keep crop/grass cues sparse and peripheral. The field remains selectable and visually dominant.

## 11. Real asset plan

Use the functional Three.js field itself for cells, zone topology, grid edge, selection, outlines, and data overlays. These elements are generated from code because they must update with app state; downloading a static field, grass plane, or zoning model would break that relationship.

For visual character, evaluate the prepared [Kenney Nature Kit palette](../assets/3d/asset-manifest.json): distant oak/pine silhouettes, sparse grass/bush/flower accents, rock variants, and an optional short rail. These are ready-to-use candidates, not a requirement to render every model. Choose the few that actually improve composition; start with no more than two or three distinct GLB types in the default view. Keep them behind/beyond the field, never over selectable cells, and avoid placing the rail on grid/zone boundaries. Use runtime tinting if the default teal/orange palette competes with the interface. [Poly Haven models](https://polyhaven.com/models) remain a possible source for a later intentional photoreal contrast; do not default to detailed assets in the analytical view.

Prefer GLB for the web runtime. The selected assets have already been optimized/normalized and validated as recorded in the manifest. Avoid unnecessary rigging/animation, excessive materials, and repeated high-poly props. Instance or merge repeated geometry where appropriate, and keep the full scene within the [TRD draw-call and render budgets](TRD.md#performance-budgets). Lazy-load if an asset does not belong in the first useful paint. Provide a procedural/CSS/SVG fallback. Do not scatter decorative models over selectable cells, use them to simulate sensor coverage, or require them for any task. If the actual R3F composition shows a candidate is too playful, distracting, or performance-costly, leave it unused rather than adding it just to tick a box.

The user has explicitly said licensing is not a blocker for this non-public prototype and that Poly Haven/Kenney may be used. Do not stop the design/build waiting for a separate asset-license approval. For maintainability and possible future release, still record the exact asset/page, creator or pack, license/source, local filename, download date, and any optimization performed in the asset manifest. Do not make unverified claims about authorship, source, or license. Keep all bundled assets local; no asset API or runtime fetch.

The twelve assets have now been selected and prepared under `assets/3d/external/kenney-nature-kit/` by the user's explicit asset-preparation request. Integrate only the subset that strengthens visual character as optional, visually restrained accents when frontend coding is later authorized. Spline is not a substitute asset source or a requirement.

## 12. Suggested source boundaries (not a demand for premature abstraction)

When coding is authorized, organize around responsibilities and keep modules deep enough to be useful. A reasonable starting shape is:

```text
src/
  app/                    # shell, routes, providers
  features/
    field/                # field domain, fixtures, Field Lab composition
    zoning/               # prepared sample and later result presentation
    crop-fit/             # contextual zone comparison, no global route
    leaf-diagnosis/       # local preview and mock-result disclosure
    evidence/             # provenance and limitations
  scene/                  # R3F field, instancing, camera, data overlays
  components/             # accessible DOM controls and shared primitives
  state/                  # commands, selectors, undo/redo
  data/demo/              # versioned fixtures and manifests
  styles/                 # design tokens, global styles, motion/accessibility
```

Adapt the shape to the repository and keep abstractions justified. Do not build a generalized design system or a speculative backend while solving the first end-to-end demo journey.

## 13. Implementation sequence after the user says to start

1. **Creative discovery:** clarify the first-user job from these docs, generate three distinct visual/composition concepts, compare them against the criteria in Section 3, and select a clear direction. **Done when:** the selected concept has a short rationale against the user/task criteria and a small visual reference; no redundant planning document is created.
2. **Interaction prototype:** establish the visual shell and one end-to-end Field Lab slice at the desktop review viewport. Test scenario choice, inspection, an edit, prepared-sample reveal, zone selection, and contextual Crop Fit. Review screenshots and the first-time walkthrough; refine before expanding routes. **Done when:** a first-time reviewer can complete the journey and explain which data is synthetic and whether zoning was computed.
3. **Foundation and design language:** create the React/TypeScript/Vite app, local styling setup, route shell, accessible controls, and the chosen token/motion vocabulary. **Done when:** the app runs locally without remote runtime dependencies and its primary route renders the selected concept at the review viewport.
4. **Fixtures and domain commands:** implement exact versioned demo data, schema validation, scenario/reset, preset/brush begin-commit-cancel, undo/redo, selection, and sample snapshot comparison. Verify transitions with focused tests. **Done when:** fixture integrity and every edit/history/sample state transition are verified against Decision 0002 and UX-SPEC.
5. **Field rendering:** implement instanced R3F cells, real camera controls, picking, responsive feature display, zone contours, DOM legend/cell navigator, and selected-cell inspector. **Done when:** every visible field response maps to the selected fixture cell/feature/sample and the renderer meets its allocated TRD budget.
6. **Zoning and Crop Fit:** add the truthful prepared-sample reveal, zone selection/summary, and three independent Crop Fit cards linked to the selected zone within Field Lab. **Done when:** the selected fixture zone remains the context throughout and none of the UI implies a live calculation or crop recommendation.
7. **Character and finish:** integrate the selected decorative GLB if it passes the visual and performance case; add motion, keyboard states, reduced-motion treatment, empty/error states, Leaf Diagnosis, and Evidence & Method. **Done when:** the product has coherent states beyond the happy path and any external asset is local, documented, optional, and within budget.
8. **Validation and review:** check the full demo journey, state/history, labels/claims, accessibility behaviors, target viewport, fixture consistency, fallback seams, and scene/asset performance budgets. Present screenshots of the polished UI and key interaction states for user review. **Done when:** every acceptance item in Section 14 has evidence or is explicitly identified as a deferred final-product gate.

Do not begin the sequence until the user explicitly starts frontend implementation. Do not implement clustering, crop-rule calculations, MobileNet training/inference, backend APIs, or a Spline scene as part of this frontend phase unless the user separately expands scope.

## 14. Acceptance criteria for the first frontend

- [ ] The first screen feels intentionally art-directed and communicates what the user can do; it does not look like a generic dashboard or an unfinished mock.
- [ ] A first-time user can choose a named scenario (with Garden East, Seed #42 as a useful default), understand that it is synthetic, and begin exploring without a blocking onboarding flow.
- [ ] At 1280 × 800 and 100% zoom, a user can inspect a cell, see exact synthetic values and units, make one preset or brush edit, undo/redo it exactly, reveal a prepared zoning sample, select a zone, and see Crop Fit in the same Field Lab context.
- [ ] There are no continuous soil sliders. Presets/brush are deterministic and only change declared cells/features; cancellation leaves no mutation/history entry.
- [ ] The spatial transition and zone assembly feel clear and satisfying while accurately reflecting fixture data. No animation claims a calculation or physical field process that did not happen.
- [ ] Crop Fit is not in global navigation; its three independent mock assessments are tied to the selected sample zone and do not rank crops or show a normalized cultivation probability.
- [ ] All fixture-derived outputs are traceable, persistent mock/sample disclosures are visible, and demo leaf behavior invents no confidence or performance numbers.
- [ ] Functional cells, zones, and data overlays are state-driven procedural geometry. At least one intentionally chosen real GLB is evaluated for decorative character; any bundled asset is optimized, locally served, non-blocking, and documented.
- [ ] The field uses instancing and stays inside the TRD's measured budgets; no paid or remotely fetched asset/API/font/icon/model is required at runtime.
- [ ] Keyboard selection/editing path, visible focus, DOM-based values/controls, reduced-motion behavior, and the architecture seam for the final 2D/no-WebGL experience are preserved.
- [ ] Screenshots and a concise first-time walkthrough are ready for the user to judge aesthetic direction and UX before later product phases.

## 15. Ready boundary

This document deliberately gives the implementing agent room to create a much stronger experience than the earlier mock while anchoring that creativity in real user needs, tested concepts, and product truth. It is not permission to proceed immediately: **wait for the user's manual prompt to start frontend coding.** When implementation begins, use this plan with PRD/TRD/UX-SPEC and the decisions above; do not quietly change the model/backend architecture or invent data to make the UI look more convincing.
