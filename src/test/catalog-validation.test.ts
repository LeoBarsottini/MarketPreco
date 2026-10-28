import { describe, expect, it } from "vitest";
import { normalizedProduct, normalizedStore, sanitizeCatalogSearch } from "@/lib/catalog-validation";

const product = { name: "  Leite   integral ", brand: " Marca  A ", size: "1000", unit: "ml", barcode: "7891234567895" };
const store = { name: "Mercado", chain: "", address: "Rua Exemplo, 10", neighborhood: "", city: "São Paulo", state: "sp" };

describe("validações do catálogo antes de salvar", () => {
  it("normaliza e mantém os dados reais do SKU", () => {
    expect(normalizedProduct(product)).toEqual({
      name: "Leite integral", brand: "Marca A", package_size: 1000,
      package_unit: "ml", barcode: "7891234567895",
    });
  });
  it("aceita quantidade fracionária com três casas decimais", () => {
    expect(normalizedProduct({ ...product, size: "0,375", unit: "kg" }).package_size).toBe(0.375);
  });
  it("rejeita alterações suspeitas e embalagens inválidas", () => {
    expect(() => normalizedProduct({ ...product, barcode: "7891234567890" })).toThrow(/barras inválido/);
    expect(() => normalizedProduct({ ...product, size: "1,2345" })).toThrow(/Embalagem inválida/);
    expect(() => normalizedProduct({ ...product, size: "-5" })).toThrow();
    expect(() => normalizedProduct({ ...product, name: "A" })).toThrow(/Nome/);
    expect(() => normalizedProduct({ ...product, unit: "litros" })).toThrow(/Unidade/);
  });
  it("preserva produtos vendidos sem GTIN e sem embalagem", () => {
    expect(normalizedProduct({ name: "Banana", brand: "", size: "", unit: "kg", barcode: "" })).toEqual({
      name: "Banana", brand: null, package_size: null, package_unit: null, barcode: null,
    });
  });
  it("normaliza UF e valida a posição do supermercado", () => {
    expect(normalizedStore(store, { lat: -23.5505, lng: -46.6333 })).toMatchObject({
      state: "SP", latitude: -23.5505, longitude: -46.6333,
    });
  });
  it("recusa UF e coordenadas inválidas", () => {
    expect(() => normalizedStore({ ...store, state: "Sao Paulo" }, null)).toThrow(/UF/);
    expect(() => normalizedStore(store, { lat: 120, lng: -46 })).toThrow(/Localização inválida/);
    expect(() => normalizedStore({ ...store, address: "X" }, null)).toThrow(/Endereço/);
    expect(() => normalizedStore({ ...store, city: " " }, null)).toThrow(/Cidade/);
  });
  it("neutraliza operadores e curingas na pesquisa do catálogo", () => {
    expect(sanitizeCatalogSearch("  Água   de coco (1L),name.ilike.%  ")).toBe("Água de coco 1L name ilike");
    expect(sanitizeCatalogSearch(",,,%%%()")).toBe("");
    expect(sanitizeCatalogSearch("Leite integral").length).toBeGreaterThan(2);
    expect(sanitizeCatalogSearch("a".repeat(500))).toHaveLength(60);
  });
  it("permite loja sem localização confirmada", () => {
    expect(normalizedStore(store, null)).toMatchObject({ latitude: null, longitude: null });
  });
});
