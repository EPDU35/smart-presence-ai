import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Home, ArrowLeft, Search } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-sm border border-slate-200">
          <Search className="h-10 w-10 text-slate-700" />
        </div>
        <h1 className="text-8xl font-black text-slate-900">404</h1>
        <p className="mt-2 text-xl font-semibold text-slate-700">Page introuvable</p>
        <p className="mt-2 text-sm text-slate-400">La page que vous cherchez n'existe pas ou a été déplacée.</p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/">
            <Button className="rounded-xl">
              <Home className="mr-2 h-4 w-4" />
              Retour à l'accueil
            </Button>
          </Link>
          <button onClick={() => window.history.back()}>
            <Button variant="secondary" className="rounded-xl border border-slate-200">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Page précédente
            </Button>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
