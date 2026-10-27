export interface StorePrice {
  store_id: string;
  store_name: string;
  price: number;
  observed_at: string;
}

export interface CompareItem {
  product_id: string;
  quantity: number;
}

export interface StoreComparison {
  store_id: string;
  store_name: string;
  total: number;
  covered: number;
  totalItems: number;
  coverage: number;
  missingProductIds: string[];
}

/**
 * Compare somente IDs exatos de produto.
 * Para cada produto/loja, usa a observação válida mais recente, independente
 * da ordem em que a API retornou os registros. Preço ausente NÃO é zero.
 */
export function compareStores(
  items: CompareItem[],
  pricesByProduct: Record<string, StorePrice[]>,
): StoreComparison[] {
  // Consolida produtos repetidos da lista para não contabilizar em duplicidade.
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
    quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
  }

  const stores = new Map<string, { name: string; cents: number; covered: Set<string> }>();
  for (const [productId, quantity] of quantities) {
    const newest = new Map<string, StorePrice>();
    for (const observation of pricesByProduct[productId] ?? []) {
      if (!Number.isFinite(observation.price) || observation.price <= 0) continue;
      const previous = newest.get(observation.store_id);
      if (!previous || observation.observed_at > previous.observed_at) {
        newest.set(observation.store_id, observation);
      }
    }
    for (const observation of newest.values()) {
      const record = stores.get(observation.store_id) ?? {
        name: observation.store_name,
        cents: 0,
        covered: new Set<string>(),
      };
      record.covered.add(productId);
      record.cents += Math.round(quantity * observation.price * 100);
      stores.set(observation.store_id, record);
    }
  }

  const productIds = [...quantities.keys()];
  return [...stores.entries()]
    .map(([store_id, s]) => ({
      store_id,
      store_name: s.name,
      total: s.cents / 100,
      covered: s.covered.size,
      totalItems: productIds.length,
      coverage: productIds.length ? s.covered.size / productIds.length : 0,
      missingProductIds: productIds.filter((id) => !s.covered.has(id)),
    }))
    .sort((a, b) => b.coverage - a.coverage || a.total - b.total);
}
