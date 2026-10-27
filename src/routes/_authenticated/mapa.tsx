import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { storesQuery, productPricesQuery, productLabel, type Store, type Product } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { latestPricesByStore, priceDateLabel, type PriceAgeDays } from "@/lib/store-prices";
import { formatBRL } from "@/lib/money";
import { PageHeader } from "@/components/AppShell";
import { ExternalLink, MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PriceRow = Database["public"]["Functions"]["public_prices_for_product"]["Returns"][number];

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

function StoreMap({ stores, prices, productSelected }: { stores: LocatedStore[]; prices: ReadonlyMap<string, PriceRow>; productSelected: boolean }) {
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
        const price = prices.get(store.id);
        const marker = new lib.Marker({ color: !productSelected || price ? "#26777c" : "#94a3b8" }).setLngLat([store.longitude, store.latitude]);
        const description = !productSelected
          ? `${store.name} — ${store.address}, ${store.city}`
          : price
          ? `${store.name} — ${store.address}, ${store.city} — ${formatBRL(Number(price.price))} em ${priceDateLabel(price.observed_at)} (preço colaborativo, não auditado)`
          : `${store.name} — ${store.address}, ${store.city} — sem preço registrado para o produto selecionado`;
        const popup = new lib.Popup({ offset: 20 }).setText(description);
        marker.setPopup(popup).addTo(map);
      }
      if (stores.length > 1) {
        const lngs = stores.map((s) => s.longitude);
        const lats = stores.map((s) => s.latitude);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 42, maxZoom: 13 });
      }
    }).catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Mapa indisponível."); });
    return () => { cancelled = true; map?.remove(); };
  }, [stores, prices, productSelected]);

  return (
    <section aria-label="Mapa das unidades cadastradas" className="mb-5">
      {error && <p role="alert" className="mb-3 rounded-lg bg-warning p-3 text-sm text-warning-foreground">{error} A lista de endereços continua disponível abaixo.</p>}
      <div ref={element} className="h-[360px] w-full overflow-hidden rounded-xl border bg-muted sm:h-[480px]" />
      <p className="mt-2 text-xs text-muted-foreground">Quando um produto é selecionado: verde indica preço registrado e cinza indica falta de preço no período. Só lojas com coordenadas aparecem no mapa. Dados cartográficos: OpenFreeMap/OpenStreetMap.</p>
    </section>
  );
}

type ProductOption = Pick<Product, "id" | "name" | "brand" | "package_size" | "package_unit" | "barcode">;

