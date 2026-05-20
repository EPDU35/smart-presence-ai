import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { fetchCheckinsByUser, fetchTodayCheckins } from "@/services/checkin.service";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/utils/format";
import { QrCode, History, CheckCircle, XCircle, Clock, Calendar, Flame } from "lucide-react";

export function EmployeeDashboardPage() {
  const { user } = useAuthStore();

  const { data: allCheckins = [], isLoading: loadingAll } = useQuery({
    queryKey: ["checkins", "user", user?.id],
    queryFn: () => fetchCheckinsByUser(user?.id ?? ""),
    enabled: !!user?.id,
  });

  const { data: todayCheckins = [], isLoading: loadingToday } = useQuery({
    queryKey: ["checkins", "today", user?.company_id],
    queryFn: () => fetchTodayCheckins(user?.company_id ?? ""),
    enabled: !!user?.company_id,
  });

  const todayMyCheckin = useMemo(
    () => todayCheckins.find((c) => c.user_id === user?.id && c.status === "VALID"),
    [todayCheckins, user?.id]
  );

  const stats = useMemo(() => {
    const valid = allCheckins.filter((c) => c.status === "VALID").length;
    const total = allCheckins.length;
    const rate = total > 0 ? Math.round((valid / total) * 100) : 0;

    // Streak (jours consécutifs)
    let streak = 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sorted = [...allCheckins]
      .filter((c) => c.status === "VALID")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const seenDates = new Set(
      sorted.map((c) =>
        new Date(c.created_at).toLocaleDateString("fr-FR")
      )
    );

    const checkDate = new Date(today);
    while (seenDates.has(checkDate.toLocaleDateString("fr-FR"))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return { valid, total, rate, streak };
  }, [allCheckins]);

  const isLoading = loadingAll || loadingToday;
  const firstName = user?.firstname ?? "vous";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">
          Bonjour {firstName} 👋
        </h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </motion.div>

      {/* Status du jour */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        {isLoading ? (
          <div className="flex h-28 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Spinner />
          </div>
        ) : todayMyCheckin ? (
          <div className="flex items-center gap-4 rounded-2xl border border-success-200 bg-success-50 p-5 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-100">
              <CheckCircle className="h-6 w-6 text-success-600" />
            </div>
            <div>
              <p className="font-semibold text-success-800">Présence enregistrée ✅</p>
              <p className="text-sm text-success-600">
                Pointé à{" "}
                {new Date(todayMyCheckin.created_at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 rounded-2xl border border-danger-200 bg-danger-50 p-5 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger-100">
              <XCircle className="h-6 w-6 text-danger-600" />
            </div>
            <div>
              <p className="font-semibold text-danger-800">Non pointé aujourd'hui</p>
              <p className="text-sm text-danger-600">Scannez le QR Code pour pointer</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* CTA Principal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Link to="/checkin">
          <button className="w-full flex items-center justify-center gap-3 rounded-3xl bg-primary-600 py-5 text-white shadow-xl hover:bg-primary-700 active:bg-primary-800 transition-all duration-150 active:scale-[0.98]">
            <QrCode className="h-6 w-6" />
            <span className="text-lg font-semibold">Scanner QR Code</span>
          </button>
        </Link>
      </motion.div>

      {/* Stats perso */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-3 gap-3"
      >
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm text-center">
          <div className="flex items-center justify-center gap-1">
            <Flame className="h-4 w-4 text-warning-500" />
            <p className="text-xl font-bold text-slate-900">{stats.streak}</p>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Série jours</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm text-center">
          <p className="text-xl font-bold text-success-600">{stats.valid}</p>
          <p className="text-xs text-slate-400 mt-0.5">Présences</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm text-center">
          <p className="text-xl font-bold text-primary-600">{stats.rate}%</p>
          <p className="text-xs text-slate-400 mt-0.5">Taux</p>
        </div>
      </motion.div>

      {/* Dernier pointages */}
      {allCheckins.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Récents</h2>
              <Link
                to="/history"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Tout voir
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {allCheckins.slice(0, 4).map((checkin) => (
                <div key={checkin.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      checkin.status === "VALID"
                        ? "bg-success-500"
                        : checkin.status === "INVALID"
                        ? "bg-danger-500"
                        : "bg-warning-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">
                      {checkin.status === "VALID"
                        ? "Présence validée"
                        : checkin.status === "INVALID"
                        ? "Accès refusé"
                        : "Position suspecte"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(checkin.created_at)}
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
                    {checkin.status === "VALID" ? "OK" : "Refusé"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Action secondaire */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Link to="/history">
          <Button variant="secondary" className="w-full rounded-2xl">
            <History className="mr-2 h-4 w-4" />
            Voir mon historique complet
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
