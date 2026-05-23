import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { closeCompanyDayIfNeeded } from "@/database/services/daily-attendance.service";
import type { Checkin, Company, User } from "@/types";

const ADMIN_ROLES = new Set(["ADMIN", "MANAGER", "SUPER_ADMIN"]);

/**
 * Après l'heure de fermeture, enregistre les absents (admin connecté).
 * Le lendemain, les requêtes « aujourd'hui » repartent à zéro (nouvelle date).
 */
export function useDayClosure(
  company: Company | null | undefined,
  employees: User[],
  todayCheckins: Checkin[],
  userRole: string | undefined,
) {
  const queryClient = useQueryClient();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!company?.id || !userRole || !ADMIN_ROLES.has(userRole)) return;

    const tick = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const closed = await closeCompanyDayIfNeeded(
          company.id,
          company.closing_time,
          employees,
          todayCheckins,
        );
        if (closed) {
          void queryClient.invalidateQueries({ queryKey: ["daily-attendance", company.id] });
          void queryClient.invalidateQueries({ queryKey: ["checkins", "today", company.id] });
        }
      } catch (err) {
        console.warn("[useDayClosure]", err);
      } finally {
        runningRef.current = false;
      }
    };

    void tick();
    const id = setInterval(() => void tick(), 60_000);
    return () => clearInterval(id);
  }, [
    company?.id,
    company?.closing_time,
    employees,
    todayCheckins,
    userRole,
    queryClient,
  ]);
}
