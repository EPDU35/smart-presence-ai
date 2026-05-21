import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signIn, getCurrentUser } from "@/services/auth.service";
import { fetchCompany } from "@/services/company.service";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Users, Clock, Shield } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setCompany } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) throw signInError;

      const profile = await getCurrentUser();
      setUser(profile);

      // Charger la company dans le store
      if (profile?.company_id) {
        const company = await fetchCompany(profile.company_id);
        setCompany(company);
      }

      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-primary-50 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold text-slate-900">Simplifiez la gestion des presences</h2>
          <p className="mt-4 text-lg text-slate-600">Connectez-vous a votre espace Smart Presence et gardez le controle de votre equipe en temps reel.</p>
          <div className="mt-10 space-y-4">
            {[
              { icon: Users, title: "Gestion d'equipe", desc: "Suivez vos employes facilement" },
              { icon: Clock, title: "Temps reel", desc: "Presences instantanees" },
              { icon: Shield, title: "Securise", desc: "Donnees protegees" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Icon className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-slate-900">Bon retour</h1>
              <p className="mt-2 text-sm text-slate-500">Connectez-vous pour acceder a votre espace.</p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input type="email" label="Email professionnel" placeholder="jean@entreprise.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" label="Mot de passe" placeholder="Votre mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="submit" className="w-full" isLoading={loading}>Se connecter</Button>
            </form>

            <div className="mt-6 flex items-center justify-between text-sm">
              <Link to="/forgot-password" className="text-slate-500 hover:text-slate-700">Mot de passe oublié ?</Link>
              <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">Creer un compte</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}