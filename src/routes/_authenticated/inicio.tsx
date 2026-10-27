import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listsQuery, productLabel } from "@/lib/queries";
import { computeTotals, formatBRL } from "@/lib/money";
import { AddItemDialog } from "@/components/AddItemDialog";
import { ModerationPanel } from "@/components/ModerationPanel";
import { MODERATION_ENABLED } from "@/lib/feature-flags";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, ScanBarcode, MapPin, ListChecks, PackageSearch, Store, History, Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Início — MarketPreço" }, { name: "description", content: "Resumo das suas listas e preços registrados." }, { property: "og:title", content: "Início — MarketPreço" }, { property: "og:description", content: "Resumo das suas listas e preços registrados." }] }),
  component: Home,
});

function Home() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [search, setSearch] = useState("");
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
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error("Não foi possível sair da conta. Tente novamente.");
        return;
      }
      await qc.cancelQueries();
      qc.clear();
      await navigate({ to: "/auth", replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0d3977] via-[#09539b] to-[#064d90] px-5 py-9 text-white shadow-lg sm:px-9 sm:py-11">
        <span aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-60 w-60 rounded-full border-[55px] border-white/5" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full border-[55px] border-white/5" />
        <div className="relative">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm text-white/80">Olá{user.user_metadata?.["display_name"] ? `, ${user.user_metadata["display_name"]}` : ""}!</span>
            <Button variant="outline" size="sm" onClick={() => void signOut()} disabled={signingOut} className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <LogOut className="h-4 w-4" /> {signingOut ? "Saindo…" : "Sair"}
            </Button>
          </div>
          <h1 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl lg:text-[42px]">
            Encontre os melhores preços <span className="text-[#6be48a]">nos supermercados da sua região</span>
          </h1>
          <p className="mt-3 text-sm text-white/80 sm:text-base">Pesquise produtos, compare preços e economize na sua próxima compra.</p>
          <form className="relative mt-6 flex flex-col gap-2 rounded-xl bg-white p-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/mapa", search: { busca: search.trim() } }); }}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-[#46647f]" aria-hidden="true" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                aria-label="Pesquisar supermercado, bairro ou cidade"
                placeholder="Pesquisar supermercado, bairro ou cidade..."
                className="h-11 border-0 bg-white pl-10 text-[#12304f] shadow-none focus-visible:ring-0" />
            </div>
            <Button type="submit" className="h-11 rounded-lg bg-[#35b75e] px-8 font-bold text-white hover:bg-[#269e50]">Pesquisar</Button>
          </form>
        </div>
      </section>
      <section aria-label="Acessos rápidos" className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-[#12304f] dark:text-foreground">O que você quer fazer?</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {[
            { to: "/mapa" as const, label: "Mapa", caption: "Supermercados perto de você", icon: MapPin },
            { to: "/lista" as const, label: "Lista de compras", caption: "Organize seus produtos", icon: ListChecks },
            { to: "/escanear" as const, label: "Scanner", caption: "Ler código de barras", icon: ScanBarcode },
            { to: "/comparar" as const, label: "Comparar preços", caption: "Encontre oportunidades", icon: PackageSearch },
            { to: "/mapa" as const, label: "Supermercados", caption: "Ver unidades cadastradas", icon: Store },
            { to: "/lista" as const, label: "Histórico", caption: "Suas compras anteriores", icon: History },
          ].map(({ to, label, caption, icon: Icon }) => (
            <Link key={label} to={to} className="group relative min-h-44 rounded-2xl border border-[#dce8f5] bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-[#075aab]/40 hover:shadow-md">
              <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#e9f3ff] text-[#075aab] group-hover:bg-[#d9ebff]">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="block text-base font-bold text-[#12304f] dark:text-foreground">{label}</span>
              <span className="mt-2 block max-w-[15rem] text-sm text-muted-foreground">{caption}</span><ArrowRight className="absolute bottom-5 right-5 h-4 w-4 text-[#075aab]" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
      <div className="mb-7 grid grid-cols-2 gap-3">
        <Button className="h-14 gap-2 rounded-xl bg-[#075aab] hover:bg-[#064b92]" onClick={() => setAdding(true)}>
          <Plus className="h-5 w-5" /> Registrar preço
        </Button>
        <Button variant="outline" className="h-14 gap-2 rounded-xl border-[#ccdceb] text-[#075aab]" asChild>
          <Link to="/escanear"><ScanBarcode className="h-5 w-5" /> Escanear</Link>
        </Button>
      </div>
      <h2 className="mb-3 text-lg font-bold text-[#12304f] dark:text-foreground">Minhas listas ativas</h2>
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

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-lg font-bold text-[#12304f] dark:text-foreground">Últimos preços registrados <ArrowRight className="h-4 w-4 text-[#075aab]" /></h2>
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
      {MODERATION_ENABLED && <ModerationPanel userId={user.id} />}
      <AddItemDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}
