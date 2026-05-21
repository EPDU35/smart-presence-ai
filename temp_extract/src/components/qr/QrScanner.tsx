import { useEffect, useRef } from "react";
import jsQR from "jsqr";
import { useQrScanner } from "@/hooks/useQrScanner";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { QrCode, CheckCircle } from "lucide-react";

interface QrScannerProps {
  onScan: (token: string) => void;
}

export function QrScanner({ onScan }: QrScannerProps) {
  const { isScanning, result, error, videoRef, start, stop, onScan: handleScan } = useQrScanner();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;

    function scan() {
      if (!ctx || !canvas || !video) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code?.data) {
          handleScan(code.data);
          onScan(code.data);
          return;
        }
      }
      rafId = requestAnimationFrame(scan);
    }

    rafId = requestAnimationFrame(scan);
    return () => cancelAnimationFrame(rafId);
  }, [isScanning, videoRef, handleScan, onScan]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary-600" />
          Scanner un QR Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          {result && (
            <Alert variant="success">
              <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success-600" />QR Code scanné avec succès</div>
            </Alert>
          )}

          <div className="relative aspect-square w-full max-w-[300px] overflow-hidden rounded-2xl bg-slate-900">
            {isScanning ? (
              <>
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                {/* Viewfinder overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative h-48 w-48">
                    {/* Coins */}
                    <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-white rounded-tl" />
                    <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-white rounded-tr" />
                    <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-white rounded-bl" />
                    <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-white rounded-br" />
                    {/* Scan line animation */}
                    <div className="absolute left-0 right-0 top-0 h-0.5 animate-[scan_2s_ease-in-out_infinite] bg-primary-400 opacity-80" />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                <QrCode className="h-16 w-16 text-slate-500" />
                <p className="text-xs text-slate-400">Caméra inactive</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {!isScanning ? (
              <Button onClick={start} className="rounded-xl">
                Activer la caméra
              </Button>
            ) : (
              <Button variant="secondary" onClick={stop} className="rounded-xl">
                Arrêter
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
