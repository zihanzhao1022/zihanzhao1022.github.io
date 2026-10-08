import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { isContentListFile, stripHiddenItems } from './lib/hiddenContent';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      // Hidden items stay in content/*.json (the edit mode reads them from GitHub)
      // but are dropped before bundling, so visitors never download them.
      // `npm run dev:mock` keeps them: its fake owner reads the bundled content instead of GitHub.
      name: 'strip-hidden-content',
      enforce: 'pre' as const,
      transform(code: string, id: string) {
        return mode !== 'mock' && isContentListFile(id) ? stripHiddenItems(code) : null;
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
  },
}));
