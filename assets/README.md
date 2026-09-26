# Assets Pipeline: Blender & Python Preparation

This directory contains offline data preparation scripts used to convert raw 3D models into web-optimized, low-latency GLB assets for browser try-on.

## Requirements

- **Blender 3.6+ or 4.x** (with bundled Python 3.10+)
- **Python 3.10+** (for standalone mesh inspection)

## Pipeline Stages

1. **Geometry Decimation**: Reduces high-poly CAD/Photogrammetry scans down to web-friendly polygon counts (3,000 - 8,000 triangles) to maintain 60 FPS on integrated GPUs.
2. **Anchor Normalization**: Aligns model origin $(0, 0, 0)$ precisely to anatomical anchor points (e.g. nose bridge center for eyewear, wrist pivot for watches).
3. **Draco Compression**: Compresses geometry buffers by up to 85%, enabling sub-second delivery via Cloudflare CDN.
4. **Validation Check**: Tests UV coordinates, texture dimension power-of-two conformity, and bone matrix definitions.

## Execution

```bash
# Run headless Blender decimation and Draco optimization
blender --background --python assets/scripts/prepare_glb.py -- \
  --input raw_models/glasses.obj \
  --output public/models/glasses.glb \
  --category eyewear \
  --target-poly 4500

# Validate generated GLB asset
python3 assets/scripts/validate_mesh.py public/models/glasses.glb
```
