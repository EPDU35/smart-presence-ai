import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { fetchTodayCheckins } from "@/services/checkin.service";
import { fetchEmployees } from "@/services/employee.service";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/utils/format";
import { Activity, Users, UserCheck, Clock, RefreshCw } from "lucide-react";
import type { Checkin, User } from "@/types";

function getInitials(emp: User | undefined): string {
  if (!emp) return "?";
  return `${emp.firstname[0]}${emp.lastname[0]}`;
}

function getName(emp: User | undefined, fallback: string): string {
  if (!emp) return fallback;
  return `${emp.firstname} ${emp.lastname}`;
}

export function LivePage() {
  const { user } = useAuthStore();
  const companyId = user?.company_id ?? "";
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown, setCountdown] = useState(30);

  const { data: checkins = [], isLoading: loadingCheckins, refetch } = useQuery({
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
    const map: Record<string, User> = {};
    employees.forEach((e) => { map[e.id] = e; });
    return map;
  }, [employees]);

  const stats = useMemo(() => {
    const present = checkins.filter((c) => c.status === "VALID").length;
    const absent = employees.length - present;
    const late = checkins.filter((c) => c.status === "SUSPICIOUS").length;
    return { present, absent, late, total: employees.length };
  }, [checkins, employees]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setLastRefresh(new Date());
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function handleManualRefresh() {
    refetch();
    setLastRefresh(new Date());
    setCountdown(30);
  }

  const isLoading = loadingCheckins || loadingEmployees;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Live</h1>
            <span className="flex h-2.5 w-2.5 items-center">
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-success-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success-500" />
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Présences en direct · Dernière mise à jour {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser ({countdown}s)
        </button>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        {[
          {
            icon: Users,
            label: "Total équipe",
            value: stats.total,
            iconBg: "bg-slate-100",
            iconColor: "text-slate-600",
          },
          {
            icon: UserCheck,
            label: "Présents",
            value: stats.present,
            iconBg: "bg-success-50",
            iconColor: "text-success-600",
            valueColor: "text-success-600",
          },
          {
            icon: Activity,
            label: "Absents",
            value: stats.absent,
            iconBg: "bg-danger-50",
            iconColor: "text-danger-600",
            valueColor: "text-danger-600",
          },
          {
            icon: Clock,
            label: "Retards",
            value: stats.late,
            iconBg: "bg-warning-50",
            iconColor: "text-warning-600",
            valueColor: "text-warning-600",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className={`mt-1 text-3xl font-bold ${card.valueColor ?? "text-slate-900"}`}>
                  {isLoading ? "—" : card.value}
                </p>
              </div>
              <div className={`rounded-lg p-2.5 ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Live feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Feed principal */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Activité du jour</h2>
              <Badge variant="success">
                {checkins.length} pointage{checkins.length > 1 ? "s" : ""}
              </Badge>
            </div>

            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : checkins.length === 0 ? (
              <div className="flex h-48 items-center justify-center">
                <p className="text-sm text-slate-400">Aucun pointage aujourd'hui</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <AnimatePresence>
                  {checkins.slice(0, 20).map((checkin, i) => {
                    const emp = employeeMap[checkin.user_id];
                    return (
                      <motion.div
                        key={checkin.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                          {getInitials(emp)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {getName(emp, checkin.user_id.slice(0, 8))}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDateTime(checkin.created_at)} · {Math.round(checkin.distance)}m
                          </p>
                        </div>
                        <Badge
                          variant={
                            checkin.status === "VALID"
                              ? "success"
                              : checkin.status === "INVALID"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {checkin.status === "VALID"
                            ? "Présent"
                            : checkin.status === "INVALID"
                            ? "Refusé"
                            : "Suspect"}
                        </Badge>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Panneau latéral - Présents */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Équipe présente</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {stats.present}/{stats.total} membres
              </p>
            </div>

            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {employees.map((emp) => {
                  const checkin = checkins.find(
                    (c) => c.user_id === emp.id && c.status === "VALID"
                  );
                  return (
                    <div
                      key={emp.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="relative">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                          {getInitials(emp)}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                            checkin ? "bg-success-500" : "bg-slate-300"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {emp.firstname} {emp.lastname}
                        </p>
                        {checkin ? (
                          <p className="text-xs text-success-600">
                            {formatDateTime(checkin.created_at)}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400">Non pointé</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
