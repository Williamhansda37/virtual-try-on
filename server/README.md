# Server: Cloudflare Workers & KV/D1 API

This module provides the edge computing backend for the 3D Virtual Try-On system.

## Features

- **Sub-15ms Latency**: Built for Cloudflare Workers edge network.
- **Asset Metadata & Catalog API**: Serves 3D GLB manifest, bone anchor weights, and calibration profiles.
- **Edge KV Caching**: Low-latency cache for Draco-compressed 3D mesh assets.
- **Cloudflare D1 Relational Storage**: Schema for SKUs, anchor configurations, and user calibration telemetry.

## Local Development

```bash
# Run local Cloudflare Worker simulator using Wrangler
cd server
npm run dev

# Execute D1 SQLite schema locally
npm run d1:init
```

## API Endpoints

- `GET /api/health` - Worker runtime status and storage binding diagnostics.
- `GET /api/models?category=eyewear` - Fetches 3D model specs and bone anchor metadata.
- `GET /api/calibration/:category` - Returns spatial landmarks calibration matrices.
