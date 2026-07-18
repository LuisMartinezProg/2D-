import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/2D-/',
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
  build: {
    outDir: 'dist',
  },
  optimizeDeps: {
    // Los paquetes @mochigo/* son código fuente TS local del workspace,
    // no dependencias externas precompiladas — que Vite los procese
    // igual que el resto del código fuente, no como node_modules.
    exclude: [
      '@mochigo/math',
      '@mochigo/ecs',
      '@mochigo/events',
      '@mochigo/renderer',
      '@mochigo/assets',
      '@mochigo/scenes',
      '@mochigo/physics',
      '@mochigo/animation',
      '@mochigo/scripting',
    ],
  },
});
