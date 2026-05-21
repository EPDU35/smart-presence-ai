import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { fetchCheckins } from "@/services/checkin.service";
import { fetchEmployees } from "@/services/employee.service";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/utils/format";
import { Search, Calendar, Download, MapPin } from "lucide-react";
import type { Checkin } from "@/types";

function exportToCSV(checkins: Checkin[], employeeMap: Record<string, { firstname: string; lastname: string }>) {
  const header = "Employé,Date,Heure,Statut,Distance (m)";
  const rows = checkins.map((c) => {
    const emp = employeeMap[c.user_id];
    const name = emp ? `${emp.firstname} ${emp.lastname}` : c.user_id.slice(0, 8);
    const date = new Date(c.created_at);
    const dateStr = date.toLocaleDateString("fr-FR");
    const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return [name, dateStr, timeStr, c.status, Math.round(c.distance)].join(",");
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `presences-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type Period = "today" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
};

function getDateRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);

  if (period === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    const day = now.getDay();
    from.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }

  return { from, to };
}

export function AttendancePage() {
  const { user } = useAuthStore();
  const companyId = user?.company_id ?? "";
  const [period, setPeriod] = useState<Period>("today");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: checkins = [], isLoading: loadingCheckins } = useQuery({
    queryKey: ["checkins", companyId],
    queryFn: () => fetchCheckins(companyId),
    enabled: !!companyId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => fetchEmployees(companyId),
    enabled: !!companyId,
  });

  const employeeMap = useMemo(() => {
    const map: Record<string, { firstname: string; lastname: string }> = {};
    employees.forEach((e) => {
      map[e.id] = { firstname: e.firstname, lastname: e.lastname };
    });
    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    const { from, to } = getDateRange(period);
    return checkins.filter((c) => {
      const date = new Date(c.created_at);
      if (date < from || date > to) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      const emp = employeeMap[c.user_id];
      if (search && emp) {
        const name = `${emp.firstname} ${emp.lastname}`.toLowerCase();
        if (!name.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [checkins, period, statusFilter, search, employeeMap]);

  const stats = useMemo(() => {
    const { from, to } = getDateRange(period);
    
    // Pour les statistiques globales de la période, on compte le nombre total d'événements
    const total = filtered.length;
    const valid = filtered.filter((c) => c.status === "VALID").length;
    const invalid = filtered.filter((c) => c.status === "INVALID").length;
    const suspicious = filtered.filter((c) => c.status === "SUSPICIOUS").length;
    
    // Pour calculer les absents sur la période, on doit itérer jour par jour
    let totalExpected = 0;
    let totalUniquePresents = 0;
    
    const currentDate = new Date(from);
    const endDate = new Date(Math.min(to.getTime(), new Date().getTime())); // Ne pas compter le futur
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      
      // Employés attendus pour CE jour précis
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);
      const expectedForDay = employees.filter(e => new Date(e.created_at) <= endOfDay).length;
      totalExpected += expectedForDay;
      
      // Employés uniques présents CE jour précis
      const dayCheckins = filtered.filter((c) => {
        const cDate = new Date(c.created_at).toISOString().split("T")[0];
        return cDate === dateStr && c.status === "VALID";
      });
      const uniquePresentsForDay = new Set(dayCheckins.map((c) => c.user_id)).size;
      totalUniquePresents += uniquePresentsForDay;
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const absents = Math.max(0, totalExpected - totalUniquePresents);

    return { total, valid, invalid, suspicious, absents };
  }, [filtered, period, employees]);

  const columns = [
    {
      key: "employee",
      header: "Employé",
      render: (row: Checkin) => {
        const emp = employeeMap[row.user_id];
        return emp ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              {emp.firstname[0]}{emp.lastname[0]}
            </div>
            <span className="font-medium text-slate-900">
              {emp.firstname} {emp.lastname}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs font-mono">{row.user_id.slice(0, 8)}…</span>
        );
      },
    },
    {
      key: "created_at",
      header: "Date & heure",
      render: (row: Checkin) => (
        <div className="flex items-center gap-1.5 text-slate-600">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          {formatDateTime(row.created_at)}
        </div>
      ),
    },
    {
      key: "status",
      header: "Statut",
      render: (row: Checkin) => (
        <Badge
          variant={
            row.status === "VALID"
              ? "success"
              : row.status === "INVALID"
              ? "danger"
              : "warning"
          }
        >
          {row.status === "VALID"
            ? "Présent"
            : row.status === "INVALID"
            ? "Refusé"
            : "Suspect"}
        </Badge>
      ),
    },
    {
      key: "distance",
      header: "Distance",
      render: (row: Checkin) => (
        <div className="flex items-center gap-1 text-slate-600">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          {Math.round(row.distance)}m
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Présences</h1>
          <p className="text-sm text-slate-500">
            Historique complet des pointages
          </p>
        </div>
        <button onClick={() => exportToCSV(filtered, employeeMap)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
          <Download className="h-4 w-4" />
          Exporter CSV
        </button>
      </motion.div>

      {/* Stats rapides */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-5"
      >
        {[
          { label: "Pointages", value: stats.total, color: "text-slate-900" },
          { label: "Présents", value: stats.valid, color: "text-success-600" },
          { label: "Absents", value: stats.absents, color: "text-danger-600" },
          { label: "Refusés", value: stats.invalid, color: "text-danger-400" },
          { label: "Retards", value: stats.suspicious, color: "text-warning-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >
        {/* Period tabs */}
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={
                period === p
                  ? "rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
              }
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option value="all">Tous les statuts</option>
          <option value="VALID">Présents</option>
          <option value="INVALID">Refusés</option>
          <option value="SUSPICIOUS">Suspects</option>
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un employé..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        {loadingCheckins ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            keyExtractor={(r) => r.id}
            pageSize={10}
            emptyMessage="Aucun pointage pour cette période"
          />
        )}
      </motion.div>
    </div>
  );
}
