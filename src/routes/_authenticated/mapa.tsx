import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { storesQuery, type Store } from "@/lib/queries";
import { PageHeader } from "@/components/AppShell";
import { ExternalLink, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => ({ meta: [
    { title: "Mapa — MarketPreço" },
    { name: "description", content: "Encontre unidades de supermercados cadastradas no mapa colaborativo." },
  ] }),
  component: MapPage,
});

type MapInstance = {
  remove: () => void;
  addControl: (control: unknown) => void;
  fitBounds: (bounds: [[number, number], [number, number]], options: { padding: number; maxZoom: number }) => void;
};
type MarkerInstance = { setLngLat: (coord: [number, number]) => MarkerInstance; setPopup: (popup: unknown) => MarkerInstance; addTo: (map: MapInstance) => MarkerInstance };
type MapLibreGlobal = {
  Map: new (options: { container: HTMLElement; style: string; center: [number, number]; zoom: number }) => MapInstance;
  Marker: new (options: { color: string }) => MarkerInstance;
  Popup: new (options: { offset: number }) => { setText: (text: string) => unknown };
  NavigationControl: new () => unknown;
};
declare global { interface Window { maplibregl?: MapLibreGlobal } }

const MAPLIBRE_VERSION = "5.6.1";
const SCRIPT_ID = "marketpreco-maplibre";
const CSS_ID = "marketpreco-maplibre-css";
let loading: Promise<MapLibreGlobal> | undefined;

function loadMapLibre(): Promise<MapLibreGlobal> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (loading) return loading;
  loading = new Promise<MapLibreGlobal>((resolve, reject) => {
    if (!document.getElementById(CSS_ID)) {
      const link = document.createElement("link");
      link.id = CSS_ID;
      link.rel = "stylesheet";
      link.href = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
    script.onload = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error("Biblioteca de mapa indisponível."));
    script.onerror = () => reject(new Error("Não foi possível carregar o mapa. Confira a conexão."));
    document.head.appendChild(script);
  }).catch((error: unknown) => { loading = undefined; document.getElementById(SCRIPT_ID)?.remove(); throw error; });
  return loading;
}

type LocatedStore = Store & { latitude: number; longitude: number };

function validCoords(store: Store): store is LocatedStore {
  return store.latitude != null && store.longitude != null &&
    Number.isFinite(store.latitude) && Number.isFinite(store.longitude) &&
    store.latitude >= -90 && store.latitude <= 90 && store.longitude >= -180 && store.longitude <= 180;
}

function StoreMap({ stores }: { stores: LocatedStore[] }) {
  const element = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!element.current || stores.length === 0) return;
    let cancelled = false;
    let map: MapInstance | undefined;
    loadMapLibre().then((lib) => {
      if (cancelled || !element.current) return;
      const first = stores[0]!;
      map = new lib.Map({
        container: element.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [first.longitude, first.latitude],
        zoom: 11,
      });
      map.addControl(new lib.NavigationControl());
      for (const store of stores) {
        const marker = new lib.Marker({ color: "#26777c" }).setLngLat([store.longitude, store.latitude]);
        const popup = new lib.Popup({ offset: 20 }).setText(`${store.name} — ${store.address}, ${store.city}`);
        marker.setPopup(popup).addTo(map);
      }
      if (stores.length > 1) {
        const lngs = stores.map((s) => s.longitude);
        const lats = stores.map((s) => s.latitude);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 42, maxZoom: 13 });
      }
    }).catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Mapa indisponível."); });
    return () => { cancelled = true; map?.remove(); };
  }, [stores]);

  return (
    <section aria-label="Mapa das unidades cadastradas" className="mb-5">
      {error && <p role="alert" className="mb-3 rounded-lg bg-warning p-3 text-sm text-warning-foreground">{error} A lista de endereços continua disponível abaixo.</p>}
      <div ref={element} className="h-[360px] w-full overflow-hidden rounded-xl border bg-muted sm:h-[480px]" />
      <p className="mt-2 text-xs text-muted-foreground">Marcadores exibem somente lojas com coordenadas cadastradas. Mapa por OpenFreeMap e OpenStreetMap.</p>
    </section>
  );
}

function MapPage() {
  const { data, isLoading, error } = useQuery(storesQuery());
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const text = search.trim().toLocaleLowerCase("pt-BR");
    return (data ?? []).filter((store) => !text || [store.name, store.chain, store.address, store.neighborhood, store.city, store.state]
      .some((field) => field?.toLocaleLowerCase("pt-BR").includes(text)));
  }, [data, search]);
  const located = useMemo(() => filtered.filter(validCoords), [filtered]);

  return (
    <>
      <PageHeader title="Mapa" subtitle="Unidades cadastradas pela comunidade." />
      <div className="relative mb-4">
        <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" aria-label="Pesquisar supermercados" placeholder="Buscar supermercado, bairro ou cidade" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {isLoading && <p className="mb-4 text-sm text-muted-foreground">Carregando supermercados…</p>}
      {error && <p role="alert" className="mb-4 text-sm text-destructive">Não foi possível carregar os supermercados.</p>}
      {located.length > 0 && <StoreMap stores={located} />}
      {!isLoading && !error && filtered.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum supermercado encontrado para esta pesquisa. Registre uma unidade durante a compra para colaborar.</p>}
      {filtered.length > 0 && <p className="mb-3 text-xs text-muted-foreground">{filtered.length} unidade(s) encontrada(s). {filtered.length - located.length} sem coordenadas no mapa.</p>}
      <ul className="space-y-2">
        {filtered.map((store) => {
          const query = validCoords(store) ? `${store.latitude},${store.longitude}` : `${store.address}, ${store.city}`;
          return (
            <li key={store.id} className="flex items-start gap-3 rounded-xl bg-card p-3 shadow-card">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{store.name}</p>
                <p className="text-xs text-muted-foreground">{store.address}{store.neighborhood ? `, ${store.neighborhood}` : ""} · {store.city}{store.state ? `/${store.state}` : ""}</p>
                {!validCoords(store) && <p className="text-xs text-warning-foreground">Sem localização precisa cadastrada</p>}
              </div>
              <a className="text-primary" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${store.name} no OpenStreetMap`}><ExternalLink className="h-4 w-4" /></a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
