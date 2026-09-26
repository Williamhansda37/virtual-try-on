/**
 * @file content-script.ts
 * Chrome MV3 Content Script injected into target shopping websites.
 * Bridges communication between the extension popup and the standalone on-page 3D Try-On HUD.
 */

import { TryOnOverlayInjector, TryOnItemCategory, TryOnItemStyle } from './overlay-injector';

declare const chrome: any;

console.log('[Try-On Content Script] Injected and active');

const injector = new TryOnOverlayInjector();

// Listen for messages from extension popup or background worker
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: (resp: any) => void) => {
    switch (request.action) {
      case 'GET_STATUS':
        sendResponse({ isOpen: injector.isOpen() });
        break;

      case 'TOGGLE_TRY_ON': {
        if (injector.isOpen()) {
          injector.destroy();
          sendResponse({ status: 'closed', isOpen: false });
        } else {
          injector.inject();
          if (request.category) injector.setCategory(request.category as TryOnItemCategory);
          if (request.style) injector.setStyle(request.style as TryOnItemStyle);
          sendResponse({ status: 'opened', isOpen: true });
        }
        break;
      }

      case 'ENABLE_TRY_ON': {
        injector.inject();
        if (request.category) injector.setCategory(request.category as TryOnItemCategory);
        if (request.style) injector.setStyle(request.style as TryOnItemStyle);
        sendResponse({ status: 'opened', isOpen: true });
        break;
      }

      case 'DISABLE_TRY_ON': {
        injector.destroy();
        sendResponse({ status: 'closed', isOpen: false });
        break;
      }

      case 'SET_CATEGORY': {
        if (request.category) {
          injector.setCategory(request.category as TryOnItemCategory);
          sendResponse({ success: true });
        }
        break;
      }

      case 'SET_STYLE': {
        if (request.style) {
          injector.setStyle(request.style as TryOnItemStyle);
          sendResponse({ success: true });
        }
        break;
      }

      default:
        sendResponse({ received: true });
    }
    return true;
  });
}
