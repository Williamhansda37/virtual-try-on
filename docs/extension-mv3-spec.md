# Chrome Manifest V3 Implementation Specification

## 1. Compliance Requirements

Google Chrome's Manifest V3 enforces strict security boundaries:
1. **No Remotely Hosted Code**: All execution logic, WebAssembly binaries, and neural network graph parsers must be bundled inside the extension package or served via standard Web standards.
2. **Service Worker Lifecycle**: The background context is ephemeral and shuts down after 30 seconds of inactivity. State must persist in `chrome.storage.local`.
3. **Content Security Policy (CSP)**: `wasm-unsafe-eval` is enabled explicitly to allow MediaPipe's optimized WebAssembly SIMD runtime.

---

## 2. Process Separation Matrix

| Component | Execution Context | Permissions | Role |
|---|---|---|---|
| `service-worker.ts` | Chrome Extension SW | `storage`, `activeTab` | Session routing, model caching coordinator |
| `content-script.ts` | Host Page Isolated World | DOM access | E-Commerce SKU detection & canvas injection |
| `overlay-injector.ts` | Host Page DOM | Style/Canvas injection | Rendering host container with shadow-like isolation |
| `popup/Popup.tsx` | Extension Popup Page | Chrome APIs | Configuration HUD, category switcher, FPS monitor |
