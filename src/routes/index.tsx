import { createFileRoute, Link } from "@tanstack/react-router";
import { ScanBarcode, Store, ListChecks, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MarketPreço — preços de supermercado colaborativos" },
      { name: "description", content: "Registre preços que você viu no supermercado, monte sua lista e saiba o total antes do caixa." },
      { property: "og:title", content: "MarketPreço — preços de supermercado colaborativos" },
      { property: "og:description", content: "Registre preços reais, monte sua lista e acompanhe o total da compra." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Store, t: "Lojas de verdade", d: "Cada unidade com endereço e cidade." },
  { icon: ScanBarcode, t: "Código de barras", d: "Leia pela câmera ou digite." },
  { icon: ListChecks, t: "Lista com total", d: "Orçamento, subtotal e itens sem preço à vista." },
  { icon: ShieldCheck, t: "Privado por padrão", d: "Você decide o que compartilhar." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <section className="bg-hero px-5 pb-14 pt-16 text-primary-foreground">
        <div className="mx-auto max-w-xl">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-sm">
            <img src="/marketpreco-logo.svg" alt="" className="h-14 w-14" />
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl"><span className="text-[#063d46]">Market</span><span className="text-[#08a16f]">Preço</span></h1>
          </div>
          <p className="mt-3 text-lg text-primary-foreground/85">
            Anote o preço que você viu na gôndola, monte sua lista e saiba quanto vai gastar.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8">
            <Link to="/auth">Começar</Link>
          </Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-xl gap-3 px-5 py-8 sm:grid-cols-2">
        {features.map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-xl bg-card p-4 shadow-card">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="mt-2 font-semibold">{t}</h2>
            <p className="text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
