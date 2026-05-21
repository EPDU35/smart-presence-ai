import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { useQrStore } from "@/store/qrStore";
import { useAuthStore } from "@/store/authStore";
import { generateQrToken, deactivateOldSessions } from "@/services/qr.service";
import { useRealtime } from "@/hooks/useRealtime";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { RefreshCw } from "lucide-react";

export function QrGenerator() {
  const { user } = useAuthStore();
  const { currentToken, expiresAt, setToken, clearToken } = useQrStore();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshQr = useCallback(async () => {
    if (!user?.company_id || refreshing) return; // Empêche les appels simultanés
    setRefreshing(true);
    // On ne fait pas de clearToken() ici pour un rafraîchissement transparent
    try {
      await deactivateOldSessions(user.company_id);
      const session = await generateQrToken(user.company_id);
      setToken(session.token, session.expires_at);
    } finally {
      setRefreshing(false);
    }
  }, [user?.company_id, setToken, refreshing]);

  useRealtime({
    table: "qr_sessions",
    filter: `company_id=eq.${user?.company_id}`,
    onInsert: (payload: unknown) => {
      const s = payload as { token: string; expires_at: string };
      setToken(s.token, s.expires_at);
    },
  });

  // Initial load ou changement de token
  useEffect(() => {
    if (!currentToken) {
      if (!refreshing) {
        refreshQr();
      }
      return;
    }
    
    QRCode.toDataURL(currentToken, { 
      width: 240, margin: 2, color: { dark: "#0F172A", light: "#FFFFFF" } 
    }).then(setQrDataUrl);
  }, [currentToken, refreshQr, refreshing]);

  // Boucle de rafraîchissement silencieuse (10s)
  useEffect(() => {
    if (!expiresAt) return;
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      
      if (remaining <= 0 && !refreshing) {
        refreshQr();
      }
    }, 500); // Check rapide mais discret
    
    return () => clearInterval(interval);
  }, [expiresAt, refreshQr, refreshing]);

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
        {/* QR Container - Sans overlay de temps */}
        <div className="relative rounded-2xl border-2 border-slate-200 bg-white p-3 transition-colors duration-300">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="h-48 w-48" />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center">
              <Spinner size="lg" />
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 px-4 mt-2">
          Actualisation automatique sécurisée.
          Les employés scannent ce QR avec l'app pour pointer leur présence.
        </p>
      </CardContent>
    </Card>
  );
}
