import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { isContentListFile, stripHiddenItems } from './lib/hiddenContent';

export default defineConfig({
  plugins: [
    react(),
    {
      // Hidden items stay in content/*.json (the edit mode reads them from GitHub)
      // but are dropped before bundling, so visitors never download them.
      name: 'strip-hidden-content',
      enforce: 'pre',
      transform(code, id) {
        return isContentListFile(id) ? stripHiddenItems(code) : null;
      },
    },
  ],
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