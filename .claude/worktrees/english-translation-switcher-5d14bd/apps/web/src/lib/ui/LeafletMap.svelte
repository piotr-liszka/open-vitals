<script lang="ts">
  /**
   * Shared SSR-safe Leaflet map (spec 015). Renders GPS polylines (a single route, or thousands of
   * faint overlaid tracks for a heatmap) plus optional vector markers, over a theme-matched tile
   * layer. Leaflet is BUNDLED (npm, not a CDN) so it satisfies the strict `script-src 'self'` CSP;
   * CARTO raster tiles load as `<img>` under the `img-src https://*.basemaps.cartocdn.com` allowance
   * in svelte.config.js — narrowed from a blanket `https:` in spec 055, so CHANGING THE TILE HOST
   * BELOW ALSO MEANS CHANGING THAT DIRECTIVE. No default marker images are used (vector
   * CircleMarkers only), so nothing else needs unblocking.
   *
   * The basemap follows the active theme, and keeps following it when the theme is toggled at runtime
   * (spec 051). It used to be `dark_all` unconditionally, which put a near-black map inside the white
   * cards of the light theme.
   *
   * Import directly (`$lib/ui/LeafletMap.svelte`) — it is intentionally NOT in the lib/ui barrel to
   * keep Leaflet out of SSR bundles for pages that don't use a map.
   */

  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();
  import { onMount } from 'svelte';

  export interface MapPolyline {
    points: Array<[number, number] | [number, number, number]>;
    color?: string;
    weight?: number;
    opacity?: number;
  }
  export interface MapMarker {
    lat: number;
    lng: number;
    color?: string;
    radius?: number;
  }

  interface Props {
    polylines?: MapPolyline[];
    markers?: MapMarker[];
    /** Disable pan/zoom for static thumbnails. */
    interactive?: boolean;
    /** CSS height (thumbnails vs full page). */
    height?: string;
    ariaLabel?: string;
  }

  let {
    polylines = [],
    markers = [],
    interactive = true,
    height = '360px',
    ariaLabel = i18n.t('ui.mapLabel')
  }: Props = $props();

  let el: HTMLDivElement;
  // Leaflet's runtime types aren't loaded at module scope (dynamic import), so a narrow local any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let map: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let L: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let layer: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tiles: any = null;

  /** Fallbacks for environments with no computed styles (SSR/jsdom): magenta-500 and white. */
  const ACCENT_FALLBACK = '#ff2f9e';
  const SURFACE_FALLBACK = '#ffffff';

  /**
   * CARTO basemaps, one per theme. A route is drawn in the accent over a low-chroma ground, so the
   * ground has to sit on the same side of the surface it lives in — a dark map inside a white card
   * reads as a hole, not as a map.
   */
  const TILES = {
    light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  } as const;

  function tileUrl(): string {
    if (typeof document === 'undefined') return TILES.light;
    return document.documentElement.dataset.theme === 'dark' ? TILES.dark : TILES.light;
  }

  onMount(() => {
    let disposed = false;
    (async () => {
      const leaflet = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (disposed) return;
      L = leaflet.default ?? leaflet;
      map = L.map(el, {
        zoomControl: interactive,
        attributionControl: true,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        touchZoom: interactive
      });
      tiles = L.tileLayer(tileUrl(), {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);
      draw();
    })();

    /*
      `ThemeToggle` flips `data-theme` on <html> in place — no reload — so a mounted map would keep
      the basemap and route colour of the theme it happened to open in. Watch the one attribute and
      swap both; `getComputedStyle` inside `draw()` re-resolves the tokens for the new theme.
    */
    const observer =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            if (!tiles) return;
            tiles.setUrl(tileUrl());
            draw();
          });
    observer?.observe(document.documentElement, { attributeFilter: ['data-theme'] });

    return () => {
      disposed = true;
      observer?.disconnect();
      if (map) map.remove();
      map = null;
      tiles = null;
    };
  });

  function draw(): void {
    if (!map || !L) return;
    if (layer) layer.remove();
    layer = L.layerGroup().addTo(map);

    const resolvedAccent = readAccent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bounds: any[] = [];
    for (const pl of polylines) {
      if (!pl.points || pl.points.length === 0) continue;
      const latlngs = pl.points.map((p) => [p[0], p[1]] as [number, number]);
      L.polyline(latlngs, {
        color: pl.color ?? resolvedAccent,
        weight: pl.weight ?? 3,
        opacity: pl.opacity ?? 0.9,
        lineJoin: 'round'
      }).addTo(layer);
      for (const ll of latlngs) bounds.push(ll);
    }
    // The ring is the card's own surface, so a marker keeps its halo on either basemap.
    const ring = readVar('--color-surface', SURFACE_FALLBACK);
    for (const m of markers) {
      L.circleMarker([m.lat, m.lng], {
        radius: m.radius ?? 6,
        color: ring,
        weight: 2,
        fillColor: m.color ?? resolvedAccent,
        fillOpacity: 1
      }).addTo(layer);
      bounds.push([m.lat, m.lng]);
    }
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [16, 16] });
    } else {
      map.setView([50.02, 8.34], 5); // neutral fallback view
    }
  }

  /** Resolve a design token to a concrete color Leaflet's canvas can use. */
  function readVar(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /**
   * The route colour: the accent, not a metric lane — a route is the product's own mark on the map,
   * not a data series (spec 051, which retired the `--lane-orange` default).
   */
  function readAccent(): string {
    return readVar('--color-accent', ACCENT_FALLBACK);
  }

  // Redraw when inputs change after mount.
  $effect(() => {
    void polylines;
    void markers;
    if (map) draw();
  });
</script>

<div bind:this={el} class="map" style="height: {height};" role="img" aria-label={ariaLabel}></div>

<style>
  .map {
    width: 100%;
    border-radius: var(--radius-lg);
    overflow: hidden;
    /*
      Leaflet gives its panes and controls z-index 200–800, resolved against the nearest stacking
      context. Without one here that is the ROOT context, so a route thumbnail (and its attribution
      strip) painted straight over the app chrome — most visibly over the mobile nav drawer
      (spec 034). `isolation` makes this frame the stacking context, so everything Leaflet draws
      stays inside the card, whatever it does with z-index.
    */
    isolation: isolate;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
  }
  /* Leaflet paints tiles/controls into nested divs; keep them inside the rounded frame. */
  .map :global(.leaflet-container) {
    background: var(--color-surface-2);
    font-family: var(--font-sans);
  }
  .map :global(.leaflet-control-attribution) {
    background: color-mix(in srgb, var(--color-surface) 70%, transparent);
    color: var(--color-text-muted);
    font-size: 10px;
  }
</style>
