import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      $modules: 'src/modules'
    },
    // Content-Security-Policy. `mode: 'auto'` lets SvelteKit hash its own inline bootstrap so
    // hydration still works under a strict script-src. style-src keeps 'unsafe-inline' because
    // Svelte sets inline `style=` attributes (e.g. lane CSS variables on charts).
    //
    // img-src used to be a blanket `https:`, which let any injected markup reach any host on the
    // internet — a working exfiltration channel for anything readable from the DOM, and the one
    // directive that undercut the rest of this policy. It is now the two origins actually used:
    // Google profile pictures, and CARTO basemap tiles for the activity maps (spec 055).
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'https://lh3.googleusercontent.com', 'https://*.basemaps.cartocdn.com'],
        'font-src': ['self'],
        'connect-src': ['self'],
        'base-uri': ['self'],
        'form-action': ['self'],
        'frame-ancestors': ['none'],
        'object-src': ['none']
      }
    }
  }
};

export default config;
