/**
 * @file content-script.ts
 * Chrome MV3 Content Script injected into target shopping websites.
 * Detects 3D-compatible products and bridges communication between webpage and Try-On HUD.
 */

import { TryOnOverlayInjector } from './overlay-injector';

declare const chrome: any;

console.log('[Try-On Content Script] Injected and active');

const injector = new TryOnOverlayInjector();

// Listen for messages from extension popup or background worker
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: (resp: any) => void) => {
    if (request.action === 'TOGGLE_TRY_ON') {
      const existing = document.getElementById('virtual-try-on-root');
      if (existing) {
        injector.destroy();
        sendResponse({ status: 'closed' });
      } else {
        const { canvas } = injector.inject();
        sendResponse({ status: 'opened', canvasReady: !!canvas });
      }
    }
    return true;
  });
}
