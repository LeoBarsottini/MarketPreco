import { describe, expect, it } from "vitest";
import { createAtomicCartArgs, localDateString, type CartDraft } from "@/lib/cart-command";

const now = new Date("2026-10-27T15:00:00.000Z");
const ids = {
  listId: "c9853377-4d7c-4091-8987-81ef22b583fc",
  productId: "e1d89d9e-d671-40f2-87ad-196c08f52a2b",
  storeId: "0b5dbb04-9405-411d-975d-54c0b8ea2e42",
};
const operationId = "f45b31cc-5685-41a8-bfcf-2092736656e2";

function draft(overrides: Partial<CartDraft> = {}): CartDraft {
  return {
    ...ids,
    quantity: 1.5,
    unitPrice: 8.5,
    observedDate: localDateString(now),
    source: "manual",
    confirmed: true,
    share: false,
    ...overrides,
  };
}

describe("comando transacional do carrinho", () => {
  it("gera carga consistente para repetições da mesma operação", () => {
    const first = createAtomicCartArgs(draft(), operationId, now);
    const retry = createAtomicCartArgs(draft(), operationId, now);
    expect(retry).toEqual(first);
    expect(first).toMatchObject({
      _operation_id: operationId,
      _quantity: 1.5,
      _price: 8.5,
      _confirmed: true,
      _share: false,
      _observed_at: "2026-10-27T15:00:00.000Z",
    });
  });

  it("permite adicionar item sem preço e sem observação compartilhada", () => {
    const result = createAtomicCartArgs(draft({
      unitPrice: null, share: false, confirmed: false,
    }), operationId, now);
    expect(result).toMatchObject({ _price: null, _observed_at: null, _confirmed: false, _share: false });
  });

  it("rejeita divulgação de preço não confirmado", () => {
    expect(() => createAtomicCartArgs(draft({ share: true, confirmed: false }), operationId, now)).toThrow();
    expect(() => createAtomicCartArgs(draft({ share: true, unitPrice: null }), operationId, now)).toThrow();
  });

  it("rejeita quantidade e preço fora dos limites", () => {
    expect(() => createAtomicCartArgs(draft({ quantity: 0 }), operationId, now)).toThrow();
    expect(() => createAtomicCartArgs(draft({ quantity: Number.NaN }), operationId, now)).toThrow();
    expect(() => createAtomicCartArgs(draft({ unitPrice: 100000 }), operationId, now)).toThrow();
    expect(() => createAtomicCartArgs(draft({ unitPrice: -2 }), operationId, now)).toThrow();
  });

  it("rejeita datas futuras, malformadas e impossíveis", () => {
    expect(() => createAtomicCartArgs(draft({ observedDate: "2026-10-28" }), operationId, now)).toThrow();
    expect(() => createAtomicCartArgs(draft({ observedDate: "2026-02-30" }), operationId, now)).toThrow();
    expect(() => createAtomicCartArgs(draft({ observedDate: "invalida" }), operationId, now)).toThrow();
  });

  it("mantém data anterior sem forjar horário de observação atual", () => {
    const result = createAtomicCartArgs(draft({ observedDate: "2026-10-25", source: "ocr" }), operationId, now);
    expect(result._observed_at).toContain("2026-10-25T");
    expect(result._source).toBe("ocr");
  });
});
