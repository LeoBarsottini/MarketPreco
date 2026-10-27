/** Comando imutável: mesmo ID e mesma carga ao repetir uma solicitação incerta. */
export interface CartDraft {
  listId: string;
  productId: string;
  storeId: string;
  quantity: number;
  unitPrice: number | null;
  observedDate: string;
  source: "manual" | "ocr" | "barcode";
  confirmed: boolean;
  share: boolean;
}

export interface AtomicCartArgs {
  _operation_id: string;
  _list_id: string;
  _product_id: string;
  _store_id: string;
  _quantity: number;
  _price: number | null;
  _observed_at: string | null;
  _source: "manual" | "ocr" | "barcode";
  _confirmed: boolean;
  _share: boolean;
}

export function localDateString(now: Date): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 10);
}

export function createAtomicCartArgs(
  draft: CartDraft,
  operationId: string,
  now: Date = new Date(),
): AtomicCartArgs {
  if (!operationId || !draft.listId || !draft.productId || !draft.storeId) {
    throw new Error("Lista, produto, supermercado e operação são obrigatórios.");
  }
  if (!Number.isFinite(draft.quantity) || draft.quantity <= 0 || draft.quantity > 100_000) {
    throw new Error("Quantidade inválida.");
  }
  if (draft.unitPrice != null &&
      (!Number.isFinite(draft.unitPrice) || draft.unitPrice <= 0 || draft.unitPrice >= 100_000)) {
    throw new Error("Preço inválido.");
  }
  if (draft.unitPrice != null && !draft.confirmed) {
    throw new Error("Confirme que viu este preço no supermercado.");
  }
  if (draft.share && (draft.unitPrice == null || !draft.confirmed)) {
    throw new Error("Não é possível compartilhar preço ausente ou não confirmado.");
  }

  let observedAt: string | null = null;
  if (draft.unitPrice != null) {
    const selected = new Date(`${draft.observedDate}T12:00:00`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(draft.observedDate) ||
      !Number.isFinite(selected.getTime()) ||
      localDateString(selected) !== draft.observedDate ||
      draft.observedDate > localDateString(now)
    ) {
      throw new Error("Data de observação inválida.");
    }
    observedAt = draft.observedDate === localDateString(now)
      ? now.toISOString()
      : selected.toISOString();
  }

  return {
    _operation_id: operationId,
    _list_id: draft.listId,
    _product_id: draft.productId,
    _store_id: draft.storeId,
    _quantity: draft.quantity,
    _price: draft.unitPrice,
    _observed_at: observedAt,
    _source: draft.source,
    _confirmed: draft.unitPrice != null && draft.confirmed,
    _share: draft.share,
  };
}
