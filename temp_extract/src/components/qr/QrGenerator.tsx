import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { useQrStore } from "@/store/qrStore";
import { useAuthStore } from "@/store/authStore";
import { generateQrToken, deactivateOldSessions } from "@/services/qr.service";
import { useRealtime } from "@/hooks/useRealtime";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { RefreshCw, Clock } from "lucide-react";

const QR_TTL = 15;

export function QrGenerator() {
  const { user } = useAuthStore();
  const { currentToken, expiresAt, setToken, clearToken } = useQrStore();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(QR_TTL);
  const [refreshing, setRefreshing] = useState(false);

  const refreshQr = useCallback(async () => {
    if (!user?.company_id) return;
    setRefreshing(true);
    clearToken();
    setQrDataUrl(null);
    try {
      await deactivateOldSessions(user.company_id);
      const session = await generateQrToken(user.company_id);
      setToken(session.token, session.expires_at);
    } finally {
      setRefreshing(false);
    }
  }, [user?.company_id, clearToken, setToken]);

  useRealtime({
    table: "qr_sessions",
    filter: `company_id=eq.${user?.company_id}`,
    onInsert: (payload: unknown) => {
      const s = payload as { token: string; expires_at: string };
      setToken(s.token, s.expires_at);
    },
  });

  useEffect(() => {
    if (!currentToken) { refreshQr(); return; }
    QRCode.toDataURL(currentToken, { width: 240, margin: 2, color: { dark: "#0F172A", light: "#FFFFFF" } }).then(setQrDataUrl);
  }, [currentToken, refreshQr]);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) refreshQr();
    }, 500);
    return () => clearInterval(interval);
  }, [expiresAt, refreshQr]);

  const progress = (timeLeft / QR_TTL) * 100;
  const urgent = timeLeft <= 5;
  const circumference = 2 * Math.PI * 20;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">QR Code de pointage</CardTitle>
          <button
            onClick={refreshQr}
            disabled={refreshing}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 pt-5">
        {/* QR Container */}
        <div className={`relative rounded-2xl border-2 p-3 transition-colors duration-300 ${
          urgent ? "border-danger-300 bg-danger-50" : "border-slate-200 bg-white"
        }`}>
          {qrDataUrl && !refreshing ? (
            <>
              <img src={qrDataUrl} alt="QR Code" className={`h-48 w-48 transition-opacity duration-300 ${urgent ? "opacity-60" : "opacity-100"}`} />
              {urgent && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-danger-600">{timeLeft}</p>
                    <p className="text-xs text-danger-500">secondes</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-48 w-48 items-center justify-center">
              <Spinner size="lg" />
            </div>
          )}
        </div>

        {/* Timer ring */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative flex items-center justify-center">
            <svg width="52" height="52" className="-rotate-90">
              <circle cx="26" cy="26" r="20" fill="none" strokeWidth="3" className="stroke-slate-100" />
              <circle
                cx="26" cy="26" r="20" fill="none" strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className={`transition-all duration-500 ${urgent ? "stroke-danger-500" : "stroke-primary-500"}`}
              />
            </svg>
            <div className="absolute flex items-center gap-0.5">
              <Clock className={`h-3 w-3 ${urgent ? "text-danger-500" : "text-primary-600"}`} />
              <span className={`text-xs font-bold tabular-nums ${urgent ? "text-danger-600" : "text-slate-700"}`}>
                {timeLeft}s
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400">Actualisation automatique</p>
        </div>

        <p className="text-center text-xs text-slate-400 px-4">
          Les employés scannent ce QR avec l'app pour pointer leur présence
        </p>
      </CardContent>
    </Card>
  );
}
