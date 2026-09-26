/**
 * @file node-server.ts
 * Zero-dependency local Node.js server bridge.
 * Executes the exact same Cloudflare Worker fetch handler using standard Node.js HTTP.
 * Runs instantly on http://localhost:8787 without requiring a Cloudflare account or Wrangler login.
 */

import http, { IncomingMessage, ServerResponse } from 'node:http';
import worker from './index';
import { Env } from './types/env';

const PORT = process.env.BACKEND_PORT
  ? parseInt(process.env.BACKEND_PORT, 10)
  : (process.env.PORT && process.env.PORT !== '8080' && process.env.PORT !== '3000'
      ? parseInt(process.env.PORT, 10)
      : 8787);

const mockEnv: Env = {
  ASSET_CACHE_KV: null as any,
  DB: null as any,
  ENVIRONMENT: 'development',
  ALLOWED_ORIGIN: '*',
};

const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || `localhost:${PORT}`;
    const fullUrl = `${protocol}://${host}${req.url}`;

    // Read request body if present
    let bodyBuffers: Uint8Array[] = [];
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      for await (const chunk of req) {
        bodyBuffers.push(chunk);
      }
    }
    const body = bodyBuffers.length > 0 ? Buffer.concat(bodyBuffers) : undefined;

    // Construct Web Standard Request
    const request = new Request(fullUrl, {
      method: req.method,
      headers: req.headers as any,
      body: body ? (body as any) : undefined,
    });

    // Execute Cloudflare Worker Handler
    const response = await worker.fetch(request, mockEnv, {});

    // Pipe response back to HTTP client
    const headersObj: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      headersObj[key] = val;
    });

    res.writeHead(response.status, headersObj);
    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('[Node Backend Server Error]:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`⚡ Try-On Backend API running at http://localhost:${PORT}`);
  console.log(`📡 Health Check:  http://localhost:${PORT}/api/health`);
  console.log(`📦 Models Catalog: http://localhost:${PORT}/api/models`);
  console.log(`📐 Calibration:   http://localhost:${PORT}/api/calibration/eyewear`);
  console.log(`======================================================\n`);
});
