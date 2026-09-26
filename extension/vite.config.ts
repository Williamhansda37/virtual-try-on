import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'extension-builder-plugin',
      generateBundle() {
        // Emit manifest.json into dist
        const manifestPath = path.resolve(import.meta.dirname, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
          this.emitFile({
            type: 'asset',
            fileName: 'manifest.json',
            source: manifestContent,
          });
        }
      },
      closeBundle() {
        const distDir = path.resolve(import.meta.dirname, 'dist');
        const rootDir = import.meta.dirname;

        // Process popup HTML from dist/src/popup/index.html
        const rawPopupPath = path.join(distDir, 'src/popup/index.html');
        if (fs.existsSync(rawPopupPath)) {
          let popupHtml = fs.readFileSync(rawPopupPath, 'utf-8');
          // Adjust relative assets path from ../../assets/ to ./assets/
          popupHtml = popupHtml.replace(/\.\.\/\.\.\/assets\//g, './assets/');

          // Write compiled popup.html to dist/
          fs.writeFileSync(path.join(distDir, 'popup.html'), popupHtml, 'utf-8');
          // Write compiled popup.html to extension root
          fs.writeFileSync(path.join(rootDir, 'popup.html'), popupHtml, 'utf-8');

          // Clean up dist/src intermediate folder
          fs.rmSync(path.join(distDir, 'src'), { recursive: true, force: true });
        }

        // Sync compiled background.js and content.js to extension root
        const filesToSync = ['background.js', 'content.js'];
        for (const file of filesToSync) {
          const srcFile = path.join(distDir, file);
          const destFile = path.join(rootDir, file);
          if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, destFile);
          }
        }

        // Sync assets directory to extension root
        const srcAssets = path.join(distDir, 'assets');
        const destAssets = path.join(rootDir, 'assets');
        if (fs.existsSync(srcAssets)) {
          fs.cpSync(srcAssets, destAssets, { recursive: true });
        }
      },
    },
  ],
  base: '',
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, '../shared'),
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(import.meta.dirname, 'src/popup/index.html'),
        background: path.resolve(import.meta.dirname, 'src/background/service-worker.ts'),
        content: path.resolve(import.meta.dirname, 'src/content/content-script.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content.js';
          }
          return 'assets/[name].js';
        },
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
