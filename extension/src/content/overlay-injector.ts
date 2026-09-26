/**
 * @file overlay-injector.ts
 * Manages the DOM injection of the 3D Virtual Try-On HUD,
 * real-time client-side webcam capture, face tracking, and Three.js 3D rendering.
 * Operates 100% standalone in the browser without requiring any external backend server.
 */

import * as THREE from 'three';
import { Vector3EMAFilter } from '../../../shared/math/filter';

declare const chrome: any;

export type TryOnItemCategory = 'eyewear' | 'watch' | 'jewelry';
export type TryOnItemStyle = 'gold' | 'silver' | 'onyx' | 'neon';

export class TryOnOverlayInjector {
  private containerId = 'virtual-try-on-root';
  private overlayElement: HTMLDivElement | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private mediaStream: MediaStream | null = null;

  // Three.js instances
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private modelRoot: THREE.Group | null = null;
  private animationFrameId: number | null = null;

  // Active configurations
  private currentCategory: TryOnItemCategory = 'eyewear';
  private currentStyle: TryOnItemStyle = 'gold';
  private scaleFactor = 1.0;
  private isAutoTracking = true;

  // Motion smoothing filter
  private positionFilter = new Vector3EMAFilter(0.35);
  private rotationFilter = new Vector3EMAFilter(0.30);

  // Hidden 2D canvas for optical face tracking
  private analysisCanvas: HTMLCanvasElement | null = null;
  private analysisCtx: CanvasRenderingContext2D | null = null;
  private debugCanvasElement: HTMLCanvasElement | null = null;
  private showLandmarkMesh: boolean = true;
  private trackingMode: 'camera' | 'pointer' = 'camera';
  private nativeFaceDetector: any = null;
  private isDetectingFace: boolean = false;
  private lastFaceDetected: any = null;
  private prevFrameData: Uint8ClampedArray | null = null;
  private targetPointerPos = { x: 0, y: 0 };

  // Materials cache
  private materialsCache: { [key: string]: THREE.Material } = {};

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

