import { describe, expect, it } from "vitest";
import { extractPriceCandidates } from "@/lib/price-ocr";

describe("OCR de etiquetas: sugestões não confirmadas", () => {
  it("lê preços brasileiros e remove duplicações", () => {
    expect(extractPriceCandidates("R$ 12,90\n12,90\nR$ 7,49")).toEqual([12.9, 7.49]);
  });
  it("aceita valores em milhares e ponto como separador decimal", () => {
    expect(extractPriceCandidates("OFERTA: 1.234,56\nUnitário 4.20")).toEqual([1234.56, 4.2]);
  });
  it("não confunde códigos inteiros de barras com preços", () => {
    expect(extractPriceCandidates("EAN 7891234567895\nLote 123456")).toEqual([]);
  });
  it("descarta preço zero e valores fora do intervalo", () => {
    expect(extractPriceCandidates("R$ 0,00\nR$ 1,99\nR$ 99999,99")).toEqual([1.99, 99999.99]);
  });
  it("não lê um preço falso dentro de identificadores numéricos longos", () => {
    expect(extractPriceCandidates("SKU 123456789,90 ou lote 123456.78")).toEqual([]);
    expect(extractPriceCandidates("Código 123456789,90 | Preço R$ 8,49")).toEqual([8.49]);
    expect(extractPriceCandidates("Identificador 12.345.678,90")).toEqual([]);
  });
  it("não extrai valores incompletos ou subcadeias de números decimais", () => {
    expect(extractPriceCandidates("123,4567 ou 12,900")).toEqual([]);
    expect(extractPriceCandidates("R$ 10,90 / 5,49")).toEqual([10.9, 5.49]);
  });
  it("retorna lista vazia quando não é possível reconhecer texto monetário", () => {
    expect(extractPriceCandidates("Preço ilegível - etiqueta danificada")).toEqual([]);
  });
});
