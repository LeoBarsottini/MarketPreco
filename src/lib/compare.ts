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
 * Compare a list across stores. Only exact product_id matches count; missing prices are
 * reported as missing (never zero). Sorted by coverage desc, then total asc.
 */
export function compareStores(
  items: CompareItem[],
  pricesByProduct: Record<string, StorePrice[]>,
): StoreComparison[] {
  const stores = new Map<string, { name: string; cents: number; covered: Set<string> }>();
  for (const it of items) {
    for (const p of pricesByProduct[it.product_id] ?? []) {
      const s = stores.get(p.store_id) ?? { name: p.store_name, cents: 0, covered: new Set() };
      if (!s.covered.has(it.product_id)) {
        s.covered.add(it.product_id);
        s.cents += Math.round(it.quantity * p.price * 100);
      }
      stores.set(p.store_id, s);
    }
  }
  const productIds = items.map((i) => i.product_id);
  return [...stores.entries()]
    .map(([store_id, s]) => ({
      store_id,
      store_name: s.name,
      total: s.cents / 100,
      covered: s.covered.size,
      totalItems: items.length,
      coverage: items.length ? s.covered.size / items.length : 0,
      missingProductIds: productIds.filter((id) => !s.covered.has(id)),
    }))
    .sort((a, b) => b.coverage - a.coverage || a.total - b.total);
}
