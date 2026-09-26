/**
 * @file service-worker.ts
 * Chrome MV3 Background Service Worker for 3D Virtual Try-On Extension.
 * Handles lifecycle, IPC routing, and remote asset metadata caching.
 */

import { BaseExtensionMessage } from '../../../shared/types/protocol';

declare const chrome: any;

console.log('[Try-On Background SW] Service Worker Initialized');

// Extension installation lifecycle
if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    console.log('[Try-On Background SW] 3D Virtual Try-On Extension Installed');
    if (chrome.storage?.local) {
      chrome.storage.local.set({
        tryOnEnabled: false,
        activeCategory: 'eyewear',
        apiEndpoint: 'http://localhost:8787/api',
      });
    }
  });

  // Message dispatcher
  chrome.runtime.onMessage.addListener((message: BaseExtensionMessage, sender: any, sendResponse: (response?: any) => void) => {
    console.log('[Try-On Background SW] Received message:', message.type, 'from:', sender.id || 'tab');

    switch (message.type) {
      case 'TRY_ON_INIT':
        sendResponse({ success: true, status: 'initialized' });
        break;

      case 'TRY_ON_SYSTEM_STATUS':
        sendResponse({ success: true, timestamp: Date.now() });
        break;

      default:
        sendResponse({ received: true });
    }
    return true; // Keep message channel open for async response
  });
}
