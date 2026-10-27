/** Estatísticas derivadas somente de registros reais, sem preencher lacunas do gráfico. */
export interface HistoricalPrice {
  observed_at: string;
  price: number;
  store_id: string;
}

export interface HistoryPoint {
  timestamp: number;
  price: number;
}

export function summarizePriceHistory<T extends HistoricalPrice>(records: readonly T[]): {
  points: HistoryPoint[];
  minimum: number | null;
  maximum: number | null;
  latest: number | null;
  count: number;
} {
  const points = records.flatMap((record) => {
    const timestamp = Date.parse(record.observed_at);
    const price = Number(record.price);
    if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) return [];
    return [{ timestamp, price }];
  }).sort((a, b) => a.timestamp - b.timestamp);
  if (!points.length) return { points, minimum: null, maximum: null, latest: null, count: 0 };
  return {
    points,
    minimum: Math.min(...points.map((p) => p.price)),
    maximum: Math.max(...points.map((p) => p.price)),
    latest: points[points.length - 1]!.price,
    count: points.length,
  };
}
