# Web 3D stack for a low-poly life sim

Type: research
Status: resolved
Map: [Language-learning life sim](../map.md)

## Question

What is the best browser 3D stack for a low-poly, single-player, free-roaming town with a third-person Character, NPCs, doors/interiors and a day–night cycle, built by a solo dev working through AI coding agents? Compare Three.js (plain and via React Three Fiber + drei), Babylon.js and PlayCanvas on: character controller and collision/physics options, lighting for day–night, performance for a town of about a dozen places, ecosystem maturity, and how well AI agents write code for it. Also survey free low-poly asset sources (e.g. Kenney, Quaternius, Poly Pizza) with their licenses, and rigged/animated character options.

## Answer

All four options can handle a ~dozen-place low-poly town on desktop; performance is not the decider. Three.js + React Three Fiber has by far the largest ecosystem and agent-facing docs (llms.txt), with Rapier (via `@react-three/rapier`/`ecctrl`) for a kinematic character controller with slopes, steps and trigger sensors. Babylon.js is the best batteries-included alternative (official Havok character controller, MIT; built-in cascaded shadows); PlayCanvas is capable but has the smallest community and a pre-1.0 React binding.
Assets: Kenney and Quaternius are CC0; Poly Pizza is per-model CC0 or CC-BY 3.0. Characters: Quaternius Universal Base Characters + Universal Animation Library (CC0, glTF) for player and NPCs; Mixamo is usable (no raw-file redistribution); Ready Player Me shut down in Jan 2026.
Recommendation: R3F + drei + Rapier on Three.js r186 / React 19, Quaternius/Kenney assets, with Babylon.js as the fallback.

Findings: [web-3d-stack](../research/web-3d-stack.md)
