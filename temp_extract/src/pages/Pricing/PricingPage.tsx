import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Check, Zap, Building2, Landmark, ChevronDown, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Starter", price: 15000, employees: 20, icon: Zap,
    features: ["Jusqu'à 20 employés", "QR Code dynamique", "Vérification GPS", "Dashboard basique", "Support email"],
    cta: "Commencer gratuitement", highlighted: false,
  },
  {
    name: "Pro", price: 65000, employees: 100, icon: Building2,
    features: ["Jusqu'à 100 employés", "QR Code dynamique", "Vérification GPS", "Anti-fraude avancé", "Analytics détaillées", "Rapports PDF mensuels", "Multi-admin", "Support prioritaire"],
    cta: "Choisir Pro", highlighted: true,
  },
  {
    name: "Entreprise", price: null, employees: null, icon: Landmark,
    features: ["Employés illimités", "Toutes les fonctions Pro", "Multi-sites", "API externe", "Mode hors ligne", "Support dédié", "Formation équipe", "SLA garanti"],
    cta: "Nous contacter", highlighted: false,
  },
];

const faqs = [
  { q: "Puis-je changer de plan à tout moment ?", a: "Oui. Vous pouvez upgrader ou downgrader votre plan à tout moment. La différence est calculée au prorata." },
  { q: "Y a-t-il un engagement minimum ?", a: "Non. Tous nos plans sont sans engagement. Vous pouvez résilier quand vous voulez." },
  { q: "Comment fonctionne la limite d'employés ?", a: "Chaque plan inclut un nombre maximum d'employés actifs. Vous pouvez passer au plan supérieur si vous dépassez la limite." },
  { q: "Quels moyens de paiement acceptez-vous ?", a: "Nous acceptons les virements bancaires, Mobile Money (Orange Money, MTN MoMo, Wave) et les cartes bancaires internationales." },
  { q: "L'essai gratuit nécessite-t-il une carte bancaire ?", a: "Non. L'essai gratuit de 14 jours est entièrement gratuit, sans carte bancaire ni engagement." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors">
        <span className="text-sm font-semibold text-slate-900">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-6 pb-5 pt-4">
          <p className="text-sm text-slate-500">{a}</p>
        </div>
      )}
    </div>
  );
}

export function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="flex h-16 items-center justify-between border-b border-slate-100 bg-white px-6 lg:px-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-xs font-bold text-white">SP</span>
          </div>
          <span className="text-lg font-bold text-slate-900">Smart Presence</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login"><Button variant="secondary" size="sm" className="rounded-xl border border-slate-200">Connexion</Button></Link>
          <Link to="/register"><Button size="sm" className="rounded-xl">Commencer</Button></Link>
        </div>
      </nav>

      {/* HEADER */}
      <div className="px-6 py-16 text-center lg:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Badge variant="primary" className="mb-4">Tarifs transparents</Badge>
          <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">Tarifs adaptés aux entreprises africaines</h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-slate-500">Pas de frais cachés. Pas de commission par employé. Un prix fixe par entreprise.</p>
        </motion.div>

        {/* Billing toggle */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mx-auto mt-8 inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button onClick={() => setBilling("monthly")} className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${billing === "monthly" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            Mensuel
          </button>
          <button onClick={() => setBilling("yearly")} className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${billing === "yearly" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            Annuel <span className={`ml-1.5 text-xs font-semibold ${billing === "yearly" ? "text-success-300" : "text-success-600"}`}>-20%</span>
          </button>
        </motion.div>
      </div>

      {/* PLANS */}
      <div className="px-6 pb-20 lg:px-12">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const displayPrice = plan.price === null ? "Sur devis"
              : billing === "yearly"
              ? `${Math.round(plan.price * 0.8 * 12).toLocaleString("fr-FR")} FCFA/an`
              : `${plan.price.toLocaleString("fr-FR")} FCFA/mois`;

            return (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <div className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-7 ${plan.highlighted ? "border-primary-400 bg-primary-600 text-white shadow-xl shadow-primary-200" : "border-slate-200 bg-white shadow-sm hover:border-primary-200 hover:shadow-md transition-all"}`}>
                  {plan.highlighted && (
                    <div className="absolute right-5 top-5">
                      <Badge variant="warning">Plus populaire</Badge>
                    </div>
                  )}

                  <div>
                    <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${plan.highlighted ? "bg-white/20" : "bg-slate-100"}`}>
                      <plan.icon className={`h-5 w-5 ${plan.highlighted ? "text-white" : "text-slate-600"}`} />
                    </div>
                    <h3 className={`text-xl font-bold ${plan.highlighted ? "text-white" : "text-slate-900"}`}>{plan.name}</h3>
                    <div className="mt-3">
                      <span className={`text-3xl font-bold ${plan.highlighted ? "text-white" : "text-slate-900"}`}>
                        {plan.price === null ? "Sur devis" : displayPrice.split(" ")[0]}
                      </span>
                      {plan.price !== null && (
                        <span className={`ml-1 text-sm ${plan.highlighted ? "text-white/70" : "text-slate-400"}`}>
                          {billing === "yearly" ? "FCFA/an" : "FCFA/mois"}
                        </span>
                      )}
                    </div>
                    {plan.employees && (
                      <p className={`mt-1 text-sm ${plan.highlighted ? "text-white/70" : "text-slate-500"}`}>
                        Jusqu'à {plan.employees} employés
                      </p>
                    )}
                  </div>

                  <ul className="my-7 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.highlighted ? "text-white/90" : "text-slate-600"}`}>
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted ? "text-white" : "text-success-500"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link to="/register">
                    <Button variant={plan.highlighted ? "secondary" : "primary"}
                      className={`w-full rounded-xl ${plan.highlighted ? "bg-white text-primary-700 hover:bg-slate-50" : ""}`}>
                      {plan.cta}
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <section className="border-t border-slate-100 bg-slate-50 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mb-8 text-center text-3xl font-bold text-slate-900">Questions fréquentes</motion.h2>
          <div className="space-y-3">
            {faqs.map((faq) => <FaqItem key={faq.q} {...faq} />)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 px-6 py-20 text-center lg:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl font-bold text-white">Prêt à sécuriser les pointages de votre entreprise ?</h2>
          <p className="mx-auto mt-4 max-w-lg text-slate-400">Essai gratuit de 14 jours · Sans carte bancaire · Sans engagement.</p>
          <Link to="/register" className="mt-8 inline-block">
            <Button size="lg" className="rounded-2xl bg-white text-slate-900 hover:bg-slate-100 px-8">
              Démarrer l'essai gratuit
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
