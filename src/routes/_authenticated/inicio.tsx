import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listsQuery, productLabel } from "@/lib/queries";
import { computeTotals, formatBRL } from "@/lib/money";
import { AddItemDialog } from "@/components/AddItemDialog";
import { ModerationPanel } from "@/components/ModerationPanel";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, ScanBarcode } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Início — MarketPreço" }, { name: "description", content: "Resumo das suas listas e preços registrados." }, { property: "og:title", content: "Início — MarketPreço" }, { property: "og:description", content: "Resumo das suas listas e preços registrados." }] }),
  component: Home,
});

function Home() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const lists = useQuery(listsQuery());
  const recent = useQuery({
    queryKey: ["my-observations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_observations")
        .select("id, price, observed_at, is_public, products(id, name, brand, package_size, package_unit), stores(name)")
        .order("observed_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });
  const active = lists.data?.filter((l) => l.status === "active") ?? [];

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Olá{user.user_metadata?.["display_name"] ? `, ${user.user_metadata["display_name"]}` : ""}</p>
          <h1 className="text-2xl font-bold">MarketPreço</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair"><LogOut className="h-4 w-4" /></Button>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Button size="lg" className="h-auto flex-col gap-1 py-4" onClick={() => setAdding(true)}><Plus className="h-5 w-5" /> Registrar preço</Button>
        <Button size="lg" variant="secondary" className="h-auto flex-col gap-1 py-4" asChild><Link to="/escanear"><ScanBarcode className="h-5 w-5" /> Escanear</Link></Button>
      </div>

      <h2 className="mb-2 font-semibold">Listas ativas</h2>
      {lists.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : active.length === 0 ? (
        <p className="mb-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhuma lista ativa. <Link to="/lista" className="text-primary underline">Criar lista</Link></p>
      ) : (
        <div className="mb-6 space-y-2">
          {active.slice(0, 3).map((l) => {
            const t = computeTotals(l.shopping_list_items.map((i) => ({ quantity: Number(i.quantity), unit_price: i.unit_price == null ? null : Number(i.unit_price) })), null);
            return (
              <Link key={l.id} to="/lista/$id" params={{ id: l.id }} className="flex justify-between rounded-xl bg-card p-3 shadow-card">
                <span className="font-medium">{l.name}<span className="block text-xs text-muted-foreground">{t.itemCount} itens{t.missingCount ? ` · ${t.missingCount} sem preço` : ""}</span></span>
                <span className="font-semibold tabular">{formatBRL(t.total)}</span>
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="mb-2 font-semibold">Seus últimos preços registrados</h2>
      {recent.data?.length === 0 && <p className="text-sm text-muted-foreground">Você ainda não registrou preços.</p>}
      <ul className="space-y-2">
        {recent.data?.map((o) => (
          <li key={o.id}>
            <Link to="/produto/$id" params={{ id: o.products!.id }} className="flex justify-between gap-2 rounded-xl bg-card p-3 shadow-card">
              <span className="min-w-0"><span className="block truncate font-medium">{o.products ? productLabel(o.products) : ""}</span><span className="text-xs text-muted-foreground">{o.stores?.name} · {new Date(o.observed_at).toLocaleDateString("pt-BR")} · {o.is_public ? "público" : "privado"}</span></span>
              <span className="font-semibold tabular">{formatBRL(Number(o.price))}</span>
            </Link>
          </li>
        ))}
      </ul>
      <ModerationPanel userId={user.id} />
      <AddItemDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}
