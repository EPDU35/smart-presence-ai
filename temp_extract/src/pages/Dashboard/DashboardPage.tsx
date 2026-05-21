import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { fetchTodayCheckins } from "@/services/checkin.service";
import { fetchEmployees } from "@/services/employee.service";
import { StatCard } from "@/components/cards/StatCard";
import { QrGenerator } from "@/components/qr/QrGenerator";
import { AttendanceChart } from "@/components/charts/AttendanceChart";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/utils/format";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import type { Checkin } from "@/types";

const CHART_DATA = [
  { date: "Lun", present: 12, absent: 3 },
  { date: "Mar", present: 14, absent: 1 },
  { date: "Mer", present: 11, absent: 4 },
  { date: "Jeu", present: 15, absent: 0 },
  { date: "Ven", present: 13, absent: 2 },
];

function CheckinFeedItem({ checkin, name }: { checkin: Checkin; name: string }) {
  const isValid = checkin.status === "VALID";
  const isWarning = checkin.status === "SUSPICIOUS";
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
      <div className={`h-2 w-2 shrink-0 rounded-full ${isValid ? "bg-success-500" : isWarning ? "bg-warning-500" : "bg-danger-500"}`} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-400">{formatDateTime(checkin.created_at)}</p>
      </div>
      <Badge variant={isValid ? "success" : isWarning ? "warning" : "danger"}>
        {isValid ? "Présent" : isWarning ? "Retard" : "Refusé"}
      </Badge>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const companyId = user?.company_id ?? "";

  const { data: checkins = [], isLoading: loadingCheckins } = useQuery({
    queryKey: ["checkins", "today", companyId],
    queryFn: () => fetchTodayCheckins(companyId),
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => fetchEmployees(companyId),
    enabled: !!companyId,
  });

  const employeeMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach((e) => { map[e.id] = `${e.firstname} ${e.lastname}`; });
    return map;
  }, [employees]);

  const present = checkins.filter((c) => c.status === "VALID").length;
  const late = checkins.filter((c) => c.status === "SUSPICIOUS").length;
  const absent = employees.length - present;

  const isLoading = loadingCheckins || loadingEmployees;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-sm text-slate-500">Vue globale de votre activité aujourd'hui.</p>
      </motion.div>

      {/* KPI Cards */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Total équipe" value={employees.length} icon={Users} variant="primary" />
            <StatCard label="Présents" value={present} icon={UserCheck} variant="success" trend={present > 0 ? `${Math.round((present / (employees.length || 1)) * 100)}% de présence` : undefined} trendUp />
            <StatCard label="Absents" value={absent} icon={UserX} variant="danger" />
            <StatCard label="Retards" value={late} icon={Clock} variant="warning" />
          </>
        )}
      </motion.div>

      {/* Chart + QR */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Présences cette semaine</h3>
          <AttendanceChart data={CHART_DATA} />
        </div>
        <div>
          <QrGenerator />
        </div>
      </motion.div>

      {/* Live feed */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">Activité en temps réel</h3>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
              </span>
            </div>
            <Badge variant="default">{checkins.length} pointage{checkins.length !== 1 ? "s" : ""}</Badge>
          </div>

          {isLoading ? (
            <div className="space-y-px p-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : checkins.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-slate-400">Aucun pointage enregistré aujourd'hui</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {checkins.slice(0, 8).map((c) => (
                <CheckinFeedItem key={c.id} checkin={c} name={employeeMap[c.user_id] ?? "Employé inconnu"} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
