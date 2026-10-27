/** Seleciona somente observações válidas e a mais recente por unidade. */
export interface PriceObservation {
  store_id: string;
  price: number;
  observed_at: string;
  is_mine?: boolean;
}

export type PriceAgeDays = 7 | 15 | 30 | 0;

export function latestPricesByStore<T extends PriceObservation>(
  observations: readonly T[],
  maxAgeDays: PriceAgeDays,
  now: Date = new Date(),
): Map<string, T> {
  const latest = new Map<string, T>();
  const timestamp = now.getTime();
  const since = maxAgeDays ? timestamp - maxAgeDays * 24 * 60 * 60 * 1000 : -Infinity;

  for (const observation of observations) {
    const at = Date.parse(observation.observed_at);
    if (!Number.isFinite(at) || at > timestamp || at < since) continue;
    if (!Number.isFinite(Number(observation.price)) || Number(observation.price) <= 0) continue;
    const earlier = latest.get(observation.store_id);
    if (!earlier || Date.parse(earlier.observed_at) < at) {
      latest.set(observation.store_id, observation);
    }
  }
  return latest;
}

export function priceDateLabel(date: string): string {
  const value = new Date(date);
  return Number.isNaN(value.getTime())
    ? "Data indisponível"
    : value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
