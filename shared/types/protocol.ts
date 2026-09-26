/**
 * @file protocol.ts
 * Inter-process communication contracts between Chrome Extension, Content Scripts,
 * Host Webpage, and Cloudflare Workers API.
 */

import { TryOnCategory } from './try-on';
import { ModelAssetMetadata } from './asset';

export type ExtensionMessageType =
  | 'TRY_ON_INIT'
  | 'TRY_ON_TOGGLE'
  | 'TRY_ON_SELECT_PRODUCT'
  | 'TRY_ON_UPDATE_TRANSFORM'
  | 'TRY_ON_CAMERA_PERMISSION_REQ'
  | 'TRY_ON_SYSTEM_STATUS'
  | 'TRY_ON_ERROR';

export interface BaseExtensionMessage {
  type: ExtensionMessageType;
  timestamp: number;
}

export interface TryOnInitMessage extends BaseExtensionMessage {
  type: 'TRY_ON_INIT';
  payload: {
    productSku?: string;
    category?: TryOnCategory;
    autoStartCamera: boolean;
  };
}

export interface TryOnSelectProductMessage extends BaseExtensionMessage {
  type: 'TRY_ON_SELECT_PRODUCT';
  payload: {
    metadata: ModelAssetMetadata;
  };
}

export interface TryOnStatusMessage extends BaseExtensionMessage {
  type: 'TRY_ON_SYSTEM_STATUS';
  payload: {
    state: 'idle' | 'tracking' | 'calibrating' | 'paused' | 'error';
    fps: number;
    latencyMs: number;
    detectedFaceCount: number;
    activeAssetId?: string;
  };
}

export interface TryOnErrorPayload {
  code: 'CAMERA_DENIED' | 'WASM_INIT_FAILED' | 'MODEL_FETCH_FAILED' | 'GPU_CONTEXT_LOST';
  message: string;
}

export interface TryOnErrorMessage extends BaseExtensionMessage {
  type: 'TRY_ON_ERROR';
  payload: TryOnErrorPayload;
}
