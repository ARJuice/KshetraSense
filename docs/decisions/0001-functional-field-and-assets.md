# Decision 0001: functional field and 3D assets

**Status:** accepted for the MVP planning baseline
**Date:** 2026-10-06

## Context

The field changes when users edit soil values and when clustering returns new assignments. The interface also needs keyboard access, mobile behavior, and a full experience when WebGL is unavailable. Imported field/grass/sensor models would add transfer, licensing, and rendering cost without encoding the current result data.

## Decision

Use Three.js through React Three Fiber for the desktop functional field, with a complete 2D mode and fallback. Generate cells, zones, overlays, sensor markers, crop cues, and root layers from instanced low-poly geometry or SVG. Bundle no external model for the current MVP.

Spline may be evaluated for a decorative scene only. It must be free-tier compatible, lazy-loaded, removable, and replaceable by a small Three.js or SVG illustration. No field interaction or required information may depend on Spline.

Any future GLB must meet [the budgets and asset policy in the TRD](../TRD.md#performance-budgets), have model-specific license/provenance and checksum records, pass glTF validation, and provide a fallback.

## Consequences

- The field remains data-responsive and the 2D mode remains useful for every core task.
- Repeated geometry must be instanced and share materials; profiling must verify the stated limits.
- The manifest records zero downloaded models. A future CC0 source does not approve an individual asset unless it also passes the need and performance checks.
- The implementation needs a consistent palette and geometry vocabulary shared by 2D and 3D.

## Alternatives considered

| Option | Reason not selected |
| --- | --- |
| Put the functional field in Spline | It would make state ownership, accessibility, and fallback behavior less direct. |
| Download a detailed field/grass/sensor scene | It would be heavier and static while the displayed data changes. |
| Build the functional field only in 3D | It would make mobile, keyboard, and no-WebGL support harder to guarantee. |
| Use one mesh/component per cell | It scales object and draw-call overhead with the grid; use instances for repeated geometry. |

## Revisit when

A tested functional need cannot be met cleanly with the procedural/SVG approach, or profiling shows that the current scene budget needs adjustment. Record a new decision if the direction changes.
