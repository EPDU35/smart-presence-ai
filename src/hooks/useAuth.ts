import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { getCurrentUser, getSession } from "@/services/auth.service";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const logout = useAuthStore((s) => s.logout);

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
      if (!cancelled) {
        setUser(profile);
        setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return { user, isLoading, isAuthenticated, logout };
}
