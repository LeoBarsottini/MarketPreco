import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocateFixed } from "lucide-react";
import type { Store } from "@/lib/queries";

export function StoreForm({ onCreated }: { onCreated: (s: Store) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", chain: "", address: "", neighborhood: "", city: "", state: "" });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .insert({
          name: f.name.trim(),
          chain: f.chain.trim() || null,
          address: f.address.trim(),
          neighborhood: f.neighborhood.trim() || null,
          city: f.city.trim(),
          state: f.state.trim().toUpperCase() || null,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      toast.success("Supermercado cadastrado");
      onCreated(s);
    },
    onError: (e) => toast.error("Erro ao salvar: " + (e as Error).message),
  });

  function locate() {
    if (!navigator.geolocation) return toast.error("Localização indisponível neste navegador.");
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.error("Permissão de localização negada."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      <F label="Nome da unidade *"><Input required minLength={2} value={f.name} onChange={set("name")} placeholder="Ex.: Mercado Bom Preço – Centro" /></F>
      <F label="Rede (opcional)"><Input value={f.chain} onChange={set("chain")} /></F>
      <F label="Endereço *"><Input required minLength={3} value={f.address} onChange={set("address")} placeholder="Rua, número" /></F>
      <div className="grid grid-cols-[1fr_1fr_4.5rem] gap-2">
        <F label="Bairro"><Input value={f.neighborhood} onChange={set("neighborhood")} /></F>
        <F label="Cidade *"><Input required minLength={2} value={f.city} onChange={set("city")} /></F>
        <F label="UF"><Input maxLength={2} value={f.state} onChange={set("state")} /></F>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
        <span className="text-muted-foreground">
          {coords ? `Localização: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "Sem localização (opcional)"}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={locate}><LocateFixed className="h-4 w-4" /> Estou aqui</Button>
      </div>
      <Button type="submit" className="w-full" disabled={m.isPending}>Salvar supermercado</Button>
    </form>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
