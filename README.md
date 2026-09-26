# AI-Powered Browser-Based 3D Virtual Try-On
**M.Tech Research Monorepo & System Architecture**

A production-structured monorepo for real-time, browser-native 3D Virtual Try-On using Chrome Manifest V3, MediaPipe Tasks Vision, Three.js, and Cloudflare Workers.

---

## 1. Monorepo Architecture Overview

This project is organized into 6 modular workspaces:

```
├── /extension        # Chrome Manifest V3 Extension (Content script DOM injector, background service worker, popup UI)
├── /server           # Cloudflare Workers API, KV Cache & D1 SQL schema for 3D model metadata & calibration
├── /web-demo         # Standalone web testbed & comprehensive interactive Health-Check Control Room
├── /shared           # Shared TypeScript types, landmark-to-NDC math projections, and jitter smoothing filters
├── /assets           # Headless Blender Python scripts for decimation & Draco GLB preparation
└── /docs             # M.Tech thesis system architecture, mathematical derivations & evaluation benchmarks
```

---

## 2. Technology Stack

| Layer | Technology | Role |
|---|---|---|
| **Client Extension** | Chrome Manifest V3, TypeScript, React, Vite | Zero-friction DOM injection on e-commerce sites |
| **Vision AI** | MediaPipe Tasks Vision (Face Mesh / Pose) | On-device 3D landmark tracking via WebAssembly SIMD |
| **3D Rendering** | Three.js (WebGL2 / WebGPU ready) | Real-time skeletal anchoring, PBR lighting, depth masking |
| **Edge Backend** | Cloudflare Workers, KV, D1 Database | Sub-20ms model manifest and spatial calibration API |
| **Offline Pipeline** | Python 3.10+, Blender Headless API | Mesh decimation, anchor normalization, Draco compression |

---

## 3. How to Run the Project Locally

### Step 1: Clone & Install Dependencies

From the workspace root:

```bash
# Install root and workspace dependencies
npm install
```

---

### Step 2: Start the Web Demo & Health-Check Dashboard

The health-check dashboard serves as the central control room to verify hardware acceleration, test Three.js rendering, and inspect the monorepo architecture.

```bash
# Starts Vite development server at http://localhost:3000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Step 3: Build & Load the Chrome Manifest V3 Extension

```bash
# Build the extension bundle
npm run build:extension
```

To load the extension into Google Chrome:
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** in the top-left corner.
4. Select the `/extension` directory (or `/extension/dist` once built).
5. The **3D Virtual Try-On Engine** icon will now appear in your Chrome toolbar.
6. Click the extension icon on any webpage to open the Try-On HUD and toggle the 3D overlay.

---

### Step 4: Run the Cloudflare Workers Server Locally

```bash
# Navigate to server workspace and run Wrangler local dev server
cd server
npm install
npm run dev
```

The edge API will start locally at `http://localhost:8787`.
Test the edge health check endpoint:
```bash
curl http://localhost:8787/api/health
```

To initialize the Cloudflare D1 local database:
```bash
npm run d1:init
```

---

### Step 5: Run the Offline 3D Asset Blender Preparation Pipeline

To prepare high-polygon 3D eyewear or accessory models for mobile web performance:

```bash
# Run headless Blender decimation and Draco GLB compression:
blender --background --python assets/scripts/prepare_glb.py -- \
  --input path/to/raw_model.obj \
  --output assets/models/optimized.glb \
  --category eyewear \
  --target-poly 4500

# Run standalone mesh verification:
python3 assets/scripts/validate_mesh.py assets/models/optimized.glb
```

---

## 4. Development Scripts Summary

Run these scripts from the repository root:

- `npm run dev` - Launch the Interactive Health-Check & Architecture Control Dashboard (Port 3000)
- `npm run build` - Compile all web demo assets
- `npm run build:extension` - Build the Chrome Manifest V3 extension
- `npm run typecheck` - Run TypeScript compiler checks across all workspaces
- `npm run lint` - Validate syntax and type safety

---

## 5. System Health Check Specification

The Health-Check page validates:
1. **WebGL2 Context**: Verifies hardware acceleration and max vertex texture units.
2. **WebAssembly SIMD**: Ensures browser support for MediaPipe real-time inference.
3. **Camera MediaStream API**: Tests user media permission grant workflows.
4. **Edge API Connectivity**: Pings Cloudflare Worker health endpoints.
5. **Coordinate Math Engine**: Verifies landmark-to-world projective matrix and EMA smoothing filters.
