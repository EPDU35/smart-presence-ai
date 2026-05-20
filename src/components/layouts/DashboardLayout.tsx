import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/utils/cn";

export function DashboardLayout() {
  const { sidebarOpen } = useUiStore();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-200",
          sidebarOpen ? "lg:ml-64" : "ml-0"
        )}
      >
        <TopBar />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
