/**
 * Vite plugin for local API development.
 * Adds middleware to handle /api/* routes using the shared API router
 * with InMemoryNoteStore and the same rate limiting as production.
 */
import type { Plugin } from 'vite';
import { InMemoryNoteStore } from './src/storage/InMemoryNoteStore';
import { createApiRouter, type ApiRequest } from './src/api/router';

export function apiPlugin(): Plugin {
  const store = new InMemoryNoteStore();
  const router = createApiRouter(store);

  return {
    name: 'vite-plugin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Only handle /api/* routes
        if (!url.startsWith('/api')) {
          return next();
        }

        try {
          // Read request body
          let body: unknown = undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
            let data = '';
            for await (const chunk of req) {
              data += chunk;
            }
            if (data) {
              try {
                body = JSON.parse(data);
              } catch {
                body = undefined;
              }
            }
          }

          // Extract headers
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') {
              headers[key.toLowerCase()] = value;
            }
          }

          const apiReq: ApiRequest = {
            url,
            method: req.method || 'GET',
            headers,
            body,
          };

          const genericRes = await router.handle(apiReq);

          // Write response
          if (!genericRes) {
            return next();
          }

          res.statusCode = genericRes.status;

          // Set response headers
          for (const [key, value] of Object.entries(genericRes.headers)) {
            res.setHeader(key, value);
          }

          // Send body
          if (genericRes.body !== undefined && genericRes.body !== null) {
            res.end(JSON.stringify(genericRes.body));
          } else {
            res.end();
          }
        } catch (error) {
          console.error('API error:', error);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    },
  };
}