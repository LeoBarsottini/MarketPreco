import "maplibre-gl/dist/maplibre-gl.css";

/** Shared MapLibre loader. Maps are initialized exclusively in the browser. */
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

let pending: Promise<MapLibreRuntime> | undefined;

/**
 * The npm module is split by the Vite bundler, cached per session and served
 * from this application's own origin. No runtime JS or CSS is injected from
 * a third-party CDN. Map styles/tiles remain externally hosted.
 */
export function loadMapLibre(): Promise<MapLibreRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mapa disponível apenas no navegador."));
  }
  if (!pending) {
    pending = import("maplibre-gl")
      .then((lib) => lib as unknown as MapLibreRuntime)
      .catch((error: unknown) => {
        pending = undefined;
        throw new Error("Não foi possível iniciar o mapa. Verifique a conexão.", { cause: error });
      });
  }
  return pending;
}
