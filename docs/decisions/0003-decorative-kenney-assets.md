# Decision 0003: small decorative Kenney GLBs

**Status:** Superseded for the current zoning scene by [Decision 0006](0006-phase-2-soil-field-ui.md); the prepared models remain optional and are not currently loaded.
**Date:** 2026-10-07

**Supersession note:** The Phase 2 field renderer uses procedural, response-driven geometry only. This record remains as asset provenance/preparation history; its mock-scene composition and “wait for the frontend prompt” instructions are not current implementation guidance.

## Context

The earlier visual mock had no real 3D assets. The user asked to prepare suitable models before frontend coding and explicitly authorized Poly Haven and Kenney assets for this non-public prototype. This updates Decision 0001's asset-bundling position, but not its rule that the interactive field and information-bearing geometry must be generated from application data.

## Decision

Bundle twelve small, untextured GLBs from [Kenney's Nature Kit](https://kenney.nl/assets/nature-kit) as an optional art-direction palette: `grass_large`, `grass_leafs`, `plant_bushSmall`, `plant_bushDetailed`, `rock_smallA/B/C`, `tree_oak`, `tree_pineSmallC`, `flower_yellowA`, `flower_purpleA`, and `fence_simpleLow`. These add distant tree silhouettes, sparse ground-level foliage/flower accents, rock-shape variation, and one short background rail. Use only a small subset at once, outside selectable cells; the fence is never a field, zone, or parcel boundary. The complete asset list, exact source archive path, license, file hashes, geometry counts, and runtime sizes live in the [3D asset manifest](../../assets/3d/asset-manifest.json). The pack's included `License.txt` is retained beside the models.

The twelve runtime models total **79,544 bytes, 882 triangles, 19 materials, and zero textures**. The nine additions account for 55,952 bytes and 626 triangles. Each remains far below the TRD per-model limits (the largest is 14,148 bytes and 196 triangles); the full set uses about 8% of the 1 MiB decorative-model transfer budget and 9% of its 10,000-triangle budget. These are available choices, not a direction to display every prop: start with only two or three distinct model types in a view and profile full-scene draw calls. They remain optional: field cells, zones, contours, sensor markers, and all analytical overlays stay procedural and data-responsive. Sensor markers are simple illustrative primitives, not imported equipment or live telemetry. No model, Spline scene, remote asset service, or external model API is needed to complete a user task.

Kenney's source GLBs had a scene-root/parent mismatch. All twelve were normalized with glTF Transform CLI 4.5.1 by flattening the scene graph, then validated with **zero errors and zero warnings**. The operation retained the mesh geometry; the validator still reports only informational unused-UV records on these untextured models. The 10.5 MB source archive was staged outside the repository; only the twelve selected ready-to-use GLBs and the included license text are in the project.

## Rationale

Kenney's deliberately low-poly style is a better fit for restrained 2.5D accents than photoreal botanical assets. The nine additions were chosen to introduce silhouette and scale variation—not to make the selectable field busier—and all twelve assets together remain a small fraction of the transfer/geometry budgets. The source preview was checked for consistent style; the GLBs themselves were independently normalized and validated, but their final composition, scale, and color treatment must still be reviewed in the actual application scene. The implementation can retint the teal/orange palette to suit the chosen art direction. Poly Haven was also reviewed. Its [Weed Plant 02](https://polyhaven.com/a/weed_plant_02) is a detailed 17,000-triangle model; its listed 1K glTF package references about 2 MB of files before optimization. That is a poor starting point for a tiny optional accent and would add unnecessary texture/detail work.

## Consequences

- The implementation agent has real GLBs available before coding, but must keep them visually subordinate to the editable grid and load them lazily or only where useful. Treat the twelve files as a selection library: use only two or three distinct GLB types in the default view, place tall silhouettes behind/beyond the field, keep flowers and ground accents rare, and omit the optional rail if it reads as an analysis boundary.
- The agent may recolor or restyle the props at runtime to fit the chosen art direction; no need to preserve Kenney's preview palette.
- Do not use the grass/bush/rock to represent a crop, sensor location, zone, or soil value. Do not scatter them over selectable cells.
- Any further asset must be recorded in the manifest, optimized and validated against the [TRD performance budgets](../TRD.md#performance-budgets), and remain removable with a procedural/SVG fallback. Keep the entire scene within the eight-draw-call ceiling; remove decoration first if necessary.
- This decision does not authorize building the frontend yet. Wait for the user's separate start prompt.

## Alternatives considered

| Option | Decision |
| --- | --- |
| Generate every decorative object procedurally | Keep as fallback and use for analytical visuals; use the small real models to give the scene more authored character. |
| Use a Poly Haven photoreal plant | Not selected: the reviewed asset is high-detail/heavier than needed and stylistically less aligned with a low-relief analytical field. |
| Download a sensor-node model | Not selected: sensor markers are illustrative and should be lightweight, tintable primitives with explicit no-live-stream labeling. |
| Use a static farm/terrain scene | Rejected: it would not respond to edited cell values or prepared zone assignments. |
