import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function edgeApiPlugin(): Plugin {
  return {
    name: 'edge-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host || 'localhost:3000';
          const fullUrl = `${protocol}://${host}${req.url}`;

          let bodyBuffers: Uint8Array[] = [];
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            for await (const chunk of req) {
              bodyBuffers.push(chunk);
            }
          }
          const body = bodyBuffers.length > 0 ? Buffer.concat(bodyBuffers) : undefined;

          try {
            const { default: worker } = await import('./server/src/index');
            const request = new Request(fullUrl, {
              method: req.method,
              headers: req.headers as any,
              body: body ? (body as any) : undefined,
            });
            const response = await worker.fetch(
              request,
              {
                ENVIRONMENT: 'development',
                ALLOWED_ORIGIN: '*',
              },
              {}
            );

            res.statusCode = response.status;
            response.headers.forEach((val, key) => {
              res.setHeader(key, val);
            });
            const arrayBuffer = await response.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), edgeApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        '@shared': path.resolve(import.meta.dirname, 'shared'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

