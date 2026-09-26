/**
 * @file overlay-injector.ts
 * Manages the DOM injection of the 3D Virtual Try-On HUD and WebGL Canvas.
 */

export class TryOnOverlayInjector {
  private containerId = 'virtual-try-on-root';
  private overlayElement: HTMLDivElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;

  public inject(): { container: HTMLDivElement; canvas: HTMLCanvasElement } {
    const existing = document.getElementById(this.containerId);
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = this.containerId;
    container.style.position = 'fixed';
    container.style.bottom = '24px';
    container.style.right = '24px';
    container.style.width = '360px';
    container.style.height = '480px';
    container.style.zIndex = '2147483640';
    container.style.borderRadius = '16px';
    container.style.overflow = 'hidden';
    container.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)';
    container.style.backgroundColor = '#090d16';
    container.style.border = '1px solid #1e293b';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // Header bar
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '10px 14px';
    header.style.backgroundColor = '#0f172a';
    header.style.borderBottom = '1px solid #1e293b';
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:#10b981;"></span>
        <span style="font-family:sans-serif;font-size:12px;font-weight:600;color:#f8fafc;">3D Try-On Engine</span>
      </div>
      <button id="try-on-close-btn" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:4px;">✕</button>
    `;

    // Viewport canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'try-on-viewport-canvas';
    canvas.style.flex = '1';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    container.appendChild(header);
    container.appendChild(canvas);
    document.body.appendChild(container);

    const closeBtn = container.querySelector('#try-on-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.destroy();
      });
    }

    this.overlayElement = container;
    this.canvasElement = canvas;

    return { container, canvas };
  }

  public destroy(): void {
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
      this.canvasElement = null;
    }
  }
}
