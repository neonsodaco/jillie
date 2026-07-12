import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['fonts/nunito-latin.woff2', 'icons/*.png'],
      manifest: {
        name: 'Jillie',
        short_name: 'Jillie',
        description: 'All your projects, all in one lovely place.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#FAF7F2',
        theme_color: '#FAF7F2',
        icons: [
          { src: 'icons/icon-192-v2.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512-v2.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        share_target: {
          action: './share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [{ name: 'images', accept: ['image/*'] }]
          }
        }
      } as any,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,woff2,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
  build: {
    target: 'es2020'
  }
});
