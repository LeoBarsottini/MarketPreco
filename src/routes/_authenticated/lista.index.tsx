import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listsQuery } from "@/lib/queries";
import { computeTotals, formatBRL, parseDecimal } from "@/lib/money";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lista/")({
  head: () => ({ meta: [{ title: "Minhas listas — Preço Certo" }, { name: "description", content: "Suas listas de compras e histórico." }, { property: "og:title", content: "Minhas listas — Preço Certo" }, { property: "og:description", content: "Suas listas de compras e histórico." }] }),
  component: ListsPage,
});

function ListsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery(listsQuery());
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const b = budget.trim() ? parseDecimal(budget) : null;
      if (budget.trim() && b == null) throw new Error("Orçamento inválido.");
      const { error } = await supabase.from("shopping_lists").insert({ name: name.trim() || "Minha lista", budget: b });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setBudget(""); qc.invalidateQueries({ queryKey: ["lists"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const active = data?.filter((l) => l.status === "active") ?? [];
  const done = data?.filter((l) => l.status === "completed") ?? [];

  return (
    <>
      <PageHeader title="Minha Lista" subtitle="Listas privadas — só você vê." />
      <form className="mb-6 grid grid-cols-[1fr_7rem_auto] gap-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <Input placeholder="Nome da lista" value={name} onChange={(e) => setName(e.target.value)} />
        <Input inputMode="decimal" placeholder="Orçamento" value={budget} onChange={(e) => setBudget(e.target.value)} />
        <Button type="submit" disabled={create.isPending} aria-label="Criar lista"><Plus className="h-4 w-4" /></Button>
      </form>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {!isLoading && active.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma lista ativa. Crie a primeira acima.</p>}
      <div className="space-y-3">{active.map((l) => <ListCard key={l.id} l={l} />)}</div>
      {done.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 flex items-center gap-2 text-lg font-semibold"><History className="h-4 w-4" /> Histórico de compras</h2>
          <div className="space-y-3">{done.map((l) => <ListCard key={l.id} l={l} />)}</div>
        </>
      )}
    </>
  );
}

type L = NonNullable<ReturnType<typeof listsQuery>["queryFn"]> extends (...a: never[]) => Promise<infer R> ? R extends (infer X)[] ? X : never : never;

function ListCard({ l }: { l: L }) {
  const t = computeTotals(l.shopping_list_items.map((i) => ({ quantity: Number(i.quantity), unit_price: i.unit_price == null ? null : Number(i.unit_price) })), l.budget == null ? null : Number(l.budget));
  return (
    <Link to="/lista/$id" params={{ id: l.id }} className="block rounded-xl bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{l.name}</p>
          <p className="text-xs text-muted-foreground">
            {t.itemCount} {t.itemCount === 1 ? "item" : "itens"}
            {l.stores?.name ? ` · ${l.stores.name}` : ""}
            {l.completed_at ? ` · finalizada em ${new Date(l.completed_at).toLocaleDateString("pt-BR")}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular">{formatBRL(t.total)}</p>
          {t.missingCount > 0 && <p className="text-xs text-warning-foreground">{t.missingCount} sem preço</p>}
        </div>
      </div>
    </Link>
  );
}
