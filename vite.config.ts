import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 'base' is crucial for GitHub Pages.
  // Using './' works perfectly with HashRouter for relative asset loading.
  base: './',
  server: {
    port: 3000,
    host: true, // Allows access from network IP
  },
  build: {
    outDir: 'dist',
  }
});