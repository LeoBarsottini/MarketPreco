/** Parse a pt-BR decimal string ("12,90", "1.234,5", "0.5"). Returns null when invalid. */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(/\s|R\$/g, "");
  if (!s) return null;
  let normalized = s;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (v: number) => brl.format(v);

export const formatQty = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(v);

const cents = (v: number) => Math.round(v * 100);

export interface TotalsItem {
  quantity: number;
  unit_price: number | null;
  checked?: boolean;
}

export interface ListTotals {
  itemCount: number;
  pricedCount: number;
  missingCount: number;
  /** Sum of priced items only. Never treats a missing price as zero silently: see missingCount. */
  total: number;
  checkedTotal: number;
  coverage: number; // 0..1
  remaining: number | null; // budget - total (null when no budget)
  overBudget: boolean;
}

export function lineSubtotal(quantity: number, unitPrice: number | null): number | null {
  if (unitPrice == null) return null;
  return cents(quantity * unitPrice) / 100;
}

export function computeTotals(items: TotalsItem[], budget: number | null): ListTotals {
  let totalCents = 0;
  let checkedCents = 0;
  let priced = 0;
  for (const it of items) {
    const sub = lineSubtotal(Number(it.quantity), it.unit_price == null ? null : Number(it.unit_price));
    if (sub == null) continue;
    priced++;
    totalCents += cents(sub);
    if (it.checked) checkedCents += cents(sub);
  }
  const total = totalCents / 100;
  const remaining = budget == null ? null : (cents(budget) - totalCents) / 100;
  return {
    itemCount: items.length,
    pricedCount: priced,
    missingCount: items.length - priced,
    total,
    checkedTotal: checkedCents / 100,
    coverage: items.length === 0 ? 0 : priced / items.length,
    remaining,
    overBudget: remaining != null && remaining < 0,
  };
}
