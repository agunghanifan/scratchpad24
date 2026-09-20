/**
 * Vite plugin for local API development.
 * Adds middleware to handle /api/* routes using the platform-agnostic handlers
 * with InMemoryNoteStore.
 */
import type { Plugin } from 'vite';
import { InMemoryNoteStore } from './src/storage/InMemoryNoteStore';
import { createCreateNoteHandler } from './src/api/createNote';
import { createGetNoteHandler } from './src/api/getNote';
import { createUpdateNoteHandler } from './src/api/updateNote';
import { createDeleteNoteHandler } from './src/api/deleteNote';
import { applySecurityHeaders } from './src/api/security';
import type { GenericRequest } from './src/api/types';

export function apiPlugin(): Plugin {
  const store = new InMemoryNoteStore();
  
  const createHandler = createCreateNoteHandler(store);
  const getHandler = createGetNoteHandler(store);
  const updateHandler = createUpdateNoteHandler(store);
  const deleteHandler = createDeleteNoteHandler(store);

  return {
    name: 'vite-plugin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        
        // Only handle /api/* routes
        if (!url.startsWith('/api/')) {
          return next();
        }

        // Strip /api prefix for routing
        const path = url.replace('/api', '');

        try {
          // Read request body
          let body: unknown = undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            body = await new Promise((resolve, reject) => {
              let data = '';
              req.on('data', chunk => (data += chunk));
              req.on('end', () => {
                if (data) {
                  try {
                    resolve(JSON.parse(data));
                  } catch {
                    resolve(undefined);
                  }
                } else {
                  resolve(undefined);
                }
              });
              req.on('error', reject);
            });
          }

          // Extract headers
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') {
              headers[key.toLowerCase()] = value;
            }
          }

          // Extract params from path
          const params: Record<string, string> = {};
          const noteIdMatch = path.match(/^\/notes\/([^/]+)$/);
          if (noteIdMatch && noteIdMatch[1]) {
            params.noteId = noteIdMatch[1];
          }

          // Build GenericRequest
          const genericReq: GenericRequest = {
            method: req.method || 'GET',
            params,
            body,
            headers,
          };

          // Route to appropriate handler
          let genericRes;
          if (path === '/notes' && req.method === 'POST') {
            genericRes = await createHandler(genericReq);
          } else if (path.match(/^\/notes\/[^/]+$/) && req.method === 'GET') {
            genericRes = await getHandler(genericReq);
          } else if (path.match(/^\/notes\/[^/]+$/) && (req.method === 'PUT' || req.method === 'PATCH')) {
            genericRes = await updateHandler(genericReq);
          } else if (path.match(/^\/notes\/[^/]+$/) && req.method === 'DELETE') {
            genericRes = await deleteHandler(genericReq);
          } else {
            // 404 for unmatched routes
            genericRes = {
              status: 404,
              body: { error: 'Not found' },
              headers: { 'content-type': 'application/json' },
            };
          }

          // Write response
          res.statusCode = genericRes.status;
          
          // Set response headers
          for (const [key, value] of Object.entries(genericRes.headers)) {
            res.setHeader(key, value);
          }
          
          // Apply security headers
          const securityHeaders = new Headers();
          applySecurityHeaders(securityHeaders);
          securityHeaders.forEach((value, key) => {
            res.setHeader(key, value);
          });

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
