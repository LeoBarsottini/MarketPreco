import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));
vi.mock("@/components/ModerationPanel", () => ({
  ModerationPanel: () => <div>Painel de denúncias simulado</div>,
}));
vi.mock("@/components/AdminCatalogPanels", () => ({
  AdminStoresPanel: () => <div>Supermercados simulados</div>,
  AdminProductsPanel: () => <div>Produtos simulados</div>,
}));
vi.mock("@/components/AdminMembersPanel", () => ({
  AdminMembersPanel: () => <div>Usuários simulados</div>,
}));

import { AdminConsole } from "@/routes/_authenticated/admin";

function renderConsole() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminConsole userId="11111111-1111-4111-8111-111111111111" />
    </QueryClientProvider>,
  );
}

beforeEach(() => { mocks.rpc.mockReset(); });
afterEach(() => { cleanup(); });

describe("Painel administrativo: proteção da interface", () => {
  it("bloqueia usuário comum sem buscar indicadores ou montar a área privada", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    renderConsole();
    expect(await screen.findByText("Acesso restrito")).toBeInTheDocument();
    expect(screen.queryByText("Painel administrativo")).not.toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("has_role", expect.objectContaining({ _role: "admin" }));
  });

  it("exibe erro de permissão sem renderizar o painel se a verificação falhar", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Serviço indisponível") });
    renderConsole();
    expect(await screen.findByText(/Não foi possível verificar as permissões/)).toBeInTheDocument();
    expect(screen.queryByText("Painel administrativo")).not.toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("mostra dados reais da resposta RPC e as quatro áreas somente a administrador", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "has_role") return { data: true, error: null };
      if (name === "admin_dashboard_overview") return {
        data: [{
          stores_count: 12, products_count: 43, contributors_count: 7,
          observations_count: 128, reports_pending: 2, stores_without_coordinates: 3,
        }],
        error: null,
      };
      throw new Error("RPC não esperada: " + name);
    });
    renderConsole();
    expect(await screen.findByText("Painel administrativo")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Indicadores do MarketPreço")).toBeInTheDocument();
    });
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Denúncias/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Lojas/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Produtos/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Usuários/ })).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith("admin_dashboard_overview");
  });

  it("mantém a área autorizada disponível mesmo quando indicadores estão indisponíveis", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "has_role"
      ? { data: true, error: null }
      : { data: null, error: new Error("Serviço de métricas indisponível") });
    renderConsole();
    expect(await screen.findByText("Painel administrativo")).toBeInTheDocument();
    expect(await screen.findByText(/Não foi possível consultar os indicadores/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Denúncias/ })).toBeInTheDocument();
  });
});
