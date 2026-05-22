import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { fetchCheckinsByUser } from "@/services/checkin.service";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { CheckCircle, XCircle, AlertCircle, Calendar, MapPin, Clock } from "lucide-react";
import type { Checkin } from "@/types";

function groupByDate(checkins: Checkin[]): Record<string, Checkin[]> {
  const groups: Record<string, Checkin[]> = {};
  checkins.forEach((c) => {
    const key = new Date(c.created_at).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  return groups;
}

export function HistoryPage() {
  const { user } = useAuthStore();

  const { data: checkins = [], isLoading } = useQuery({
    queryKey: ["checkins", "user", user?.id],
    queryFn: () => fetchCheckinsByUser(user?.id ?? ""),
    enabled: !!user?.id,
  });

  const grouped = useMemo(() => groupByDate(checkins), [checkins]);

  const stats = useMemo(() => {
    const valid = checkins.filter((c) => c.status === "VALID").length;
    const total = checkins.length;
    const rate  = total > 0 ? Math.round((valid / total) * 100) : 0;
    return { valid, total, rate };
  }, [checkins]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Mon historique</h1>
        <p className="text-sm text-slate-500">Tous vos pointages enregistrés</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-3"
      >
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500">Pointages</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-success-600">{stats.valid}</p>
          <p className="text-xs text-slate-500">Validés</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-primary-600">{stats.rate}%</p>
          <p className="text-xs text-slate-500">Taux présence</p>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : checkins.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white"
        >
          <Calendar className="h-12 w-12 text-slate-200" />
          <p className="font-medium text-slate-500">Aucune présence enregistrée</p>
          <p className="text-sm text-slate-400">Scannez un QR Code pour pointer</p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items], i) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {date}
              </p>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
                {items.map((checkin) => (
                  <CheckinRow key={checkin.id} checkin={checkin} />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckinRow({ checkin }: { checkin: Checkin }) {
  const Icon =
    checkin.status === "VALID"
      ? CheckCircle
      : checkin.status === "INVALID"
      ? XCircle
      : AlertCircle;

  const iconColor =
    checkin.status === "VALID"
      ? "text-success-500"
      : checkin.status === "INVALID"
      ? "text-danger-500"
      : "text-warning-500";

  const label =
    checkin.status === "VALID"
      ? "Présence validée"
      : checkin.status === "INVALID"
      ? "Accès refusé"
      : "Position suspecte";

  const time = new Date(checkin.created_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <div className="mt-0.5 flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3 w-3" />
            {time}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3 w-3" />
            {Math.round(checkin.distance)}m
          </span>
        </div>
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
          ? "Validé"
          : checkin.status === "INVALID"
          ? "Refusé"
          : "Suspect"}
      </Badge>
    </div>
  );
}
