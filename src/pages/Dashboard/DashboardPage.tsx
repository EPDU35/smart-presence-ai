import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { fetchTodayCheckins, fetchWeekCheckins } from "@/services/checkin.service";
import { fetchEmployees } from "@/services/employee.service";
import { fetchDailyAttendance } from "@/database/services/daily-attendance.service";
import { useDayClosure } from "@/hooks/useDayClosure";
import { useTodayAttendanceStats } from "@/hooks/useTodayAttendanceStats";
import { getLocalDateKey } from "@/utils/attendance-day";
import { StatCard } from "@/components/cards/StatCard";
import { QrGenerator } from "@/components/qr/QrGenerator";
import { AttendanceChart } from "@/components/charts/AttendanceChart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/utils/format";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import type { Checkin } from "@/types";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function CheckinFeedItem({ checkin, name }: { checkin: Checkin; name: string }) {
  const isValid = checkin.status === "VALID";
  const isWarning = checkin.status === "SUSPICIOUS";
  return (
    <div className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
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
  const { user, company } = useAuthStore();
  const companyId = user?.company_id ?? "";
  const todayDate = getLocalDateKey();

  const { data: checkins = [], isLoading: loadingCheckins } = useQuery({
    queryKey: ["checkins", "today", companyId],
    queryFn: () => fetchTodayCheckins(companyId),
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  const { data: weekCheckins = [] } = useQuery({
    queryKey: ["checkins", "week", companyId],
    queryFn: () => fetchWeekCheckins(companyId),
    enabled: !!companyId,
  });

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => fetchEmployees(companyId),
    enabled: !!companyId,
  });

  const { data: dailyRecords = [] } = useQuery({
    queryKey: ["daily-attendance", companyId, todayDate],
    queryFn: () => fetchDailyAttendance(companyId, todayDate),
    enabled: !!companyId,
    refetchInterval: 60000,
  });

  useDayClosure(company, employees, checkins, user?.role);

  const stats = useTodayAttendanceStats(employees, checkins, dailyRecords);

  const employeeMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach((e) => { map[e.id] = `${e.firstname} ${e.lastname}`; });
    return map;
  }, [employees]);

  // Calcul des données du graphique à partir des vrais checkins de la semaine
  const chartData = useMemo(() => {
    // Générer les 7 jours de la semaine (Lun → Dim)
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);

    const days: { date: string; present: number; absent: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      // Ne pas afficher les jours futurs
      if (d > now) break;

      const dayCheckins = weekCheckins.filter((c) => {
        const cDate = new Date(c.created_at).toISOString().split("T")[0];
        return cDate === dateStr && c.status === "VALID";
      });
      // Compter les utilisateurs uniques présents ce jour-là
      const uniquePresent = new Set(dayCheckins.map((c) => c.user_id)).size;

      // Seulement compter comme absent les employés qui étaient déjà créés ce jour-là
      // On met d à la fin de la journée (23:59:59) pour compter ceux créés dans la journée
      const endOfDay = new Date(d);
      endOfDay.setHours(23, 59, 59, 999);
      
      const expectedEmployees = employees.filter(e => new Date(e.created_at) <= endOfDay).length;

      days.push({
        date: DAY_LABELS[d.getDay()],
        present: uniquePresent,
        absent: Math.max(0, expectedEmployees - uniquePresent),
      });
    }

    return days;
  }, [weekCheckins, employees]);

  const isLoading = loadingCheckins || loadingEmployees;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-sm text-slate-500">
          {stats.dayClosed
            ? "Journée clôturée — absents enregistrés. Demain : nouveau jour (compteurs remis à zéro)."
            : "Vue globale de votre activité aujourd'hui."}
        </p>
      </motion.div>

      {/* KPI Cards */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Total équipe" value={stats.total} icon={Users} variant="primary" />
            <StatCard label="Présents" value={stats.present} icon={UserCheck} variant="success" trend={stats.present > 0 ? `${Math.round((stats.present / (stats.total || 1)) * 100)}% de présence` : undefined} trendUp />
            <StatCard label="Absents" value={stats.absent} icon={UserX} variant="danger" />
            <StatCard label="Retards" value={stats.late} icon={Clock} variant="warning" />
          </>
        )}
      </motion.div>

      {/* Chart + QR */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Présences cette semaine</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Tendance des pointages récents.</p>
          </CardHeader>
          <CardContent className="min-h-[300px]">
            <AttendanceChart data={chartData} />
          </CardContent>
        </Card>
        <div>
          <QrGenerator />
        </div>
      </motion.div>

      {/* Live feed */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card padding="none" className="overflow-hidden">
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
                <div key={i} className="flex items-center gap-3 px-5 py-4">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : checkins.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-5">
              <p className="text-sm text-slate-400">Aucun pointage enregistré aujourd'hui</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {checkins.slice(0, 8).map((c) => (
                <CheckinFeedItem key={c.id} checkin={c} name={employeeMap[c.user_id] ?? "Employé inconnu"} />
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
