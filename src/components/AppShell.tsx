import { Link, Outlet } from "@tanstack/react-router";
import { Home, ScanBarcode, ListChecks, MapPin, Scale, ShoppingBasket } from "lucide-react";

const nav = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/mapa", label: "Mapa", icon: MapPin },
  { to: "/lista", label: "Lista", icon: ListChecks },
  { to: "/escanear", label: "Scanner", icon: ScanBarcode },
  { to: "/comparar", label: "Comparar", icon: Scale },
] as const;

function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/inicio" className="inline-flex items-center gap-2.5" aria-label="MarketPreço — voltar ao início">
      <img src="/marketpreco-logo.svg" alt="" className="h-9 w-9 rounded-lg bg-white p-0.5" />
      <span className="font-display text-lg font-extrabold tracking-tight">
        <span className={inverted ? "text-white" : "text-[#063d46] dark:text-white"}>Market</span>
        <span className={inverted ? "text-[#9eef8d]" : "text-[#08a16f]"}>Preço</span>
      </span>
    </Link>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-[#084b91] bg-[#075aab] shadow-sm">
        <div className="mx-auto flex h-[66px] max-w-7xl items-center justify-between px-4 sm:px-6">
          <Brand inverted />
          <div className="flex items-center gap-2 text-xs text-white/85">
            <ShoppingBasket className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Compare. Economize. Escolha melhor.</span>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden min-h-[calc(100vh-66px)] w-64 shrink-0 border-r border-border bg-card px-4 py-7 lg:block">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Explorar</p>
          <nav aria-label="Navegação lateral" className="space-y-1.5">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} activeOptions={{ exact: true }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-[#edf5ff] hover:text-[#075aab]"
                activeProps={{ className: "bg-[#e3f0ff] !text-[#075aab]" }}>
                <Icon className="h-5 w-5" aria-hidden="true" />{label === "Lista" ? "Minha Lista" : label === "Scanner" ? "Escanear" : label}
              </Link>
            ))}
          </nav>
          <div className="mt-10 rounded-xl bg-[#eef8f5] p-4 text-sm text-[#134a43]">
            <strong>Economia começa aqui</strong>
            <p className="mt-1 text-xs leading-relaxed">Registre valores reais e compare suas compras com mais clareza.</p>
          </div>
        </aside>
        <main id="conteudo" className="mx-auto min-w-0 w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-9 lg:pb-12 lg:pt-8">
          <Outlet />
        </main>
      </div>
      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(4,35,70,.09)] backdrop-blur dark:bg-card/95 lg:hidden">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {nav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} activeOptions={{ exact: true }}
                className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[10px] font-semibold text-muted-foreground"
                activeProps={{ className: "!text-[#075aab]" }}>
                <Icon className="h-5 w-5" aria-hidden="true" />{label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-[#12304f] dark:text-foreground sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
