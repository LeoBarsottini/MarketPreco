import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";

const REASON_NAMES: Record<string, string> = {
  wrong_price: "Preço incorreto",
  wrong_product: "Produto incorreto",
  wrong_store: "Supermercado incorreto",
  expired: "Promoção encerrada",
  other: "Outro motivo",
};

export function ModerationPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const permitted = useQuery({
    queryKey: ["can-moderate", userId],
    queryFn: async () => {
      const roles = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
      ]);
      if (roles.some((r) => r.error)) return false;
      return roles.some((r) => r.data === true);
    },
    staleTime: 300_000,
  });
  const queue = useQuery({
    queryKey: ["moderation-queue"],
    enabled: permitted.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pending_price_reports");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 30_000,
  });
  const resolve = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "accepted" | "rejected" }) => {
      const { data, error } = await supabase.rpc("review_price_report", {
        _report_id: id,
        _decision: decision,
      });
      if (error) throw new Error(error.message);
      if (data !== true) throw new Error("A decisão não foi confirmada pelo servidor.");
      return decision;
    },
    onSuccess: (decision) => {
      toast.success(decision === "accepted" ? "Registro ocultado das consultas." : "Denúncia rejeitada.");
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      qc.invalidateQueries({ queryKey: ["prices"] });
      qc.invalidateQueries({ queryKey: ["price-history"] });
      qc.invalidateQueries({ queryKey: ["compare"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  if (permitted.data !== true) return null;

  return (
    <section aria-labelledby="moderation-title" className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id="moderation-title" className="font-bold">Moderação de preços</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Disponível somente para administradores e moderadores autorizados pelo servidor.
        Aceitar uma denúncia oculta o registro de preço da comunidade.
      </p>
      {queue.isLoading && <p className="text-sm text-muted-foreground">Consultando denúncias…</p>}
      {queue.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar a fila de denúncias.</p>}
      {queue.data?.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhuma denúncia pendente.</p>}
      <ul className="space-y-3">
        {queue.data?.map((report) => (
          <li key={report.report_id} className="rounded-xl border bg-card p-4">
            <p className="font-semibold">{report.product_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {report.store_name} · {formatBRL(Number(report.reported_price))} · registrado em {new Date(report.observed_at).toLocaleDateString("pt-BR")}
            </p>
            <p className="mt-2 text-sm"><strong>Motivo:</strong> {REASON_NAMES[report.reason] ?? "Outro motivo"}</p>
            {report.details && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{report.details}</p>}
            <p className="mt-2 text-xs text-muted-foreground">Denunciado em {new Date(report.created_at).toLocaleDateString("pt-BR")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: report.report_id, decision: "accepted" })}
              >
                Confirmar erro e ocultar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: report.report_id, decision: "rejected" })}
              >
                Manter preço
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
