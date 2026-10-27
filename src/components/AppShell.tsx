import { Link, Outlet } from "@tanstack/react-router";
import { Home, ScanBarcode, ListChecks, MapPin, Scale } from "lucide-react";

const nav = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/escanear", label: "Escanear", icon: ScanBarcode },
  { to: "/lista", label: "Minha Lista", icon: ListChecks },
  { to: "/mapa", label: "Mapa", icon: MapPin },
  { to: "/comparar", label: "Comparar", icon: Scale },
] as const;

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <main className="flex-1 px-4 pb-28 pt-5">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {nav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
                activeProps={{ className: "text-primary" }}
              >
                <Icon className="h-5 w-5" />
                {label}
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
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
