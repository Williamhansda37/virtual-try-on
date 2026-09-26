# Cloudflare Workers, KV, and D1 Architecture

## 1. Edge Strategy

To achieve low-latency asset streaming globally without maintaining dedicated GPU servers, the backend utilizes:
- **Cloudflare Workers**: Serverless execution running on V8 isolates with cold start $< 5\text{ ms}$.
- **Cloudflare KV**: Key-Value caching for Draco-compressed 3D GLB models and binary buffers.
- **Cloudflare D1**: Serverless SQLite database at the edge storing SKU manifests, bone anchor vectors, and user metric profiles.

---

## 2. D1 Schema Relational Layout

```
[categories] 1 ──── ∞ [model_assets]
                             │
                             └─── 1 ──── 1 [anchor_calibrations]
```

## 3. Cache Invalidation and ETag Management

Asset responses include `Cache-Control: public, max-age=31536000, immutable` and content hashing to ensure client extensions only download 3D models once per revision.
