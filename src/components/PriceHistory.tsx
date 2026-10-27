import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { priceHistoryQuery } from "@/lib/queries";
import { summarizePriceHistory } from "@/lib/price-history";
import { formatBRL } from "@/lib/money";

type PeriodDays = 30 | 90 | 365;

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

/** Histórico de observações reais. Cada gráfico representa apenas uma unidade. */
export function PriceHistory({ productId }: { productId: string }) {
  const [period, setPeriod] = useState<PeriodDays>(90);
  const [chosenStore, setChosenStore] = useState("");
  const query = useQuery(priceHistoryQuery(productId, period));

  const stores = useMemo(() => {
    const unique = new Map<string, { id: string; name: string; city: string }>();
    for (const observation of query.data ?? []) {
      unique.set(observation.store_id, {
        id: observation.store_id,
        name: observation.store_name,
        city: observation.store_city,
      });
    }
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [query.data]);

  const storeId = stores.some((store) => store.id === chosenStore)
    ? chosenStore
    : (stores[0]?.id ?? "");

  const history = useMemo(
    () => summarizePriceHistory((query.data ?? []).filter((row) => row.store_id === storeId)),
    [query.data, storeId],
  );

  return (
    <section className="mt-8" aria-labelledby="price-history-title">
      <h2 id="price-history-title" className="text-lg font-bold">Evolução do preço</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Histórico de valores observados pela comunidade ou por você. Não representa preços oficiais ou garantidos.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="history-period" className="mb-1 block text-sm font-medium">Período</label>
          <select
            id="history-period"
            value={period}
            onChange={(event) => setPeriod(Number(event.target.value) as PeriodDays)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Últimos 365 dias</option>
          </select>
        </div>
        <div>
          <label htmlFor="history-store" className="mb-1 block text-sm font-medium">Unidade do supermercado</label>
          <select
            id="history-store"
            value={storeId}
            onChange={(event) => setChosenStore(event.target.value)}
            disabled={stores.length === 0}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
          >
            {stores.length === 0 && <option value="">Nenhuma unidade com registros</option>}
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{store.name} — {store.city}</option>
            ))}
          </select>
        </div>
      </div>

      {query.isLoading && <p role="status" className="mt-4 text-sm text-muted-foreground">Carregando preços históricos…</p>}
      {query.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          Não foi possível consultar o histórico. Verifique a conexão ou tente novamente.
        </p>
      )}
      {!query.isLoading && !query.isError && history.count === 0 && (
        <p className="mt-4 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          Ainda não existem observações de preço nesse período. Registre um preço real para começar o histórico.
        </p>
      )}

      {!query.isError && history.count > 0 && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border bg-card p-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Menor registro</p>
              <p className="font-semibold tabular">{formatBRL(history.minimum!)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Maior registro</p>
              <p className="font-semibold tabular">{formatBRL(history.maximum!)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mais recente</p>
              <p className="font-semibold tabular">{formatBRL(history.latest!)}</p>
            </div>
          </div>
          {history.count === 1 ? (
            <p className="mt-3 rounded-lg bg-muted p-4 text-sm">
              Há apenas um registro para esta unidade no período: {formatDate(history.points[0]!.timestamp)}.
              Mais observações são necessárias para mostrar a evolução.
            </p>
          ) : (
            <div className="mt-4 h-[280px] w-full rounded-xl border bg-card p-3" role="img" aria-label={`Gráfico de linha de ${history.count} preços registrados para o supermercado selecionado`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history.points} margin={{ top: 10, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.35} />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    scale="time"
                    tickFormatter={(value: number) => new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    width={58}
                    domain={["auto", "auto"]}
                    tickFormatter={(value: number) => formatBRL(value)}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    labelFormatter={(value) => formatDate(Number(value))}
                    formatter={(value) => [formatBRL(Number(value)), "Preço informado"]}
                  />
                  <Line type="linear" dataKey="price" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {history.count} observação(ões) para esta unidade · até 500 registros recentes por consulta.
            Os pontos são registros individuais; não há preenchimento de dias sem informação.
          </p>
        </>
      )}
    </section>
  );
}
