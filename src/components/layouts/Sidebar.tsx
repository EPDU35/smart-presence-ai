import { NavLink, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/utils/cn";
import {
  LayoutDashboard,
  Users,
  QrCode,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  X,
  Activity,
  Clock,
  History,
} from "lucide-react";

const ADMIN_NAV = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/employees", label: "Employés", icon: Users },
  { to: "/attendance", label: "Présences", icon: Clock },
  { to: "/live", label: "Live", icon: Activity, dot: true },
  { to: "/analytics", label: "Analyses", icon: BarChart3 },
  { to: "/settings", label: "Paramètres", icon: Settings },
];

const SUPER_ADMIN_EXTRA = [
  { to: "/admin", label: "Administration", icon: Shield },
];

const EMPLOYEE_NAV = [
  { to: "/dashboard", label: "Mon espace", icon: LayoutDashboard },
  { to: "/checkin", label: "Pointer", icon: QrCode },
  { to: "/history", label: "Mon historique", icon: History },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const isEmployee = user?.role === "EMPLOYEE";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const navItems = isEmployee
    ? EMPLOYEE_NAV
    : isSuperAdmin
    ? [...ADMIN_NAV, ...SUPER_ADMIN_EXTRA]
    : ADMIN_NAV;

  return (
    <>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-slate-900">Smart Presence</h1>
          </div>
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors lg:hidden"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => {
                      // Ferme sidebar sur mobile
                      if (window.innerWidth < 1024) toggleSidebar();
                    }}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                    {("dot" in item) && (item as { dot?: boolean }).dot && (
                      <span className="ml-auto flex h-2 w-2">
                        <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-success-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {/* Section rôle */}
          {!isEmployee && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Employé
              </p>
              <NavLink
                to="/checkin"
                onClick={() => {
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  location.pathname === "/checkin"
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <QrCode className="h-4 w-4 shrink-0" />
                Pointage QR
              </NavLink>
            </div>
          )}
        </nav>

        {/* Profil + logout */}
        <div className="shrink-0 border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              {user?.firstname?.[0] ?? "?"}{user?.lastname?.[0] ?? ""}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {user?.firstname} {user?.lastname}
              </p>
              <p className="truncate text-xs text-slate-400">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
