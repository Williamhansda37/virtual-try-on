# Web Demo: 3D Try-On Stage & Health-Check Testbed

This module provides the browser-based testbed for evaluating the 3D Virtual Try-On pipeline outside the Chrome extension context.

## Capabilities

- **Interactive Health Dashboard**: Hardware acceleration verification (WebGL2, WebAssembly SIMD, Camera permissions).
- **Three.js Try-On Canvas**: Real-time rendering viewport validating anchor transformations, coordinate axes, and PBR lighting.
- **Edge API Simulator**: Real-time mock/live test client for the Cloudflare Workers backend.
- **Diagnostics Runner**: Validates mathematical projections and EMA smoothing filters under synthetic sensor noise.

## Development

```bash
# Start standalone web demo
cd web-demo
npm run dev
```
