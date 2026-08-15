import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ListOrdered,
  Menu,
  Settings2,
  Tags,
} from "lucide-react";
import { useAuth } from "@/features/auth/model/auth-context";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/cn";

const links = [
  { to: "/", label: "Обзор", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Операции", icon: ListOrdered },
  { to: "/categories", label: "Категории", icon: Tags },
  { to: "/settings", label: "Настройки", icon: Settings2 },
];

function NavItems({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex gap-2", className)}>
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-2 rounded-2xl border-2 border-black/90 px-3 py-2 text-sm font-semibold transition",
              isActive
                ? "bg-[#d8fb88] text-black shadow-[0_4px_0_rgba(0,0,0,0.85)]"
                : "bg-[#fff6be] text-black shadow-[0_4px_0_rgba(0,0,0,0.85)] hover:bg-[#ffef93]",
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const jakeBg = `${import.meta.env.BASE_URL}theme/jake.png`;
  const finnBg = `${import.meta.env.BASE_URL}theme/finn.png`;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <img
          src={jakeBg}
          alt=""
          aria-hidden="true"
          className="absolute -left-8 bottom-6 w-28 opacity-20 md:-left-2 md:bottom-10 md:w-44"
        />
        <img
          src={finnBg}
          alt=""
          aria-hidden="true"
          className="absolute -right-6 top-20 w-24 opacity-20 md:right-0 md:top-24 md:w-40"
        />
        <div className="absolute left-6 top-8 h-20 w-20 rounded-full border-2 border-black/20 bg-[#ffd8e5]" />
        <div className="absolute right-8 top-24 h-14 w-14 rounded-full border-2 border-black/20 bg-[#c8f6ff]" />
        <div className="absolute bottom-12 left-1/3 h-16 w-16 rounded-full border-2 border-black/20 bg-[#ffe8b8]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-4 md:gap-6 md:px-8 md:py-6">
        <header className="flex items-center justify-between gap-3 rounded-[28px] border-2 border-black/90 bg-[#fffdf5] px-4 py-3 shadow-[0_6px_0_rgba(0,0,0,0.85)] md:gap-4 md:px-5 md:py-4">
          <div className="min-w-0">
            <div className="font-display text-xl tracking-tight text-black md:text-2xl">
              MoneyFlow
            </div>
            <div className="truncate text-sm text-black/60">{user?.name}</div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <NavItems className="flex-wrap" />
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              Выйти
            </Button>
          </div>

          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="shrink-0 md:hidden"
                aria-label="Меню"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2 md:hidden">
              <NavItems
                className="flex-col"
                onNavigate={() => setMenuOpen(false)}
              />
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 w-full"
                onClick={() => {
                  setMenuOpen(false);
                  void logout();
                }}
              >
                Выйти
              </Button>
            </PopoverContent>
          </Popover>
        </header>
        <main className="flex-1 pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
