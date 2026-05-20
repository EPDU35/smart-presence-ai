import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp, createProfile } from "@/services/auth.service";
import { createCompany, fetchCompanyByCode } from "@/services/company.service";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Building2, Users, ArrowRight, ArrowLeft } from "lucide-react";

type Step = "identity" | "choice" | "create" | "join";

export function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [step, setStep] = useState<Step>("identity");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateIdentity() {
    if (!fullname.trim() || !email.trim() || !password) {
      setError("Tous les champs sont obligatoires");
      return false;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caracteres");
      return false;
    }
    setError("");
    return true;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Le nom de l entreprise est obligatoire");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await signUp(email, password);
      if (authError || !authData.user) throw authError || new Error("Erreur inscription");

      const company = await createCompany(companyName, companyLocation, authData.user.id);
      if (!company) throw new Error("Erreur creation entreprise");

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
      setError(err instanceof Error ? err.message : "Erreur lors de l inscription");
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) {
      setError("Le code entreprise est obligatoire");
      return;
    }

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
      setError(err instanceof Error ? err.message : "Erreur lors de l inscription");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Creation de votre espace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* LEFT SIDE */}
      <div className="hidden w-1/2 bg-primary-50 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold text-slate-900">
            Simplifiez la gestion des presences
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Rejoignez Smart Presence et transformez la facon dont vous suivez votre equipe.
          </p>
          <div className="mt-10 space-y-4">
            {[
              { text: "Configuration en moins de 2 minutes" },
              { text: "Pointage par QR Code simple" },
              { text: "Validation GPS automatique" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                  {i + 1}
                </div>
                <p className="text-sm font-medium text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            {/* STEP 1: IDENTITY */}
            {step === "identity" && (
              <div>
                <div className="mb-8 text-center">
                  <h1 className="text-2xl font-bold text-slate-900">Creer votre compte</h1>
                  <p className="mt-2 text-sm text-slate-500">Configurez votre espace en moins de 2 minutes.</p>
                </div>

                {error && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-5">
                  <Input
                    label="Nom complet"
                    placeholder="Jean Dupont"
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                  />
                  <Input
                    type="email"
                    label="Email professionnel"
                    placeholder="jean@entreprise.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <div>
                    <Input
                      type="password"
                      label="Mot de passe"
                      placeholder="Min. 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">Au moins 8 caracteres</p>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => {
                      if (validateIdentity()) setStep("choice");
                    }}
                  >
                    Continuer
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <p className="mt-6 text-center text-sm text-slate-500">
                  Deja un compte ?{" "}
                  <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
                    Se connecter
                  </Link>
                </p>
              </div>
            )}

            {/* STEP 2: CHOICE */}
            {step === "choice" && (
              <div>
                <div className="mb-8 text-center">
                  <h1 className="text-2xl font-bold text-slate-900">Comment souhaitez-vous continuer ?</h1>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => { setError(""); setStep("create"); }}
                    className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-primary-500 hover:shadow-lg"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                      <Building2 className="h-6 w-6 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">Creer une entreprise</p>
                      <p className="text-sm text-slate-500">Creer un nouvel espace de gestion pour votre equipe.</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300" />
                  </button>

                  <button
                    onClick={() => { setError(""); setStep("join"); }}
                    className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-primary-500 hover:shadow-lg"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <Users className="h-6 w-6 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">Rejoindre une entreprise</p>
                      <p className="text-sm text-slate-500">Entrer un code d invitation envoye par votre entreprise.</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300" />
                  </button>
                </div>

                <button
                  onClick={() => setStep("identity")}
                  className="mx-auto mt-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </button>
              </div>
            )}

            {/* STEP 3A: CREATE COMPANY */}
            {step === "create" && (
              <div>
                <div className="mb-8 text-center">
                  <h1 className="text-2xl font-bold text-slate-900">Creer votre entreprise</h1>
                </div>

                {error && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleCreate} className="space-y-5">
                  <Input
                    label="Nom de l entreprise"
                    placeholder="Ma Societe SA"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    autoFocus
                  />
                  <Input
                    label="Localisation"
                    placeholder="Abidjan, Cocody"
                    value={companyLocation}
                    onChange={(e) => setCompanyLocation(e.target.value)}
                  />

                  <Button type="submit" className="w-full">
                    Creer mon espace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>

                <button
                  onClick={() => setStep("choice")}
                  className="mx-auto mt-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </button>
              </div>
            )}

            {/* STEP 3B: JOIN COMPANY */}
            {step === "join" && (
              <div>
                <div className="mb-8 text-center">
                  <h1 className="text-2xl font-bold text-slate-900">Rejoindre une entreprise</h1>
                </div>

                {error && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleJoin} className="space-y-5">
                  <Input
                    label="Code entreprise"
                    placeholder="SP-9XK2L"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    autoFocus
                  />

                  <Button type="submit" className="w-full">
                    Rejoindre
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>

                <button
                  onClick={() => setStep("choice")}
                  className="mx-auto mt-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
