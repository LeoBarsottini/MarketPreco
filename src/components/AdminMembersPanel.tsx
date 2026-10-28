import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Member = {
  user_id: string;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
  is_moderator: boolean;
};

export function AdminMembersPanel({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<Member | null>(null);

  const members = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_members");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const change = useMutation({
    mutationFn: async (member: Member) => {
      const enabled = !member.is_moderator;
      const { data, error } = await supabase.rpc("admin_set_moderator", {
        _target_id: member.user_id,
        _enabled: enabled,
      });
      if (error) throw new Error(error.message);
      if (data !== true) throw new Error("Alteração não confirmada pelo servidor.");
      return enabled;
    },
    onSuccess: (enabled) => {
      toast.success(enabled ? "Moderador autorizado." : "Acesso de moderador revogado.");
      setConfirmTarget(null);
      void qc.invalidateQueries({ queryKey: ["admin-members"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const found = (members.data ?? []).filter((m) =>
    (m.display_name || "Sem nome cadastrado").toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR").trim()),
  );
  const granting = confirmTarget !== null && !confirmTarget.is_moderator;

  return (
    <section className="space-y-4" aria-labelledby="admin-members-title">
      <div>
        <h2 id="admin-members-title" className="flex items-center gap-2 text-lg font-bold">
          <Users className="h-5 w-5 text-[#075aab]" aria-hidden="true" /> Contas e permissões
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie o papel de moderador. Por segurança, esta relação não expõe e-mails, senhas ou listas de compras.
        </p>
      </div>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar pelo nome" aria-label="Pesquisar usuários por nome" />
      {members.isLoading && <p role="status" className="text-sm text-muted-foreground">Carregando contas…</p>}
      {members.isError && <p role="alert" className="text-sm text-destructive">Não foi possível consultar os usuários autorizados.</p>}
      {!members.isLoading && !members.isError && found.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
      )}
      <ul className="space-y-2">
        {found.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold">
                {m.is_admin ? <ShieldCheck className="h-4 w-4 text-[#075aab]" aria-hidden="true" /> :
                  <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                {m.display_name || "Usuário sem nome"}
                {m.user_id === currentUserId && <span className="text-xs text-muted-foreground">(você)</span>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.is_admin ? "Administrador" : m.is_moderator ? "Moderador" : "Usuário padrão"}
                {" · "}Cadastro {new Date(m.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            {!m.is_admin && m.user_id !== currentUserId && (
              <Button variant={m.is_moderator ? "outline" : "default"} size="sm"
                disabled={change.isPending} onClick={() => setConfirmTarget(m)}>
                {m.is_moderator ? "Revogar moderação" : "Tornar moderador"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Até 500 contas por consulta. Somente administradores podem alterar permissões; cada mudança é registrada no banco.</p>

      <Dialog open={confirmTarget !== null} onOpenChange={(open) => { if (!open && !change.isPending) setConfirmTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{granting ? "Autorizar moderador?" : "Revogar acesso de moderação?"}</DialogTitle>
            <DialogDescription>
              {granting
                ? `A conta ${confirmTarget?.display_name || "selecionada"} poderá visualizar denúncias e decidir se registros de preços serão ocultados.`
                : `A conta ${confirmTarget?.display_name || "selecionada"} perderá a permissão para analisar denúncias.`}
              {" "}Esta ação será auditada.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={change.isPending} onClick={() => setConfirmTarget(null)}>Cancelar</Button>
            <Button disabled={!confirmTarget || change.isPending} onClick={() => { if (confirmTarget) change.mutate(confirmTarget); }}>
              {change.isPending ? "Salvando…" : granting ? "Confirmar autorização" : "Confirmar revogação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
