import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { fetchTodayCheckins } from "@/services/checkin.service";
import { fetchEmployees } from "@/services/employee.service";
import { StatCard } from "@/components/cards/StatCard";
import { QrGenerator } from "@/components/qr/QrGenerator";
import { AttendanceChart } from "@/components/charts/AttendanceChart";
import { Users, UserCheck, UserX, Clock } from "lucide-react";

export function DashboardPage() {
  const { user } = useAuthStore();
  const companyId = user?.company_id ?? "";

  const { data: checkins = [] } = useQuery({
    queryKey: ["checkins", "today", companyId],
    queryFn: () => fetchTodayCheckins(companyId),
    enabled: !!companyId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => fetchEmployees(companyId),
    enabled: !!companyId,
  });

  const present = checkins.filter((c) => c.status === "VALID").length;
  const absent = employees.length - present;

  const chartData = [
    { date: "Lun", present: 12, absent: 3 },
    { date: "Mar", present: 14, absent: 1 },
    { date: "Mer", present: 11, absent: 4 },
    { date: "Jeu", present: 15, absent: 0 },
    { date: "Ven", present: 13, absent: 2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-sm text-slate-500">Vue d ensemble de votre activite</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total employes" value={employees.length} icon={Users} />
        <StatCard label="Presents aujourd hui" value={present} icon={UserCheck} trend="+2 vs hier" trendUp />
        <StatCard label="Absents" value={absent} icon={UserX} />
        <StatCard label="Heures moyennes" value="7h30" icon={Clock} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Presences cette semaine</h3>
            <AttendanceChart data={chartData} />
          </div>
        </div>
        <div>
          <QrGenerator />
        </div>
      </div>
    </div>
  );
}
