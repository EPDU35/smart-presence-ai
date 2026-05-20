import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Check, Zap, Building2, Landmark } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "15 000",
    priceNum: 15000,
    period: "mois",
    employees: 20,
    icon: Zap,
    features: [
      "Jusqu a 20 employes",
      "QR dynamique",
      "Verification GPS",
      "Dashboard basique",
      "Support email",
    ],
    cta: "Commencer",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "65 000",
    priceNum: 65000,
    period: "mois",
    employees: 100,
    icon: Building2,
    features: [
      "Jusqu a 100 employes",
      "QR dynamique",
      "Verification GPS",
      "Anti-fraude avancee",
      "Analytics detaillees",
      "Rapports PDF mensuels",
      "Multi-admin",
      "Support prioritaire",
    ],
    cta: "Choisir Pro",
    highlighted: true,
  },
  {
    name: "Entreprise",
    price: "Sur devis",
    priceNum: null,
    period: "",
    employees: null,
    icon: Landmark,
    features: [
      "Employes illimites",
      "Toutes les fonctions Pro",
      "Multi-sites",
      "API externe",
      "Mode hors ligne",
      "Support dedie",
      "Formation equipe",
      "SLA garanti",
    ],
    cta: "Nous contacter",
    highlighted: false,
  },
];

const faqs = [
  {
    q: "Puis-je changer de plan a tout moment ?",
    a: "Oui. Vous pouvez upgrader ou downgrader votre plan a tout moment. La difference est calculee au prorata.",
  },
  {
    q: "Y a-t-il un engagement minimum ?",
    a: "Non. Tous nos plans sont sans engagement. Vous pouvez resilier quand vous voulez.",
  },
  {
    q: "Comment fonctionne la limite d employes ?",
    a: "Chaque plan inclut un nombre maximum d employes actifs. Vous pouvez ajouter des employes supplementaires moyennant un supplement.",
  },
  {
    q: "Le paiement se fait en ligne ?",
    a: "Nous acceptons les virements bancaires, Mobile Money (Orange Money, MTN MoMo, Wave) et les cartes bancaires.",
  },
];

export function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-12">
        <Link to="/" className="text-xl font-bold text-slate-900">
          Smart Presence
        </Link>
        <Link to="/login">
          <Button size="sm">Connexion</Button>
        </Link>
      </nav>

      <div className="px-6 py-16 text-center lg:px-12">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Tarifs adaptes aux entreprises africaines
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-slate-500">
          Pas de frais caches. Pas de commission par employe. Un prix fixe par entreprise.
        </p>

        <div className="mx-auto mt-8 inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setBilling("monthly")}
            className={
              billing === "monthly"
                ? "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                : "rounded-md px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900"
            }
          >
            Mensuel
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={
              billing === "yearly"
                ? "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                : "rounded-md px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900"
            }
          >
            Annuel <span className="ml-1 text-xs text-success-500">-20%</span>
          </button>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const finalPrice =
              billing === "yearly" && plan.priceNum
                ? Math.round(plan.priceNum * 0.8 * 12).toLocaleString("fr-FR")
                : plan.price;

            return (
              <Card
                key={plan.name}
                className={
                  plan.highlighted
                    ? "relative border-primary-300 ring-1 ring-primary-300"
                    : ""
                }
              >
                {plan.highlighted && (
                  <Badge
                    variant="success"
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                  >
                    Plus populaire
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                    <plan.icon className="h-5 w-5 text-slate-600" />
                  </div>
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-slate-900">
                      {finalPrice}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-slate-500">
                        {" "}FCFA/{plan.period}
                      </span>
                    )}
                  </div>
                  {plan.employees && (
                    <p className="mt-1 text-sm text-slate-500">
                      Jusqu a {plan.employees} employes
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-slate-600"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className="mt-6 block">
                    <Button
                      variant={plan.highlighted ? "primary" : "secondary"}
                      className="w-full"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <section className="border-t border-slate-200 bg-white px-6 py-16 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Questions frequentes
          </h2>
          <div className="mt-8 space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-xl border border-slate-200 bg-slate-50 p-5"
              >
                <h3 className="text-sm font-semibold text-slate-900">{faq.q}</h3>
                <p className="mt-2 text-sm text-slate-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-900 px-6 py-16 text-center lg:px-12">
        <h2 className="text-2xl font-bold text-white">
          Pret a securiser les pointages de votre entreprise ?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-slate-400">
          Essai gratuit de 14 jours. Sans carte bancaire. Sans engagement.
        </p>
        <div className="mt-8">
          <Link to="/register">
            <Button size="lg">Demarrer l essai gratuit</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
