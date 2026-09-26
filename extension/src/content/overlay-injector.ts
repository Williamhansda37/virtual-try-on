/**
 * @file overlay-injector.ts
 * Manages the DOM injection of the 3D Virtual Try-On HUD,
 * real-time client-side webcam capture, MediaPipe Face Landmarker tracking,
 * GLB/Three.js 3D eyewear rendering, and live diagnostics.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FaceLandmarker, FilesetResolver } from '../vendor/vision_bundle.js';
import { Vector3EMAFilter } from '../../../shared/math/filter';

declare const chrome: any;

export type TryOnItemCategory = 'eyewear' | 'watch' | 'jewelry';
export type TryOnItemStyle = 'gold' | 'silver' | 'onyx' | 'neon';

export class TryOnOverlayInjector {
  private containerId = 'virtual-try-on-root';
  private overlayElement: HTMLDivElement | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private debugCanvasElement: HTMLCanvasElement | null = null;
  private mediaStream: MediaStream | null = null;

  // Three.js instances
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private modelRoot: THREE.Group | null = null;
  private glbGlassesScene: THREE.Group | null = null;
  private animationFrameId: number | null = null;

  // MediaPipe Face Landmarker
  private faceLandmarker: FaceLandmarker | null = null;
  private isLandmarkerInitializing: boolean = false;
  private lastVideoTime: number = -1;

  // Active configurations
  private currentCategory: TryOnItemCategory = 'eyewear';
  private currentStyle: TryOnItemStyle = 'gold';
  private scaleFactor = 1.0;
  private isAutoTracking = true;
  private showLandmarkMesh = true;
  private showDiagnostics = true;

  // Motion smoothing filters
  private positionFilter = new Vector3EMAFilter(0.35);
  private rotationFilter = new Vector3EMAFilter(0.30);

  // Diagnostics State
  private diagnostics = {
    camera: 'WAITING',
    video: 'WAITING',
    mediapipe: 'INITIALIZING',
    face: 'NOT DETECTED',
    landmarks: '0',
    three: 'INITIALIZING',
    glb: 'WAITING',
    fps: '0 FPS',
  };

  public isOpen(): boolean {
    return !!this.overlayElement && document.body.contains(this.overlayElement);
  }

  public setCategory(cat: TryOnItemCategory): void {
    this.currentCategory = cat;
    this.rebuild3DModel();
    this.updateActiveButtonStates();
  }

  public setStyle(style: TryOnItemStyle): void {
    this.currentStyle = style;
    this.rebuild3DModel();
    this.updateActiveButtonStates();
  }

  private updateDiagnostic(key: keyof typeof this.diagnostics, val: string, color?: string): void {
    this.diagnostics[key] = val;
    if (this.overlayElement) {
      const el = this.overlayElement.querySelector(`#diag-${key}`) as HTMLElement | null;
      if (el) {
        el.textContent = val;
        if (color) el.style.color = color;
      }
    }
  }

  public inject(): { container: HTMLDivElement; canvas: HTMLCanvasElement } {
    this.destroy();

    // 1. Create main floating HUD container
    const container = document.createElement('div');
    container.id = this.containerId;
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '390px',
      height: '560px',
      zIndex: '2147483647',
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      backgroundColor: '#090d16',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#f8fafc',
      userSelect: 'none',
      transition: 'height 0.25s ease',
    });

    // 2. Header Bar (Draggable)
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      backgroundColor: '#0f172a',
      borderBottom: '1px solid #1e293b',
      cursor: 'grab',
    });
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#10b981;box-shadow:0 0 10px #10b981;"></span>
        <div>
          <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;">
            <span>3D Virtual Try-On</span>
            <span style="font-size:9px;padding:1px 6px;border-radius:6px;background-color:#1e293b;color:#38bdf8;font-weight:600;">MEDIAPIPE</span>
          </div>
          <div style="font-size:10px;color:#94a3b8;">Client-Side AI Vision & Three.js</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button id="vto-snap-btn" title="Take Try-On Photo" style="background:#1e293b;border:1px solid #334155;color:#f8fafc;border-radius:8px;padding:4px 8px;cursor:pointer;font-size:11px;">📷</button>
        <button id="vto-min-btn" title="Minimize" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;border-radius:8px;padding:4px 8px;cursor:pointer;font-size:11px;">−</button>
        <button id="vto-close-btn" title="Close" style="background:#dc2626;border:none;color:#ffffff;border-radius:8px;padding:4px 9px;cursor:pointer;font-size:12px;font-weight:bold;">✕</button>
      </div>
    `;

    // 3. Viewport Container
    const viewportArea = document.createElement('div');
    viewportArea.id = 'vto-viewport-area';
    Object.assign(viewportArea.style, {
      position: 'relative',
      flex: '1',
      backgroundColor: '#020617',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });

    // Mirrored Video Element
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    Object.assign(video.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: 'scaleX(-1)', // Mirror user perspective
      display: 'block',
    });

    // Three.js Canvas Overlay
    const canvas = document.createElement('canvas');
    canvas.id = 'try-on-viewport-canvas';
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      display: 'block',
    });

    // 2D Face Landmark Mesh Debug Canvas
    const debugCanvas = document.createElement('canvas');
    debugCanvas.id = 'vto-debug-canvas';
    Object.assign(debugCanvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      display: 'block',
    });
    this.debugCanvasElement = debugCanvas;

    // Top Status Banner
    const statusBanner = document.createElement('div');
    statusBanner.id = 'vto-status-banner';
    Object.assign(statusBanner.style, {
      position: 'absolute',
      top: '10px',
      left: '10px',
      right: '10px',
      padding: '6px 10px',
      borderRadius: '8px',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      fontSize: '11px',
      color: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: '10',
    });
    statusBanner.innerHTML = `
      <span id="vto-cam-msg" style="font-weight:600;display:flex;align-items:center;gap:4px;">Connecting to camera...</span>
      <div style="display:flex;align-items:center;gap:5px;">
        <button id="vto-mesh-toggle" style="background:#0284c7;color:#ffffff;border:none;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;font-weight:600;">Mesh ON</button>
        <button id="vto-diag-toggle" style="background:#334155;color:#38bdf8;border:none;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;font-weight:600;">Diag</button>
        <span id="vto-fps" style="font-family:monospace;font-size:10px;color:#10b981;font-weight:bold;">60 FPS</span>
      </div>
    `;

    // 7. Tracking Diagnostics Panel (Requirement 7)
    const diagnosticsPanel = document.createElement('div');
    diagnosticsPanel.id = 'vto-diagnostics-panel';
    Object.assign(diagnosticsPanel.style, {
      position: 'absolute',
      bottom: '10px',
      left: '10px',
      right: '10px',
      padding: '8px 10px',
      borderRadius: '8px',
      backgroundColor: 'rgba(2, 6, 23, 0.90)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(56, 189, 248, 0.35)',
      fontFamily: 'monospace',
      fontSize: '10px',
      lineHeight: '1.4',
      zIndex: '20',
      display: 'block',
    });
    diagnosticsPanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #1e293b;padding-bottom:3px;margin-bottom:4px;font-weight:bold;color:#38bdf8;">
        <span>⚡ TRACKING DIAGNOSTICS</span>
        <span id="diag-fps" style="color:#10b981;">0 FPS</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;">
        <div>Camera: <span id="diag-camera" style="font-weight:bold;color:#f59e0b;">INITIALIZING</span></div>
        <div>Video: <span id="diag-video" style="font-weight:bold;color:#f59e0b;">WAITING</span></div>
        <div>MediaPipe: <span id="diag-mediapipe" style="font-weight:bold;color:#f59e0b;">LOADING</span></div>
        <div>Face: <span id="diag-face" style="font-weight:bold;color:#ef4444;">NOT DETECTED</span></div>
        <div>Landmarks: <span id="diag-landmarks" style="font-weight:bold;color:#94a3b8;">0</span></div>
        <div>Three.js: <span id="diag-three" style="font-weight:bold;color:#10b981;">READY</span></div>
        <div>GLB: <span id="diag-glb" style="font-weight:bold;color:#f59e0b;">LOADING...</span></div>
        <div>Anchor: <span id="diag-anchor" style="font-weight:bold;color:#f59e0b;">[168] Glabella</span></div>
      </div>
    `;

    viewportArea.appendChild(video);
    viewportArea.appendChild(canvas);
    viewportArea.appendChild(debugCanvas);
    viewportArea.appendChild(statusBanner);
    viewportArea.appendChild(diagnosticsPanel);

    // 4. Interactive Bottom Controls Toolbar
    const controls = document.createElement('div');
    Object.assign(controls.style, {
      padding: '10px 12px',
      backgroundColor: '#0b1120',
      borderTop: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    // Category Selector
    const catRow = document.createElement('div');
    catRow.style.display = 'flex';
    catRow.style.gap = '6px';
    catRow.innerHTML = `
      <button id="cat-btn-eyewear" style="flex:1;padding:6px;border-radius:8px;border:1px solid #3b82f6;background:#1e3a8a;color:#ffffff;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
        👓 Glasses
      </button>
      <button id="cat-btn-watch" style="flex:1;padding:6px;border-radius:8px;border:1px solid #1e293b;background:#0f172a;color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
        ⌚ Watch
      </button>
      <button id="cat-btn-jewelry" style="flex:1;padding:6px;border-radius:8px;border:1px solid #1e293b;background:#0f172a;color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
        💎 Pendant
      </button>
    `;

    // Style & Scale Row
    const styleRow = document.createElement('div');
    styleRow.style.display = 'flex';
    styleRow.style.alignItems = 'center';
    styleRow.style.justifyContent = 'space-between';
    styleRow.style.fontSize = '11px';
    styleRow.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="color:#94a3b8;font-size:10px;">MATERIAL:</span>
        <button id="style-gold" style="width:18px;height:18px;border-radius:50%;background:#eab308;border:2px solid #ffffff;cursor:pointer;" title="Gold"></button>
        <button id="style-silver" style="width:18px;height:18px;border-radius:50%;background:#94a3b8;border:1px solid transparent;cursor:pointer;" title="Silver"></button>
        <button id="style-onyx" style="width:18px;height:18px;border-radius:50%;background:#18181b;border:1px solid #3f3f46;cursor:pointer;" title="Onyx"></button>
        <button id="style-neon" style="width:18px;height:18px;border-radius:50%;background:#06b6d4;border:1px solid transparent;cursor:pointer;" title="Cyber Neon"></button>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="color:#94a3b8;font-size:10px;">SCALE:</span>
        <button id="scale-down" style="padding:2px 8px;border-radius:4px;border:1px solid #334155;background:#1e293b;color:#f8fafc;cursor:pointer;">−</button>
        <button id="scale-up" style="padding:2px 8px;border-radius:4px;border:1px solid #334155;background:#1e293b;color:#f8fafc;cursor:pointer;">+</button>
      </div>
    `;

    // Reconnect Button
    const actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.gap = '6px';
    actionRow.innerHTML = `
      <button id="vto-retry-btn" style="flex:1;padding:5px 8px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#cbd5e1;font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
        🔄 Restart Camera & Tracker
      </button>
    `;

    controls.appendChild(catRow);
    controls.appendChild(styleRow);
    controls.appendChild(actionRow);

    container.appendChild(header);
    container.appendChild(viewportArea);
    container.appendChild(controls);
    document.body.appendChild(container);

    this.overlayElement = container;
    this.videoElement = video;
    this.canvasElement = canvas;

    // Attach drag behavior to header
    this.setupDraggable(header, container);

    // Attach event listeners
    this.setupUIEventListeners(container, video, canvas, diagnosticsPanel);

    // Execute complete camera, MediaPipe, GLB, and WebGL initialization pipeline
    this.initCameraAndWebGL(video, canvas);

    return { container, canvas };
  }

  private setupUIEventListeners(
    container: HTMLDivElement,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    diagnosticsPanel: HTMLDivElement
  ): void {
    // Close button
    container.querySelector('#vto-close-btn')?.addEventListener('click', () => {
      this.destroy();
    });

    // Minimize button
    const minBtn = container.querySelector('#vto-min-btn') as HTMLButtonElement;
    const viewportArea = container.querySelector('#vto-viewport-area') as HTMLDivElement;
    const controlsArea = container.lastElementChild as HTMLDivElement;
    let isMinimized = false;

    minBtn?.addEventListener('click', () => {
      isMinimized = !isMinimized;
      if (isMinimized) {
        viewportArea.style.display = 'none';
        controlsArea.style.display = 'none';
        container.style.height = 'auto';
        minBtn.textContent = '+';
      } else {
        viewportArea.style.display = 'flex';
        controlsArea.style.display = 'flex';
        container.style.height = '560px';
        minBtn.textContent = '−';
      }
    });

    // Snapshot button
    container.querySelector('#vto-snap-btn')?.addEventListener('click', () => {
      this.captureSnapshot(video, canvas);
    });

    // Mesh toggle button
    const meshToggleBtn = container.querySelector('#vto-mesh-toggle') as HTMLButtonElement | null;
    meshToggleBtn?.addEventListener('click', () => {
      this.showLandmarkMesh = !this.showLandmarkMesh;
      meshToggleBtn.textContent = this.showLandmarkMesh ? 'Mesh ON' : 'Mesh OFF';
      meshToggleBtn.style.backgroundColor = this.showLandmarkMesh ? '#0284c7' : '#475569';
      if (!this.showLandmarkMesh && this.debugCanvasElement) {
        const dctx = this.debugCanvasElement.getContext('2d');
        if (dctx) dctx.clearRect(0, 0, this.debugCanvasElement.width, this.debugCanvasElement.height);
      }
    });

    // Diagnostics toggle button
    const diagToggleBtn = container.querySelector('#vto-diag-toggle') as HTMLButtonElement | null;
    diagToggleBtn?.addEventListener('click', () => {
      this.showDiagnostics = !this.showDiagnostics;
      diagnosticsPanel.style.display = this.showDiagnostics ? 'block' : 'none';
      if (diagToggleBtn) {
        diagToggleBtn.style.color = this.showDiagnostics ? '#38bdf8' : '#94a3b8';
      }
    });

    // Cam Reconnect Button
    const retryBtn = container.querySelector('#vto-retry-btn') as HTMLButtonElement | null;
    retryBtn?.addEventListener('click', () => {
      this.initCameraAndWebGL(video, canvas);
    });

    // Category buttons
    container.querySelector('#cat-btn-eyewear')?.addEventListener('click', () => this.setCategory('eyewear'));
    container.querySelector('#cat-btn-watch')?.addEventListener('click', () => this.setCategory('watch'));
    container.querySelector('#cat-btn-jewelry')?.addEventListener('click', () => this.setCategory('jewelry'));

    // Style buttons
    container.querySelector('#style-gold')?.addEventListener('click', () => this.setStyle('gold'));
    container.querySelector('#style-silver')?.addEventListener('click', () => this.setStyle('silver'));
    container.querySelector('#style-onyx')?.addEventListener('click', () => this.setStyle('onyx'));
    container.querySelector('#style-neon')?.addEventListener('click', () => this.setStyle('neon'));

    // Scale buttons
    container.querySelector('#scale-down')?.addEventListener('click', () => {
      this.scaleFactor = Math.max(0.5, this.scaleFactor - 0.1);
      if (this.modelRoot) {
        this.modelRoot.scale.setScalar(this.scaleFactor);
      }
    });
    container.querySelector('#scale-up')?.addEventListener('click', () => {
      this.scaleFactor = Math.min(2.0, this.scaleFactor + 0.1);
      if (this.modelRoot) {
        this.modelRoot.scale.setScalar(this.scaleFactor);
      }
    });
  }

  private updateActiveButtonStates(): void {
    if (!this.overlayElement) return;

    // Categories
    const cats: TryOnItemCategory[] = ['eyewear', 'watch', 'jewelry'];
    cats.forEach((cat) => {
      const btn = this.overlayElement?.querySelector(`#cat-btn-${cat}`) as HTMLButtonElement | null;
      if (btn) {
        const isActive = this.currentCategory === cat;
        btn.style.borderColor = isActive ? '#3b82f6' : '#1e293b';
        btn.style.backgroundColor = isActive ? '#1e3a8a' : '#0f172a';
        btn.style.color = isActive ? '#ffffff' : '#cbd5e1';
      }
    });

    // Styles
    const styles: TryOnItemStyle[] = ['gold', 'silver', 'onyx', 'neon'];
    styles.forEach((style) => {
      const btn = this.overlayElement?.querySelector(`#style-${style}`) as HTMLButtonElement | null;
      if (btn) {
        const isSelected = this.currentStyle === style;
        btn.style.border = isSelected ? '2px solid #ffffff' : '1px solid transparent';
      }
    });
  }

  /**
   * Complete Pipeline Execution (Steps 1 through 5)
   */
  private async initCameraAndWebGL(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> {
    const statusMsg = this.overlayElement?.querySelector('#vto-cam-msg') as HTMLElement | null;

    // STEP 4: Initialize Three.js Scene
    this.initThreeJS(canvas);

    // STEP 4: Load 3D GLB Model Asset
    this.loadGLBModel();

    // STEP 2: Initialize MediaPipe Face Landmarker
    this.initMediaPipe();

    // STEP 1: Request and Initialize Webcam Stream
    try {
      this.updateDiagnostic('camera', 'INITIALIZING', '#f59e0b');
      this.updateDiagnostic('video', 'INITIALIZING', '#f59e0b');
      console.log('[Try-On] Step 1: Requesting webcam stream via getUserMedia()...');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is not supported on this page context');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      console.log('[Try-On] Step 1: MediaStream successfully acquired:', stream.id);
      this.mediaStream = stream;
      video.srcObject = stream;
      this.updateDiagnostic('camera', 'READY', '#10b981');

      // Wait for video to load data and begin playback
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          console.log(`[Try-On] Step 1: Video metadata loaded: ${video.videoWidth}x${video.videoHeight}`);
          resolve();
        };
        setTimeout(resolve, 500);
      });

      await video.play();
      console.log(`[Try-On] Step 1: Video playing. readyState=${video.readyState}, size=${video.videoWidth}x${video.videoHeight}`);

      this.updateDiagnostic('video', 'READY', '#10b981');
      if (statusMsg) {
        statusMsg.innerHTML = '<span style="color:#10b981;">🟢 Camera Active • Tracking Face</span>';
      }

      // Start render & tracking animation loop
      this.startAnimationLoop(video, canvas);
    } catch (err: any) {
      console.error('[Try-On] Step 1 Camera Error:', err);
      this.updateDiagnostic('camera', 'FAILED', '#ef4444');
      this.updateDiagnostic('video', 'FAILED', '#ef4444');
      if (statusMsg) {
        statusMsg.innerHTML = `<span style="color:#ef4444;">🔴 Camera: FAILED (${err.name || 'Denied'})</span>`;
      }
      // Start loop for Three.js rendering
      this.startAnimationLoop(null, canvas);
    }
  }

  /**
   * STEP 2: MediaPipe Face Landmarker Initialization
   */
  private async initMediaPipe(): Promise<boolean> {
    if (this.isLandmarkerInitializing) return false;
    this.isLandmarkerInitializing = true;
    this.updateDiagnostic('mediapipe', 'LOADING', '#f59e0b');
    console.log('[Try-On] Step 2: Initializing MediaPipe Face Landmarker...');

    const localWasmPath = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('wasm')
      : '/wasm';
    const localModelPath = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('models/face_landmarker.task')
      : '/models/face_landmarker.task';

    const cdnWasmPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
    const cdnModelPath = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

    let vision = null;
    let modelPathUsed = localModelPath;

    // 1. Try local extension WASM first, fallback to CDN
    try {
      console.log('[Try-On] Step 2: Loading WASM files from local extension path:', localWasmPath);
      vision = await FilesetResolver.forVisionTasks(localWasmPath);
      console.log('[Try-On] Step 2: Local extension WASM loaded successfully!');
    } catch (localWasmErr) {
      console.warn('[Try-On] Step 2: Local WASM failed, falling back to CDN WASM:', localWasmErr);
      try {
        vision = await FilesetResolver.forVisionTasks(cdnWasmPath);
        modelPathUsed = cdnModelPath;
        console.log('[Try-On] Step 2: CDN WASM loaded successfully!');
      } catch (cdnWasmErr) {
        console.error('[Try-On] Step 2: All WASM sources failed:', cdnWasmErr);
        this.updateDiagnostic('mediapipe', 'FAILED', '#ef4444');
        this.isLandmarkerInitializing = false;
        return false;
      }
    }

    // 2. Try creating FaceLandmarker (GPU first, fallback to CPU)
    try {
      console.log('[Try-On] Step 2: Creating FaceLandmarker with model:', modelPathUsed);
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPathUsed,
          delegate: 'GPU',
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      console.log('[Try-On] Step 2: MediaPipe FaceLandmarker successfully initialized (GPU delegate)!');
      this.updateDiagnostic('mediapipe', 'READY', '#10b981');
      this.isLandmarkerInitializing = false;
      return true;
    } catch (gpuErr) {
      console.warn('[Try-On] Step 2: GPU delegate failed, attempting CPU delegate:', gpuErr);
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPathUsed,
            delegate: 'CPU',
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        console.log('[Try-On] Step 2: MediaPipe FaceLandmarker initialized (CPU delegate)!');
        this.updateDiagnostic('mediapipe', 'READY', '#10b981');
        this.isLandmarkerInitializing = false;
        return true;
      } catch (cpuErr) {
        // Fallback to CDN model if local model path failed
        if (modelPathUsed !== cdnModelPath) {
          try {
            console.log('[Try-On] Step 2: Retrying with CDN model URL:', cdnModelPath);
            this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: cdnModelPath,
                delegate: 'CPU',
              },
              outputFaceBlendshapes: false,
              runningMode: 'VIDEO',
              numFaces: 1,
            });
            console.log('[Try-On] Step 2: MediaPipe FaceLandmarker initialized with CDN model!');
            this.updateDiagnostic('mediapipe', 'READY', '#10b981');
            this.isLandmarkerInitializing = false;
            return true;
          } catch (cdnModelErr) {
            console.error('[Try-On] Step 2: Failed with CDN model:', cdnModelErr);
          }
        }
        console.error('[Try-On] Step 2: FaceLandmarker creation failed completely:', cpuErr);
        this.updateDiagnostic('mediapipe', 'FAILED', '#ef4444');
        this.isLandmarkerInitializing = false;
        return false;
      }
    }
  }

  /**
   * STEP 4: Three.js Setup & GLB Loading
   */
  private initThreeJS(canvas: HTMLCanvasElement): void {
    const width = canvas.clientWidth || 390;
    const height = canvas.clientHeight || 340;

    const scene = new THREE.Scene();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(45, width / Math.max(1, height), 0.1, 100);
    camera.position.set(0, 0, 3.8);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer = renderer;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xfffbeb, 1.6);
    dirLight1.position.set(3, 4, 3);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x60a5fa, 0.9);
    dirLight2.position.set(-3, -2, 2);
    scene.add(dirLight2);

    // Root Group for 3D item
    this.modelRoot = new THREE.Group();
    scene.add(this.modelRoot);

    this.updateDiagnostic('three', 'READY', '#10b981');

    // Build the active item
    this.rebuild3DModel();
  }

  /**
   * Loads the 3D GLB model asset
   */
  private async loadGLBModel(): Promise<void> {
    this.updateDiagnostic('glb', 'LOADING', '#f59e0b');
    const glbUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('models/glasses.glb')
      : '/models/glasses.glb';

    console.log('[Try-On] Step 4: Loading 3D GLB model from:', glbUrl);
    const loader = new GLTFLoader();

    loader.load(
      glbUrl,
      (gltf) => {
        console.log('[Try-On] Step 4: GLB Model loaded successfully!', gltf);
        this.glbGlassesScene = gltf.scene;
        this.updateDiagnostic('glb', 'LOADED', '#10b981');
        this.rebuild3DModel();
      },
      undefined,
      (error) => {
        console.warn('[Try-On] Step 4: GLB load failed, using procedural 3D model fallback:', error);
        this.updateDiagnostic('glb', 'FAILED', '#ef4444');
        this.rebuild3DModel();
      }
    );
  }

  private rebuild3DModel(): void {
    if (!this.modelRoot) return;

    // Clean existing children
    while (this.modelRoot.children.length > 0) {
      const child = this.modelRoot.children[0];
      this.modelRoot.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }

    // Material definitions based on currentStyle
    let metalColor = 0xd4af37; // Gold
    let metalness = 0.85;
    let roughness = 0.2;

    if (this.currentStyle === 'silver') {
      metalColor = 0xe2e8f0;
      metalness = 0.95;
      roughness = 0.15;
    } else if (this.currentStyle === 'onyx') {
      metalColor = 0x18181b;
      metalness = 0.6;
      roughness = 0.4;
    } else if (this.currentStyle === 'neon') {
      metalColor = 0x06b6d4;
      metalness = 0.3;
      roughness = 0.2;
    }

    const frameMat = new THREE.MeshStandardMaterial({
      color: metalColor,
      metalness: metalness,
      roughness: roughness,
    });

    const lensMat = new THREE.MeshPhysicalMaterial({
      color: this.currentStyle === 'neon' ? 0x06b6d4 : 0x0f172a,
      transmission: 0.75,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.1,
    });

    if (this.currentCategory === 'eyewear') {
      if (this.glbGlassesScene) {
        // Use loaded GLB model!
        const clone = this.glbGlassesScene.clone();
        clone.traverse((node: any) => {
          if (node.isMesh) {
            node.material = frameMat;
          }
        });
        this.modelRoot.add(clone);
      } else {
        // High-Poly Procedural Eyewear fallback
        const glassesGroup = new THREE.Group();

        // Left Lens
        const leftLensGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.03, 32);
        leftLensGeo.rotateX(Math.PI / 2);
        const leftLens = new THREE.Mesh(leftLensGeo, lensMat);
        leftLens.position.set(-0.52, 0, 0);
        glassesGroup.add(leftLens);

        // Right Lens
        const rightLens = new THREE.Mesh(leftLensGeo, lensMat);
        rightLens.position.set(0.52, 0, 0);
        glassesGroup.add(rightLens);

        // Left Rim
        const rimGeo = new THREE.TorusGeometry(0.39, 0.03, 16, 48);
        const leftRim = new THREE.Mesh(rimGeo, frameMat);
        leftRim.position.set(-0.52, 0, 0);
        glassesGroup.add(leftRim);

        // Right Rim
        const rightRim = new THREE.Mesh(rimGeo, frameMat);
        rightRim.position.set(0.52, 0, 0);
        glassesGroup.add(rightRim);

        // Nose Bridge
        const bridgeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.35, 16);
        bridgeGeo.rotateZ(Math.PI / 2);
        const bridge = new THREE.Mesh(bridgeGeo, frameMat);
        bridge.position.set(0, 0.08, 0);
        glassesGroup.add(bridge);

        // Temples
        const templeGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 16);
        templeGeo.rotateX(Math.PI / 2);

        const leftTemple = new THREE.Mesh(templeGeo, frameMat);
        leftTemple.position.set(-0.9, 0.05, -0.6);
        glassesGroup.add(leftTemple);

        const rightTemple = new THREE.Mesh(templeGeo, frameMat);
        rightTemple.position.set(0.9, 0.05, -0.6);
        glassesGroup.add(rightTemple);

        this.modelRoot.add(glassesGroup);
      }
    } else if (this.currentCategory === 'watch') {
      const watchGroup = new THREE.Group();
      const caseGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 32);
      const watchCase = new THREE.Mesh(caseGeo, frameMat);
      watchGroup.add(watchCase);

      const dialMat = new THREE.MeshStandardMaterial({
        color: this.currentStyle === 'onyx' ? 0x090d16 : 0x1e293b,
        roughness: 0.3,
      });
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.02, 32), dialMat);
      dial.position.y = 0.06;
      watchGroup.add(dial);

      const handMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.28), handMat);
      hand.position.set(0, 0.08, 0.08);
      watchGroup.add(hand);

      const strapMat = new THREE.MeshStandardMaterial({
        color: this.currentStyle === 'gold' ? 0x78350f : 0x18181b,
        roughness: 0.8,
      });
      const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.8), strapMat);
      strap1.position.set(0, 0, 0.85);
      watchGroup.add(strap1);

      const strap2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.8), strapMat);
      strap2.position.set(0, 0, -0.85);
      watchGroup.add(strap2);

      watchGroup.rotation.x = Math.PI / 4;
      this.modelRoot.add(watchGroup);
    } else {
      // Luxury Pendant
      const pendantGroup = new THREE.Group();
      const gemGeo = new THREE.OctahedronGeometry(0.45);
      const gemMat = new THREE.MeshPhysicalMaterial({
        color: this.currentStyle === 'neon' ? 0x06b6d4 : 0xef4444,
        transmission: 0.9,
        transparent: true,
        opacity: 0.9,
        roughness: 0.05,
      });
      const gem = new THREE.Mesh(gemGeo, gemMat);
      pendantGroup.add(gem);

      const bailGeo = new THREE.TorusGeometry(0.18, 0.04, 16, 32);
      const bail = new THREE.Mesh(bailGeo, frameMat);
      bail.position.set(0, 0.52, 0);
      pendantGroup.add(bail);

      this.modelRoot.add(pendantGroup);
    }

    this.modelRoot.scale.setScalar(this.scaleFactor);
  }

  /**
   * Main Render & Tracking Animation Loop
   */
  private startAnimationLoop(video: HTMLVideoElement | null, canvas: HTMLCanvasElement): void {
    let lastTime = performance.now();
    let frameCount = 0;
    const fpsBadge = this.overlayElement?.querySelector('#vto-fps') as HTMLElement | null;

    const animate = (currentTime: number) => {
      this.animationFrameId = requestAnimationFrame(animate);

      // FPS tracking
      frameCount++;
      if (currentTime - lastTime >= 1000) {
        const fpsStr = `${frameCount} FPS`;
        if (fpsBadge) fpsBadge.textContent = fpsStr;
        this.updateDiagnostic('fps', fpsStr, '#10b981');
        frameCount = 0;
        lastTime = currentTime;
      }

      // Live Tracking via MediaPipe Face Landmarker
      if (this.faceLandmarker && video && video.readyState >= 2 && this.isAutoTracking) {
        try {
          // Verify timestamp is increasing
          const nowMs = performance.now();
          if (nowMs > this.lastVideoTime) {
            this.lastVideoTime = nowMs;
            const results = this.faceLandmarker.detectForVideo(video, nowMs);

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
              const landmarks = results.faceLandmarks[0];
              this.updateDiagnostic('face', 'DETECTED', '#10b981');
              this.updateDiagnostic('landmarks', `${landmarks.length}`, '#10b981');

              // STEP 3: Draw visual landmark mesh and anchor crosshair
              if (this.debugCanvasElement && this.showLandmarkMesh) {
                this.drawLandmarkMesh(landmarks);
              }

              // STEP 5: Apply mathematical ray unprojection and 3D transform
              this.applyLandmarkTransform(landmarks);
            } else {
              this.updateDiagnostic('face', 'NOT DETECTED', '#ef4444');
              this.updateDiagnostic('landmarks', '0', '#94a3b8');
              if (this.debugCanvasElement) {
                const dctx = this.debugCanvasElement.getContext('2d');
                if (dctx) dctx.clearRect(0, 0, this.debugCanvasElement.width, this.debugCanvasElement.height);
              }
            }
          }
        } catch (detectErr) {
          console.warn('[Try-On] FaceLandmarker detect error:', detectErr);
        }
      }

      // Render Three.js frame
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * STEP 5: Mathematical Ray Unprojection and Real-Time Transform
   * Binds Landmark 168 (Nose Bridge / Glabella) to Three.js world space
   */
  private applyLandmarkTransform(landmarks: any[]): void {
    if (!this.modelRoot || !this.camera || landmarks.length < 468) return;

    // Anatomical Key Landmarks:
    // 168: Glabella / Nose Bridge between the eyes (Center Anchor for Glasses)
    // 6: Mid-bridge of nose
    // 33: Left eye outer corner
    // 263: Right eye outer corner
    // 133: Left eye inner corner
    // 362: Right eye inner corner
    // 10: Top forehead
    // 152: Bottom chin
    // 234: Left cheek boundary
    // 454: Right cheek boundary
    const noseBridge = landmarks[168] || landmarks[6];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const forehead = landmarks[10];
    const chin = landmarks[152];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];

    let anchorX = noseBridge.x;
    let anchorY = noseBridge.y;

    if (this.currentCategory === 'jewelry') {
      // Pendant rests at collarbone/chest below chin
      anchorY = Math.min(0.95, chin.y + (chin.y - forehead.y) * 0.25);
    }

    // 1. Mirrored Normalized Device Coordinates (NDC) in range [-1, 1]
    // Because webcam view is mirrored horizontally:
    const ndcX = 1 - 2 * anchorX;
    const ndcY = 1 - 2 * anchorY;

    // 2. Exact PerspectiveCamera Ray Unprojection (Field of View = 45 deg, dist = 3.8)
    const fovRad = (45 * Math.PI) / 180;
    const camZ = 3.8;
    const targetZ = 0;
    const distFromCam = camZ - targetZ;
    const visibleHalfHeight = distFromCam * Math.tan(fovRad / 2);

    const canvasW = this.canvasElement?.clientWidth || 390;
    const canvasH = this.canvasElement?.clientHeight || 340;
    const aspect = canvasW / Math.max(1, canvasH);
    const visibleHalfWidth = visibleHalfHeight * aspect;

    const exactWorldX = ndcX * visibleHalfWidth;
    const exactWorldY = ndcY * visibleHalfHeight;

    // 3. Distance & Scale Matching from 3D Inter-Pupillary Distance (Landmark 33 & 263)
    const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    const nominalEyeDist = 0.28; // Nominal eye span ratio in camera frame
    const distanceRatio = Math.max(0.6, Math.min(1.8, eyeDist / nominalEyeDist));
    const exactWorldZ = (distanceRatio - 1.0) * 1.5;

    // Scale model proportionally to face width
    const dynamicScale = this.scaleFactor * distanceRatio;
    this.modelRoot.scale.setScalar(dynamicScale);

    // 4. Decoupled Anatomical Head Pose Calculation:
    // A) Roll (tilt): slope between left and right eyes
    const rollAngleRad = -Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

    // B) Yaw (turn left/right): asymmetry between nose bridge and cheeks
    const dxLeft = Math.abs(noseBridge.x - leftCheek.x);
    const dxRight = Math.abs(rightCheek.x - noseBridge.x);
    const yawAsymmetry = (dxLeft - dxRight) / Math.max(0.001, dxLeft + dxRight);
    const yawAngleRad = Math.asin(Math.max(-0.85, Math.min(0.85, -yawAsymmetry * 1.1)));

    // C) Pitch (look up/down): vertical balance from forehead to nose to chin
    const eyeCenterY = (leftEye.y + rightEye.y) / 2;
    const verticalSpan = Math.max(0.01, chin.y - forehead.y);
    const noseRel = (noseBridge.y - eyeCenterY) / verticalSpan;
    const pitchAngleRad = (noseRel - 0.05) * 2.2;

    // 5. Apply Vector3 Exponential Moving Average (EMA) filter
    if (this.currentCategory === 'watch') {
      const smoothedPos = this.positionFilter.filter({
        x: exactWorldX + 0.65,
        y: exactWorldY - 0.85,
        z: exactWorldZ + 0.2,
      });
      this.modelRoot.position.set(smoothedPos.x, smoothedPos.y, smoothedPos.z);

      const smoothedRot = this.rotationFilter.filter({
        x: Math.PI / 4,
        y: yawAngleRad * 0.4,
        z: -0.2,
      });
      this.modelRoot.rotation.set(smoothedRot.x, smoothedRot.y, smoothedRot.z);
    } else {
      const smoothedPos = this.positionFilter.filter({
        x: exactWorldX,
        y: exactWorldY,
        z: exactWorldZ,
      });
      this.modelRoot.position.set(smoothedPos.x, smoothedPos.y, smoothedPos.z);

      const smoothedRot = this.rotationFilter.filter({
        x: pitchAngleRad,
        y: yawAngleRad,
        z: rollAngleRad,
      });
      this.modelRoot.rotation.set(smoothedRot.x, smoothedRot.y, smoothedRot.z);
    }
  }

  /**
   * STEP 3: Landmark Mesh Overlay & Nose Bridge Anchor Crosshair
   */
  private drawLandmarkMesh(landmarks: any[]): void {
    if (!this.debugCanvasElement || landmarks.length < 468) return;

    const dw = (this.debugCanvasElement.width = this.debugCanvasElement.clientWidth || 390);
    const dh = (this.debugCanvasElement.height = this.debugCanvasElement.clientHeight || 340);
    const ctx = this.debugCanvasElement.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, dw, dh);

    // Draw key contour landmarks in emerald green
    ctx.fillStyle = '#34d399';
    const keyIndices = [
      33, 263, 133, 362, 10, 152, 234, 454, 61, 291, 199, 1, 4,
      70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 168
    ];

    for (const idx of keyIndices) {
      const pt = landmarks[idx];
      if (pt) {
        // Mirrored coordinate:
        const px = (1 - pt.x) * dw;
        const py = pt.y * dh;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Eye Baseline in dashed cyan
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    if (leftEye && rightEye) {
      const lx = (1 - leftEye.x) * dw;
      const ly = leftEye.y * dh;
      const rx = (1 - rightEye.x) * dw;
      const ry = rightEye.y * dh;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(rx, ry);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // STEP 3: Anchor Crosshair on Landmark 168 (Nose Bridge / Glabella)
    const anchor = landmarks[168] || landmarks[6];
    if (anchor) {
      const ax = (1 - anchor.x) * dw;
      const ay = anchor.y * dh;

      // Outer Ring
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax, ay, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Reticle Dot
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(ax, ay, 3, 0, Math.PI * 2);
      ctx.fill();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(ax - 14, ay);
      ctx.lineTo(ax + 14, ay);
      ctx.moveTo(ax, ay - 14);
      ctx.lineTo(ax, ay + 14);
      ctx.stroke();

      // Anchor Label
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('ANCHOR [168] GLABELLA', ax + 12, ay - 8);
    }
  }

  /**
   * Captures the composite of video + 3D model and downloads a try-on picture
   */
  private captureSnapshot(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = canvas.width;
    snapCanvas.height = canvas.height;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame mirrored
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -snapCanvas.width, 0, snapCanvas.width, snapCanvas.height);
    ctx.restore();

    // Draw 3D WebGL canvas
    ctx.drawImage(canvas, 0, 0);

    // Watermark
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(12, snapCanvas.height - 36, 170, 24);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px system-ui';
    ctx.fillText('3D Virtual Try-On', 20, snapCanvas.height - 20);

    // Download image
    const link = document.createElement('a');
    link.download = `try-on-${this.currentCategory}-${Date.now()}.png`;
    link.href = snapCanvas.toDataURL('image/png');
    link.click();
  }

  private setupDraggable(handle: HTMLDivElement, target: HTMLDivElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialRight = 24;
    let initialBottom = 24;

    handle.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = target.getBoundingClientRect();
      initialRight = window.innerWidth - rect.right;
      initialBottom = window.innerHeight - rect.bottom;
      handle.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      target.style.right = `${Math.max(10, initialRight - dx)}px`;
      target.style.bottom = `${Math.max(10, initialBottom - dy)}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        handle.style.cursor = 'grab';
      }
    });
  }

  public destroy(): void {
    // 1. Cancel animation loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 2. Stop camera stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // 3. Dispose Face Landmarker
    if (this.faceLandmarker) {
      try {
        this.faceLandmarker.close();
      } catch (e) {}
      this.faceLandmarker = null;
    }

    // 4. Dispose Three.js objects
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
    this.modelRoot = null;
    this.glbGlassesScene = null;

    // 5. Remove DOM element
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
      this.videoElement = null;
      this.canvasElement = null;
      this.debugCanvasElement = null;
    }

    // 6. Sync storage state
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ tryOnEnabled: false });
    }
  }
}
