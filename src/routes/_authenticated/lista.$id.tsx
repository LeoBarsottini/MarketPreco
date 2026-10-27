import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listQuery, productLabel } from "@/lib/queries";
import { computeTotals, formatBRL, formatQty, lineSubtotal, parseDecimal } from "@/lib/money";
import { AddItemDialog } from "@/components/AddItemDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Pencil, Plus, Trash2, CheckCheck, RotateCcw } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/lista/$id")({
  head: () => ({ meta: [{ title: "Lista de compras — MarketPreço" }, { name: "description", content: "Itens, preços e total da sua lista." }, { property: "og:title", content: "Lista de compras — MarketPreço" }, { property: "og:description", content: "Itens, preços e total da sua lista." }] }),
  component: ListPage,
});

function ListPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(listQuery(id));
  const [adding, setAdding] = useState(false);
  const [editingList, setEditingList] = useState(false);
  const [editItem, setEditItem] = useState<null | { id: string; quantity: number; unit_price: number | null; label: string }>(null);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["list", id] }); qc.invalidateQueries({ queryKey: ["lists"] }); };

  const toggle = useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const { error } = await supabase.from("shopping_list_items").update({ checked }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("shopping_list_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: async (status: "active" | "completed") => {
      const { error } = await supabase.from("shopping_lists").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, s) => { invalidate(); toast.success(s === "completed" ? "Compra registrada no histórico" : "Lista reaberta"); },
  });
  const delList = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shopping_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lists"] }); navigate({ to: "/lista" }); },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (error || !data || !data.list) return <p className="text-sm text-destructive">Lista não encontrada.</p>;
  const { list, items } = data;
  const budget = list.budget == null ? null : Number(list.budget);
  const t = computeTotals(items.map((i) => ({ quantity: Number(i.quantity), unit_price: i.unit_price == null ? null : Number(i.unit_price), checked: i.checked })), budget);
  const done = list.status === "completed";

  return (
    <>
      <Link to="/lista" className="mb-3 inline-flex items-center text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> Listas</Link>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{list.name}</h1>
          {done && <p className="text-sm text-muted-foreground">Finalizada em {new Date(list.completed_at!).toLocaleString("pt-BR")}</p>}
        </div>
        <Button size="icon" variant="ghost" onClick={() => setEditingList(true)} aria-label="Editar lista"><Pencil className="h-4 w-4" /></Button>
      </div>

      <section className="mb-5 rounded-2xl bg-hero p-5 text-primary-foreground shadow-card">
        <p className="text-sm opacity-80">Total com preço</p>
        <p className="text-4xl font-extrabold tabular">{formatBRL(t.total)}</p>
        <p className="mt-1 text-sm opacity-90">
          {t.pricedCount} de {t.itemCount} itens com preço
          {t.missingCount > 0 && ` · ${t.missingCount} sem preço (não somados)`}
        </p>
        {t.itemCount > 0 && <Progress value={t.coverage * 100} className="mt-2 h-1.5 bg-primary-foreground/25" />}
        {budget != null && (
          <p className={`mt-3 text-sm font-medium ${t.overBudget ? "rounded bg-destructive px-2 py-1 text-destructive-foreground" : ""}`}>
            Orçamento {formatBRL(budget)} · {t.overBudget ? `excedido em ${formatBRL(-t.remaining!)}` : `restam ${formatBRL(t.remaining!)}`}
          </p>
        )}
        {t.checkedTotal > 0 && <p className="mt-1 text-xs opacity-80">No carrinho: {formatBRL(t.checkedTotal)}</p>}
      </section>

      {!done && <Button className="mb-4 w-full" size="lg" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Adicionar item</Button>}

      {items.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Lista vazia.</p>}
      <ul className="space-y-2">
        {items.map((i) => {
          const price = i.unit_price == null ? null : Number(i.unit_price);
          const sub = lineSubtotal(Number(i.quantity), price);
          return (
            <li key={i.id} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-card">
              <Checkbox checked={i.checked} disabled={done} onCheckedChange={(v) => toggle.mutate({ itemId: i.id, checked: v === true })} aria-label="Marcar como pego" />
              <button className="min-w-0 flex-1 text-left" onClick={() => !done && setEditItem({ id: i.id, quantity: Number(i.quantity), unit_price: price, label: i.products ? productLabel(i.products) : "" })}>
                <p className={`truncate font-medium ${i.checked ? "text-muted-foreground line-through" : ""}`}>{i.products ? productLabel(i.products) : "Produto"}</p>
                <p className="text-xs text-muted-foreground tabular">
                  {formatQty(Number(i.quantity))} × {price != null ? formatBRL(price) : "sem preço"}{i.stores?.name ? ` · ${i.stores.name}` : ""}
                </p>
              </button>
              <span className={`text-right font-semibold tabular ${sub == null ? "text-xs font-medium text-warning-foreground" : ""}`}>{sub != null ? formatBRL(sub) : "sem preço"}</span>
              {!done && <Button size="icon" variant="ghost" onClick={() => remove.mutate(i.id)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 space-y-2">
        {done ? (
          <Button variant="outline" className="w-full" onClick={() => setStatus.mutate("active")}><RotateCcw className="h-4 w-4" /> Reabrir lista</Button>
        ) : (
          items.length > 0 && <Button variant="secondary" className="w-full" onClick={() => setStatus.mutate("completed")}><CheckCheck className="h-4 w-4" /> Finalizar compra</Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="ghost" className="w-full text-destructive">Excluir lista</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Excluir “{list.name}”?</AlertDialogTitle><AlertDialogDescription>Os itens da lista serão apagados. Os preços que você registrou continuam salvos.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => delList.mutate()}>Excluir</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <AddItemDialog open={adding} onOpenChange={setAdding} listId={id} defaultStoreId={list.store_id ?? items.at(-1)?.store_id ?? null} />
      <EditListDialog open={editingList} onOpenChange={setEditingList} list={list} onSaved={invalidate} />
      {editItem && <EditItemDialog item={editItem} onClose={() => setEditItem(null)} onSaved={invalidate} />}
    </>
  );
}

function EditListDialog({ open, onOpenChange, list, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; list: { id: string; name: string; budget: number | null }; onSaved: () => void }) {
  const [name, setName] = useState(list.name);
  const [budget, setBudget] = useState(list.budget == null ? "" : String(list.budget).replace(".", ","));
  const save = useMutation({
    mutationFn: async () => {
      const b = budget.trim() ? parseDecimal(budget) : null;
      if (budget.trim() && b == null) throw new Error("Orçamento inválido.");
      const { error } = await supabase.from("shopping_lists").update({ name: name.trim() || list.name, budget: b }).eq("id", list.id);
      if (error) throw error;
    },
    onSuccess: () => { onSaved(); onOpenChange(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar lista</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Orçamento (R$)</Label><Input inputMode="decimal" placeholder="Sem orçamento" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditItemDialog({ item, onClose, onSaved }: { item: { id: string; quantity: number; unit_price: number | null; label: string }; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState(String(item.quantity).replace(".", ","));
  const [price, setPrice] = useState(item.unit_price == null ? "" : String(item.unit_price).replace(".", ","));
  const save = useMutation({
    mutationFn: async () => {
      const q = parseDecimal(qty);
      if (q == null || q <= 0) throw new Error("Quantidade inválida.");
      const p = price.trim() ? parseDecimal(price) : null;
      if (price.trim() && (p == null || p <= 0)) throw new Error("Preço inválido.");
      const { error } = await supabase.from("shopping_list_items").update({ quantity: q, unit_price: p }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item.label}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Quantidade</Label><Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div className="space-y-1"><Label>Preço unitário</Label><Input inputMode="decimal" placeholder="Sem preço" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Alterar o preço aqui muda só a sua lista. Para registrar um preço observado, adicione o item novamente com confirmação.</p>
          <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
