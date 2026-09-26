# Chrome Extension: 3D Virtual Try-On (Manifest V3)

This module implements the browser extension that injects real-time 3D Virtual Try-On directly onto e-commerce web pages.

## Architecture

- **Manifest V3 Specification**: Complies with Google's MV3 requirements, using non-persistent service workers and Declarative Net Request/Scripting APIs.
- **Content Scripts**: Injected into host web pages (`overlay-injector.ts`) to render a zero-layout-shift WebGL canvas overlay.
- **MediaPipe Tasks Vision**: Real-time facial and pose landmark tracking within the browser context.
- **Three.js Viewport**: Hardware-accelerated 3D viewport that maps 2D/3D landmarks to 3D skeletal anchor points in real-time.

## Installation & Development

```bash
# From workspace root or /extension directory:
cd extension
npm install

# Build extension for Chrome
npm run build
```

## Loading into Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `extension/dist` (or `extension` root with pre-compiled bundle) directory.
5. Click on the extension icon in your Chrome toolbar to launch the Try-On HUD.
