import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { updateCompany } from "@/services/company.service";

export function SettingsPage() {
  const { user, company } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: company?.name ?? "",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    radius: company?.radius ?? 100,
    latitude: company?.latitude ?? 0,
    longitude: company?.longitude ?? 0,
  });

  function updateField<K extends keyof typeof form>(key: K, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (!company?.id) return;
    setSaving(true);

    try {
      await updateCompany(company.id, {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        radius: Number(form.radius),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Parametres</h1>
        <p className="text-sm text-slate-500">Configuration de votre entreprise</p>
      </div>

      {saved && <Alert variant="success">Modifications enregistrees</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Informations generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Nom de l entreprise"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
          <Input
            type="email"
            label="Email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
          <Input
            label="Telephone"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Localisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              step="0.000001"
              label="Latitude"
              value={form.latitude}
              onChange={(e) => updateField("latitude", parseFloat(e.target.value))}
            />
            <Input
              type="number"
              step="0.000001"
              label="Longitude"
              value={form.longitude}
              onChange={(e) => updateField("longitude", parseFloat(e.target.value))}
            />
          </div>
          <Input
            type="number"
            label="Rayon autorise (metres)"
            value={form.radius}
            onChange={(e) => updateField("radius", parseInt(e.target.value))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Email</span>
            <span className="text-slate-900">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Role</span>
            <span className="text-slate-900">{user?.role}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={saving}>
          Enregistrer les modifications
        </Button>
      </div>
    </div>
  );
}
