import { describe, expect, it } from "vitest";
import { computeTotals, parseDecimal } from "@/lib/money";
import { isValidGtin } from "@/lib/gtin";
import { compareStores } from "@/lib/compare";

describe("totais da lista", () => {
  it("não trata preço ausente como zero: conta como faltante e fora do total", () => {
    const t = computeTotals(
      [
        { quantity: 2, unit_price: 4.99 },
        { quantity: 1.5, unit_price: null },
      ],
      null,
    );
    expect(t.total).toBe(9.98);
    expect(t.missingCount).toBe(1);
    expect(t.coverage).toBe(0.5);
  });

  it("quantidade decimal arredonda subtotal em centavos", () => {
    expect(computeTotals([{ quantity: 0.755, unit_price: 39.9 }], null).total).toBe(30.12);
  });

  it("calcula saldo do orçamento e estouro", () => {
    const t = computeTotals([{ quantity: 3, unit_price: 10 }], 25);
    expect(t.remaining).toBe(-5);
    expect(t.overBudget).toBe(true);
  });
});

describe("parseDecimal pt-BR", () => {
  it("aceita vírgula e milhar", () => {
    expect(parseDecimal("1.234,56")).toBe(1234.56);
    expect(parseDecimal("0,5")).toBe(0.5);
    expect(parseDecimal("abc")).toBeNull();
  });
});

describe("GTIN", () => {
  it("valida dígito verificador EAN-13", () => {
    expect(isValidGtin("7891000100103")).toBe(true);
    expect(isValidGtin("7891000100104")).toBe(false);
  });
});

describe("comparação entre lojas", () => {
  it("só soma produtos idênticos e reporta cobertura", () => {
    const res = compareStores(
      [
        { product_id: "a", quantity: 1 },
        { product_id: "b", quantity: 2 },
      ],
      {
        a: [
          { store_id: "s1", store_name: "S1", price: 10, observed_at: "" },
          { store_id: "s2", store_name: "S2", price: 5, observed_at: "" },
        ],
        b: [{ store_id: "s1", store_name: "S1", price: 3, observed_at: "" }],
      },
    );
    expect(res[0]).toMatchObject({ store_id: "s1", total: 16, covered: 2 });
    expect(res[1]).toMatchObject({ store_id: "s2", total: 5, covered: 1, missingProductIds: ["b"] });
  });

  it("usa o preço mais recente mesmo com observações fora de ordem", () => {
    const result = compareStores(
      [{ product_id: "leite", quantity: 2 }],
      { leite: [
        { store_id: "mercado", store_name: "Mercado", price: 4.2, observed_at: "2026-10-25T12:00:00Z" },
        { store_id: "mercado", store_name: "Mercado", price: 3.8, observed_at: "2026-10-20T12:00:00Z" },
        { store_id: "mercado", store_name: "Mercado", price: 4.5, observed_at: "2026-10-26T12:00:00Z" },
      ] },
    );
    expect(result[0]?.total).toBe(9);
    expect(result[0]?.coverage).toBe(1);
  });

  it("consolida produtos repetidos e não soma preços inválidos", () => {
    const result = compareStores(
      [{ product_id: "arroz", quantity: 1 }, { product_id: "arroz", quantity: 2 }, { product_id: "feijao", quantity: 1 }],
      {
        arroz: [{ store_id: "a", store_name: "A", price: 10, observed_at: "2026-10-25" }],
        feijao: [{ store_id: "a", store_name: "A", price: 0, observed_at: "2026-10-25" }],
      },
    );
    expect(result[0]).toMatchObject({ total: 30, covered: 1, totalItems: 2, missingProductIds: ["feijao"] });
  });
});
