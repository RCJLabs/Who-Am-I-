import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // Project Pages lives under /Who-Am-I-/. Override with BASE_PATH=/ for a custom domain.
  base: process.env.BASE_PATH ?? '/Who-Am-I-/',
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
