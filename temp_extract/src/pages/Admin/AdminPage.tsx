import { useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { StatCard } from "@/components/cards/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Shield, Users, Building2, AlertTriangle, Activity, Lock, TrendingUp, MoreVertical, CheckCircle, XCircle } from "lucide-react";

const MOCK_COMPANIES = [
  { id: "1", name: "TechCorp CI", plan: "pro", admin: "Konan Yao", users: 47, status: "active", createdAt: "12 Jan 2025" },
  { id: "2", name: "Setaci SARL", plan: "starter", admin: "Marie Dupont", users: 8, status: "active", createdAt: "3 Fév 2025" },
  { id: "3", name: "AfricaTech", plan: "enterprise", admin: "Jean Kouassi", users: 214, status: "active", createdAt: "15 Nov 2024" },
  { id: "4", name: "EnergieSol", plan: "starter", admin: "Paul Bamba", users: 5, status: "suspended", createdAt: "20 Mars 2025" },
  { id: "5", name: "LogiNet", plan: "pro", admin: "Aïcha Touré", users: 62, status: "active", createdAt: "8 Avr 2025" },
];

const MOCK_USERS = [
  { id: "1", name: "Konan Yao", email: "konan@techcorp.ci", role: "ADMIN", company: "TechCorp CI", status: "active", lastSeen: "Il y a 5 min" },
  { id: "2", name: "Marie Dupont", email: "marie@setaci.ci", role: "ADMIN", company: "Setaci SARL", status: "active", lastSeen: "Il y a 1h" },
  { id: "3", name: "Awa Diallo", email: "awa@africatech.ci", role: "EMPLOYEE", company: "AfricaTech", status: "active", lastSeen: "Aujourd'hui" },
  { id: "4", name: "Paul Bamba", email: "paul@energiesol.ci", role: "ADMIN", company: "EnergieSol", status: "suspended", lastSeen: "Il y a 7 jours" },
];

const MOCK_LOGS = [
  { id: "1", event: "Connexion suspecte", ip: "41.202.10.5", company: "TechCorp CI", time: "Il y a 2 min", level: "warning" as const },
  { id: "2", event: "Appareil inconnu", ip: "197.166.4.82", company: "AfricaTech", time: "Il y a 15 min", level: "danger" as const },
  { id: "3", event: "Pointage hors zone", ip: "—", company: "Setaci SARL", time: "Il y a 1h", level: "warning" as const },
  { id: "4", event: "Echec authentification (3x)", ip: "78.12.90.33", company: "LogiNet", time: "Il y a 2h", level: "danger" as const },
  { id: "5", event: "Plan mis à jour", ip: "—", company: "AfricaTech", time: "Hier", level: "info" as const },
];

const planColors: Record<string, "success" | "primary" | "warning" | "default"> = {
  enterprise: "success",
  pro: "primary",
  starter: "warning",
};

type AdminTab = "overview" | "companies" | "users" | "security";

export function AdminPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<AdminTab>("overview");

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

      {/* OVERVIEW */}
      {tab === "overview" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Entreprises actives" value={4} icon={Building2} variant="primary" trend="+2 ce mois" trendUp />
            <StatCard label="Utilisateurs actifs" value={336} icon={Users} variant="success" trend="+18 cette semaine" trendUp />
            <StatCard label="Présences aujourd'hui" value={218} icon={CheckCircle} variant="success" />
            <StatCard label="Alertes sécurité" value={4} icon={AlertTriangle} variant="danger" trend="À traiter" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Récents */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold text-slate-900">Activité récente</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {MOCK_LOGS.slice(0, 4).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={`h-2 w-2 shrink-0 rounded-full ${log.level === "danger" ? "bg-danger-500" : log.level === "warning" ? "bg-warning-500" : "bg-slate-300"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{log.event}</p>
                      <p className="text-xs text-slate-400">{log.company} · {log.time}</p>
                    </div>
                    <Badge variant={log.level === "danger" ? "danger" : log.level === "warning" ? "warning" : "default"}>
                      {log.level === "danger" ? "Critique" : log.level === "warning" ? "Alerte" : "Info"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Plans répartition */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold text-slate-900">Plans actifs</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { plan: "Enterprise", count: 1, revenue: "Sur devis", color: "bg-success-500" },
                  { plan: "Pro", count: 2, revenue: "130 000 FCFA/mois", color: "bg-primary-500" },
                  { plan: "Starter", count: 2, revenue: "30 000 FCFA/mois", color: "bg-warning-500" },
                ].map((p) => (
                  <div key={p.plan} className="flex items-center gap-4 px-5 py-4">
                    <div className={`h-3 w-3 rounded-full ${p.color}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{p.plan}</p>
                      <p className="text-xs text-slate-400">{p.revenue}</p>
                    </div>
                    <Badge variant="default">{p.count} client{p.count > 1 ? "s" : ""}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* COMPANIES */}
      {tab === "companies" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">{MOCK_COMPANIES.length} entreprises enregistrées</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {["Entreprise", "Plan", "Admin", "Employés", "Statut", "Créée le", ""].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MOCK_COMPANIES.map((c) => (
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
                      <td className="px-5 py-3.5 text-slate-600">{c.admin}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">{c.users}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={c.status === "active" ? "success" : "danger"}>
                          {c.status === "active" ? "Actif" : "Suspendu"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">{c.createdAt}</td>
                      <td className="px-5 py-3.5">
                        <button className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
                          <MoreVertical className="h-4 w-4 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* USERS */}
      {tab === "users" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">{MOCK_USERS.length} utilisateurs</h3>
              <div className="flex gap-2">
                {(["Tous", "Admin", "Employés"] as const).map((f) => (
                  <button key={f} className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors">{f}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {["Utilisateur", "Rôle", "Entreprise", "Statut", "Dernière activité", ""].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MOCK_USERS.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                            {u.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={u.role === "ADMIN" ? "primary" : "default"}>{u.role}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{u.company}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={u.status === "active" ? "success" : "danger"}>
                          {u.status === "active" ? "Actif" : "Suspendu"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{u.lastSeen}</td>
                      <td className="px-5 py-3.5">
                        <button className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
                          <MoreVertical className="h-4 w-4 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* SECURITY */}
      {tab === "security" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Alertes actives" value={4} icon={AlertTriangle} variant="danger" />
            <StatCard label="Connexions suspectes" value={2} icon={Shield} variant="warning" />
            <StatCard label="Appareils inconnus" value={1} icon={XCircle} variant="danger" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Logs de sécurité</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {MOCK_LOGS.map((log) => (
                <div key={log.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    log.level === "danger" ? "bg-danger-100" : log.level === "warning" ? "bg-warning-100" : "bg-slate-100"
                  }`}>
                    {log.level === "danger" ? <XCircle className="h-4 w-4 text-danger-600" />
                    : log.level === "warning" ? <AlertTriangle className="h-4 w-4 text-warning-600" />
                    : <CheckCircle className="h-4 w-4 text-slate-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{log.event}</p>
                    <p className="text-xs text-slate-400">
                      {log.company}{log.ip !== "—" ? ` · IP: ${log.ip}` : ""} · {log.time}
                    </p>
                  </div>
                  <Badge variant={log.level === "danger" ? "danger" : log.level === "warning" ? "warning" : "default"}>
                    {log.level === "danger" ? "Critique" : log.level === "warning" ? "Alerte" : "Info"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
