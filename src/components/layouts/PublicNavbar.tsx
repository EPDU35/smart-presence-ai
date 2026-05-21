import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Menu, X } from "lucide-react";
import logoImage from "@/img/smart_presence_logo.png";

export function PublicNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-100 bg-white/90 px-6 backdrop-blur-sm lg:px-12 w-full"
    >
      <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
        <img src={logoImage} alt="Smart Presence Logo" className="h-7 w-auto object-contain" />
        <span className="text-lg font-bold text-slate-900">Smart Presence</span>
      </Link>

      {/* Desktop Menu */}
      <div className="hidden md:flex items-center gap-8">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors ${
              currentPath === "/" ? "text-primary-600" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Accueil
          </Link>
          <Link
            to="/pricing"
            className={`text-sm font-medium transition-colors ${
              currentPath === "/pricing" ? "text-primary-600" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Tarifs
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {currentPath !== "/login" && (
            <Link to="/login">
              <Button variant="secondary" size="sm" className="rounded-xl border border-slate-200">
                Connexion
              </Button>
            </Link>
          )}
          {currentPath !== "/register" && (
            <Link to="/register">
              <Button size="sm" className="rounded-xl">
                Commencer
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-16 left-0 w-full bg-white border-b border-slate-100 shadow-lg px-6 py-6 md:hidden flex flex-col gap-6 overflow-hidden"
          >
            <div className="flex flex-col gap-4">
              <Link
                to="/"
                className={`text-base font-semibold transition-colors py-2 ${
                  currentPath === "/" ? "text-primary-600" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Accueil
              </Link>
              <Link
                to="/pricing"
                className={`text-base font-semibold transition-colors py-2 ${
                  currentPath === "/pricing" ? "text-primary-600" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tarifs
              </Link>
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
              {currentPath !== "/login" && (
                <Link to="/login" className="w-full">
                  <Button variant="secondary" className="w-full rounded-xl border border-slate-200 py-3">
                    Connexion
                  </Button>
                </Link>
              )}
              {currentPath !== "/register" && (
                <Link to="/register" className="w-full">
                  <Button className="w-full rounded-xl py-3">
                    Commencer
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
