import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productLabel, productPricesQuery } from "@/lib/queries";
import { formatBRL } from "@/lib/money";
import { AddItemDialog } from "@/components/AddItemDialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/produto/$id")({
  head: () => ({ meta: [{ title: "Produto — Preço Certo" }, { name: "description", content: "Preços deste produto por supermercado." }, { property: "og:title", content: "Produto — Preço Certo" }, { property: "og:description", content: "Preços deste produto por supermercado." }] }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const [adding, setAdding] = useState(false);
  const product = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const prices = useQuery(productPricesQuery(id));
  const sorted = [...(prices.data ?? [])].sort((a, b) => Number(a.price) - Number(b.price));

  if (product.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!product.data) return <p className="text-sm text-destructive">Produto não encontrado.</p>;

  return (
    <>
      <Link to="/inicio" className="mb-3 inline-flex items-center text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> Início</Link>
      <h1 className="text-2xl font-bold">{productLabel(product.data)}</h1>
      {product.data.barcode && <p className="text-sm text-muted-foreground tabular">EAN {product.data.barcode}</p>}
      <Button className="my-5 w-full" size="lg" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Registrar preço e adicionar à lista</Button>

      <h2 className="mb-1 font-semibold">Último preço por supermercado</h2>
      <p className="mb-3 text-xs text-muted-foreground">Inclui seus registros e os compartilhados publicamente. Lojas sem registro não aparecem.</p>
      {prices.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {sorted.length === 0 && !prices.isLoading && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum preço registrado para este produto.</p>}
      <ul className="space-y-2">
        {sorted.map((p) => (
          <li key={p.observation_id} className="flex justify-between rounded-xl bg-card p-3 shadow-card">
            <span><span className="block font-medium">{p.store_name}</span><span className="text-xs text-muted-foreground">{p.store_city} · {new Date(p.observed_at).toLocaleDateString("pt-BR")}{p.is_mine ? " · seu registro" : ""}</span></span>
            <span className="font-semibold tabular">{formatBRL(Number(p.price))}</span>
          </li>
        ))}
      </ul>
      <AddItemDialog open={adding} onOpenChange={setAdding} initialProduct={product.data} />
    </>
  );
}
