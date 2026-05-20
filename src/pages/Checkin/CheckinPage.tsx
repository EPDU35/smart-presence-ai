import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useCheckin } from "@/hooks/useCheckin";
import { useGeolocation } from "@/hooks/useGeolocation";
import { QrScanner } from "@/components/qr/QrScanner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { MapPin, CheckCircle, XCircle } from "lucide-react";

export function CheckinPage() {
  const { user } = useAuthStore();
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [checkinResult, setCheckinResult] = useState<{ success: boolean; message: string } | null>(null);

  const { latitude, longitude, accuracy, loading: geoLoading, error: geoError, getPosition } = useGeolocation();

  const { checkin, isCheckingIn, error: checkinError } = useCheckin({
    companyId: user?.company_id ?? "",
    userId: user?.id ?? "",
    companyLat: 5.36,
    companyLon: -4.01,
    radius: 200,
  });

  async function handleScan(token: string) {
    setScannedToken(token);
    setCheckinResult(null);

    try {
      await checkin(token);
      setCheckinResult({ success: true, message: "Pointage valide" });
    } catch {
      setCheckinResult({ success: false, message: checkinError ?? "Pointage invalide" });
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pointage</h1>
        <p className="text-sm text-slate-500">Scannez le QR Code pour pointer votre presence</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary-600" />
            Position GPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          {geoLoading ? (
            <p className="text-sm text-slate-500">Obtention de la position...</p>
          ) : geoError ? (
            <div className="space-y-2">
              <Alert variant="error">{geoError}</Alert>
              <Button size="sm" onClick={getPosition}>Reessayer</Button>
            </div>
          ) : latitude && longitude ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Latitude</span>
                <span className="font-mono text-slate-900">{latitude.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Longitude</span>
                <span className="font-mono text-slate-900">{longitude.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Precision</span>
                <Badge variant={accuracy && accuracy < 50 ? "success" : "warning"}>
                  {accuracy ? `${Math.round(accuracy)}m` : "Inconnue"}
                </Badge>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <QrScanner onScan={handleScan} />

      {scannedToken && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultat du pointage</CardTitle>
          </CardHeader>
          <CardContent>
            {isCheckingIn ? (
              <p className="text-sm text-slate-500">Validation en cours...</p>
            ) : checkinResult ? (
              <div className="flex items-center gap-3">
                {checkinResult.success ? (
                  <CheckCircle className="h-6 w-6 text-success-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-danger-500" />
                )}
                <div>
                  <p className={checkinResult.success ? "font-medium text-success-700" : "font-medium text-danger-700"}>
                    {checkinResult.message}
                  </p>
                  <p className="text-xs text-slate-500">Token: {scannedToken.slice(0, 16)}...</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
