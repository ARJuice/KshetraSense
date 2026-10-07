# External decorative 3D asset sources

**Status:** source research complete; twelve Kenney models downloaded and validated for decorative use
**Reviewed:** 2026-10-07
**Scope:** optional, non-functional visual dressing only. Import is approved for the twelve models recorded in the asset manifest and Decision 0003.

## Product boundary

The current architecture decision remains in force: the interactive field, its cells, zone boundaries, sensor markers, crop cues, and all information-bearing layers are generated from application data. They must not be replaced by downloaded models. See [Decision 0001](../decisions/0001-functional-field-and-assets.md).

An external asset is permissible only as a removable, lazy-loaded decorative accent (for example, a small low-poly plant/rock beside the field illustration or a non-interactive background detail). The product must remain complete without it, including in 2D/no-WebGL mode. Do not use an external field scene, vegetation ground plane, or sensor model as a proxy for data.

## Candidate sources

| Source | Suitable use here | Exact official license/terms | Constraints to observe |
| --- | --- | --- | --- |
| [Poly Haven asset license](https://polyhaven.com/license) | At most one optimized decorative GLB or small PBR texture/HDRI for a non-functional landing/empty-state illustration. | Poly Haven states that its HDRIs, textures, and 3D models are **CC0**: commercial use, modification, redistribution, and inclusion in sold products are allowed; attribution is not required. | This applies to **assets**, not site content: its logos, example renders, user renders, and copy are not CC0. Do not use the live API in the product unless its separate [API terms](https://polyhaven.com/our-api) are met (visible source credit and a unique `User-Agent`). Prefer a versioned local copy over a runtime API dependency. Do not claim authorship or relicense assets, per the [official FAQ](https://docs.polyhaven.com/en/faq). |
| [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) (representative 3D pack) | Low-poly tree, foliage, or rock *reference/accent* if the visual direction deliberately needs a game-like, illustrative hero. The pack page identifies it as 3D and CC0. | Kenney says all game assets on its asset pages are public-domain **CC0**, usable in commercial projects; attribution is not required. | Confirm the selected pack's page and included license file at download time. If credit is voluntarily given, use the name “Kenney”; its [official support page](https://kenney.nl/support) says not to use the Kenney logo. Keep the asset isolated from functional map/zone rendering. |

CC0 permits copying, modifying, distributing, and performing a work, including commercially, without permission. It does **not** waive third-party trademark/patent, privacy/publicity, or endorsement concerns; Creative Commons also supplies the work without warranty. See the [CC0 1.0 deed](https://creativecommons.org/publicdomain/zero/1.0/) and [legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode).

## Selected assets

| Model | Local runtime file | Original → prepared | Role |
| --- | --- | --- | --- |
| Grass Large | `assets/3d/external/kenney-nature-kit/kenney_grass_large.glb` | 18,504 → 18,160 bytes; 224 triangles; 1 material; no textures | Very sparse field-edge/empty-state accent. |
| Grass Leafs | `assets/3d/external/kenney-nature-kit/kenney_grass_leafs.glb` | 4,608 → 4,276 bytes; 36 triangles; 1 material; no textures | Tiny edge tuft, not field-wide vegetation. |
| Plant Bush Small | `assets/3d/external/kenney-nature-kit/kenney_plant_bushSmall.glb` | 3,212 → 2,864 bytes; 16 triangles; 1 material; no textures | Small peripheral accent, not a crop identity. |
| Plant Bush Detailed | `assets/3d/external/kenney-nature-kit/kenney_plant_bushDetailed.glb` | 10,172 → 9,824 bytes; 104 triangles; 1 material; no textures | Fuller foliage clump for the perimeter/empty state. |
| Rock Small A | `assets/3d/external/kenney-nature-kit/kenney_rock_smallA.glb` | 3,044 → 2,568 bytes; 16 triangles; 2 materials; no textures | Small field-edge accent, not terrain. |
| Rock Small B | `assets/3d/external/kenney-nature-kit/kenney_rock_smallB.glb` | 3,528 → 3,052 bytes; 24 triangles; 2 materials; no textures | Small silhouette variation. |
| Rock Small C | `assets/3d/external/kenney-nature-kit/kenney_rock_smallC.glb` | 3,044 → 2,568 bytes; 16 triangles; 2 materials; no textures | Small silhouette variation. |
| Tree Oak | `assets/3d/external/kenney-nature-kit/kenney_tree_oak.glb` | 14,644 → 14,148 bytes; 196 triangles; 2 materials; no textures | Broad distant silhouette outside the field footprint. |
| Tree Pine Small C | `assets/3d/external/kenney-nature-kit/kenney_tree_pineSmallC.glb` | 5,376 → 4,872 bytes; 54 triangles; 2 materials; no textures | Narrow distant silhouette outside the field footprint. |
| Flower Yellow A | `assets/3d/external/kenney-nature-kit/kenney_flower_yellowA.glb` | 7,120 → 6,620 bytes; 76 triangles; 2 materials; no textures | Rare decorative color accent, not a crop cue. |
| Flower Purple A | `assets/3d/external/kenney-nature-kit/kenney_flower_purpleA.glb` | 7,112 → 6,612 bytes; 76 triangles; 2 materials; no textures | Rare alternative accent, not a crop cue. |
| Fence Simple Low | `assets/3d/external/kenney-nature-kit/kenney_fence_simpleLow.glb` | 4,312 → 3,980 bytes; 44 triangles; 1 material; no textures | Optional short background rail; never use as a map/zone boundary. |

The twelve prepared models total **79,544 bytes, 882 triangles, 19 materials, and zero textures**. The nine additions account for 55,952 bytes and 626 triangles. The largest prepared model is 14,148 bytes/196 triangles; the whole set is about 8% of the 1 MiB decorative transfer budget and 9% of the 10,000-triangle budget. The official archive download was 10,537,521 bytes and was staged outside the repository; only these twelve models plus the included `License.txt` were extracted. Kenney's license file identifies the pack as CC0. Exact SHA-256 values, source archive URL/hash, download date, and validation status are recorded in the [asset manifest](../../assets/3d/asset-manifest.json).

Kenney's source GLBs referenced a child node as a scene root while retaining its parent relationship. A lossless scene-graph flatten with glTF Transform CLI 4.5.1 repaired the files and removed the redundant parent without changing mesh geometry; all twelve prepared GLBs then validated with zero errors and zero warnings. The validator reports informational unused UV attributes, expected because these assets contain no textures.

## Recommendation

Use these small models selectively when implementing the frontend; do not scatter them across the map. The twelve models are a palette, not an instruction to display all at once: start with two or three distinct GLB types in the main view, and remove decoration first if the eight-draw-call full-scene target is threatened. Keep cells, zones, sensor markers, and data overlays procedural. Review scale, palette, and balance in the actual R3F scene; no frontend was created in this asset-preparation step. Poly Haven remains a useful source for a later intentional photoreal accent, but the reviewed Weed Plant 02 model is too detailed/heavy for this small decorative role without additional simplification and texture work. The user has authorized asset use for the private prototype, so a licensing approval is not a blocker; keep the provenance already captured in the manifest.