function MapPage() {
  const stores = useQuery(storesQuery());
  const [storeSearch, setStoreSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [period, setPeriod] = useState<PriceAgeDays>(30);
  const [onlyWithPrice, setOnlyWithPrice] = useState(false);

  const productMatches = useQuery({
    queryKey: ["map-product-search", productSearch.trim()],
    enabled: !selectedProduct && productSearch.trim().length >= 2,
    queryFn: async () => {
      // Remove caracteres especiais dos filtros PostgREST.
      const query = productSearch.trim().replace(/[^a-zA-Z0-9À-ÿ -]/g, " ").slice(0, 60).trim();
      if (query.length < 2) return [] as ProductOption[];
      const predicates = [
        `name.ilike.%${query}%`,
        `brand.ilike.%${query}%`,
      ];
      if (/^\d{8,14}$/.test(query)) predicates.push(`barcode.eq.${query}`);
      const { data, error } = await supabase.from("products")
        .select("id, name, brand, package_size, package_unit, barcode")
        .or(predicates.join(","))
        .order("name")
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const pricesQuery = useQuery({
    ...productPricesQuery(selectedProduct?.id ?? ""),
    enabled: selectedProduct !== null,
  });
  const pricesByStore = useMemo(
    () => latestPricesByStore(pricesQuery.data ?? [], period),
    [pricesQuery.data, period],
  );
  const filteredStores = useMemo(() => {
    const term = storeSearch.trim().toLocaleLowerCase("pt-BR");
    return (stores.data ?? []).filter((store) =>
      (!term || [store.name, store.chain, store.address, store.neighborhood, store.city, store.state]
        .some((field) => field?.toLocaleLowerCase("pt-BR").includes(term))) &&
      (!selectedProduct || !onlyWithPrice || pricesByStore.has(store.id)),
    );
  }, [stores.data, storeSearch, selectedProduct, onlyWithPrice, pricesByStore]);
  const locatedStores = useMemo(() => filteredStores.filter(validCoords), [filteredStores]);

  function clearProduct() {
    setProductSearch("");
    setSelectedProduct(null);
    setOnlyWithPrice(false);
  }

  return (
    <>
      <PageHeader title="Mapa" subtitle="Supermercados cadastrados e preços informados pela comunidade." />
      <div className="space-y-4">
        <section className="rounded-xl border bg-card p-4">
          <label htmlFor="map-product-search" className="mb-2 block text-sm font-semibold">Qual produto deseja consultar?</label>
          <div className="flex gap-2">
            <Input
              id="map-product-search"
              value={productSearch}
              onChange={(event) => { setProductSearch(event.target.value); setSelectedProduct(null); }}
              placeholder="Nome, marca ou código de barras"
              aria-label="Pesquisar produto"
            />
            {selectedProduct && (
              <Button variant="outline" size="icon" onClick={clearProduct} aria-label="Limpar produto">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {!selectedProduct && productSearch.trim().length >= 2 && (
            <div className="mt-2">
              {productMatches.isLoading && <p className="text-sm text-muted-foreground">Buscando produtos…</p>}
              {productMatches.isError && <p role="alert" className="text-sm text-destructive">Não foi possível buscar os produtos.</p>}
              {productMatches.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto cadastrado com esse nome ou código.</p>}
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {productMatches.data?.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedProduct(product); setProductSearch(productLabel(product)); }}
                      className="w-full rounded-md border p-3 text-left text-sm hover:bg-muted"
                    >
                      {productLabel(product)}
                      {product.barcode && <span className="block text-xs text-muted-foreground">{product.barcode}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedProduct && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <label htmlFor="price-period" className="text-sm font-medium">Registros dos últimos</label>
              <select
                id="price-period"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={period}
                onChange={(event) => setPeriod(Number(event.target.value) as PriceAgeDays)}
              >
                <option value={7}>7 dias</option>
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
                <option value={0}>Todo o histórico disponível</option>
              </select>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={onlyWithPrice}
                  onChange={(event) => setOnlyWithPrice(event.target.checked)}
                />
                Mostrar somente supermercados com preço registrado no período
              </label>
            </div>
          )}
          {selectedProduct && (
            <p className="mt-3 text-xs text-muted-foreground">
              Preços colaborativos informados por usuários, sem verificação independente. Não são ofertas garantidas e podem mudar na loja.
            </p>
          )}
        </section>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-9"
            value={storeSearch}
            onChange={(event) => setStoreSearch(event.target.value)}
            aria-label="Pesquisar supermercados"
            placeholder="Filtrar supermercado, bairro ou cidade"
          />
        </div>
      </div>

      {stores.isLoading && <p className="my-4 text-sm text-muted-foreground">Carregando supermercados…</p>}
      {stores.error && <p role="alert" className="my-4 text-sm text-destructive">Não foi possível carregar as unidades.</p>}
      {pricesQuery.isLoading && <p className="my-4 text-sm text-muted-foreground">Consultando preços do produto…</p>}
      {pricesQuery.error && <p role="alert" className="my-4 text-sm text-destructive">Não foi possível consultar os preços. Tente novamente.</p>}

      {locatedStores.length > 0 && (
        <StoreMap stores={locatedStores} prices={pricesByStore} productSelected={selectedProduct !== null} />
      )}
      {!stores.isLoading && !stores.error && locatedStores.length === 0 && filteredStores.length > 0 && (
        <p className="my-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          As unidades encontradas ainda não têm coordenadas cadastradas, mas seus endereços estão listados abaixo.
        </p>
      )}
      {!stores.isLoading && !stores.error && filteredStores.length === 0 && !pricesQuery.isLoading && (
        <p className="my-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Nenhum supermercado corresponde aos filtros escolhidos. Não existem preços suficientes para comparar essas unidades.
        </p>
      )}

      {filteredStores.length > 0 && (
        <p className="my-3 text-sm text-muted-foreground">
          {filteredStores.length} unidade(s) encontrada(s); {filteredStores.length - locatedStores.length} sem coordenadas.
        </p>
      )}
      <ul className="space-y-2">
        {filteredStores.map((store) => {
          const observation = selectedProduct ? pricesByStore.get(store.id) : undefined;
          const addressQuery = validCoords(store)
            ? `${store.latitude},${store.longitude}`
            : `${store.address}, ${store.city}, ${store.state ?? ""}`;
          return (
            <li key={store.id} className="flex items-start gap-3 rounded-xl bg-card p-3 shadow-card">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{store.name}</p>
                <p className="text-xs text-muted-foreground">
                  {store.address}{store.neighborhood ? `, ${store.neighborhood}` : ""} · {store.city}{store.state ? `/${store.state}` : ""}
                </p>
                {observation && (
                  <p className="mt-2 text-sm">
                    <strong className="text-primary">{formatBRL(Number(observation.price))}</strong>
                    <span className="block text-xs text-muted-foreground">
                      Visto em {priceDateLabel(observation.observed_at)} · {observation.is_mine ? "Seu registro" : "Registro comunitário"} · não auditado
                    </span>
                  </p>
                )}
                {selectedProduct && !observation && !pricesQuery.isLoading && (
                  <p className="mt-1 text-xs text-muted-foreground">Sem preço registrado neste período.</p>
                )}
                {!validCoords(store) && <p className="text-xs text-warning-foreground">Sem coordenadas cadastradas</p>}
              </div>
              <a
                className="shrink-0 text-primary"
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(addressQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${store.name} no OpenStreetMap`}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
