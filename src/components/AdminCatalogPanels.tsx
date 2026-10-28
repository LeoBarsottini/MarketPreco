import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Package, Search, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { storesQuery, productLabel, type Store, type Product } from "@/lib/queries";
import { LocationPicker, validShopCoordinates, type ShopCoordinates } from "@/components/LocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CatalogProduct = Pick<Product, "id" | "name" | "brand" | "barcode" | "package_size" | "package_unit">;

export function AdminStoresPanel() {
  const qc = useQueryClient();
  const query = useQuery(storesQuery());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Store | null>(null);
  const [position, setPosition] = useState<ShopCoordinates | null>(null);

  const update = useMutation({
    mutationFn: async () => {
      if (!editing || !validShopCoordinates(position)) throw new Error("Selecione uma posição válida.");
      const { data, error } = await supabase.from("stores")
        .update({ latitude: position.lat, longitude: position.lng })
        .eq("id", editing.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("O servidor não autorizou a alteração da unidade.");
    },
    onSuccess: () => {
      toast.success("Localização do supermercado atualizada.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["stores"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const matches = (query.data ?? []).filter((s) =>
    [s.name,s.chain,s.address,s.neighborhood,s.city,s.state]
      .some((v) => v?.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR").trim())),
  );
  function open(store: Store) {
    setEditing(store);
    setPosition(store.latitude != null && store.longitude != null
      ? { lat: store.latitude, lng: store.longitude } : null);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold"><StoreIcon className="h-5 w-5 text-[#075aab]" /> Supermercados cadastrados</h2>
        <p className="mt-1 text-sm text-muted-foreground">Verifique unidades e corrija a posição delas no mapa integrado. Nenhum endereço é geocodificado sem confirmação.</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, bairro ou cidade" className="pl-9" aria-label="Pesquisar supermercados cadastrados" />
      </div>
      {query.isLoading && <p role="status" className="text-sm text-muted-foreground">Carregando supermercados…</p>}
      {query.isError && <p role="alert" className="text-sm text-destructive">Falha ao carregar os supermercados.</p>}
      {!query.isLoading && !query.isError && matches.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhuma unidade encontrada.</p>}
      <ul className="space-y-2">
        {matches.map((store) => (
          <li key={store.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="min-w-0">
              <p className="font-semibold">{store.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{store.address} · {store.city}{store.state ? `/${store.state}` : ""}</p>
              <p className="mt-1 text-xs text-muted-foreground">{store.latitude != null && store.longitude != null ? "Com marcador no mapa" : "Localização não cadastrada"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => open(store)}><MapPin className="h-4 w-4" /> Corrigir marcador</Button>
          </li>
        ))}
      </ul>
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !update.isPending) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Localização do supermercado</DialogTitle>
            <DialogDescription>{editing?.name} — confirme a posição exata da unidade antes de salvar.</DialogDescription>
          </DialogHeader>
          {editing && <LocationPicker value={position} onChange={setPosition} />}
          <Button disabled={!validShopCoordinates(position) || update.isPending} onClick={() => update.mutate()}>
            {update.isPending ? "Salvando…" : "Salvar marcador"}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function AdminProductsPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");

  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("id,name,brand,package_size,package_unit,barcode")
        .order("name").limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing || name.trim().length < 2 || name.trim().length > 120 || brand.trim().length > 120) {
        throw new Error("Informe um nome válido (2–120 caracteres) e marca de até 120 caracteres.");
      }
      const { data, error } = await supabase.from("products")
        .update({ name: name.trim(), brand: brand.trim() || null })
        .eq("id", editing.id).select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("O servidor não confirmou a atualização.");
    },
    onSuccess: () => {
      toast.success("Nome e marca corrigidos no catálogo.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["admin-products"] });
      void qc.invalidateQueries({ queryKey: ["product"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const visible = (products.data ?? []).filter((p) =>
    [p.name,p.brand,p.barcode].some((v) => v?.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR").trim())),
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Package className="h-5 w-5 text-[#075aab]" /> Catálogo de produtos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Corrija nomes e marcas, sem alterar código de barras ou embalagem que identificam o produto e seu histórico de preços.
        </p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Nome, marca ou código de barras" aria-label="Pesquisar produtos cadastrados" />
      </div>
      {products.isLoading && <p role="status" className="text-sm text-muted-foreground">Carregando produtos…</p>}
      {products.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os produtos.</p>}
      {!products.isLoading && !products.isError && visible.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
      <ul className="space-y-2">
        {visible.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="min-w-0">
              <p className="font-semibold">{productLabel(p)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Código de barras: {p.barcode || "Não informado"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setEditing(p); setName(p.name); setBrand(p.brand ?? ""); }}>
              Corrigir nome/marca
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">São exibidos os 200 primeiros produtos em ordem alfabética. Uma pesquisa global do catálogo será adicionada em etapa posterior.</p>
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !save.isPending) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corrigir cadastro do produto</DialogTitle>
            <DialogDescription>O código de barras e a embalagem serão preservados. Confira a identificação antes de alterar o nome.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
            <label htmlFor="admin-product-name" className="block text-sm font-medium">Nome</label>
            <Input id="admin-product-name" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} disabled={save.isPending} />
            <label htmlFor="admin-product-brand" className="block text-sm font-medium">Marca</label>
            <Input id="admin-product-brand" maxLength={120} value={brand} onChange={(e) => setBrand(e.target.value)} disabled={save.isPending} />
            <Button type="submit" className="w-full" disabled={save.isPending || name.trim().length < 2}>Salvar correção</Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
