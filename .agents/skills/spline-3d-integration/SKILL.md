---
name: spline-3d-integration
description: Expert guide and playbook for embedding interactive 3D scenes from Spline.design into web projects, including Three.js integration, React/Vite embedding, and Spline runtime control API.
risk: safe
source: community
date_added: 2026-03-07
---

# Spline 3D Integration Skill

Master guide for embedding and controlling interactive 3D scenes from [Spline.design](https://spline.design) in web projects (Three.js, React, Vanilla JS, and WebGL).

---

## When to Use
- Adding interactive 3D scenes designed in Spline to web applications.
- Integrating Spline scenes directly into Three.js scenes using `@splinetool/loader`.
- Embedding Spline in React / Vite / Next.js using `@splinetool/react-spline` or `@splinetool/r3f-spline`.
- Controlling 3D objects, animations, and variables via the Spline Runtime API (`@splinetool/runtime`).
- Handling WebGL fallbacks, mobile GPU optimization, and scroll performance.

## Integration Architecture

Choose the right integration path based on your 3D stack:

| Target Stack | Package / Tool | Best For |
|---|---|---|
| **Three.js Vanilla** | `@splinetool/loader` | Loading `.splinecode` assets directly into Three.js `Scene` alongside custom 3D meshes |
| **React / Vite** | `@splinetool/react-spline` | Fast interactive 3D embeds with React lifecycle & event props |
| **React Three Fiber (R3F)** | `@splinetool/r3f-spline` | Composing Spline models inside an R3F Canvas pipeline |
| **Vanilla HTML/JS** | `<spline-viewer>` or `@splinetool/runtime` | Lightweight web component or direct canvas control |

## Quick Guides

- [Three.js + Spline Loader Integration](guides/THREEJS_SPLINE_LOADER.md)
- [React & Vite Integration](guides/REACT_INTEGRATION.md)
- [Vanilla JS & HTML Component](guides/VANILLA_INTEGRATION.md)
- [Performance & Mobile Optimization](guides/PERFORMANCE.md)
- [Common Problems & Debugging](guides/COMMON_PROBLEMS.md)

## Connection Checklist

1. **Scene URL**: Obtain the scene URL exported from Spline editor (`https://prod.spline.design/<id>/scene.splinecode`).
2. **Authentication**: Spline public embeds and runtime loaders do **not** require user API keys or interactive login tokens in client code; scenes are accessed directly via the generated scene URL or self-hosted `.splinecode` bundle.
3. **Scroll & Overflow**: Ensure `overflow: hidden` is not injected onto the `<body>` by disabling page scroll in export settings or enforcing `body { overflow: auto !important; }`.
4. **Fallback & Loading**: Always provide a loading skeleton / background fallback for devices with lower GPU capabilities or WebGL disabled.
