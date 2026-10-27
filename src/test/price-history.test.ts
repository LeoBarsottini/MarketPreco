import { describe, expect, it } from "vitest";
import { summarizePriceHistory } from "@/lib/price-history";

const date = (day: number) => `2026-10-${String(day).padStart(2, "0")}T12:00:00.000Z`;

describe("histórico de preços observados", () => {
  it("retorna vazio sem inventar pontos ou estatísticas", () => {
    expect(summarizePriceHistory([])).toEqual({
      points: [], count: 0, minimum: null, maximum: null, latest: null,
    });
  });

  it("ordena por data e calcula mínimo, máximo e último registro", () => {
    const result = summarizePriceHistory([
      { store_id: "a", price: 8.99, observed_at: date(26) },
      { store_id: "a", price: 12.5, observed_at: date(20) },
      { store_id: "a", price: 6.1, observed_at: date(25) },
    ]);
    expect(result.points.map((point) => point.price)).toEqual([12.5, 6.1, 8.99]);
    expect(result).toMatchObject({ count: 3, minimum: 6.1, maximum: 12.5, latest: 8.99 });
  });

  it("ignora dados inválidos em vez de representar ausência como preço zero", () => {
    const result = summarizePriceHistory([
      { store_id: "a", price: 0, observed_at: date(26) },
      { store_id: "a", price: -2, observed_at: date(26) },
      { store_id: "a", price: 4.5, observed_at: "invalid-date" },
      { store_id: "a", price: 9, observed_at: date(27) },
    ]);
    expect(result).toMatchObject({ count: 1, minimum: 9, maximum: 9, latest: 9 });
  });
});
