import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { storesQuery } from "@/lib/queries";
import { PageHeader } from "@/components/AppShell";
import { ExternalLink, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => ({ meta: [{ title: "Mapa — Preço Certo" }, { name: "description", content: "Supermercados cadastrados." }, { property: "og:title", content: "Mapa — Preço Certo" }, { property: "og:description", content: "Supermercados cadastrados." }] }),
  component: MapPage,
});

function MapPage() {
  const { data, isLoading } = useQuery(storesQuery());
  return (
    <>
      <PageHeader title="Mapa" subtitle="Supermercados cadastrados pela comunidade." />
      <p className="mb-4 rounded-lg bg-warning p-3 text-sm text-warning-foreground">O mapa interativo ainda não foi implementado. Por enquanto, veja a lista e abra a localização no mapa externo.</p>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum supermercado cadastrado ainda.</p>}
      <ul className="space-y-2">
        {data?.map((s) => {
          const q = s.latitude != null ? `${s.latitude},${s.longitude}` : `${s.address}, ${s.city}`;
          return (
            <li key={s.id} className="flex items-start gap-3 rounded-xl bg-card p-3 shadow-card">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.address}{s.neighborhood ? `, ${s.neighborhood}` : ""} · {s.city}{s.state ? `/${s.state}` : ""}</p>
              </div>
              <a className="text-primary" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer" aria-label="Abrir no mapa"><ExternalLink className="h-4 w-4" /></a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
