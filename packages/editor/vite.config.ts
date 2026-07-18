import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: '/2D-/' porque se publica en GitHub Pages bajo ese subpath
// (luismartinezprog.github.io/2D-/), no en la raíz del dominio.
export default defineConfig({
  plugins: [react()],
  base: '/2D-/',
  build: {
    outDir: 'dist',
  },
});
