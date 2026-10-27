import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ProductForm } from "@/components/ProductForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/escanear")({
  head: () => ({ meta: [{ title: "Escanear — MarketPreço" }, { name: "description", content: "Leia o código de barras de um produto." }, { property: "og:title", content: "Escanear — MarketPreço" }, { property: "og:description", content: "Leia o código de barras de um produto." }] }),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const [unknown, setUnknown] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  async function onDetected(code: string) {
    const { data, error } = await supabase.from("products").select("id").eq("barcode", code).maybeSingle();
    if (error) return toast.error(error.message);
    if (data) navigate({ to: "/produto/$id", params: { id: data.id } });
    else setUnknown(code);
  }

  return (
    <>
      <PageHeader title="Escanear" subtitle="EAN/GTIN pela câmera ou digitado." />
      {unknown ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-muted p-3 text-sm">Código <strong className="tabular">{unknown}</strong> ainda não está cadastrado. Cadastre o produto:</p>
          <ProductForm initialBarcode={unknown} onCreated={(p) => navigate({ to: "/produto/$id", params: { id: p.id } })} />
          <Button variant="ghost" className="w-full" onClick={() => { setUnknown(null); setKey((k) => k + 1); }}>Escanear outro</Button>
        </div>
      ) : (
        <BarcodeScanner key={key} onDetected={onDetected} />
      )}
    </>
  );
}
