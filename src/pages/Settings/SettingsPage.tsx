import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { LocationPicker } from "@/components/register/LocationPicker";
import { updateCompany, companyHasScheduleColumns } from "@/services/company.service";
import { updateProfile } from "@/services/auth.service";
import { Shield, Smartphone, MapPin, Building2, User, Copy, Check } from "lucide-react";
import type { Company } from "@/types";

/** Supabase renvoie souvent "08:00:00" — les inputs type=time attendent "08:00" */
function normalizeTime(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.slice(0, 5);
}

function isEmployeeRole(role: string | undefined): boolean {
  return role === "EMPLOYEE";
}

export function SettingsPage() {
  const { user, company, setCompany, setUser } = useAuthStore();
  const isEmployee = isEmployeeRole(user?.role);
  const hasScheduleColumns = companyHasScheduleColumns(company);
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<"company" | "presence" | "security" | "account">("account");

  const [form, setForm] = useState({
    name: company?.name ?? "",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    radius: company?.radius ?? 100,
    latitude: company?.latitude ?? 0,
    longitude: company?.longitude ?? 0,
    location: company?.location ?? "",
    opening_time: normalizeTime(company?.opening_time, "08:00"),
    closing_time: normalizeTime(company?.closing_time, "18:00"),
    late_tolerance: company?.late_tolerance ?? 15,
  });

  const [userForm, setUserForm] = useState({
    firstname: user?.firstname ?? "",
    lastname: user?.lastname ?? "",
    phone: user?.phone ?? "",
  });

  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name ?? "",
      email: company.email ?? "",
      phone: company.phone ?? "",
      radius: company.radius ?? 100,
      latitude: company.latitude ?? 0,
      longitude: company.longitude ?? 0,
      location: company.location ?? "",
      opening_time: normalizeTime(company.opening_time, "08:00"),
      closing_time: normalizeTime(company.closing_time, "18:00"),
      late_tolerance: company.late_tolerance ?? 15,
    });
  }, [company?.id, company?.updated_at]);

  useEffect(() => {
    if (!user) return;
    setUserForm({
      firstname: user.firstname ?? "",
      lastname: user.lastname ?? "",
      phone: user.phone ?? "",
    });
    setActiveSection(isEmployeeRole(user.role) ? "account" : "company");
  }, [user?.id, user?.role, user?.firstname, user?.lastname, user?.phone]);

  function updateField<K extends keyof typeof form>(key: K, value: string | number) {
    // Guard against NaN for numeric fields
    if (typeof value === "number" && isNaN(value)) return;
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function updateUserField<K extends keyof typeof userForm>(key: K, value: string) {
    setUserForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setErrorMsg(null);
    try {
      // Employés : uniquement le profil (jamais la table companies)
      if (isEmployee) {
        if (!user?.id) return;
        const { data, error } = await updateProfile(user.id, {
          firstname: userForm.firstname.trim(),
          lastname: userForm.lastname.trim(),
          phone: userForm.phone?.trim() || null,
        });
        if (error) throw new Error(error.message);
        if (data) setUser(data);
        setSaved(true);
        return;
      }

      if (activeSection === "account") {
        if (!user?.id) return;
        const { data, error } = await updateProfile(user.id, {
          firstname: userForm.firstname.trim(),
          lastname: userForm.lastname.trim(),
          phone: userForm.phone?.trim() || null,
        });
        if (error) throw new Error(error.message);
        if (data) setUser(data);
      } else if ((activeSection === "company" || activeSection === "presence") && company?.id) {
        const radiusVal = Number(form.radius);
        const latVal = Number(form.latitude);
        const lngVal = Number(form.longitude);
        const toleranceVal = Number(form.late_tolerance);

        const companyUpdates: Partial<Company> = {
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          location: form.location || null,
          radius: isNaN(radiusVal) ? company.radius : radiusVal,
          latitude: isNaN(latVal) ? company.latitude : latVal,
          longitude: isNaN(lngVal) ? company.longitude : lngVal,
        };

        if (hasScheduleColumns) {
          companyUpdates.opening_time = form.opening_time || null;
          companyUpdates.closing_time = form.closing_time || null;
          companyUpdates.late_tolerance = isNaN(toleranceVal) ? company.late_tolerance : toleranceVal;
        }

        const updatedCompany = await updateCompany(company.id, companyUpdates);
        setCompany(updatedCompany);
      }
      setSaved(true);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  function copyCode() {
    const code = company?.code ?? "";
    if (!code) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => fallbackCopy(code));
    } else {
      fallbackCopy(code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function fallbackCopy(text: string) {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }

  const allSections = [
    { id: "company", label: "Entreprise", icon: Building2 },
    { id: "presence", label: "Présence", icon: MapPin },
    { id: "security", label: "Sécurité", icon: Shield },
    { id: "account", label: "Mon compte", icon: User },
  ] as const;

  const sections = isEmployee 
    ? allSections.filter(s => s.id === "account" || s.id === "security")
    : allSections;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500">Configuration de votre {isEmployee ? "compte" : "entreprise et de votre compte"}</p>
      </motion.div>

      {saved && <Alert variant="success">Modifications enregistrées avec succès ✓</Alert>}
      {errorMsg && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-900">Erreur lors de l'enregistrement</p>
          <p className="mt-1 text-xs text-danger-700">{errorMsg}</p>
        </div>
      )}

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {sections.map((s, index) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all focus:z-10 ${
                activeSection === s.id
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              } ${index === 0 ? "rounded-l-2xl" : ""} ${index === sections.length - 1 ? "rounded-r-2xl" : "border-l border-slate-200"}`}
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
                  <p className="font-mono text-lg font-bold tracking-widest text-slate-900">
                    {company?.code ?? "—"}
                  </p>
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

              {hasScheduleColumns ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input type="time" label="Heure d'ouverture" value={form.opening_time} onChange={(e) => updateField("opening_time", e.target.value)} />
                    <Input type="time" label="Heure de fermeture" value={form.closing_time} onChange={(e) => updateField("closing_time", e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Tolérance retard (minutes)</label>
                    <Input type="number" min={0} max={120} value={form.late_tolerance} onChange={(e) => updateField("late_tolerance", parseInt(e.target.value))} />
                    <p className="mt-1 text-xs text-slate-400">Délai accordé avant qu'un pointage soit marqué comme retard.</p>
                  </div>
                </>
              ) : (
                <Alert variant="warning">
                  Les horaires d'ouverture ne sont pas encore activés sur votre base Supabase.
                  Exécutez le fichier <code className="text-xs">supabase-schema-additions.sql</code> dans le SQL Editor.
                </Alert>
              )}
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
              <div className="flex h-24 items-center justify-center rounded-xl bg-slate-50">
                <p className="text-sm text-slate-400">Aucun log de connexion disponible pour le moment.</p>
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
                <Input label="Prénom" value={userForm.firstname} onChange={(e) => updateUserField("firstname", e.target.value)} />
                <Input label="Nom" value={userForm.lastname} onChange={(e) => updateUserField("lastname", e.target.value)} />
              </div>
              <Input type="email" label="Email" value={user?.email ?? ""} disabled />
              <Input label="Téléphone" value={userForm.phone} onChange={(e) => updateUserField("phone", e.target.value)} />
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

      {/* Save button — compte (employé) ou entreprise/présence (admin) */}
      {((isEmployee && activeSection === "account") ||
        (!isEmployee && (activeSection === "company" || activeSection === "presence" || activeSection === "account"))) && (
        <div className="flex justify-end">
          <Button onClick={handleSave} isLoading={saving} className="rounded-xl">
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  );
}