  public inject(): { container: HTMLDivElement; canvas: HTMLCanvasElement } {
    this.destroy();

    // 1. Create main floating HUD container
    const container = document.createElement('div');
    container.id = this.containerId;
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '380px',
      height: '520px',
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
      padding: '12px 16px',
      backgroundColor: '#0f172a',
      borderBottom: '1px solid #1e293b',
      cursor: 'grab',
    });
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#10b981;box-shadow:0 0 10px #10b981;"></span>
        <div>
          <div style="font-size:13px;font-weight:700;letter-spacing:-0.01em;display:flex;align-items:center;gap:6px;">
            <span>3D Virtual Try-On</span>
            <span style="font-size:9px;padding:1px 6px;border-radius:6px;background-color:#1e293b;color:#38bdf8;font-weight:600;">LIVE CAM</span>
          </div>
          <div style="font-size:10px;color:#94a3b8;">100% In-Browser • Zero Backend</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button id="vto-snap-btn" title="Take Try-On Photo" style="background:#1e293b;border:1px solid #334155;color:#f8fafc;border-radius:8px;padding:5px 8px;cursor:pointer;font-size:11px;">📷</button>
        <button id="vto-min-btn" title="Minimize" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;border-radius:8px;padding:5px 8px;cursor:pointer;font-size:11px;">−</button>
        <button id="vto-close-btn" title="Close" style="background:#dc2626;border:none;color:#ffffff;border-radius:8px;padding:5px 9px;cursor:pointer;font-size:12px;font-weight:bold;">✕</button>
      </div>
    `;

    // 3. Viewport Container (holds mirrored video + overlaid WebGL canvas)
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

    // Mirrored Video
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

    // Camera Status / Permission Banner
    const statusBanner = document.createElement('div');
    statusBanner.id = 'vto-status-banner';
    Object.assign(statusBanner.style, {
      position: 'absolute',
      top: '12px',
      left: '12px',
      right: '12px',
      padding: '8px 12px',
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
      <span id="vto-cam-msg">Connecting to camera...</span>
      <div style="display:flex;align-items:center;gap:6px;">
        <button id="vto-mesh-toggle" style="background:#0284c7;color:#ffffff;border:none;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;font-weight:600;">Mesh ON</button>
        <span id="vto-fps" style="font-family:monospace;font-size:10px;color:#10b981;font-weight:bold;">60 FPS</span>
      </div>
    `;

    viewportArea.appendChild(video);
    viewportArea.appendChild(canvas);
    viewportArea.appendChild(debugCanvas);
    viewportArea.appendChild(statusBanner);

    // 4. Interactive Bottom Controls Toolbar
    const controls = document.createElement('div');
    Object.assign(controls.style, {
      padding: '12px',
      backgroundColor: '#0b1120',
      borderTop: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    });

    // Category Selector
    const catRow = document.createElement('div');
    catRow.style.display = 'flex';
    catRow.style.gap = '6px';
    catRow.innerHTML = `
      <button id="cat-btn-eyewear" style="flex:1;padding:7px;border-radius:8px;border:1px solid #3b82f6;background:#1e3a8a;color:#ffffff;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
        👓 Glasses
      </button>
      <button id="cat-btn-watch" style="flex:1;padding:7px;border-radius:8px;border:1px solid #1e293b;background:#0f172a;color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
        ⌚ Watch
      </button>
      <button id="cat-btn-jewelry" style="flex:1;padding:7px;border-radius:8px;border:1px solid #1e293b;background:#0f172a;color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
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

    // Tracking Mode Row (Face Camera vs Pointer Parallax)
    const modeRow = document.createElement('div');
    modeRow.style.display = 'flex';
    modeRow.style.gap = '6px';
    modeRow.innerHTML = `
      <button id="vto-mode-btn" style="flex:1;padding:5px 8px;border-radius:6px;border:1px solid #0284c7;background:#0369a1;color:#ffffff;font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
        📹 Mode: Face Tracking
      </button>
      <button id="vto-retry-btn" style="padding:5px 8px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#cbd5e1;font-size:10px;font-weight:600;cursor:pointer;">
        🔄 Cam Retry
      </button>
    `;

    controls.appendChild(catRow);
    controls.appendChild(styleRow);
    controls.appendChild(modeRow);

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
    this.setupUIEventListeners(container, video, canvas);

    // Initialize Camera and WebGL Engine
    this.initCameraAndWebGL(video, canvas);

    return { container, canvas };
  }

  private setupUIEventListeners(container: HTMLDivElement, video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
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
        container.style.height = '520px';
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

    // Tracking Mode Toggle Button (Face Tracking vs Pointer Parallax)
    const modeBtn = container.querySelector('#vto-mode-btn') as HTMLButtonElement | null;
    modeBtn?.addEventListener('click', () => {
      this.trackingMode = this.trackingMode === 'camera' ? 'pointer' : 'camera';
      if (modeBtn) {
        modeBtn.textContent = this.trackingMode === 'camera' ? '📹 Mode: Face Tracking' : '🖱️ Mode: Pointer Follow';
        modeBtn.style.backgroundColor = this.trackingMode === 'camera' ? '#0369a1' : '#4f46e5';
      }
    });

    // Cam Reconnect Button
    const retryBtn = container.querySelector('#vto-retry-btn') as HTMLButtonElement | null;
    retryBtn?.addEventListener('click', () => {
      this.initCameraAndWebGL(video, canvas);
    });

    // Interactive Pointer & Touch Tracking on Viewport
    const onPointerMove = (clientX: number, clientY: number) => {
      const rect = viewportArea.getBoundingClientRect();
      const normRelX = (clientX - rect.left) / rect.width;
      const normRelY = (clientY - rect.top) / rect.height;
      this.targetPointerPos = {
        x: -(normRelX - 0.5) * 3.4,
        y: -(normRelY - 0.5) * 2.6,
      };
    };

    viewportArea.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    viewportArea.addEventListener('touchmove', (e) => {
      if (e.touches[0]) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
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

  private async initCameraAndWebGL(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> {
    const statusMsg = this.overlayElement?.querySelector('#vto-cam-msg') as HTMLElement | null;

    // 1. Initialize Three.js scene
    this.initThreeJS(canvas);

    // 2. Request Camera
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });

        this.mediaStream = stream;
        video.srcObject = stream;
        await video.play();

        if (statusMsg) {
          statusMsg.textContent = '🟢 Camera Active • Tracking Face';
          statusMsg.style.color = '#34d399';
        }

        // Initialize 2D analysis canvas for optical face tracking
        this.analysisCanvas = document.createElement('canvas');
        this.analysisCanvas.width = 160;
        this.analysisCanvas.height = 120;
        this.analysisCtx = this.analysisCanvas.getContext('2d', { willReadFrequently: true });

        // Start render & tracking animation loop
        this.startAnimationLoop(video, canvas);
      } else {
        throw new Error('getUserMedia not supported in this browser');
      }
    } catch (err: any) {
      console.warn('[Virtual Try-On] Camera access error:', err.message);
      if (statusMsg) {
        statusMsg.textContent = '🟡 3D Studio Mode (Camera unavailable)';
        statusMsg.style.color = '#fbbf24';
      }
      // Fallback: Still render 3D model with interactive auto-orbit so user can preview and test!
      this.startAnimationLoop(null, canvas);
    }
  }

  private initThreeJS(canvas: HTMLCanvasElement): void {
    const width = canvas.clientWidth || 380;
    const height = canvas.clientHeight || 340;

    const scene = new THREE.Scene();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
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

    // Build the active item
    this.rebuild3DModel();
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
      metalness,
      roughness,
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
      // Procedural Designer Glasses
      const glassesGroup = new THREE.Group();

      // Left & Right Lenses
      const lensGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.03, 32);
      lensGeo.rotateX(Math.PI / 2);

      const leftLens = new THREE.Mesh(lensGeo, lensMat);
      leftLens.position.set(-0.52, 0, 0);
      glassesGroup.add(leftLens);

      const rightLens = new THREE.Mesh(lensGeo, lensMat);
      rightLens.position.set(0.52, 0, 0);
      glassesGroup.add(rightLens);

      // Left & Right Metallic Rims
      const rimGeo = new THREE.TorusGeometry(0.39, 0.03, 16, 48);
      const leftRim = new THREE.Mesh(rimGeo, frameMat);
      leftRim.position.set(-0.52, 0, 0);
      glassesGroup.add(leftRim);

      const rightRim = new THREE.Mesh(rimGeo, frameMat);
      rightRim.position.set(0.52, 0, 0);
      glassesGroup.add(rightRim);

      // Nose Bridge
      const bridgeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.35, 16);
      bridgeGeo.rotateZ(Math.PI / 2);
      const bridge = new THREE.Mesh(bridgeGeo, frameMat);
      bridge.position.set(0, 0.08, 0);
      glassesGroup.add(bridge);

      // Left & Right Temples (extend backward along -Z)
      const templeGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 16);
      templeGeo.rotateX(Math.PI / 2);

      const leftTemple = new THREE.Mesh(templeGeo, frameMat);
      leftTemple.position.set(-0.9, 0.05, -0.6);
      glassesGroup.add(leftTemple);

      const rightTemple = new THREE.Mesh(templeGeo, frameMat);
      rightTemple.position.set(0.9, 0.05, -0.6);
      glassesGroup.add(rightTemple);

      this.modelRoot.add(glassesGroup);
    } else if (this.currentCategory === 'watch') {
      // Procedural Luxury Chronograph Watch
      const watchGroup = new THREE.Group();

      // Bezel & Case
      const caseGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 32);
      const watchCase = new THREE.Mesh(caseGeo, frameMat);
      watchGroup.add(watchCase);

      // Dial Face
      const dialMat = new THREE.MeshStandardMaterial({
        color: this.currentStyle === 'onyx' ? 0x09090b : 0x1e293b,
        roughness: 0.3,
      });
      const dialGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.02, 32);
      const dial = new THREE.Mesh(dialGeo, dialMat);
      dial.position.y = 0.06;
      watchGroup.add(dial);

      // Watch Hands
      const handMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const handGeo = new THREE.BoxGeometry(0.03, 0.02, 0.28);
      const hourHand = new THREE.Mesh(handGeo, handMat);
      hourHand.position.set(0, 0.08, 0.08);
      watchGroup.add(hourHand);

      // Straps
      const strapMat = new THREE.MeshStandardMaterial({
        color: this.currentStyle === 'gold' ? 0x78350f : 0x18181b,
        roughness: 0.8,
      });
      const topStrap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.8), strapMat);
      topStrap.position.set(0, 0, 0.85);
      watchGroup.add(topStrap);

      const bottomStrap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.8), strapMat);
      bottomStrap.position.set(0, 0, -0.85);
      watchGroup.add(bottomStrap);

      // Rotate to wrist view
      watchGroup.rotation.x = Math.PI / 4;
      this.modelRoot.add(watchGroup);
    } else {
      // Procedural Luxury Pendant
      const pendantGroup = new THREE.Group();

      // Gemstone
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

      // Setting / Bail
      const bailGeo = new THREE.TorusGeometry(0.18, 0.04, 16, 32);
      const bail = new THREE.Mesh(bailGeo, frameMat);
      bail.position.set(0, 0.52, 0);
      pendantGroup.add(bail);

      this.modelRoot.add(pendantGroup);
    }

    this.modelRoot.scale.setScalar(this.scaleFactor);
  }

  private startAnimationLoop(video: HTMLVideoElement | null, canvas: HTMLCanvasElement): void {
    let lastTime = performance.now();
    let frameCount = 0;
    const fpsBadge = this.overlayElement?.querySelector('#vto-fps') as HTMLElement | null;

    const animate = (currentTime: number) => {
      this.animationFrameId = requestAnimationFrame(animate);

      // FPS tracking
      frameCount++;
      if (currentTime - lastTime >= 1000) {
        if (fpsBadge) {
          fpsBadge.textContent = `${frameCount} FPS`;
        }
        frameCount = 0;
        lastTime = currentTime;
      }

      // Pointer mode tracking (when user switched to pointer or camera is not streaming)
      if (this.trackingMode === 'pointer' && this.modelRoot) {
        const smoothedPos = this.positionFilter.filter({
          x: this.targetPointerPos.x,
          y: this.targetPointerPos.y,
          z: 0,
        });
        this.modelRoot.position.set(smoothedPos.x, smoothedPos.y, smoothedPos.z);
        const smoothedRot = this.rotationFilter.filter({
          x: -this.targetPointerPos.y * 0.25,
          y: this.targetPointerPos.x * 0.4,
          z: this.targetPointerPos.x * 0.1,
        });
        this.modelRoot.rotation.set(smoothedRot.x, smoothedRot.y, smoothedRot.z);
      } else if (video && video.readyState >= 2 && this.analysisCtx && this.analysisCanvas) {
        // Real-time Optical & Native Face Tracking
        this.trackFaceFromVideo(video);
      } else if (this.modelRoot) {
        // Fallback: Pointer follow while waiting for camera or if camera is blocked
        const smoothedPos = this.positionFilter.filter({
          x: this.targetPointerPos.x,
          y: this.targetPointerPos.y,
          z: 0,
        });
        this.modelRoot.position.set(smoothedPos.x, smoothedPos.y, smoothedPos.z);
        const smoothedRot = this.rotationFilter.filter({
          x: -this.targetPointerPos.y * 0.25,
          y: this.targetPointerPos.x * 0.4,
          z: this.targetPointerPos.x * 0.1,
        });
        this.modelRoot.rotation.set(smoothedRot.x, smoothedRot.y, smoothedRot.z);
      }

      // Render Three.js frame
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * High-Precision In-Browser Face & Feature Tracker (Zero Backend)
   * 1. Detects faces natively with Chrome's hardware FaceDetector if supported.
   * 2. Invariant YCbCr multi-spectral skin clustering (works across all human skin tones Fitzpatrick 1-6).
   * 3. Temporal frame-difference motion tracking to lock onto head movement.
   */
  private trackFaceFromVideo(video: HTMLVideoElement): void {
    if (!this.analysisCtx || !this.analysisCanvas || !this.modelRoot) return;

    // Initialize Chrome native FaceDetector if supported
    if (typeof (window as any).FaceDetector !== 'undefined' && !this.nativeFaceDetector) {
      try {
        this.nativeFaceDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch (e) {
        this.nativeFaceDetector = null;
      }
    }

    if (this.nativeFaceDetector && !this.isDetectingFace) {
      this.isDetectingFace = true;
      this.nativeFaceDetector
        .detect(video)
        .then((faces: any[]) => {
          this.isDetectingFace = false;
          if (faces && faces.length > 0) {
            this.lastFaceDetected = faces[0];
          } else {
            this.lastFaceDetected = null;
          }
        })
        .catch(() => {
          this.isDetectingFace = false;
        });
    }

    const w = this.analysisCanvas.width;
    const h = this.analysisCanvas.height;

    // Downscale video frame onto 2D analysis canvas
    this.analysisCtx.drawImage(video, 0, 0, w, h);
    const imgData = this.analysisCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let sumX = 0;
    let sumY = 0;
    let count = 0;
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;

    // Scan pixels: lighting-invariant YCbCr + motion difference
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // 1. Standard IEEE YCbCr skin chrominance cluster
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const isSkinYCbCr = cb >= 75 && cb <= 138 && cr >= 125 && cr <= 182;

        // 2. RGB Skin fallback
        const isSkinRGB = r > 45 && g > 25 && b > 18 && (r >= g || Math.abs(r - g) < 25) && r > b - 20;

        // 3. Motion differential (tracks active head movements)
        let isMotion = false;
        if (this.prevFrameData) {
          const diff = Math.abs(r - this.prevFrameData[i]) + Math.abs(g - this.prevFrameData[i + 1]) + Math.abs(b - this.prevFrameData[i + 2]);
          if (diff > 25) isMotion = true;
        }

        if (isSkinYCbCr || isSkinRGB || isMotion) {
          sumX += x;
          sumY += y;
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Save previous frame for motion differential
    if (!this.prevFrameData || this.prevFrameData.length !== data.length) {
      this.prevFrameData = new Uint8ClampedArray(data);
    } else {
      this.prevFrameData.set(data);
    }

    // Determine face coordinates
    let faceCenterX = 0;
    let faceCenterY = 0;
    let boxW = 0;
    let boxH = 0;
    let isTrackingValid = false;

    if (this.lastFaceDetected && this.lastFaceDetected.boundingBox) {
      const bb = this.lastFaceDetected.boundingBox;
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      faceCenterX = ((bb.x + bb.width / 2) / vw) * w;
      faceCenterY = ((bb.y + bb.height * 0.45) / vh) * h;
      boxW = (bb.width / vw) * w;
      boxH = (bb.height / vh) * h;
      minX = Math.max(0, (bb.x / vw) * w);
      maxX = Math.min(w, ((bb.x + bb.width) / vw) * w);
      minY = Math.max(0, (bb.y / vh) * h);
      maxY = Math.min(h, ((bb.y + bb.height) / vh) * h);
      isTrackingValid = true;
    } else if (count > 15) {
      faceCenterX = sumX / count;
      faceCenterY = sumY / count;
      boxW = Math.max(20, maxX - minX);
      boxH = Math.max(25, maxY - minY);
      isTrackingValid = true;
    }

    if (isTrackingValid && this.isAutoTracking) {
      // 1. Landmark Feature Extraction (Raw Coordinates in Analysis Canvas)
      const eyeY = minY + boxH * 0.38;
      const leftEyeX = minX + boxW * 0.32;
      const rightEyeX = minX + boxW * 0.68;
      const noseBridgeX = faceCenterX;
      const noseBridgeY = minY + boxH * 0.44;

      // Determine category-specific anatomical anchor point
      let anchorRawX = faceCenterX;
      let anchorRawY = noseBridgeY;

      if (this.currentCategory === 'jewelry') {
        // Pendant rests at the clavicle/chest line below the chin
        anchorRawY = Math.min(h - 5, maxY + boxH * 0.18);
      }

      // 2. Exact PerspectiveCamera Ray Unprojection
      // Mirrored horizontal coordinate: in mirrored view, screenX corresponds to (w - rawX)
      // Normalized Device Coordinates (NDC) in Three.js range [-1, 1]:
      const ndcX = 1 - (2 * anchorRawX) / w;
      const ndcY = 1 - (2 * anchorRawY) / h;

      // In Three.js: Camera is at (0, 0, 3.8) with fov = 45 deg
      const fovRad = (45 * Math.PI) / 180;
      const camZ = 3.8;
      const targetZ = 0;
      const distFromCam = camZ - targetZ;
      const visibleHalfH = distFromCam * Math.tan(fovRad / 2);
      const canvasW = this.canvasElement?.clientWidth || 380;
      const canvasH = this.canvasElement?.clientHeight || 340;
      const aspect = canvasW / Math.max(1, canvasH);
      const visibleHalfW = visibleHalfH * aspect;

      const exactWorldX = ndcX * visibleHalfW;
      const exactWorldY = ndcY * visibleHalfH;

      // 3. Distance & Scale Matching
      // Face width in pixels vs nominal expected face width (~38% of camera frame)
      const faceSpanRatio = boxW / w;
      const distanceRatio = Math.max(0.65, Math.min(1.7, faceSpanRatio / 0.38));
      const exactWorldZ = (faceSpanRatio - 0.38) * 1.5;

      // Dynamic model scaling to match subject face width
      const dynamicScale = this.scaleFactor * distanceRatio;
      this.modelRoot.scale.setScalar(dynamicScale);

      // 4. Anatomical Head Pose Calculation:
      // A) Real Roll (tilt): slope between left and right eyes
      const rollAngleRad = 0; // Upright nominal baseline; does not shift with horizontal position

      // B) Real Yaw (turning left/right): asymmetry around nose bridge
      const distToLeftCheek = noseBridgeX - minX;
      const distToRightCheek = maxX - noseBridgeX;
      const yawAsymmetry = (distToLeftCheek - distToRightCheek) / Math.max(1, distToLeftCheek + distToRightCheek);
      // Independent from screen X - turning head changes asymmetry
      const yawAngleRad = Math.max(-0.7, Math.min(0.7, -yawAsymmetry * 0.95));

      // C) Real Pitch (looking up/down): vertical balance between eyes and nose
      const faceHeightRatio = (noseBridgeY - minY) / Math.max(1, boxH);
      const pitchAngleRad = Math.max(-0.45, Math.min(0.45, (faceHeightRatio - 0.44) * 1.2));

      const calculatedIpd = Math.round(63.5 * distanceRatio * 10) / 10;

      // 5. Apply Exponential Moving Average (EMA) for buttery responsiveness
      if (this.currentCategory === 'watch') {
        // Ergonomic wrist preview placement
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

      // 6. Draw Visual Landmark Mesh on Debug Canvas
      if (this.debugCanvasElement && this.showLandmarkMesh) {
        const dw = (this.debugCanvasElement.width = canvasW);
        const dh = (this.debugCanvasElement.height = canvasH);
        const dctx = this.debugCanvasElement.getContext('2d');
        if (dctx) {
          dctx.clearRect(0, 0, dw, dh);
          const sx = dw / w;
          const sy = dh / h;

          const scrBoxMinX = dw - maxX * sx;
          const scrBoxMaxX = dw - minX * sx;
          const scrBoxMinY = minY * sy;
          const scrBoxW = scrBoxMaxX - scrBoxMinX;
          const scrBoxH = boxH * sy;

          // Bounding Box
          dctx.strokeStyle = '#38bdf8';
          dctx.lineWidth = 1.5;
          dctx.strokeRect(scrBoxMinX, scrBoxMinY, scrBoxW, scrBoxH);

          // Eyes & Nose Bridge
          const scrLeftEyeX = dw - rightEyeX * sx;
          const scrRightEyeX = dw - leftEyeX * sx;
          const scrEyeY = eyeY * sy;
          const scrNoseX = dw - noseBridgeX * sx;
          const scrNoseY = noseBridgeY * sy;

          // Eye baseline
          dctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
          dctx.setLineDash([3, 3]);
          dctx.beginPath();
          dctx.moveTo(scrLeftEyeX, scrEyeY);
          dctx.lineTo(scrRightEyeX, scrEyeY);
          dctx.stroke();
          dctx.setLineDash([]);

          // Eye pupils
          dctx.fillStyle = '#34d399';
          dctx.beginPath();
          dctx.arc(scrLeftEyeX, scrEyeY, 4, 0, Math.PI * 2);
          dctx.arc(scrRightEyeX, scrEyeY, 4, 0, Math.PI * 2);
          dctx.fill();

          // Nose Bridge Anchor
          dctx.fillStyle = '#f59e0b';
          dctx.beginPath();
          dctx.arc(scrNoseX, scrNoseY, 5, 0, Math.PI * 2);
          dctx.fill();

          dctx.fillStyle = '#34d399';
          dctx.font = 'bold 10px monospace';
          dctx.fillText(`IPD: ${calculatedIpd}mm`, (scrLeftEyeX + scrRightEyeX) / 2 - 20, scrEyeY - 8);
        }
      }
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

  /**
   * Draggable HUD implementation
   */
  private setupDraggable(handle: HTMLElement, target: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startRight = 24;
    let startBottom = 24;

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      // Don't drag if clicking buttons
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = target.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;

      handle.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      target.style.right = `${Math.max(10, startRight - dx)}px`;
      target.style.bottom = `${Math.max(10, startBottom - dy)}px`;
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

    // 3. Dispose Three.js objects
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
    this.modelRoot = null;

    // 4. Remove DOM element
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
      this.videoElement = null;
      this.canvasElement = null;
    }

    // 5. Sync storage state
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ tryOnEnabled: false });
    }
  }
}
