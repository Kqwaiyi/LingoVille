# Web 3D stack for a low-poly life sim

Research for ticket [04 — Web 3D stack](../issues/04-web-3d-stack.md). Gathered 2026-10-03 from official docs, GitHub repos, npm registry and asset-site license pages.

## Snapshot of the candidates (as of 2026-10-03)

| | Three.js (plain) | React Three Fiber + drei | Babylon.js | PlayCanvas (engine) |
|---|---|---|---|---|
| Latest version | `three` 0.186.1 (r186, 2026-09-24) | `@react-three/fiber` 9.8.1, `@react-three/drei` 10.7.9 | `@babylonjs/core` 9.29.0 (2026-10-01) | `playcanvas` 2.23.0 (2026-10-01); `@playcanvas/react` 0.11.7 |
| License | MIT | MIT | Apache-2.0 | MIT |
| GitHub stars | ~116k | ~32.7k (R3F), ~9.9k (drei) | ~26k | ~17k (engine), ~0.5k (react) |
| npm weekly downloads | ~22.3M | ~6.7M (R3F), ~4.7M (drei) | ~0.44M | ~0.12M (engine), ~7k (react) |
| Shape | Renderer + addons; you assemble the game | React renderer for Three.js + helper library | Full game engine (physics plugin, GUI, audio, inspector) | Full game engine (ECS, scripts, physics); optional cloud Editor |

