import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { contentPlugin } from './src/compiler/vite-plugin.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Project Pages lives under /Who-Am-I-/. Override with BASE_PATH=/ for a custom domain.
const base = process.env.BASE_PATH ?? '/Who-Am-I-/';

/**
 * Content Security Policy for production builds. The app talks to nothing but its own origin, so
 * "your answers never leave this device" is enforced by the browser, not just promised.
 * (Only in builds: the dev server needs inline scripts and websockets.)
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'whoami-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      ),
  };
}

export default defineConfig({
  base,
  plugins: [
    contentPlugin(),
    svelte(),
    VitePWA({
      // Updates wait for the user (never mid-question); see src/app/pwa.svelte.ts.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Who Am I',
        short_name: 'Who Am I',
        description: 'Find out where you stand: personality, values, beliefs and interests. Everything stays on your device.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f6f3',
        theme_color: '#f7f6f3',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        // Hash routing: every navigation is index.html.
        navigateFallback: 'index.html',
      },
    }),
    contentSecurityPolicy(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
