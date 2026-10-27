import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REASONS = [
  ["wrong_price", "Preço diferente do registrado"],
  ["wrong_product", "Produto ou embalagem incorreta"],
  ["wrong_store", "Supermercado ou unidade incorreta"],
  ["expired", "Preço antigo ou promoção encerrada"],
  ["other", "Outro problema"],
] as const;

type Reason = (typeof REASONS)[number][0];

export function PriceReportDialog({
  observationId,
  onClose,
}: {
  observationId: string | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<Reason>("wrong_price");
  const [details, setDetails] = useState("");

  const report = useMutation({
    mutationFn: async () => {
      if (!observationId) throw new Error("Selecione um preço para denunciar.");
      const { data, error } = await supabase.rpc("report_price_observation", {
        _observation_id: observationId,
        _reason: reason,
        _details: details.trim() || null,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("O servidor não confirmou a denúncia.");
    },
    onSuccess: () => {
      toast.success("Denúncia enviada para análise.");
      onClose();
      setDetails("");
      setReason("wrong_price");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <Dialog open={observationId !== null} onOpenChange={(open) => { if (!open && !report.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Informar um problema com o preço</DialogTitle>
          <DialogDescription>
            A denúncia será analisada por um moderador. Ela não remove automaticamente o preço compartilhado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); report.mutate(); }} className="space-y-4">
          <fieldset disabled={report.isPending} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Qual é o problema?</Label>
              <select
                id="report-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value as Reason)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {REASONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-details">Detalhes (opcional)</Label>
              <Textarea
                id="report-details"
                maxLength={500}
                rows={3}
                value={details}
                placeholder="Ex.: a etiqueta estava indicando outro valor."
                onChange={(event) => setDetails(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{details.length}/500 caracteres. Não informe dados pessoais.</p>
            </div>
            <Button type="submit" disabled={report.isPending} className="w-full">
              {report.isPending ? "Enviando denúncia…" : "Enviar para análise"}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
