import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { fetchCompanyByCode, fetchCompany } from "@/services/company.service";
import { updateProfile } from "@/services/auth.service";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { signOut } from "@/services/auth.service";
import logoImage from "@/img/smart_presence_logo.png";
import { Building2, ArrowRight, LogOut, Users, Shield, Zap } from "lucide-react";

export function JoinCompanyPage() {
  const navigate = useNavigate();
  const { user, setUser, setCompany, logout } = useAuthStore();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      if (!company) throw new Error("Code entreprise invalide. Vérifiez auprès de votre administrateur.");

      if (!user) throw new Error("Session expirée. Reconnectez-vous.");

      const { data: profile, error: profileError } = await updateProfile(user.id, {
        role: "EMPLOYEE",
        company_id: company.id,
      });
      if (profileError) throw new Error(profileError.message);

      // Charger la company complète dans le store
      const fullCompany = await fetchCompany(company.id);
      setUser(profile);
      setCompany(fullCompany);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la jonction");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut();
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Simple top bar */}
      <div className="flex h-16 items-center justify-between border-b border-slate-100 bg-white px-6">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Smart Presence Logo" className="h-7 w-auto object-contain" />
          <span className="text-lg font-bold text-slate-900">Smart Presence</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
              <Building2 className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Rejoignez votre entreprise
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Bonjour <strong>{user?.firstname}</strong> ! Pour accéder à votre espace de travail, 
              entrez le code fourni par votre administrateur.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl bg-white p-8 shadow-xl"
          >
            {error && (
              <Alert variant="error" className="mb-5">{error}</Alert>
            )}

            <form onSubmit={handleJoin} className="space-y-5">
              <Input
                label="Code entreprise"
                placeholder="SP-9XK2L"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                autoFocus
                className="font-mono text-lg tracking-widest text-center"
              />
              <p className="text-xs text-slate-400 text-center">
                Demandez ce code à votre responsable ou administrateur.
              </p>
              <Button
                type="submit"
                className="w-full rounded-xl"
                isLoading={loading}
              >
                Rejoindre l'équipe
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </motion.div>

          {/* Info cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 grid grid-cols-3 gap-3"
          >
            {[
              { icon: Users, label: "Rejoignez votre équipe" },
              { icon: Shield, label: "Accès sécurisé" },
              { icon: Zap, label: "Prêt en 10 secondes" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center"
              >
                <Icon className="h-5 w-5 text-primary-500" />
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
