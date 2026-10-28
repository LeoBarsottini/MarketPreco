import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Store, Package, Users, MessageSquareWarning, MapPinned, ChartColumnIncreasing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { ModerationPanel } from "@/components/ModerationPanel";
import { AdminStoresPanel, AdminProductsPanel } from "@/components/AdminCatalogPanels";
import { AdminMembersPanel } from "@/components/AdminMembersPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Administração — MarketPreço" },
    { name: "description", content: "Painel restrito de administração do MarketPreço." },
  ] }),
  component: AdminPage,
});

const cards = [
  { key: "stores_count", title: "Supermercados", icon: Store },
  { key: "products_count", title: "Produtos", icon: Package },
  { key: "contributors_count", title: "Contas", icon: Users },
  { key: "observations_count", title: "Registros de preço", icon: ChartColumnIncreasing },
  { key: "reports_pending", title: "Denúncias pendentes", icon: MessageSquareWarning },
  { key: "stores_without_coordinates", title: "Lojas sem marcador", icon: MapPinned },
] as const;

function AdminPage() {
  const { user } = Route.useRouteContext();
  const permission = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
    staleTime: 30_000,
  });
  const overview = useQuery({
    queryKey: ["admin-overview"],
    enabled: permission.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_overview");
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
    staleTime: 30_000,
  });

  const stats = overview.data;

  if (permission.isLoading) return <p role="status" className="text-sm text-muted-foreground">Verificando autorização administrativa…</p>;
  if (permission.isError) return <p role="alert" className="rounded-xl border p-5 text-sm text-destructive">Não foi possível verificar as permissões. Atualize a página e tente novamente.</p>;
  if (permission.data !== true) return (
    <section className="rounded-2xl border bg-card p-7" role="alert">
      <ShieldCheck className="mb-3 h-8 w-8 text-muted-foreground" />
      <h1 className="text-xl font-bold">Acesso restrito</h1>
      <p className="mt-2 text-sm text-muted-foreground">Somente administradores podem abrir esta área. Os dados e as alterações também são protegidos pelo banco.</p>
    </section>
  );

  return (
    <>
      <PageHeader title="Painel administrativo" subtitle="Gestão de preços colaborativos, lojas, produtos e permissões." />
      <div className="mb-6 rounded-2xl border border-[#cfe0f5] bg-[#edf5ff] p-4 text-[#12304f]">
        <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-5 w-5 text-[#075aab]" /> Acesso de administrador confirmado</p>
        <p className="mt-1 text-xs">As decisões sobre denúncias e alterações de moderadores são validadas no banco de dados.</p>
      </div>

      {overview.isLoading && <p role="status" className="mb-5 text-sm text-muted-foreground">Carregando indicadores…</p>}
      {overview.isError && <p role="alert" className="mb-5 text-sm text-destructive">Não foi possível consultar os indicadores administrativos.</p>}
      {stats && (
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Indicadores do MarketPreço">
          {cards.map(({ key, title, icon: Icon }) => (
            <div key={key} className="rounded-xl border bg-card p-4 shadow-card">
              <Icon className="mb-2 h-5 w-5 text-[#075aab]" aria-hidden="true" />
              <p className="text-2xl font-bold tabular-nums">{Number(stats[key]).toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{title}</p>
            </div>
          ))}
        </section>
      )}

      <Tabs defaultValue="denuncias" className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger value="denuncias" className="gap-1.5"><MessageSquareWarning className="h-4 w-4" /> Denúncias</TabsTrigger>
          <TabsTrigger value="lojas" className="gap-1.5"><Store className="h-4 w-4" /> Lojas</TabsTrigger>
          <TabsTrigger value="produtos" className="gap-1.5"><Package className="h-4 w-4" /> Produtos</TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-1.5"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
        </TabsList>
        <TabsContent value="denuncias" className="mt-3"><ModerationPanel userId={user.id} /></TabsContent>
        <TabsContent value="lojas" className="mt-3"><AdminStoresPanel /></TabsContent>
        <TabsContent value="produtos" className="mt-3"><AdminProductsPanel /></TabsContent>
        <TabsContent value="usuarios" className="mt-3"><AdminMembersPanel currentUserId={user.id} /></TabsContent>
      </Tabs>
    </>
  );
}