Sources: npm registry (`https://registry.npmjs.org/<pkg>`), npm downloads API (`https://api.npmjs.org/downloads/point/last-week/<pkg>`), GitHub repo API for [mrdoob/three.js](https://github.com/mrdoob/three.js), [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber), [pmndrs/drei](https://github.com/pmndrs/drei), [BabylonJS/Babylon.js](https://github.com/BabylonJS/Babylon.js), [playcanvas/engine](https://github.com/playcanvas/engine), [playcanvas/react](https://github.com/playcanvas/react). R3F v9 supports React 19 ([releases](https://github.com/pmndrs/react-three-fiber/releases)).

## 1. Character controller and collision/physics

**Three.js (plain).** No physics in core. Options:
- Built-in lightweight approach: `Octree` + `Capsule` addons (exported from `three/addons`) as used in the official [games_fps example](https://threejs.org/examples/games_fps.html): capsule-vs-static-world collision with no physics engine. Good fit for walking around a town where nothing needs to be simulated ([Addons.js r186](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/Addons.js)).
- Rapier (Rust→WASM, Apache-2.0) via `@dimforge/rapier3d-compat` 0.21.0. Its kinematic character controller has max slope climb angle, min slope slide angle, autostep (stairs/curbs), snap-to-ground, and per-move collision lists ([Rapier JS character controller guide](https://rapier.rs/docs/user_guides/javascript/character_controller/)). The JS bindings now live in the main [dimforge/rapier](https://github.com/dimforge/rapier/tree/master/typescript) monorepo; the old `rapier.js` repo was archived in July 2026 ([dimforge/rapier.js](https://github.com/dimforge/rapier.js)).

**React Three Fiber.** `@react-three/rapier` 2.2.0 (MIT) wraps Rapier declaratively: auto colliders (cuboid/ball/trimesh/hull), sensors (useful for door/interaction trigger zones), collision groups and events; v2 targets React 19 / R3F v9 ([pmndrs/react-three-rapier](https://github.com/pmndrs/react-three-rapier)). Note: its last release was 2025-11-03, so it is stable but slow-moving. `ecctrl` 2.0.2 (MIT, pmndrs) is a ready-made physics character controller for R3F + Rapier with runtime animation states and keyboard controls via drei; peer deps R3F ≥9.4, rapier ≥2.2, React ≥19.2 ([pmndrs/ecctrl](https://github.com/pmndrs/ecctrl), [package.json](https://raw.githubusercontent.com/pmndrs/ecctrl/main/package.json)). It is small (~800 stars, ~4k weekly downloads), so treat it as a starting point you may fork.

**Babylon.js.** Two built-in routes:
- Classic collision system: `mesh.moveWithCollisions()` / camera collisions with ellipsoid-vs-mesh checks and gravity, no physics engine needed ([camera collisions docs](https://doc.babylonjs.com/features/featuresDeepDive/cameras/camera_collisions)).
- Physics V2 with Havok (`@babylonjs/havok` 1.3.14, **MIT**) plus a first-party `PhysicsCharacterController` (capsule/shape-based, surface support state, friction, surface velocity for moving platforms) ([character controller docs](https://doc.babylonjs.com/features/featuresDeepDive/physics/characterController), [Havok plugin docs](https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin), [type defs](https://unpkg.com/@babylonjs/core@9.29.0/Physics/v2/characterController.d.ts), [npm](https://registry.npmjs.org/@babylonjs/havok/latest)).
Babylon is the only candidate with an official, engine-maintained character controller.

**PlayCanvas.** Physics is ammo.js (Bullet → WASM): rigid bodies, capsule/mesh shapes, trigger volumes, raycasts ([physics manual](https://developer.playcanvas.com/user-manual/physics/), [engine llms.txt](https://developer.playcanvas.com/user-manual/engine/llms.txt)). No core character-controller component, but the engine repo ships production ESM scripts including `third-person-controller.mjs` and `first-person-controller.mjs` built on the rigidbody component ([scripts/esm](https://github.com/playcanvas/engine/tree/main/scripts/esm)). The Editor is optional; the same components work engine-only, via `@playcanvas/react`, or via Web Components ([physics manual](https://developer.playcanvas.com/user-manual/physics/)).

## 2. Lighting for a day–night cycle

All four can animate a directional "sun" light, ambient/hemisphere light, sky and fog per frame; the differentiator is shadow quality over a town-sized area (needs cascaded shadow maps).

- **Three.js:** CSM addon for `WebGLRenderer` ([example](https://threejs.org/examples/webgl_shadowmap_csm.html)); r186 added a `SunLight` with built-in cascaded shadow maps and `CSMShadowNode` for `WebGPURenderer` ([r186 release notes](https://github.com/mrdoob/three.js/releases/tag/r186)). r186 also removed `PCFSoftShadowMap`, so older tutorials/agent memory may be stale. Sky shader addon (`Sky`) available. drei adds `<Sky>`, `<Environment>`, `<SoftShadows>` etc. for R3F ([drei](https://github.com/pmndrs/drei)).
- **Babylon.js:** `CascadedShadowGenerator` built in ([CSM docs](https://doc.babylonjs.com/features/featuresDeepDive/lights/shadows_csm)), plus built-in sky material, fog, glow/post-processing pipeline.
- **PlayCanvas:** directional lights with cascades, PCF/VSM/PCSS shadow types, clustered lighting for many omni/spot lights (street lamps, interiors), runtime lightmap baking ([shadows](https://developer.playcanvas.com/user-manual/graphics/lighting/shadows/), [engine llms.txt](https://developer.playcanvas.com/user-manual/engine/llms.txt)).

For low-poly flat shading, a single shadowed sun + ambient color lerp + emissive window/lamp materials at night is enough on any of them; clustered lighting (PlayCanvas) is the most convenient if many real night lights are wanted.

## 3. Performance for a town of ~a dozen places

A dozen low-poly places is a small scene for any of these engines; draw-call count and shadow cost dominate, not polygons. The tools that matter:
- Instancing of repeated props (trees, lamps, chairs): Three.js `InstancedMesh` and `BatchedMesh` ([InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html), [BatchedMesh](https://threejs.org/docs/pages/BatchedMesh.html)); drei `<Instances>`/`<Merged>`; Babylon thin instances ([docs](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances)); PlayCanvas hardware instancing and batch groups ([engine llms.txt](https://developer.playcanvas.com/user-manual/engine/llms.txt)).
- Interiors as separate scenes/zones loaded on door entry (keeps the exterior render set small) — an app-level pattern available on all four.
- R3F specifics: avoid React re-renders in the frame loop (mutate in `useFrame`), use on-demand rendering and instancing ([R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)). R3F has no inherent rendering overhead vs Three.js when used this way, but it is easy for agents to write per-frame `setState`.
- All three engines ship WebGL2 plus WebGPU backends (Three.js `WebGPURenderer`, Babylon WebGPU, PlayCanvas WebGPU); Three.js's own LLM guide still recommends `WebGLRenderer` as the default mature path ([threejs.org/docs/llms.txt](https://threejs.org/docs/llms.txt)).

Conclusion: performance is not a deciding factor at this scope on desktop browsers.

## 4. Ecosystem maturity

- Three.js has by far the largest user base (~22M weekly npm downloads, ~116k stars), examples, and third-party libraries; R3F/drei/pmndrs (Rapier wrapper, ecctrl, postprocessing, zustand) form the richest declarative game-ish ecosystem on the web.
- Babylon.js is a complete, Microsoft-backed engine with strong backward-compatibility policy, Inspector, Playground, Node Material Editor, GUI; much smaller community than Three.js but batteries-included.
- PlayCanvas engine is mature (used in production for years) and MIT, but its community is the smallest; `@playcanvas/react` is pre-1.0 (0.11.x, ~7k weekly downloads).

## 5. How well AI agents write code for it

Primary-source signals only (no benchmark exists that compares these directly):
- All four publish `llms.txt` for agents: [threejs.org/llms.txt](https://threejs.org/llms.txt) → [docs/llms.txt](https://threejs.org/docs/llms.txt) and `llms-full.txt`; [doc.babylonjs.com/llms.txt](https://doc.babylonjs.com/llms.txt); [developer.playcanvas.com/llms.txt](https://developer.playcanvas.com/llms.txt) (explicit agent rules, links to Markdown pages, and an Editor MCP server); [r3f.docs.pmnd.rs/llms.txt](https://r3f.docs.pmnd.rs/llms.txt).
- Three.js's llms.txt explicitly corrects common outdated patterns agents produce (old CDN script tags, renderer choice), and recent Three.js commits are co-authored by `@claude` ([r186 release notes](https://github.com/mrdoob/three.js/releases/tag/r186)), i.e. the maintainers actively use AI agents on the codebase.
- PlayCanvas's own agent guide warns that "Code written for Engine 1 often no longer works" and tells agents to read the installed `playcanvas.d.ts` ([llms.txt](https://developer.playcanvas.com/llms.txt)) — a sign of API churn that model memory may not reflect.
- Volume of public code is the main driver of model fluency; by download/star counts Three.js and R3F dwarf the others. Risk with Three.js/R3F: version churn (r-numbered monthly releases, removals such as `PCFSoftShadowMap`; R3F v8→v9 / React 18→19 split) means agents should be pointed at the pinned version's docs.
- Babylon's API is very stable and fully typed, which helps agents, but less training data exists.

## 6. Free low-poly asset sources

| Source | License | Relevant content |
|---|---|---|
| [Kenney](https://kenney.nl/assets/category:3D) | **CC0**, commercial OK, no attribution required; only the Kenney logo is off-limits ([support/FAQ](https://kenney.nl/support)) | City Kit (Commercial), City Kit (Suburban), Furniture Kit, Food Kit, Car Kit, Fantasy Town Kit; [Mini Characters](https://kenney.nl/assets/mini-characters) (animated, CC0) |
| [Quaternius](https://quaternius.com/) | **CC0**, commercial OK, no attribution required ([FAQ](https://quaternius.com/faq.html)) | Downtown City MegaKit, Ultimate House Interior, Ultimate Furniture, Ultimate Buildings, Modular Streets, Stylized Nature MegaKit; FBX/OBJ/glTF |
| [Poly Pizza](https://poly.pizza/) | **Per model**: CC0 1.0 or CC-BY 3.0 (both appear in search results); downloaders must follow the license on each model ([ToS](https://poly.pizza/docs/tos)); has a public [API](https://poly.pizza/docs/api/v1.1) | Aggregates Kenney, Quaternius, Google Poly legacy and user uploads; CC-BY models need an in-game credits list |

## 7. Rigged / animated character options

- **Quaternius Universal Base Characters + Universal Animation Library 1 & 2** — humanoid rig built for retargeting, UAL2 has 130+ animations, OBJ/FBX/glTF, **CC0**; ~60–70% free, the rest in a paid "source" tier ([UAL2](https://quaternius.com/packs/universalanimationlibrary2.html), [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)). Also Ultimate Modular Characters and older Animated Men/Women packs ([site](https://quaternius.com/)). Best fit: one shared rig for player and all NPCs, glTF straight into any engine.
- **Kenney Mini Characters** — CC0, animated, very simple style ([page](https://kenney.nl/assets/mini-characters)).
- **Mixamo (Adobe)** — free auto-rigging and a large animation library, royalty-free in commercial games, but raw character/animation files may not be redistributed ([Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)). Fine for a local-only game; outputs FBX that needs conversion to glTF.
- **Ready Player Me** — no longer an option: public services shut down 2026-01-31 after Netflix's acquisition (secondary reporting: [Genies blog](https://genies.com/blog/ready-player-me-shutdown), [Avatar SDK blog](https://avatarsdk.com/blog/2026/08/31/avatar-platforms-2026-whos-alive-whos-gone/)).

All engines load glTF/GLB with skeletal animation: Three.js `GLTFLoader` + `AnimationMixer` (drei `useGLTF`/`useAnimations` in R3F), Babylon `SceneLoader`/`AnimationGroup`, PlayCanvas anim component.

## Recommendation

**Use React Three Fiber + drei + `@react-three/rapier` on Three.js (pinned to r186 / R3F 9 / React 19), with Quaternius/Kenney CC0 assets and the Quaternius Universal rig + animation library for the Character and NPCs.**

- It has the largest body of public code and the best agent-facing docs, which matters most for a solo dev driving AI agents; React also matches the dev's web background and lets UI (dialogue, vocabulary panels) live in the same React tree.
- Character movement: start with Rapier's kinematic character controller (slopes, steps, snap-to-ground) — either via `ecctrl` or a small custom controller — and use Rapier sensors for doors/interaction zones. Load interiors as separate zones on door entry.
- Day–night: animate a single shadowed sun (CSM, or `SunLight` if adopting `WebGPURenderer`) plus ambient/sky/fog colors; emissive materials for night lights.
- Guardrails for agents: point them at `https://threejs.org/docs/llms.txt` and the R3F llms.txt, pin versions, and forbid per-frame React state updates.
- **Fallback:** if the dev prefers an all-in-one engine with an official character controller and less assembly, Babylon.js (Havok, MIT) is the strongest alternative. PlayCanvas is capable but has the smallest community and its React binding is pre-1.0, so it is the least attractive for agent-driven work.
