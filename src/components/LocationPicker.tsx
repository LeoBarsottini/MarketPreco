import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadMapLibre, type MarketMap, type MarketMarker, type MapLibreRuntime } from "@/lib/maplibre-loader";

export type ShopCoordinates = { lat: number; lng: number };

export function validShopCoordinates(value: ShopCoordinates | null): value is ShopCoordinates {
  return value !== null && Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
    Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
}

/** Mapa incorporado ao formulário: um toque escolhe a posição, sem redirecionamentos. */
export function LocationPicker({
  value, onChange,
}: {
  value: ShopCoordinates | null;
  onChange: (value: ShopCoordinates) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const mapRef = useRef<MarketMap | null>(null);
  const libraryRef = useRef<MapLibreRuntime | null>(null);
  const markerRef = useRef<MarketMarker | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let instance: MarketMap | null = null;
    void loadMapLibre().then((lib) => {
      if (cancelled || !holder.current) return;
      instance = new lib.Map({
        container: holder.current, style: "https://tiles.openfreemap.org/styles/liberty",
        center: validShopCoordinates(value) ? [value.lng, value.lat] : [-46.6333, -23.5505],
        zoom: validShopCoordinates(value) ? 16 : 10,
      });
      mapRef.current = instance;
      libraryRef.current = lib;
      instance.addControl(new lib.NavigationControl());
      if (validShopCoordinates(value)) markerRef.current = new lib.Marker({ color: "#075aab" })
        .setLngLat([value.lng, value.lat]).addTo(instance);
      instance.on("click", ({ lngLat }) => callback.current({
        lat: Number(lngLat.lat.toFixed(6)), lng: Number(lngLat.lng.toFixed(6)),
      }));
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Mapa indisponível.");
    });
    return () => { cancelled = true; markerRef.current?.remove(); markerRef.current = null; instance?.remove(); mapRef.current = null; libraryRef.current = null; };
    // Map lifecycle should not restart when a marker changes.
  }, []);

  useEffect(() => {
    if (!validShopCoordinates(value) || !mapRef.current) return;
    const lib = libraryRef.current;
    if (!lib) return;
    markerRef.current?.remove();
    markerRef.current = new lib.Marker({ color: "#075aab" })
      .setLngLat([value.lng, value.lat]).addTo(mapRef.current);
  }, [value?.lat, value?.lng]);

  function locate() {
    if (!navigator.geolocation) { setError("Localização não disponível neste navegador."); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        callback.current(next);
        mapRef.current?.flyTo({ center: [next.lng, next.lat], zoom: 16 });
        setError("");
      },
      () => setError("Não foi possível acessar a localização. Você pode tocar no mapa."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Localização da unidade no mapa</p>
        <Button type="button" size="sm" variant="outline" onClick={locate}><MapPin className="h-4 w-4" /> Estou na loja</Button>
      </div>
      <p className="text-xs text-muted-foreground">Toque no mapa para marcar a entrada do supermercado. Sua localização atual é opcional e nunca é enviada automaticamente.</p>
      <div ref={holder} aria-label="Mapa interativo para selecionar localização do supermercado" className="h-64 w-full overflow-hidden rounded-xl border bg-muted sm:h-72" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {validShopCoordinates(value)
          ? `Marcador selecionado: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}. Confira a posição antes de salvar.`
          : "Nenhum marcador selecionado. O supermercado poderá ser salvo sem coordenadas."}
      </p>
    </section>
  );
}
