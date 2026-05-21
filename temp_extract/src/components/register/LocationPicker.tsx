import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { MapPin, Crosshair } from "lucide-react";

interface LocationPickerProps {
  value: string;
  lat: number;
  lng: number;
  onChange: (location: string, lat: number, lng: number) => void;
}

export function LocationPicker({ value, lat, lng, onChange }: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const getCurrentPosition = useCallback(() => {
    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        reverseGeocode(lat, lng);
      },
      (err) => {
        setLoading(false);
        setError(err.message || "Impossible d obtenir la position");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`
      );
      const data = await res.json();
      const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      onChange(address, lat, lng);
    } catch {
      onChange(`${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          label="Adresse"
          placeholder="Abidjan, Cocody"
          value={value}
          onChange={(e) => onChange(e.target.value, lat, lng)}
          className="flex-1"
        />
        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={getCurrentPosition}
            isLoading={loading}
            className="mb-0"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {lat !== 0 && lng !== 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin className="h-3 w-3" />
            <span>Lat: {lat.toFixed(6)}</span>
            <span>Lng: {lng.toFixed(6)}</span>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Cliquez sur la cible pour utiliser votre position GPS actuelle, ou entrez une adresse manuellement.
      </p>
    </div>
  );
}
