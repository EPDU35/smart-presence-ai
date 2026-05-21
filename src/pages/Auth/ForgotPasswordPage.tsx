import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import logoImage from "@/img/smart_presence_logo.png";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Entrez votre adresse email"); return; }
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* LEFT */}
      <div className="hidden w-1/2 flex-col justify-center bg-primary-50 px-16 lg:flex">
        <div className="max-w-md">
          <div className="mb-6 flex items-center gap-2">
            <img src={logoImage} alt="Smart Presence Logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-slate-900">Smart Presence</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Récupérez votre accès</h2>
          <p className="mt-4 text-lg text-slate-600">Nous vous enverrons un lien sécurisé pour réinitialiser votre mot de passe.</p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex w-full items-center justify-center bg-slate-50 px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            <AnimatePresence mode="wait">
              {!sent ? (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Mot de passe oublié ?</h1>
                    <p className="mt-2 text-sm text-slate-500">Entrez votre email pour recevoir un lien de réinitialisation.</p>
                  </div>
                  {error && <Alert variant="error" className="mb-5">{error}</Alert>}
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <Input type="email" label="Email professionnel" placeholder="jean@entreprise.com"
                      value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                    <Button type="submit" isLoading={loading} className="w-full rounded-xl">
                      <Mail className="mr-2 h-4 w-4" />
                      Envoyer le lien
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-50">
                    <CheckCircle className="h-9 w-9 text-success-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center justify-center gap-2"><CheckCircle className="h-5 w-5 text-success-600" />Email envoyé</h2>
                  <p className="mt-3 text-sm text-slate-500">
                    Un lien de réinitialisation a été envoyé à <strong>{email}</strong>. Vérifiez votre boîte mail.
                  </p>
                  <p className="mt-2 text-xs text-slate-400">Si vous ne le recevez pas, vérifiez vos spams.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
