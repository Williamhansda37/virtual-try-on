# Evaluation Metrics & Research Dissertation Benchmarks

## 1. Latency Budget (Target: 30 FPS $\to$ 33.3 ms per frame)

| Pipeline Phase | Target Duration (ms) | Upper Bound (ms) |
|---|---|---|
| Camera Frame Capture & Buffer Transfer | 4.0 | 7.0 |
| MediaPipe Vision Landmark Inference (WASM SIMD) | 12.0 | 18.0 |
| PnP / Geometric Anchor Solver & EMA Filter | 1.5 | 3.0 |
| Three.js Scene Matrix Update & WebGL Draw Calls | 6.0 | 10.0 |
| **Total Frame Latency** | **23.5 ms (~42 FPS)** | **38.0 ms (~26 FPS)** |

---

## 2. Memory Footprint Targets

- **WebGL Heap**: $< 85\text{ MB}$
- **WASM Memory**: $< 35\text{ MB}$
- **Total Browser Tab Overhead**: $< 150\text{ MB}$

---

## 3. Pose Tracking Stability (RMSE)

- **Static Face Jitter**: Root Mean Squared Error (RMSE) $< 0.8\text{ mm}$ with EMA smoothing.
- **Occlusion Recovery**: Tracking re-acquisition within $\le 2$ consecutive frames upon landmark reappearance.
