import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { fetchCheckinsByUser } from "@/services/checkin.service";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/utils/format";
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

  // Thresholds
  const SESSION_GAP_MINUTES = 30; // gap to split presence sessions
  const ABSENCE_HOURS = 5; // long absence threshold
  const DISTANCE_THRESHOLD = 500; // meters to consider off-site

  function computeSessions(items: Checkin[]) {
    if (!items || items.length === 0) return { sessions: [] as { start: Date; end: Date }[], absences: [] as { start: Date; end: Date }[] };

    const sorted = [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const sessions: { start: Date; end: Date; lastDistance?: number }[] = [];

    let curStart = new Date(sorted[0].created_at);
    let curEnd = new Date(sorted[0].created_at);
    let curLastDistance = sorted[0].distance ?? 0;

    for (let i = 1; i < sorted.length; i++) {
      const chk = sorted[i];
      const t = new Date(chk.created_at);
      const gapMin = (t.getTime() - curEnd.getTime()) / 60000;
      if (gapMin <= SESSION_GAP_MINUTES) {
        curEnd = t;
        curLastDistance = chk.distance ?? curLastDistance;
      } else {
        sessions.push({ start: curStart, end: curEnd, lastDistance: curLastDistance });
        curStart = t;
        curEnd = t;
        curLastDistance = chk.distance ?? 0;
      }
    }
    sessions.push({ start: curStart, end: curEnd, lastDistance: curLastDistance });

    const absences: { start: Date; end: Date; durationHours: number }[] = [];
    for (let i = 0; i < sessions.length - 1; i++) {
      const a = sessions[i];
      const b = sessions[i + 1];
      const durH = (b.start.getTime() - a.end.getTime()) / (1000 * 60 * 60);
      // mark absence if gap >= ABSENCE_HOURS and off-site evidence nearby
      const offsite = (a.lastDistance ?? 0) >= DISTANCE_THRESHOLD || (sorted.find((s) => new Date(s.created_at).getTime() === b.start.getTime())?.distance ?? 0) >= DISTANCE_THRESHOLD;
      if (durH >= ABSENCE_HOURS && offsite) {
        absences.push({ start: a.end, end: b.start, durationHours: durH });
      }
    }

    return { sessions, absences };
  }

  const stats = useMemo(() => {
    const valid = checkins.filter((c) => c.status === "VALID").length;
    const total = checkins.length;
    const rate = total > 0 ? Math.round((valid / total) * 100) : 0;
    return { valid, total, rate };
  }, [checkins]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Mon historique</h1>
        <p className="text-sm text-slate-500">Tous vos pointages enregistrés</p>
      </motion.div>

      {/* Stats */}
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

      {/* Timeline */}
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
              {/* Presence sessions + Absences summary */}
              {(() => {
                const { sessions, absences } = computeSessions(items);
                return (
                  <div className="mb-3 flex flex-col gap-2">
                    {sessions.map((s, idx) => (
                      <div key={`sess-${idx}`} className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 text-sm border">
                        <span className="text-slate-700">Présent</span>
                        <span className="text-slate-500">{new Date(s.start).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} → {new Date(s.end).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                    ))}
                    {absences.map((a, idx) => (
                      <div key={`abs-${idx}`} className="flex items-center justify-between rounded-lg bg-danger-50 border border-danger-100 px-3 py-2 text-sm">
                        <span className="text-danger-800 font-semibold">Absent</span>
                        <span className="text-danger-600">{new Date(a.start).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} → {new Date(a.end).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} ({Math.round(a.durationHours)}h)</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
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
