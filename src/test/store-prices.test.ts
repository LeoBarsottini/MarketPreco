import { describe, expect, it } from "vitest";
import { latestPricesByStore, priceDateLabel } from "@/lib/store-prices";

const now = new Date("2026-10-27T15:00:00Z");
const obs = (store_id: string, price: number, observed_at: string) => ({ store_id, price, observed_at });

describe("preços no mapa", () => {
  it("mantém o registro mais novo da mesma loja, independentemente da ordem", () => {
    const results = latestPricesByStore([
      obs("mercado-a", 8, "2026-10-23T15:00:00Z"),
      obs("mercado-a", 6, "2026-10-20T15:00:00Z"),
      obs("mercado-a", 9.4, "2026-10-26T15:00:00Z"),
      obs("mercado-b", 7, "2026-10-26T15:00:00Z"),
    ], 30, now);
    expect(results.get("mercado-a")?.price).toBe(9.4);
    expect(results.get("mercado-b")?.price).toBe(7);
  });

  it("não exibe dados anteriores ao filtro ou preços sem validade", () => {
    const results = latestPricesByStore([
      obs("antigo", 3, "2026-09-01T10:00:00Z"),
      obs("futuro", 3, "2026-10-30T10:00:00Z"),
      obs("zerado", 0, "2026-10-26T10:00:00Z"),
      obs("nan", Number.NaN, "2026-10-26T10:00:00Z"),
      obs("atual", 4.5, "2026-10-25T10:00:00Z"),
    ], 7, now);
    expect([...results.keys()]).toEqual(["atual"]);
  });

  it("permite consultar todo o histórico quando usuário seleciona o período completo", () => {
    const results = latestPricesByStore([
      obs("antigo", 3, "2026-09-01T10:00:00Z"),
    ], 0, now);
    expect(results.get("antigo")?.price).toBe(3);
  });

  it("apresenta a data do registro no formato brasileiro", () => {
    expect(priceDateLabel("2026-10-25T15:00:00Z")).toBe("25/10/2026");
    expect(priceDateLabel("data-invalida")).toBe("Data indisponível");
  });
});
