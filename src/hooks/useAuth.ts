import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { getCurrentUser, getSession } from "@/services/auth.service";
import { fetchCompany } from "@/services/company.service";

// Ce hook ne doit être monté qu'UNE SEULE FOIS dans App.tsx
export function useAuthInit() {
  const { setUser, setCompany, setLoading } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      const { data } = await getSession();

      if (!data.session) {
        setLoading(false);
        return;
      }

      const profile = await getCurrentUser();
      if (cancelled) return;

      setUser(profile);

      // Correction TS2322 : company_id est string | null
      // fetchCompany n'accepte que string — on vérifie avant d'appeler
      if (profile?.company_id != null) {
        const company = await fetchCompany(profile.company_id);
        if (!cancelled) setCompany(company);
      }

      setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);
}

// Hook léger pour les composants — lit juste le store
export function useAuth() {
  const user            = useAuthStore((s) => s.user);
  const isLoading       = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout          = useAuthStore((s) => s.logout);
  return { user, isLoading, isAuthenticated, logout };
}
