# System Architecture: AI-Powered Browser-Based 3D Virtual Try-On

## 1. Abstract & Research Motivation

Contemporary online retail suffers from high return rates (up to 30-40% in apparel and fashion accessories) primarily due to sizing, fit uncertainty, and visual dissonance. Traditional augmented reality (AR) try-on solutions require either native mobile applications (iOS ARKit, Android ARCore) or heavyweight, server-dependent cloud rendering that incurs high GPU costs and unacceptable latency.

This M.Tech project establishes a zero-install, browser-native 3D Virtual Try-On architecture using:
1. **Chrome Manifest V3 Extension**: Injected into e-commerce product pages without requiring merchant backend modification.
2. **MediaPipe Tasks Vision**: On-device WebAssembly and WebGL-accelerated facial/pose landmark tracking.
3. **Three.js Hardware-Accelerated Renderer**: Seamless 60 FPS viewport overlay with PBR materials and depth occlusion.
4. **Cloudflare Edge Infrastructure**: Low-latency delivery of Draco-compressed 3D models via Cloudflare Workers, KV, and D1.
5. **Headless Blender Pipeline**: Automated offline asset decimation and bone anchor tagging.

---

## 2. Monorepo Structural Topology

```
virtual-try-on/
├── extension/          # Chrome Manifest V3 Extension (Content scripts, SW, Popup)
├── server/             # Cloudflare Workers API, KV Cache & D1 SQL schema
├── web-demo/           # Standalone Web Application & Interactive Health Test Harness
├── shared/             # Shared TypeScript types, math projection, smoothing filters
├── assets/             # Blender Python automation and Draco compression scripts
└── docs/               # System specifications, mathematical derivations & benchmarks
```

---

## 3. High-Level Dataflow Pipeline

```
[Target E-Commerce Webpage]
         │
         ▼
[Extension Content Script] ─── DOM Inspection & SKU Detection
         │
         ▼
[MediaPipe Vision Pipeline] ─── Camera Frame (1080p/720p)
         │                       │
         │                       ▼ (30-60 FPS)
         │                   468 Face Mesh Landmarks (x, y, z)
         │
         ▼
[Coordinate Transformation Engine]
         │ ── Perspective Projection Matrix
         │ ── PnP Pose Solver & Centroid Alignment
         │ ── Exponential Moving Average Jitter Filter
         │
         ▼
[Three.js Scene Graph Engine]
         │ ── Draco Compressed GLB Model
         │ ── Bone Anchor Matrix Update
         │ ── Real-time Environmental Lighting & Occlusion Mesh
         │
         ▼
[Canvas Overlay Injected to DOM]
```

---

## 4. Key Architectural Trade-Offs

| Dimension | Native App / WebRTC Cloud Streaming | Browser-Native On-Device (Our Approach) |
|---|---|---|
| **User Friction** | High (Install app / accept heavy data stream) | Zero (Runs directly inside Chrome tab) |
| **Server Cost** | High ($0.05 - $0.20 per stream hour) | Low (Client compute; edge CDN only) |
| **Privacy** | Low (Video stream sent to cloud) | High (Video never leaves client device) |
| **Latency** | 80-250ms roundtrip | < 25ms local inference & render |
