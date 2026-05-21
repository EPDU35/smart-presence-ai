import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { fetchCheckins } from "@/services/checkin.service";
import { fetchEmployees } from "@/services/employee.service";
import { AttendanceChart } from "@/components/charts/AttendanceChart";
import { PresencePieChart } from "@/components/charts/PresencePieChart";
import { StatCard } from "@/components/cards/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Download, TrendingUp, TrendingDown, UserCheck, Clock, Target, Award } from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";

type Period = "week" | "month";

function exportCSV(data: { date: string; present: number; absent: number }[]) {
  const header = "Date,Présents,Absents";
  const rows = data.map((d) => `${d.date},${d.present},${d.absent}`);
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `presences-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsPage() {
  const { user } = useAuthStore();
  const companyId = user?.company_id ?? "";
  const [period, setPeriod] = useState<Period>("week");

  const { data: checkins = [], isLoading: loadingCheckins } = useQuery({
    queryKey: ["checkins", companyId],
    queryFn: () => fetchCheckins(companyId),
    enabled: !!companyId,
  });

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => fetchEmployees(companyId),
    enabled: !!companyId,
  });

  const isLoading = loadingCheckins || loadingEmployees;

  const chartData = useMemo(() => {
    const now = new Date();
    const from = period === "week"
      ? startOfWeek(now, { weekStartsOn: 1 })
      : startOfMonth(now);
    const days = eachDayOfInterval({ start: from, end: now });

    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayCheckins = checkins.filter((c) => c.created_at.startsWith(dayStr));
      const present = dayCheckins.filter((c) => c.status === "VALID").length;
      const absent = Math.max(0, employees.length - present);
      return {
        date: format(day, period === "week" ? "EEE" : "d MMM", { locale: fr }),
        present,
        absent,
      };
    });
  }, [checkins, employees, period]);

  const stats = useMemo(() => {
    const valid = checkins.filter((c) => c.status === "VALID").length;
    const invalid = checkins.filter((c) => c.status === "INVALID").length;
    const suspicious = checkins.filter((c) => c.status === "SUSPICIOUS").length;
    const total = checkins.length;
    const rate = total > 0 ? Math.round((valid / total) * 100) : 0;

    // Top employees
    const counts: Record<string, number> = {};
    checkins.filter((c) => c.status === "VALID").forEach((c) => {
      counts[c.user_id] = (counts[c.user_id] ?? 0) + 1;
    });
    const topIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { valid, invalid, suspicious, total, rate, topIds };
  }, [checkins]);

  const employeeMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach((e) => { map[e.id] = `${e.firstname} ${e.lastname}`; });
    return map;
  }, [employees]);

  const pieData = [
    { name: "Présents", value: stats.valid },
    { name: "Refusés", value: stats.invalid },
    { name: "Suspects", value: stats.suspicious },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Statistiques</h1>
          <p className="text-sm text-slate-500">Analyse des présences de votre équipe</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {(["week", "month"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${period === p ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>
                {p === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>
          <button onClick={() => exportCSV(chartData)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Taux de présence" value={`${stats.rate}%`} icon={Target} variant={stats.rate >= 80 ? "success" : stats.rate >= 60 ? "warning" : "danger"}
              trend={stats.rate >= 80 ? "Excellent" : stats.rate >= 60 ? "Moyen" : "Faible"} trendUp={stats.rate >= 80} />
            <StatCard label="Présences validées" value={stats.valid} icon={UserCheck} variant="success" />
            <StatCard label="Retards / Suspects" value={stats.suspicious} icon={Clock} variant="warning" />
            <StatCard label="Refusés" value={stats.invalid} icon={TrendingDown} variant="danger" />
          </>
        )}
      </motion.div>

      {/* Charts */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-semibold text-slate-900">Présences par jour</h3>
          </div>
          <div className="p-5">
            {isLoading ? <Skeleton className="h-52 w-full rounded-xl" /> : <AttendanceChart data={chartData} />}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-semibold text-slate-900">Répartition</h3>
          </div>
          <div className="p-5">
            {isLoading ? <Skeleton className="h-52 w-full rounded-xl" /> : (
              <>
                <PresencePieChart data={pieData} />
                <div className="mt-4 space-y-2">
                  {[
                    { label: "Présents", value: stats.valid, variant: "success" as const },
                    { label: "Suspects", value: stats.suspicious, variant: "warning" as const },
                    { label: "Refusés", value: stats.invalid, variant: "danger" as const },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                        <Badge variant={item.variant}>{stats.total > 0 ? `${Math.round((item.value / stats.total) * 100)}%` : "0%"}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Top employees */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Award className="h-4 w-4 text-warning-500" />
            <h3 className="font-semibold text-slate-900">Top employés — présences validées</h3>
          </div>
          {isLoading ? (
            <div className="space-y-px p-5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : stats.topIds.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-slate-400">Aucune donnée disponible</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.topIds.map(([id, count], i) => (
                <div key={id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? "bg-warning-100 text-warning-700"
                    : i === 1 ? "bg-slate-200 text-slate-600"
                    : "bg-slate-100 text-slate-500"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                    {employeeMap[id]?.split(" ").map((n) => n[0]).join("") ?? "?"}
                  </div>
                  <p className="flex-1 text-sm font-medium text-slate-900">{employeeMap[id] ?? "Employé"}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(100, (count / (stats.topIds[0]?.[1] ?? 1)) * 100)}%` }} />
                    </div>
                    <Badge variant="success">{count} jour{count > 1 ? "s" : ""}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
