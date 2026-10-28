import { describe, expect, it } from "vitest";
import { productLabel } from "@/lib/queries";

describe("formatação segura de embalagens para comparação", () => {
  it.each([
    [500, "g", "Arroz · Marca 500g"],
    [1000, "ml", "Arroz · Marca 1000ml"],
    [10, "un", "Arroz · Marca 10un"],
    [100, "g", "Arroz · Marca 100g"],
    [1.5, "l", "Arroz · Marca 1,5l"],
    [0.25, "kg", "Arroz · Marca 0,25kg"],
    [1, "l", "Arroz · Marca 1l"],
  ] as const)("mantém a quantidade %s%s correta", (package_size, package_unit, expected) => {
    expect(productLabel({ name: "Arroz", brand: "Marca", package_size, package_unit })).toBe(expected);
  });

  it("omite embalagem e marca quando ausentes", () => {
    expect(productLabel({ name: "Abacaxi", brand: null, package_size: null, package_unit: null })).toBe("Abacaxi");
  });
});
