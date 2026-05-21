import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { LocationPicker } from "@/components/register/LocationPicker";
import { updateCompany } from "@/services/company.service";
import { Shield, Smartphone, Clock, MapPin, Building2, User, Copy, Check } from "lucide-react";

export function SettingsPage() {
  const { user, company } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<"company" | "presence" | "security" | "account">("company");

  const [form, setForm] = useState({
    name: company?.name ?? "",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    radius: company?.radius ?? 100,
    latitude: company?.latitude ?? 0,
    longitude: company?.longitude ?? 0,
    location: "",
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

  function copyCode() {
    // Company code would be on the company object
    navigator.clipboard.writeText("SP-CODE");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sections = [
    { id: "company", label: "Entreprise", icon: Building2 },
    { id: "presence", label: "Présence", icon: MapPin },
    { id: "security", label: "Sécurité", icon: Shield },
    { id: "account", label: "Mon compte", icon: User },
  ] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500">Configuration de votre entreprise et de votre compte</p>
      </motion.div>

      {saved && <Alert variant="success">Modifications enregistrées avec succès ✓</Alert>}

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeSection === s.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <s.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* COMPANY */}
      {activeSection === "company" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Nom de l'entreprise" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
              <Input type="email" label="Email professionnel" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
              <Input label="Téléphone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Code d'invitation</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-500">Partagez ce code avec vos employés pour qu'ils rejoignent votre espace.</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="font-mono text-lg font-bold tracking-widest text-slate-900">SP-CODE</p>
                </div>
                <Button variant="secondary" onClick={copyCode} className="rounded-xl">
                  {copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* PRESENCE */}
      {activeSection === "presence" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Localisation de l'entreprise</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">La position GPS de référence pour valider les pointages.</p>
              <LocationPicker
                value={form.location}
                lat={form.latitude}
                lng={form.longitude}
                onChange={(loc, lat, lng) => {
                  updateField("location", loc);
                  updateField("latitude", lat);
                  updateField("longitude", lng);
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Règles de présence</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Rayon autorisé (mètres)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={25}
                    max={500}
                    step={25}
                    value={form.radius}
                    onChange={(e) => updateField("radius", parseInt(e.target.value))}
                    className="flex-1 accent-primary-600"
                  />
                  <div className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-sm font-semibold text-slate-900">
                    {form.radius}m
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Les employés doivent être à moins de {form.radius}m pour valider leur présence.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input type="time" label="Heure d'arrivée" defaultValue="08:00" />
                <Input type="time" label="Heure de fin" defaultValue="18:00" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Tolérance retard (minutes)</label>
                <Input type="number" min={0} max={60} defaultValue={15} />
                <p className="mt-1 text-xs text-slate-400">Délai accordé avant qu'un pointage soit marqué comme retard.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* SECURITY */}
      {activeSection === "security" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Authentification à deux facteurs</CardTitle>
                <Badge variant="warning">Inactif</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-slate-500">Renforcez la sécurité de votre compte en activant la 2FA.</p>
              <Button variant="secondary" className="rounded-xl">
                <Shield className="mr-2 h-4 w-4" />
                Activer la 2FA
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Appareils connectés</CardTitle>
                <Badge variant="default">1 actif</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <Smartphone className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">Navigateur Web</p>
                    <p className="text-xs text-slate-400">Session actuelle · Abidjan, CI</p>
                  </div>
                  <Badge variant="success">Actif</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Logs de connexion</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { action: "Connexion réussie", time: "Aujourd'hui, 08:34", status: "success" as const },
                  { action: "Connexion réussie", time: "Hier, 09:12", status: "success" as const },
                  { action: "Tentative échouée", time: "Il y a 3 jours", status: "danger" as const },
                ].map((log, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <p className="text-sm text-slate-700">{log.action}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-400">{log.time}</p>
                      <Badge variant={log.status}>{log.status === "success" ? "OK" : "Erreur"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ACCOUNT */}
      {activeSection === "account" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Informations personnelles</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
                  {user?.firstname?.[0]}{user?.lastname?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{user?.firstname} {user?.lastname}</p>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                  <Badge variant="success" className="mt-1">{user?.role}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Prénom" defaultValue={user?.firstname ?? ""} />
                <Input label="Nom" defaultValue={user?.lastname ?? ""} />
              </div>
              <Input type="email" label="Email" defaultValue={user?.email ?? ""} />
              <Input label="Téléphone" defaultValue={user?.phone ?? ""} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Changer le mot de passe</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input type="password" label="Mot de passe actuel" placeholder="••••••••" />
              <Input type="password" label="Nouveau mot de passe" placeholder="••••••••" />
              <Input type="password" label="Confirmer le mot de passe" placeholder="••••••••" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Save button - visible on company and presence tabs */}
      {(activeSection === "company" || activeSection === "presence" || activeSection === "account") && (
        <div className="flex justify-end">
          <Button onClick={handleSave} isLoading={saving} className="rounded-xl">
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  );
}
