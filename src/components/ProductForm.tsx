import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizedProduct } from "@/lib/catalog-validation";
import type { Product } from "@/lib/queries";

export function ProductForm({ initialBarcode, initialName, onCreated }: { initialBarcode?: string; initialName?: string; onCreated: (p: Product) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(initialName ?? "");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState<string>("g");
  const [barcode, setBarcode] = useState(initialBarcode ?? "");

  const m = useMutation({
    mutationFn: async () => {
      const payload = normalizedProduct({ name, brand, size, unit, barcode });
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select()
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("Já existe um produto com este código de barras.");
        throw error;
      }
      return data;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto cadastrado");
      onCreated(p);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Arroz branco tipo 1" /></div>
      <div className="space-y-1"><Label className="text-xs">Marca</Label><Input maxLength={120} value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <div className="space-y-1"><Label className="text-xs">Embalagem</Label><Input inputMode="decimal" maxLength={22} value={size} onChange={(e) => setSize(e.target.value)} placeholder="5" /></div>
        <div className="space-y-1">
          <Label className="text-xs">Unidade</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["un", "g", "kg", "ml", "l"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Código de barras (opcional)</Label><Input inputMode="numeric" maxLength={20} autoComplete="off" value={barcode} onChange={(e) => setBarcode(e.target.value)} /></div>
      <Button type="submit" className="w-full" disabled={m.isPending}>Salvar produto</Button>
    </form>
  );
}
