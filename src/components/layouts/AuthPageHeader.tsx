import { Link, useLocation } from "react-router-dom";
import logoImage from "@/img/smart_presence_logo.png";
import { Button } from "@/components/ui/Button";

const AUTH_HEADER_PATHS = ["/login", "/register", "/forgot-password"];

export function AuthPageHeader() {
  const { pathname } = useLocation();
  const isLogin = pathname === "/login";
  const isRegister = pathname === "/register";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-12">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoImage} alt="Smart Presence" className="h-8 w-auto" />
          <span className="text-base font-bold text-slate-900">Smart Presence</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Accueil
          </Link>
          <Link to="/pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Tarifs
          </Link>
          {isLogin ? (
            <Link to="/register">
              <Button size="sm" className="rounded-xl">
                Créer un compte
              </Button>
            </Link>
          ) : isRegister ? (
            <Link to="/login">
              <Button variant="secondary" size="sm" className="rounded-xl border border-slate-200">
                Connexion
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button size="sm" className="rounded-xl">
                Connexion
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
