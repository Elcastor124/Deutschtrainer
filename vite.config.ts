import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// En desarrollo Vite sirve el cliente (5173) y reenvía el WebSocket al servidor de juego (PORT, por defecto 4747).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: { '/ws': { target: `ws://localhost:${process.env.PORT || 4747}`, ws: true } },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.ts'] },
});
