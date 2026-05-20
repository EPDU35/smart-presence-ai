import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { QrCode, MapPin, BarChart3, Shield, Check, ArrowRight, Smartphone } from "lucide-react";

const features = [
  {
    icon: Smartphone,
    title: "Pointage mobile",
    desc: "Les employes enregistrent leur presence directement depuis leur smartphone.",
  },
  {
    icon: MapPin,
    title: "Validation intelligente",
    desc: "Chaque presence est validee automatiquement selon les regles de l entreprise.",
  },
  {
    icon: BarChart3,
    title: "Dashboard temps reel",
    desc: "Suivez les presences, retards et activites instantanement.",
  },
  {
    icon: Shield,
    title: "Securite integree",
    desc: "Sessions securisees et acces controles.",
  },
];

const trustBadges = [
  "Configuration rapide",
  "Compatible mobile",
  "Tableau de bord temps reel",
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* NAV */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-16 items-center justify-between border-b border-slate-100 px-6 lg:px-12"
      >
        <span className="text-xl font-bold text-slate-900">Smart Presence</span>
        <div className="flex items-center gap-6">
          <Link to="/pricing" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            Tarifs
          </Link>
          <Link to="/login">
            <Button size="sm">Connexion</Button>
          </Link>
        </div>
      </motion.nav>

      {/* HERO */}
      <section className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl font-bold leading-tight tracking-tight text-slate-900 sm:text-6xl">
                Suivez les presences de vos equipes en temps reel
              </h1>
              <p className="mt-6 text-lg text-slate-500">
                Smart Presence automatise le suivi des presences avec une experience rapide, moderne et simple a utiliser.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link to="/register">
                  <Button size="lg" className="rounded-2xl shadow-lg">
                    Commencer gratuitement
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button variant="secondary" size="lg" className="rounded-2xl border border-slate-200">
                    Voir les tarifs
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
                {trustBadges.map((badge) => (
                  <span key={badge} className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Check className="h-4 w-4 text-success-500" />
                    {badge}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-3xl bg-slate-50 p-6 shadow-xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Dashboard</span>
                    <Badge variant="success">En direct</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-xs text-slate-500">Employes</p>
                      <p className="text-2xl font-bold text-slate-900">24</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-xs text-slate-500">Presents</p>
                      <p className="text-2xl font-bold text-success-600">22</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-xs text-slate-500">Absents</p>
                      <p className="text-2xl font-bold text-danger-600">1</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-xs text-slate-500">Retards</p>
                      <p className="text-2xl font-bold text-warning-600">1</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500 mb-2">Activite en temps reel</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full bg-success-500" />
                        <span className="text-slate-700">Jean Dupont - Presence validee</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full bg-warning-500" />
                        <span className="text-slate-700">Paul Koffi - Retard detecte</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-t border-slate-100 bg-slate-50 px-6 py-20 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="text-3xl font-bold text-slate-900">
            Les feuilles de presence ne suffisent plus
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Les entreprises perdent du temps avec des systemes manuels difficiles a gerer et peu fiables.
          </p>
        </motion.div>
      </section>

      {/* SOLUTION */}
      <section className="px-6 py-20 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="text-3xl font-bold text-slate-900">
            Une plateforme moderne pour gerer vos equipes
          </h2>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section className="border-t border-slate-100 bg-slate-50 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center text-3xl font-bold text-slate-900"
          >
            Tout ce qu il vous faut
          </motion.h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
                    <f.icon className="h-7 w-7 text-primary-600" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 py-20 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="text-3xl font-bold text-slate-900">
            Commencez a gerer vos presences intelligemment
          </h2>
          <div className="mt-8">
            <Link to="/register">
              <Button size="lg" className="rounded-2xl shadow-lg">
                Creer mon espace gratuitement
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 px-6 py-8 text-center lg:px-12">
        <p className="text-sm text-slate-400">Smart Presence. Tous droits reserves.</p>
      </footer>
    </div>
  );
}
