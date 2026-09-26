/**
 * @file env.ts
 * Cloudflare Workers Environment bindings (KV, D1, Environment variables).
 */

export interface Env {
  ASSET_CACHE_KV?: {
    get(key: string, type?: 'text' | 'json' | 'arrayBuffer'): Promise<any>;
    put(key: string, value: string | ArrayBuffer | ReadableStream, options?: any): Promise<void>;
  };
  DB?: {
    prepare(query: string): {
      bind(...params: any[]): {
        all(): Promise<{ results: any[] }>;
        first<T = any>(): Promise<T | null>;
        run(): Promise<{ success: boolean; meta: any }>;
      };
    };
  };
  ENVIRONMENT: string;
  ALLOWED_ORIGIN: string;
}
