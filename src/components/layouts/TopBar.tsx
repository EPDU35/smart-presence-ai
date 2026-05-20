import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { Bell, Menu, Search } from "lucide-react";

export function TopBar() {
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const { user, company } = useAuthStore();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 hover:bg-slate-100 transition-colors"
        >
          <Menu className="h-5 w-5 text-slate-600" />
        </button>

        {/* Company name - desktop only */}
        {company?.name && (
          <p className="hidden text-sm font-medium text-slate-500 lg:block">
            {company.name}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative rounded-lg p-2 hover:bg-slate-100 transition-colors">
          <Bell className="h-5 w-5 text-slate-500" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
        </button>

        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
          {user?.firstname?.[0] ?? "?"}{user?.lastname?.[0] ?? ""}
        </div>
      </div>
    </header>
  );
}
