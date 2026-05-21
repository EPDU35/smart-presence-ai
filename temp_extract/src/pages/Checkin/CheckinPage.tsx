import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { useCheckin } from "@/hooks/useCheckin";
import { useGeolocation } from "@/hooks/useGeolocation";
import { QrScanner } from "@/components/qr/QrScanner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { CheckCircle, XCircle, MapPin, Clock, Building2, AlertCircle, RefreshCw } from "lucide-react";

type FlowState = "idle" | "scanning" | "validating" | "success" | "error";

interface CheckinResult {
  time: string;
  company: string;
  distance: number;
  message: string;
  errorCode?: "gps" | "expired" | "position" | "network";
}

export function CheckinPage() {
  const { user, company } = useAuthStore();
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [result, setResult] = useState<CheckinResult | null>(null);

  const { latitude, longitude, accuracy, loading: geoLoading, error: geoError, getPosition } = useGeolocation();

  const { checkin, isCheckingIn } = useCheckin({
    companyId: user?.company_id ?? "",
    userId: user?.id ?? "",
    companyLat: company?.latitude ?? 0,
    companyLon: company?.longitude ?? 0,
    radius: company?.radius ?? 200,
  });

  async function handleScan(token: string) {
    setFlowState("validating");
    try {
      const res = await checkin(token);
      setResult({
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        company: company?.name ?? "Votre entreprise",
        distance: Math.round(res.distance),
        message: "Présence enregistrée avec succès",
      });
      setFlowState("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      let errorCode: CheckinResult["errorCode"] = "network";
      if (msg.includes("zone") || msg.includes("distance")) errorCode = "position";
      else if (msg.includes("expir")) errorCode = "expired";
      else if (msg.includes("GPS") || msg.includes("geo")) errorCode = "gps";
      setResult({
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        company: company?.name ?? "",
        distance: 0,
        message: msg || "Erreur lors du pointage",
        errorCode,
      });
      setFlowState("error");
    }
  }

  function reset() {
    setFlowState("idle");
    setResult(null);
  }

  const gpsOk = !geoLoading && !geoError && latitude && longitude;
  const gpsGood = gpsOk && accuracy && accuracy <= 50;

  return (
    <div className="mx-auto max-w-sm space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Scanner votre présence</h1>
        <p className="text-sm text-slate-500">Utilisez le QR Code affiché par votre administrateur</p>
      </motion.div>

      {/* GPS Status card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors ${
          geoLoading ? "border-slate-200 bg-slate-50"
          : geoError ? "border-danger-200 bg-danger-50"
          : gpsGood ? "border-success-200 bg-success-50"
          : "border-warning-200 bg-warning-50"
        }`}>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            geoLoading ? "bg-slate-100"
            : geoError ? "bg-danger-100"
            : gpsGood ? "bg-success-100"
            : "bg-warning-100"
          }`}>
            <MapPin className={`h-4 w-4 ${
              geoLoading ? "text-slate-400"
              : geoError ? "text-danger-600"
              : gpsGood ? "text-success-600"
              : "text-warning-600"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            {geoLoading ? (
              <><p className="text-sm font-medium text-slate-700">Obtention du GPS...</p><Skeleton className="mt-1 h-3 w-32" /></>
            ) : geoError ? (
              <><p className="text-sm font-medium text-danger-800">GPS non disponible</p><p className="text-xs text-danger-600">Activez la localisation</p></>
            ) : (
              <><p className="text-sm font-medium text-slate-800">
                {gpsGood ? "Position validée" : "Position approximative"}
              </p><p className="text-xs text-slate-500">Précision : {accuracy ? `${Math.round(accuracy)}m` : "..."}</p></>
            )}
          </div>
          {geoError && (
            <button onClick={getPosition} className="rounded-lg p-1.5 hover:bg-danger-100">
              <RefreshCw className="h-4 w-4 text-danger-600" />
            </button>
          )}
          {!geoLoading && !geoError && (
            <Badge variant={gpsGood ? "success" : "warning"}>
              {gpsGood ? "OK" : "Faible"}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Main flow */}
      <AnimatePresence mode="wait">
        {/* IDLE */}
        {flowState === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
            <button
              onClick={() => setFlowState("scanning")}
              disabled={!!geoError || geoLoading}
              className="w-full flex flex-col items-center gap-4 rounded-3xl bg-primary-600 py-10 text-white shadow-xl hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9V5a2 2 0 012-2h4M9 3H5M3 9h6m0 0v6m0-6h6m0 0V9m0 6v4a2 2 0 01-2 2h-4m4-2h4M21 15h-6m0 0v-6m6 6v4a2 2 0 01-2 2h-4" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">Scanner QR Code</p>
                <p className="mt-1 text-sm text-white/70">Ouvrir la caméra pour pointer</p>
              </div>
            </button>
          </motion.div>
        )}

        {/* SCANNING */}
        {flowState === "scanning" && (
          <motion.div key="scanning" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <QrScanner onScan={handleScan} />
            <Button variant="secondary" className="mt-3 w-full rounded-xl" onClick={reset}>
              Annuler
            </Button>
          </motion.div>
        )}

        {/* VALIDATING */}
        {(flowState === "validating" || isCheckingIn) && (
          <motion.div key="validating" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5 rounded-3xl border border-slate-200 bg-white py-12 shadow-sm">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary-100" />
              <div className="relative h-10 w-10 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-900">Validation en cours...</p>
              <p className="mt-1 text-sm text-slate-400">Vérification de votre position</p>
            </div>
          </motion.div>
        )}

        {/* SUCCESS */}
        {flowState === "success" && result && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
            className="rounded-3xl border border-success-200 bg-success-50 p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
              <CheckCircle className="h-9 w-9 text-success-600" />
            </motion.div>
            <h2 className="text-xl font-bold text-success-900 flex items-center justify-center gap-2"><CheckCircle className="h-5 w-5" />Présence enregistrée</h2>
            <p className="mt-2 text-sm text-success-700">{result.message}</p>
            <div className="mt-5 space-y-2.5 rounded-2xl bg-white/60 p-4 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-500"><Clock className="h-3.5 w-3.5" />Heure</span>
                <span className="font-semibold text-slate-900">{result.time}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-500"><MapPin className="h-3.5 w-3.5" />Distance</span>
                <Badge variant="success">{result.distance}m</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-500"><Building2 className="h-3.5 w-3.5" />Entreprise</span>
                <span className="font-semibold text-slate-900">{result.company}</span>
              </div>
            </div>
            <Button className="mt-5 w-full rounded-2xl" onClick={reset}>Nouveau pointage</Button>
          </motion.div>
        )}

        {/* ERROR */}
        {flowState === "error" && result && (
          <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
            className="rounded-3xl border border-danger-200 bg-danger-50 p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring" }}
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-danger-100">
              <XCircle className="h-9 w-9 text-danger-600" />
            </motion.div>
            <h2 className="text-xl font-bold text-danger-900 flex items-center justify-center gap-2"><XCircle className="h-5 w-5" />Pointage refusé</h2>
            <div className="mt-3 rounded-xl bg-white/60 p-3">
              <div className="flex items-start gap-2 text-sm text-danger-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-500" />
                <p>{result.message}</p>
              </div>
            </div>
            {result.errorCode === "position" && (
              <p className="mt-3 text-xs text-danger-600">Vous êtes hors de la zone autorisée. Rapprochez-vous de l'entreprise.</p>
            )}
            {result.errorCode === "expired" && (
              <p className="mt-3 text-xs text-danger-600">Le QR Code a expiré. Demandez un nouveau QR Code à votre administrateur.</p>
            )}
            <Button variant="secondary" className="mt-5 w-full rounded-2xl" onClick={reset}>Réessayer</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
