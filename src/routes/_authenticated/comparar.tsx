import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listsQuery, productLabel } from "@/lib/queries";
import { compareStores, type StorePrice } from "@/lib/compare";
import { formatBRL } from "@/lib/money";
import { PageHeader } from "@/components/AppShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/comparar")({
  head: () => ({ meta: [{ title: "Comparar — MarketPreço" }, { name: "description", content: "Compare o custo da sua lista entre supermercados." }, { property: "og:title", content: "Comparar — MarketPreço" }, { property: "og:description", content: "Compare o custo da sua lista entre supermercados." }] }),
  component: ComparePage,
});

function ComparePage() {
  const lists = useQuery(listsQuery());
  const [listId, setListId] = useState<string>();

  const result = useQuery({
    queryKey: ["compare", listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data: items, error } = await supabase.from("shopping_list_items").select("product_id, quantity, products(name, brand, package_size, package_unit)").eq("list_id", listId!);
      if (error) throw error;
      // merge duplicate products in the list
      const merged = new Map<string, { product_id: string; quantity: number; label: string }>();
      for (const i of items) {
        const m = merged.get(i.product_id);
        if (m) m.quantity += Number(i.quantity);
        else merged.set(i.product_id, { product_id: i.product_id, quantity: Number(i.quantity), label: i.products ? productLabel(i.products) : "" });
      }
      const prices: Record<string, StorePrice[]> = {};
      await Promise.all([...merged.keys()].map(async (pid) => {
        const { data, error } = await supabase.rpc("public_prices_for_product", { _product_id: pid });
        if (error) throw error;
        prices[pid] = data.map((d) => ({ store_id: d.store_id, store_name: d.store_name, price: Number(d.price), observed_at: d.observed_at }));
      }));
      const list = [...merged.values()];
      return { rows: compareStores(list, prices), labels: Object.fromEntries(list.map((l) => [l.product_id, l.label])) };
    },
  });

  return (
    <>
      <PageHeader title="Comparar" subtitle="Custo da lista por supermercado, só com produtos idênticos." />
      <Select value={listId} onValueChange={setListId}>
        <SelectTrigger><SelectValue placeholder="Escolha uma lista" /></SelectTrigger>
        <SelectContent>{lists.data?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
      </Select>
      <p className="mt-3 text-xs text-muted-foreground">Usa o último preço conhecido (seu ou público) de cada produto em cada loja. Itens sem preço na loja não são somados — confira a cobertura antes de comparar totais.</p>
      {result.isLoading && <p className="mt-4 text-sm text-muted-foreground">Calculando…</p>}
      {result.data?.rows.length === 0 && <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum preço registrado para os produtos desta lista.</p>}
      <ul className="mt-4 space-y-3">
        {result.data?.rows.map((r) => (
          <li key={r.store_id} className="rounded-xl bg-card p-4 shadow-card">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{r.store_name}</span>
              <span className="font-semibold tabular">{formatBRL(r.total)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Cobertura: {r.covered} de {r.totalItems} produtos</p>
            <Progress value={r.coverage * 100} className="mt-1 h-1.5" />
            {r.missingProductIds.length > 0 && (
              <p className="mt-2 text-xs text-warning-foreground">Sem preço: {r.missingProductIds.map((id) => result.data!.labels[id]).join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
