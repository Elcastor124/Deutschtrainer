import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Publica src/design/tokens.css como /design-tokens.css para presentaciones y minijuegos independientes (una sola fuente).
const tokensFile = resolve(import.meta.dirname, 'src/design/tokens.css');
const designTokens = () => ({
  name: 'design-tokens',
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/design-tokens.css') return next();
      res.setHeader('content-type', 'text/css; charset=utf-8');
      res.end(readFileSync(tokensFile, 'utf8'));
    });
  },
  generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
    this.emitFile({ type: 'asset', fileName: 'design-tokens.css', source: readFileSync(tokensFile, 'utf8') });
  },
});

// En desarrollo Vite sirve el cliente (5173) y reenvía el WebSocket al servidor de juego (PORT, por defecto 4747).
export default defineConfig({
  plugins: [react(), designTokens()],
  server: {
    host: true,
    proxy: { '/ws': { target: `ws://localhost:${process.env.PORT || 4747}`, ws: true } },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.ts', 'src/**/*.test.ts'] },
});
