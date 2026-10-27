import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productLabel, productPricesQuery } from "@/lib/queries";
import { formatBRL } from "@/lib/money";
import { AddItemDialog } from "@/components/AddItemDialog";
import { PriceHistory } from "@/components/PriceHistory";
import { PriceReportDialog } from "@/components/PriceReportDialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/produto/$id")({
  head: () => ({ meta: [{ title: "Produto — MarketPreço" }, { name: "description", content: "Preços deste produto por supermercado." }, { property: "og:title", content: "Produto — MarketPreço" }, { property: "og:description", content: "Preços deste produto por supermercado." }] }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const [adding, setAdding] = useState(false);
  const [reportedObservationId, setReportedObservationId] = useState<string | null>(null);
  const product = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const prices = useQuery(productPricesQuery(id));
  // Uma loja pode ter várias observações: mostre a mais recente, não a mais barata antiga.
  const latestByStore = new Map<string, NonNullable<typeof prices.data>[number]>();
  for (const observation of prices.data ?? []) {
    const previous = latestByStore.get(observation.store_id);
    if (!previous || observation.observed_at > previous.observed_at) {
      latestByStore.set(observation.store_id, observation);
    }
  }
  const sorted = [...latestByStore.values()].sort((a, b) => Number(a.price) - Number(b.price));

  if (product.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!product.data) return <p className="text-sm text-destructive">Produto não encontrado.</p>;

  return (
    <>
      <Link to="/inicio" className="mb-3 inline-flex items-center text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> Início</Link>
      <h1 className="text-2xl font-bold">{productLabel(product.data)}</h1>
      {product.data.barcode && <p className="text-sm text-muted-foreground tabular">EAN {product.data.barcode}</p>}
      <Button className="my-5 w-full" size="lg" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Registrar preço e adicionar à lista</Button>

      <h2 className="mb-1 font-semibold">Último preço conhecido por supermercado</h2>
      <p className="mb-3 text-xs text-muted-foreground">Inclui seus registros e os compartilhados publicamente. Lojas sem registro não aparecem. Os valores podem estar desatualizados.</p>
      {prices.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {sorted.length === 0 && !prices.isLoading && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum preço registrado para este produto.</p>}
      <ul className="space-y-2">
        {sorted.map((p) => (
          <li key={p.observation_id} className="flex items-start justify-between gap-3 rounded-xl bg-card p-3 shadow-card">
            <span className="min-w-0">
              <span className="block font-medium">{p.store_name}</span>
              <span className="text-xs text-muted-foreground">{p.store_city} · {new Date(p.observed_at).toLocaleDateString("pt-BR")}{p.is_mine ? " · seu registro" : ""}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-semibold tabular">{formatBRL(Number(p.price))}</span>
              {!p.is_mine && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setReportedObservationId(p.observation_id)}
                  aria-label={`Denunciar preço do supermercado ${p.store_name}`}
                >
                  Denunciar preço
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <PriceHistory productId={id} />
      <PriceReportDialog observationId={reportedObservationId} onClose={() => setReportedObservationId(null)} />
      <AddItemDialog open={adding} onOpenChange={setAdding} initialProduct={product.data} />
    </>
  );
}
