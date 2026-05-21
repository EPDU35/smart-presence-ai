import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { useQrStore } from "@/store/qrStore";
import { useAuthStore } from "@/store/authStore";
import { generateQrToken, deactivateOldSessions } from "@/services/qr.service";
import { useRealtime } from "@/hooks/useRealtime";
import { Spinner } from "@/components/ui/Spinner";
import { RefreshCw, Maximize, Minimize } from "lucide-react";

export function QrKioskPage() {
  const { user, company } = useAuthStore();
  const { currentToken, expiresAt, setToken, clearToken } = useQrStore();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const refreshQr = useCallback(async () => {
    if (!user?.company_id || refreshing) return;
    setRefreshing(true);
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

  useEffect(() => {
    if (!currentToken) {
      if (!refreshing) refreshQr();
      return;
    }
    
    // Very large QR code for kiosk
    QRCode.toDataURL(currentToken, { 
      width: 600, 
      margin: 2, 
      color: { dark: "#0F172A", light: "#FFFFFF" } 
    }).then(setQrDataUrl);
  }, [currentToken, refreshQr, refreshing]);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      if (remaining <= 0 && !refreshing) refreshQr();
    }, 500);
    return () => clearInterval(interval);
  }, [expiresAt, refreshQr, refreshing]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900 overflow-hidden" onClick={toggleFullscreen}>
        {/* Background decoration */}
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 rounded-[3rem] border-4 border-white/10 bg-white p-8 shadow-[0_0_100px_rgba(255,255,255,0.1)] transition-all">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code Kiosk" className="h-[70vh] w-[70vh] max-h-[70vw] max-w-[70vw] object-contain" />
          ) : (
            <div className="flex h-[70vh] w-[70vh] max-h-[70vw] max-w-[70vw] items-center justify-center">
              <Spinner size="xl" className="text-primary-600" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full flex-col items-center justify-center rounded-3xl bg-slate-900 p-8 text-center text-white shadow-2xl relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary-500/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
        <h1 className="mb-2 text-4xl font-extrabold tracking-tight">Pointage {company?.name ? `- ${company.name}` : ""}</h1>
        <p className="mb-10 text-lg text-slate-300">Scannez ce QR Code avec l'application mobile pour pointer.</p>
        
        <div className="relative rounded-[2rem] border-4 border-white/10 bg-white p-6 shadow-2xl transition-all">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code Kiosk" className="h-[40vh] w-[40vh] min-h-[300px] min-w-[300px] object-contain" />
          ) : (
            <div className="flex h-[40vh] w-[40vh] min-h-[300px] min-w-[300px] items-center justify-center">
              <Spinner size="xl" className="text-primary-600" />
            </div>
          )}
        </div>
        
        <div className="mt-10 flex items-center gap-6">
          <button
            onClick={refreshQr}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 font-medium text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
            Forcer l'actualisation
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-all"
          >
            <Maximize className="h-5 w-5" /> Plein écran
          </button>
        </div>
      </div>
    </div>
  );
}
