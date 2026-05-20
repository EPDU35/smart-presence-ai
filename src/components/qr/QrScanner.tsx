import { useEffect, useRef } from "react";
import jsQR from "jsqr";
import { useQrScanner } from "@/hooks/useQrScanner";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

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
        <CardTitle>Scanner un QR Code</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          {result && <Alert variant="success">QR Code scanne avec succes</Alert>}

          <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-xl bg-slate-900">
            {isScanning ? (
              <>
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border-2 border-white/20">
                  <div className="absolute inset-8 border border-white/40" />
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <p className="text-sm text-slate-400">Camera inactive</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {!isScanning ? (
              <Button onClick={start}>Activer la camera</Button>
            ) : (
              <Button variant="secondary" onClick={stop}>
                Arreter
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
