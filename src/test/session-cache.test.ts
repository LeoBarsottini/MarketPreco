import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createSessionCacheGuard } from "@/lib/session-cache";

const session = (id: string) => ({ user: { id } });

describe("Isolamento do cache entre contas", () => {
  it("apaga consultas privadas ao trocar da conta A para B", () => {
    const cache = new QueryClient();
    const invalidateRouter = vi.fn();
    const handle = createSessionCacheGuard(cache, invalidateRouter);

    handle("INITIAL_SESSION", session("conta-a"));
    cache.setQueryData(["list", "compras-da-conta-a"], { budget: 999, item: "privado" });
    expect(cache.getQueryData(["list", "compras-da-conta-a"])).toBeTruthy();

    handle("SIGNED_IN", session("conta-b"));
    expect(cache.getQueryData(["list", "compras-da-conta-a"])).toBeUndefined();
    expect(invalidateRouter).toHaveBeenCalledTimes(2);
    cache.clear();
  });

  it("apaga todos os dados ao sair da conta", () => {
    const cache = new QueryClient();
    const handle = createSessionCacheGuard(cache, vi.fn());
    handle("INITIAL_SESSION", session("conta-a"));
    cache.setQueryData(["lists"], [{ name: "Lista privada" }]);
    handle("SIGNED_OUT", null);
    expect(cache.getQueryData(["lists"])).toBeUndefined();
    cache.clear();
  });

  it("não apaga o cache toda vez que a mesma conta retorna à aba", () => {
    const cache = new QueryClient();
    const handle = createSessionCacheGuard(cache, vi.fn());
    handle("INITIAL_SESSION", session("conta-a"));
    cache.setQueryData(["lists"], ["somente-conta-a"]);
    handle("SIGNED_IN", session("conta-a"));
    expect(cache.getQueryData(["lists"])).toEqual(["somente-conta-a"]);
    cache.clear();
  });

  it("limpa dados se a sessão inicial for anônima ou trocar de anônima para conta", () => {
    const cache = new QueryClient();
    const handle = createSessionCacheGuard(cache, vi.fn());
    cache.setQueryData(["stale"], "valor antigo");
    handle("INITIAL_SESSION", null);
    expect(cache.getQueryData(["stale"])).toBeUndefined();
    cache.setQueryData(["offline-guest"], "visível sem login");
    handle("SIGNED_IN", session("conta-a"));
    expect(cache.getQueryData(["offline-guest"])).toBeUndefined();
    cache.clear();
  });

  it("não reage a atualizações técnicas de token, mas atualiza dados ao mudar perfil", () => {
    const cache = new QueryClient();
    const inv = vi.fn();
    const handle = createSessionCacheGuard(cache, inv);
    handle("INITIAL_SESSION", session("conta-a"));
    cache.setQueryData(["profiles"], { name: "Antigo" });
    handle("TOKEN_REFRESHED", session("conta-a"));
    expect(inv).toHaveBeenCalledTimes(1);
    expect(cache.getQueryData(["profiles"])).toBeTruthy();
    handle("USER_UPDATED", session("conta-a"));
    expect(inv).toHaveBeenCalledTimes(2);
    cache.clear();
  });
});
