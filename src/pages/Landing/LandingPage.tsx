import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import mockupImage from "@/img/Mockup.png";
import logoImage from "@/img/smart_presence_logo.png";
import { QrCode, MapPin, BarChart3, Shield, Check, ArrowRight, Smartphone, ChevronDown, Rocket, Clock, XCircle, DollarSign } from "lucide-react";

const features = [
  { icon: Smartphone, title: "Pointage mobile", desc: "Les employés enregistrent leur présence directement depuis leur smartphone en quelques secondes." },
  { icon: MapPin, title: "Validation GPS", desc: "Chaque présence est validée automatiquement selon la position GPS et les règles de l'entreprise." },
  { icon: BarChart3, title: "Dashboard temps réel", desc: "Suivez les présences, retards et activités de votre équipe instantanément, partout." },
  { icon: Shield, title: "Sécurité intégrée", desc: "QR Code dynamique anti-fraude, sessions sécurisées et accès contrôlés par rôle." },
];

// testimonials removed per design: section replaced/omitted

const faqs = [
  { q: "Comment fonctionne le pointage ?", a: "L'admin affiche un QR Code sur son écran. L'employé le scanne avec son téléphone. La validation GPS confirme sa présence automatiquement." },
  { q: "Faut-il une application mobile ?", a: "Non, Smart Presence fonctionne directement dans le navigateur mobile. Aucune installation requise." },
  { q: "Les données sont-elles sécurisées ?", a: "Oui. Toutes les données sont chiffrées et stockées sur des serveurs sécurisés. Le QR Code se renouvelle toutes les 15 secondes." },
  { q: "Combien de temps pour configurer ?", a: "Moins de 2 minutes. Créez votre compte, renseignez votre entreprise et invitez votre équipe via un code unique." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-6 py-4 text-left">
        <span className="text-sm font-semibold text-slate-900">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          className="border-t border-slate-100 px-6 pb-4 pt-3">
          <p className="text-sm text-slate-500">{a}</p>
        </motion.div>
      )}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <motion.nav initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-100 bg-white/90 px-6 backdrop-blur-sm lg:px-12">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Smart Presence Logo" className="h-7 w-auto object-contain" />
          <span className="text-lg font-bold text-slate-900">Smart Presence</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/pricing" className="hidden text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors sm:block">Tarifs</Link>
          <Link to="/login"><Button variant="secondary" size="sm" className="rounded-xl border border-slate-200">Connexion</Button></Link>
          <Link to="/register"><Button size="sm" className="rounded-xl">Commencer</Button></Link>
        </div>
      </motion.nav>

      {/* HERO */}
      <section className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-success-500" />
                <span className="text-xs font-medium text-primary-700">Disponible maintenant · Essai gratuit 14 jours</span>
              </div>
              <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">
                Suivez les présences de vos équipes en temps réel
              </h1>
              <p className="mt-6 text-xl text-slate-500">
                Smart Presence automatise le suivi des présences avec une expérience rapide, moderne et simple à utiliser.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register">
                  <Button size="lg" className="rounded-2xl shadow-lg px-7">
                      <Rocket className="mr-2 h-5 w-5 inline text-white/90" />
                      Commencer gratuitement
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
                <Link to="/pricing">
                  <Button variant="secondary" size="lg" className="rounded-2xl border border-slate-200">Voir les tarifs</Button>
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
                {["Configuration rapide", "Compatible mobile", "Tableau de bord temps réel"].map((b) => (
                  <span key={b} className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Check className="h-4 w-4 text-success-500" />{b}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Dashboard Preview */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
              <div className="overflow-hidden rounded-[22px] shadow-2xl">
                <img src={mockupImage} alt="Mochup" className="h-full w-full object-cover" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-y border-slate-100 bg-slate-50 px-6 py-20 lg:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Le problème</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Les feuilles de présence ne suffisent plus</h2>
          <p className="mt-4 text-lg text-slate-500">Les entreprises perdent du temps avec des systèmes manuels difficiles à gérer et peu fiables — erreurs, oublis, fraudes.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Clock, label: "Heures perdues", value: "~3h/semaine", desc: "à gérer les présences manuellement" },
              { icon: XCircle, label: "Erreurs", value: "15-20%", desc: "des relevés manuels sont incorrects" },
              { icon: DollarSign, label: "Pertes", value: "Significatives", desc: "liées aux présences fictives" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <s.icon className="mx-auto h-8 w-8 text-primary-600" />
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{s.value}</p>
                <p className="mt-1 text-xs text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">La solution</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Une plateforme moderne pour gérer vos équipes</h2>
          </motion.div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="h-full hover:border-primary-200 hover:shadow-md transition-all duration-200">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50">
                    <f.icon className="h-6 w-6 text-primary-600" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      

      {/* FAQ */}
      <section className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-slate-900">Questions fréquentes</h2>
          </motion.div>
          <div className="space-y-3">
            {faqs.map((faq) => <FaqItem key={faq.q} {...faq} />)}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 py-20 lg:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-slate-900 p-12 text-center">
          <h2 className="text-3xl font-bold text-white">Commencez à gérer vos présences intelligemment</h2>
          <p className="mt-4 text-slate-400">Essai gratuit 14 jours · Sans carte bancaire · Sans engagement</p>
          <div className="mt-8">
            <Link to="/register">
              <Button size="lg" className="rounded-2xl bg-white text-slate-900 hover:bg-slate-100 shadow-lg px-8">
                Créer mon espace gratuitement
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 px-6 py-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Smart Presence Logo" className="h-6 w-auto object-contain" />
            <span className="text-sm font-semibold text-slate-700">Smart Presence</span>
          </div>
          <p className="text-xs text-slate-400">© 2025 Smart Presence. Tous droits réservés.</p>
          <div className="flex gap-4">
            <Link to="/pricing" className="text-xs text-slate-400 hover:text-slate-700">Tarifs</Link>
            <Link to="/login" className="text-xs text-slate-400 hover:text-slate-700">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
