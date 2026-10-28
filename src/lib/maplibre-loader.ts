/** Shared MapLibre loader. No map implementation is loaded during SSR. */
export interface MarketMap {
  remove: () => void;
  on: (event: "click", handler: (event: { lngLat: { lat: number; lng: number } }) => void) => void;
  addControl: (control: unknown) => void;
  fitBounds: (bounds: [[number, number], [number, number]], options: { padding: number; maxZoom: number }) => void;
  flyTo: (options: { center: [number, number]; zoom: number }) => void;
}

export interface MarketMarker {
  setLngLat: (coordinates: [number, number]) => MarketMarker;
  setPopup: (popup: unknown) => MarketMarker;
  addTo: (map: MarketMap) => MarketMarker;
  remove: () => void;
}
export interface MapLibreRuntime {
  Map: new (options: { container: HTMLElement; style: string; center: [number, number]; zoom: number }) => MarketMap;
  Marker: new (options: { color: string }) => MarketMarker;
  Popup: new (options: { offset: number }) => { setText: (text: string) => unknown };
  NavigationControl: new () => unknown;
}

declare global {
  interface Window {
    maplibregl?: MapLibreRuntime;
  }
}

const VERSION = "5.6.1";
const SCRIPT = `https://cdn.jsdelivr.net/npm/maplibre-gl@${VERSION}/dist/maplibre-gl.js`;
const CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${VERSION}/dist/maplibre-gl.css`;
const SCRIPT_ID = "marketpreco-maplibre";
const CSS_ID = "marketpreco-maplibre-css";
let pending: Promise<MapLibreRuntime> | undefined;

/**
 * Shared loader prevents a second third-party script from being injected when
 * both the store picker and general map are mounted. Error resets permit retry.
 * Note: external script execution still requires a local-bundle/SRI follow-up.
 */
export function loadMapLibre(): Promise<MapLibreRuntime> {
  if (typeof window === "undefined") return Promise.reject(new Error("Mapa disponível apenas no navegador."));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (pending) return pending;

  pending = new Promise<MapLibreRuntime>((resolve, reject) => {
    if (!document.getElementById(CSS_ID)) {
      const css = document.createElement("link");
      css.id = CSS_ID;
      css.rel = "stylesheet";
      css.href = CSS;
      css.referrerPolicy = "no-referrer";
      document.head.appendChild(css);
    }
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT;
      script.async = true;
      script.referrerPolicy = "no-referrer";
    }
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.removeEventListener("load", loaded);
      script.removeEventListener("error", failed);
      if (error) reject(error);
      else if (window.maplibregl) resolve(window.maplibregl);
      else reject(new Error("Biblioteca do mapa indisponível."));
    };
    const loaded = () => finish();
    const failed = () => finish(new Error("Não foi possível carregar o mapa."));
    const timeout = window.setTimeout(
      () => finish(new Error("O mapa demorou demais para carregar. Tente novamente.")), 15000,
    );
    script.addEventListener("load", loaded);
    script.addEventListener("error", failed);
    if (!existing) document.head.appendChild(script);
    if (window.maplibregl) finish();
  }).catch((error: unknown) => {
    pending = undefined;
    document.getElementById(SCRIPT_ID)?.remove();
    throw error;
  });
  return pending;
}
