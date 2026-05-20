import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { useQrStore } from "@/store/qrStore";
import { useAuthStore } from "@/store/authStore";
import { generateQrToken, deactivateOldSessions } from "@/services/qr.service";
import { useRealtime } from "@/hooks/useRealtime";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

export function QrGenerator() {
  const { user } = useAuthStore();
  const { currentToken, expiresAt, setToken, clearToken } = useQrStore();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);

  const refreshQr = useCallback(async () => {
    if (!user?.company_id) return;

    clearToken();
    await deactivateOldSessions(user.company_id);
    const session = await generateQrToken(user.company_id);
    setToken(session.token, session.expires_at);
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
    if (!currentToken) {
      refreshQr();
      return;
    }

    QRCode.toDataURL(currentToken, { width: 280, margin: 2 }).then(setQrDataUrl);
  }, [currentToken, refreshQr]);

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        refreshQr();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, refreshQr]);

  return (
    <Card className="text-center">
      <CardHeader>
        <CardTitle>QR Code de pointage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-[280px] w-[280px] items-center justify-center rounded-xl bg-white p-4 shadow-inner">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="h-full w-full" />
            ) : (
              <Spinner size="lg" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
            <span className="text-sm text-slate-500">
              Actualisation dans {timeLeft}s
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
