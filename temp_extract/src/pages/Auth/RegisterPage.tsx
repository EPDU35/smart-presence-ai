import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp, createProfile } from "@/services/auth.service";
import { createCompany, fetchCompanyByCode } from "@/services/company.service";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { LocationPicker } from "@/components/register/LocationPicker";
import { Building2, Users, ArrowRight, ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react";

type Step = "identity" | "choice" | "create" | "join";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8 caractères minimum", ok: password.length >= 8 },
    { label: "Une majuscule", ok: /[A-Z]/.test(password) },
    { label: "Un chiffre", ok: /[0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ["bg-danger-500", "bg-warning-500", "bg-warning-400", "bg-success-500"];
  const labels = ["", "Faible", "Moyen", "Fort"];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < score ? colors[score] : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-xs font-medium ${score === 3 ? "text-success-600" : score === 2 ? "text-warning-600" : "text-danger-600"}`}>
          {labels[score]}
        </p>
      )}
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-1.5 text-xs">
            {c.ok
              ? <Check className="h-3 w-3 text-success-500" />
              : <X className="h-3 w-3 text-slate-300" />}
            <span className={c.ok ? "text-success-700" : "text-slate-400"}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const LEFT_STEPS = {
  identity: {
    title: "Simplifiez la gestion des présences",
    desc: "Rejoignez Smart Presence et transformez la façon dont vous suivez votre équipe.",
    items: ["Configuration en moins de 2 minutes", "Pointage par QR Code simple", "Validation GPS automatique"],
  },
  choice: {
    title: "Un espace pour chaque rôle",
    desc: "Créez votre entreprise ou rejoignez une équipe existante.",
    items: ["Gestion multi-équipes", "Tableau de bord en temps réel", "Sécurité renforcée"],
  },
  create: {
    title: "Votre entreprise en quelques secondes",
    desc: "Configurez votre espace de gestion et invitez votre équipe.",
    items: ["Code d'invitation unique", "GPS configuré automatiquement", "Prêt en 2 minutes"],
  },
  join: {
    title: "Rejoignez votre équipe",
    desc: "Un code suffit pour accéder à votre espace de travail.",
    items: ["Accès immédiat", "Profil configuré automatiquement", "Support disponible"],
  },
};

export function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [step, setStep] = useState<Step>("identity");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [companyLat, setCompanyLat] = useState(0);
  const [companyLng, setCompanyLng] = useState(0);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateIdentity() {
    if (!fullname.trim() || !email.trim() || !password) {
      setError("Tous les champs sont obligatoires");
      return false;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return false;
    }
    setError("");
    return true;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) { setError("Le nom de l'entreprise est obligatoire"); return; }
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await signUp(email, password);
      if (authError || !authData.user) throw authError || new Error("Erreur inscription");

      const company = await createCompany(companyName, companyLocation, companyLat, companyLng, authData.user.id);
      if (!company) throw new Error("Erreur création entreprise");

      const profile = await createProfile(authData.user.id, {
        fullname,
        email,
        role: "ADMIN",
        company_id: company.id,
      });
      if (profile.error) throw profile.error;
      setUser(profile.data);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription");
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) { setError("Le code entreprise est obligatoire"); return; }
    setLoading(true);
    setError("");
    try {
      const company = await fetchCompanyByCode(joinCode);
      if (!company) throw new Error("Code entreprise invalide");

      const { data: authData, error: authError } = await signUp(email, password);
      if (authError || !authData.user) throw authError || new Error("Erreur inscription");

      const profile = await createProfile(authData.user.id, {
        fullname,
        email,
        role: "EMPLOYEE",
        company_id: company.id,
      });
      if (profile.error) throw profile.error;
      setUser(profile.data);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription");
      setLoading(false);
    }
  }

  const leftContent = LEFT_STEPS[step];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Création de votre espace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* LEFT SIDE */}
      <div className="hidden w-1/2 bg-primary-50 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="max-w-md">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <span className="text-sm font-bold text-white">SP</span>
            </div>
            <span className="font-bold text-slate-900">Smart Presence</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-900">{leftContent.title}</h2>
          <p className="mt-4 text-lg text-slate-600">{leftContent.desc}</p>
          <div className="mt-10 space-y-4">
            {leftContent.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm font-medium text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex w-full items-center justify-center bg-slate-50 px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Progress bar */}
          <div className="mb-8 flex gap-2">
            {(["identity", "choice", step === "create" ? "create" : "join"] as const).map((s, i) => {
              const steps = ["identity", "choice", step === "create" ? "create" : "join"];
              const current = steps.indexOf(step);
              return (
                <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= current ? "bg-primary-500" : "bg-slate-200"}`} />
              );
            })}
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-xl">
            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* STEP 1: IDENTITY */}
            {step === "identity" && (
              <div>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-slate-900">Créer votre compte</h1>
                  <p className="mt-2 text-sm text-slate-500">Configurez votre espace en moins de 2 minutes.</p>
                </div>
                <div className="space-y-5">
                  <Input label="Nom complet" placeholder="Jean Dupont" value={fullname} onChange={(e) => setFullname(e.target.value)} />
                  <Input type="email" label="Email professionnel" placeholder="jean@entreprise.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <div>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        label="Mot de passe"
                        placeholder="Min. 8 caractères"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={password} />
                  </div>
                  <Button className="w-full rounded-xl" onClick={() => { if (validateIdentity()) setStep("choice"); }}>
                    Continuer
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-6 text-center text-sm text-slate-500">
                  Déjà un compte ?{" "}
                  <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">Se connecter</Link>
                </p>
              </div>
            )}

            {/* STEP 2: CHOICE */}
            {step === "choice" && (
              <div>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-slate-900">Comment souhaitez-vous continuer ?</h1>
                </div>
                <div className="space-y-4">
                  <button onClick={() => { setError(""); setStep("create"); }} className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-primary-500 hover:shadow-lg">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                      <Building2 className="h-6 w-6 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">Créer une entreprise</p>
                      <p className="text-sm text-slate-500">Créer un nouvel espace de gestion pour votre équipe.</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300" />
                  </button>
                  <button onClick={() => { setError(""); setStep("join"); }} className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-primary-500 hover:shadow-lg">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <Users className="h-6 w-6 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">Rejoindre une entreprise</p>
                      <p className="text-sm text-slate-500">Entrer un code d'invitation envoyé par votre entreprise.</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300" />
                  </button>
                </div>
                <button onClick={() => setStep("identity")} className="mx-auto mt-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                  <ArrowLeft className="h-4 w-4" />Retour
                </button>
              </div>
            )}

            {/* STEP 3A: CREATE COMPANY */}
            {step === "create" && (
              <div>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-slate-900">Créer votre entreprise</h1>
                  <p className="mt-2 text-sm text-slate-500">Ces infos serviront à valider le GPS de vos employés.</p>
                </div>
                <form onSubmit={handleCreate} className="space-y-5">
                  <Input label="Nom de l'entreprise" placeholder="Ma Société SA" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus />
                  <LocationPicker
                    value={companyLocation}
                    lat={companyLat}
                    lng={companyLng}
                    onChange={(loc, lat, lng) => { setCompanyLocation(loc); setCompanyLat(lat); setCompanyLng(lng); }}
                  />
                  <Button type="submit" className="w-full rounded-xl">
                    Créer mon espace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
                <button onClick={() => setStep("choice")} className="mx-auto mt-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                  <ArrowLeft className="h-4 w-4" />Retour
                </button>
              </div>
            )}

            {/* STEP 3B: JOIN COMPANY */}
            {step === "join" && (
              <div>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-slate-900">Rejoindre une entreprise</h1>
                  <p className="mt-2 text-sm text-slate-500">Entrez le code fourni par votre administrateur.</p>
                </div>
                <form onSubmit={handleJoin} className="space-y-5">
                  <Input label="Code entreprise" placeholder="SP-9XK2L" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} autoFocus className="font-mono text-lg tracking-widest text-center" />
                  <Button type="submit" className="w-full rounded-xl">
                    Rejoindre l'équipe
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
                <button onClick={() => setStep("choice")} className="mx-auto mt-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                  <ArrowLeft className="h-4 w-4" />Retour
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
