import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { PriceLabelOCR } from "@/components/PriceLabelOCR";
import { StoreForm } from "@/components/StoreForm";
import { ProductForm } from "@/components/ProductForm";
import { listsQuery, productLabel, storesQuery, type Product, type Store } from "@/lib/queries";
import { formatBRL, lineSubtotal, parseDecimal } from "@/lib/money";
import { createAtomicCartArgs, type AtomicCartArgs } from "@/lib/cart-command";
import { ChevronLeft, Plus, ScanBarcode, Search, Store as StoreIcon } from "lucide-react";
import { sanitizeCatalogSearch } from "@/lib/catalog-validation";

type Step = "list" | "store" | "product" | "price";

export function AddItemDialog({
  open,
  onOpenChange,
  listId,
  defaultStoreId,
  initialProduct,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listId?: string;
  defaultStoreId?: string | null;
  initialProduct?: Product | null;
}) {
  const qc = useQueryClient();
  const stores = useQuery({ ...storesQuery(), enabled: open });
  const lists = useQuery({ ...listsQuery(), enabled: open && !listId });
  const [targetList, setTargetList] = useState<string | undefined>(listId);
  const [store, setStore] = useState<Store | null>(null);
  const [product, setProduct] = useState<Product | null>(initialProduct ?? null);
  const [step, setStep] = useState<Step>(listId ? "store" : "list");

  useEffect(() => {
    if (!open) return;
    setTargetList(listId);
    setProduct(initialProduct ?? null);
    setStore(null);
    setStep(listId ? "store" : "list");
  }, [open, listId, initialProduct]);

  useEffect(() => {
    if (open && defaultStoreId && stores.data && !store) {
      const s = stores.data.find((x) => x.id === defaultStoreId);
      if (s) setStore(s);
    }
  }, [open, defaultStoreId, stores.data, store]);

  const back: Record<Step, Step | null> = { list: null, store: listId ? null : "list", product: "store", price: initialProduct ? "store" : "product" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {back[step] && (
              <button onClick={() => setStep(back[step]!)} aria-label="Voltar" className="-ml-1 rounded p-1 hover:bg-muted"><ChevronLeft className="h-5 w-5" /></button>
            )}
            {{ list: "Escolha a lista", store: "1. Supermercado", product: "2. Produto", price: "3. Preço e quantidade" }[step]}
          </DialogTitle>
        </DialogHeader>

        {step === "list" && (
          <ListStep
            lists={(lists.data ?? []).filter((l) => l.status === "active")}
            loading={lists.isLoading}
            onPick={(id, storeId) => {
              setTargetList(id);
              if (storeId && stores.data) setStore(stores.data.find((s) => s.id === storeId) ?? null);
              setStep("store");
            }}
          />
        )}
        {step === "store" && (
          <StoreStep
            stores={stores.data ?? []}
            loading={stores.isLoading}
            selected={store}
            onPick={(s) => {
              setStore(s);
              setStep(product ? "price" : "product");
            }}
          />
        )}
        {step === "product" && <ProductStep onPick={(p) => { setProduct(p); setStep("price"); }} />}
        {step === "price" && store && product && targetList && (
          <PriceStep
            store={store}
            product={product}
            listId={targetList}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["list", targetList] });
              qc.invalidateQueries({ queryKey: ["lists"] });
              qc.invalidateQueries({ queryKey: ["prices", product.id] });
              qc.invalidateQueries({ queryKey: ["price-history", product.id] });
              qc.invalidateQueries({ queryKey: ["compare"] });
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ListStep({ lists, loading, onPick }: { lists: { id: string; name: string; store_id: string | null }[]; loading: boolean; onPick: (id: string, storeId: string | null) => void }) {
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("shopping_lists").insert({ name: name.trim() || "Minha lista" }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (l) => onPick(l.id, null),
    onError: (e) => toast.error((e as Error).message),
  });
  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return (
    <div className="space-y-3">
      {lists.map((l) => (
        <button key={l.id} onClick={() => onPick(l.id, l.store_id)} className="w-full rounded-lg border p-3 text-left font-medium hover:bg-muted">{l.name}</button>
      ))}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <Input placeholder="Nova lista" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={create.isPending}><Plus className="h-4 w-4" /> Criar</Button>
      </form>
    </div>
  );
}

function StoreStep({ stores, loading, selected, onPick }: { stores: Store[]; loading: boolean; selected: Store | null; onPick: (s: Store) => void }) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? stores.filter((s) => `${s.name} ${s.chain ?? ""} ${s.city} ${s.neighborhood ?? ""}`.toLowerCase().includes(t)) : stores;
  }, [q, stores]);

  if (creating) return <><StoreForm onCreated={onPick} /><Button variant="ghost" className="mt-2 w-full" onClick={() => setCreating(false)}>Cancelar</Button></>;
  return (
    <div className="space-y-3">
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome, bairro ou cidade" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum supermercado encontrado. Cadastre a unidade onde você está.</p>}
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {filtered.map((s) => (
          <button key={s.id} onClick={() => onPick(s)} className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted ${selected?.id === s.id ? "border-primary bg-primary-soft" : ""}`}>
            <StoreIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span><span className="block font-medium">{s.name}</span><span className="text-xs text-muted-foreground">{s.address}{s.neighborhood ? `, ${s.neighborhood}` : ""} · {s.city}{s.state ? `/${s.state}` : ""}</span></span>
          </button>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Cadastrar supermercado</Button>
    </div>
  );
}

export function ProductStep({ onPick }: { onPick: (p: Product) => void }) {
  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);
  const [creating, setCreating] = useState<{ barcode?: string } | null>(null);
  const search = useQuery({
    queryKey: ["products", "search", q.trim()],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const t = sanitizeCatalogSearch(q);
      const { data, error } = await supabase.from("products").select("*").or(`name.ilike.%${t}%,brand.ilike.%${t}%,barcode.eq.${t.replace(/\D/g, "") || "0"}`).order("name").limit(30);
      if (error) throw error;
      return data;
    },
  });

  async function onBarcode(code: string) {
    setScan(false);
    const { data, error } = await supabase.from("products").select("*").eq("barcode", code).maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (data) onPick(data);
    else {
      toast.info(`Código ${code} ainda não cadastrado. Cadastre o produto.`);
      setCreating({ barcode: code });
    }
  }

  if (scan) return <><BarcodeScanner onDetected={onBarcode} /><Button variant="ghost" className="mt-2 w-full" onClick={() => setScan(false)}>Cancelar</Button></>;
  if (creating) return <><ProductForm {...(creating.barcode ? { initialBarcode: creating.barcode } : {})} initialName={creating.barcode ? "" : q} onCreated={onPick} /><Button variant="ghost" className="mt-2 w-full" onClick={() => setCreating(null)}>Cancelar</Button></>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input autoFocus className="pl-9" placeholder="Nome, marca ou código" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button variant="secondary" onClick={() => setScan(true)} aria-label="Escanear"><ScanBarcode className="h-4 w-4" /></Button>
      </div>
      {search.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {search.data?.map((p) => (
          <button key={p.id} onClick={() => onPick(p)} className="w-full rounded-lg border p-3 text-left hover:bg-muted">
            <span className="block font-medium">{productLabel(p)}</span>
            {p.barcode && <span className="text-xs text-muted-foreground tabular">{p.barcode}</span>}
          </button>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={() => setCreating({})}><Plus className="h-4 w-4" /> Cadastrar produto</Button>
    </div>
  );
}

function PriceStep({ store, product, listId, onDone }: { store: Store; product: Product; listId: string; onDone: () => void }) {
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [priceSource, setPriceSource] = useState<"manual" | "ocr">("manual");
  const [date, setDate] = useState(today);
  const [confirmed, setConfirmed] = useState(false);
  const [share, setShare] = useState(false);
  const q = parseDecimal(qty);
  const p = price.trim() ? parseDecimal(price) : null;
  const priceInvalid = price.trim() !== "" && (p == null || p <= 0 || p >= 100000);
  const sub = q && p ? lineSubtotal(q, p) : null;

  // Repete a MESMA carga e ID após um erro de rede: o servidor deduplica.
  const pendingCommand = useRef<AtomicCartArgs | null>(null);
  const resetPendingCommand = () => { pendingCommand.current = null; };

  const save = useMutation({
    mutationFn: async () => {
      if (!pendingCommand.current) {
        pendingCommand.current = createAtomicCartArgs({
          listId,
          productId: product.id,
          storeId: store.id,
          quantity: q ?? Number.NaN,
          unitPrice: p,
          observedDate: date,
          source: priceSource,
          confirmed,
          share,
        }, crypto.randomUUID());
      }

      const { data, error } = await supabase.rpc("add_shopping_item_atomic", pendingCommand.current);
      if (error) {
        if (error.code === "PGRST202" || error.code === "42883") {
          throw new Error("Salvamento indisponível: a função de compras ainda não está instalada no banco de dados.");
        }
        throw new Error(error.message);
      }
      const rows = data as Array<{
        item_id: string;
        observation_id: string | null;
        replayed: boolean;
      }> | null;
      if (!rows?.[0]?.item_id) {
        throw new Error("O servidor não confirmou o salvamento. Tente novamente.");
      }
      return rows[0];
    },
    onSuccess: () => {
      pendingCommand.current = null;
      toast.success("Item adicionado à lista");
      onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <fieldset disabled={save.isPending} className="space-y-4">
      <div className="rounded-lg bg-muted p-3 text-sm">
        <p className="font-medium">{productLabel(product)}</p>
        <p className="text-muted-foreground">{store.name} · {store.city}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Quantidade</Label><Input inputMode="decimal" required value={qty} onChange={(e) => { resetPendingCommand(); setQty(e.target.value); }} /></div>
        <div className="space-y-1"><Label>Preço unitário (R$)</Label><Input inputMode="decimal" placeholder="Sem preço" value={price} onChange={(e) => { resetPendingCommand(); setPrice(e.target.value); setPriceSource("manual"); setConfirmed(false); }} aria-invalid={priceInvalid} /></div>
      </div>
      <PriceLabelOCR onSelect={(value) => { resetPendingCommand(); setPrice(value); setPriceSource("ocr"); setConfirmed(false); }} />
      {p != null && !priceInvalid && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="space-y-1"><Label>Data em que viu o preço</Label><Input type="date" max={today} value={date} onChange={(e) => { resetPendingCommand(); setDate(e.target.value); setConfirmed(false); }} /></div>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={(v) => { resetPendingCommand(); setConfirmed(v === true); }} className="mt-0.5" /> Confirmo que vi este preço neste supermercado.</label>
          <label className="flex items-center justify-between gap-2 text-sm"><span>Compartilhar com a comunidade<span className="block text-xs text-muted-foreground">Seu nome e e-mail nunca são exibidos.</span></span><Switch checked={share} onCheckedChange={(v) => { resetPendingCommand(); setShare(v); }} /></label>
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="text-lg font-semibold tabular">{sub != null ? formatBRL(sub) : "—"}</span>
      </div>
      <Button type="submit" className="w-full" disabled={save.isPending || !q || q <= 0 || priceInvalid || (p != null && !confirmed)}>Adicionar à lista</Button>
      </fieldset>
    </form>
  );
}
