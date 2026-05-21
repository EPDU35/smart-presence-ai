import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { StatCard } from "@/components/cards/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/utils/format";
import { Shield, Users, Building2, AlertTriangle, Activity, Lock, MoreVertical, CheckCircle, XCircle } from "lucide-react";
import type { Company, User, SuspiciousLog } from "@/types";

const planColors: Record<string, "success" | "primary" | "warning" | "default"> = {
  enterprise: "success",
  pro: "primary",
  starter: "warning",
};

type AdminTab = "overview" | "companies" | "users" | "security";

export function AdminPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<AdminTab>("overview");

  // Fetch all companies
  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["admin", "companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Company[];
    },
    enabled: user?.role === "SUPER_ADMIN",
  });

  // Fetch all users
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as User[];
    },
    enabled: user?.role === "SUPER_ADMIN",
  });

  // Fetch suspicious logs
  const { data: suspiciousLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["admin", "suspicious_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suspicious_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SuspiciousLog[];
    },
    enabled: user?.role === "SUPER_ADMIN",
  });

  // Company map for lookups
  const companyMap = useMemo(() => {
    const map: Record<string, string> = {};
    companies.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [companies]);

  // User map for lookups
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    allUsers.forEach((u) => { map[u.id] = `${u.firstname} ${u.lastname}`; });
    return map;
  }, [allUsers]);

  const activeCompanies = companies.filter((c) => c.is_active).length;
  const activeUsers = allUsers.filter((u) => u.is_active).length;
  const unresolvedLogs = suspiciousLogs.filter((l) => !l.resolved).length;

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
          <Lock className="h-8 w-8 text-danger-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-slate-900">Accès refusé</h2>
          <p className="mt-1 text-sm text-slate-500">Vous n'avez pas les permissions Super Admin.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Building2 }[] = [
    { id: "overview", label: "Vue globale", icon: Activity },
    { id: "companies", label: "Entreprises", icon: Building2 },
    { id: "users", label: "Utilisateurs", icon: Users },
    { id: "security", label: "Sécurité", icon: Shield },
  ];

  const isLoading = loadingCompanies || loadingUsers || loadingLogs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
            <Badge variant="danger">Super Admin</Badge>
          </div>
          <p className="text-sm text-slate-500">Contrôle global de la plateforme Smart Presence</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${tab === t.id ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>
            <t.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {/* OVERVIEW */}
      {!isLoading && tab === "overview" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Entreprises actives" value={activeCompanies} icon={Building2} variant="primary" />
            <StatCard label="Utilisateurs" value={allUsers.length} icon={Users} variant="success" />
            <StatCard label="Utilisateurs actifs" value={activeUsers} icon={CheckCircle} variant="success" />
            <StatCard label="Alertes sécurité" value={unresolvedLogs} icon={AlertTriangle} variant={unresolvedLogs > 0 ? "danger" : "success"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Récents logs */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold text-slate-900">Activité suspecte récente</h3>
              </div>
              {suspiciousLogs.length === 0 ? (
                <div className="flex h-32 items-center justify-center">
                  <p className="text-sm text-slate-400">Aucune activité suspecte détectée</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {suspiciousLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${log.resolved ? "bg-slate-300" : "bg-danger-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{log.reason}</p>
                        <p className="text-xs text-slate-400">
                          {companyMap[log.company_id] ?? "—"} · {formatDateTime(log.created_at)}
                        </p>
                      </div>
                      <Badge variant={log.resolved ? "default" : "danger"}>
                        {log.resolved ? "Résolu" : "Actif"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Plans répartition */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold text-slate-900">Répartition par plan</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {(() => {
                  const planCounts: Record<string, number> = {};
                  companies.forEach((c) => {
                    planCounts[c.plan] = (planCounts[c.plan] || 0) + 1;
                  });
                  return Object.entries(planCounts).map(([plan, count]) => (
                    <div key={plan} className="flex items-center gap-4 px-5 py-4">
                      <div className={`h-3 w-3 rounded-full ${
                        plan === "enterprise" ? "bg-success-500" : plan === "pro" ? "bg-primary-500" : "bg-warning-500"
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 capitalize">{plan}</p>
                      </div>
                      <Badge variant="default">{count} client{count > 1 ? "s" : ""}</Badge>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* COMPANIES */}
      {!isLoading && tab === "companies" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">{companies.length} entreprise{companies.length > 1 ? "s" : ""} enregistrée{companies.length > 1 ? "s" : ""}</h3>
            </div>
            {companies.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <p className="text-sm text-slate-400">Aucune entreprise enregistrée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Entreprise", "Plan", "Code", "Statut", "Créée le"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {companies.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-xs font-bold text-primary-700">
                              {c.name[0]}
                            </div>
                            <span className="font-medium text-slate-900">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={planColors[c.plan] ?? "default"}>{c.plan}</Badge>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{c.code}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant={c.is_active ? "success" : "danger"}>
                            {c.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{formatDateTime(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* USERS */}
      {!isLoading && tab === "users" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">{allUsers.length} utilisateur{allUsers.length > 1 ? "s" : ""}</h3>
            </div>
            {allUsers.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <p className="text-sm text-slate-400">Aucun utilisateur enregistré</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Utilisateur", "Rôle", "Entreprise", "Statut", "Dernière activité"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                              {u.firstname?.[0] ?? "?"}{u.lastname?.[0] ?? ""}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{u.firstname} {u.lastname}</p>
                              <p className="text-xs text-slate-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={u.role === "ADMIN" || u.role === "SUPER_ADMIN" ? "primary" : "default"}>{u.role}</Badge>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {u.company_id ? (companyMap[u.company_id] ?? "—") : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={u.is_active ? "success" : "danger"}>
                            {u.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">
                          {u.last_seen ? formatDateTime(u.last_seen) : "Jamais"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* SECURITY */}
      {!isLoading && tab === "security" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Alertes non résolues" value={unresolvedLogs} icon={AlertTriangle} variant={unresolvedLogs > 0 ? "danger" : "success"} />
            <StatCard label="Total alertes" value={suspiciousLogs.length} icon={Shield} variant="warning" />
            <StatCard label="Alertes résolues" value={suspiciousLogs.filter(l => l.resolved).length} icon={CheckCircle} variant="success" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Logs de sécurité</h3>
            </div>
            {suspiciousLogs.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <p className="text-sm text-slate-400">Aucun log de sécurité</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {suspiciousLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      log.resolved ? "bg-slate-100" : "bg-danger-100"
                    }`}>
                      {log.resolved
                        ? <CheckCircle className="h-4 w-4 text-slate-500" />
                        : <XCircle className="h-4 w-4 text-danger-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{log.reason}</p>
                      <p className="text-xs text-slate-400">
                        {companyMap[log.company_id] ?? "—"}
                        {log.ip ? ` · IP: ${log.ip}` : ""}
                        {log.device ? ` · ${log.device}` : ""}
                        {` · ${formatDateTime(log.created_at)}`}
                      </p>
                    </div>
                    <Badge variant={log.resolved ? "default" : "danger"}>
                      {log.resolved ? "Résolu" : "Actif"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
