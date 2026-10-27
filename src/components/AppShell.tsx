import { Link, Outlet } from "@tanstack/react-router";
import { Home, ScanBarcode, ListChecks, MapPin, Scale, ShoppingBasket } from "lucide-react";

const nav = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/escanear", label: "Escanear", icon: ScanBarcode },
  { to: "/lista", label: "Minha Lista", icon: ListChecks },
  { to: "/mapa", label: "Mapa", icon: MapPin },
  { to: "/comparar", label: "Comparar", icon: Scale },
] as const;

export function AppShell() {
  return (
    <div className="mx-auto min-h-screen max-w-7xl md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card px-4 py-7 md:flex">
        <Link to="/inicio" className="mb-10 flex items-center gap-3 px-3 text-lg font-extrabold text-primary">
          <ShoppingBasket className="h-7 w-7" aria-hidden="true" />
          MarketPreço
        </Link>
        <nav aria-label="Navegação principal" className="space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
              activeProps={{ className: "bg-primary-soft text-primary" }}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main id="conteudo" className="mx-auto w-full min-w-0 max-w-3xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
        <Outlet />
      </main>

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {nav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: true }}
                className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[11px] font-medium text-muted-foreground"
                activeProps={{ className: "text-primary" }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
