import { supabase } from "@/lib/supabase";
import type { Checkin, User } from "@/types";
import { getLocalDateKey, isPastClosingTime } from "@/utils/attendance-day";

export type DailyAttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

export interface DailyAttendanceRecord {
  id: string;
  company_id: string;
  user_id: string;
  attendance_date: string;
  status: DailyAttendanceStatus;
  closed_at: string;
  created_at: string;
}

function statusFromCheckins(userId: string, checkins: Checkin[]): DailyAttendanceStatus {
  const mine = checkins.filter((c) => c.user_id === userId);
  if (mine.some((c) => c.status === "VALID")) return "PRESENT";
  if (mine.some((c) => c.status === "SUSPICIOUS")) return "LATE";
  return "ABSENT";
}

/**
 * Clôture la journée : enregistre PRESENT / ABSENT / LATE pour chaque employé actif.
 * Idempotent (upsert). À appeler après l'heure de fermeture.
 */
export async function closeCompanyDay(
  companyId: string,
  employees: User[],
  todayCheckins: Checkin[],
  attendanceDate = getLocalDateKey(),
): Promise<{ closed: number; absent: number; present: number }> {
  const active = employees.filter((e) => e.is_active !== false);
  if (active.length === 0) return { closed: 0, absent: 0, present: 0 };

  const now = new Date().toISOString();
  const rows = active.map((emp) => ({
    company_id: companyId,
    user_id: emp.id,
    attendance_date: attendanceDate,
    status: statusFromCheckins(emp.id, todayCheckins),
    closed_at: now,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("daily_attendance").upsert(rows as any, {
    onConflict: "company_id,user_id,attendance_date",
  });

  if (error) {
    if (error.message.includes("daily_attendance") || error.code === "42P01") {
      throw new Error(
        "Table daily_attendance manquante — exécutez supabase/daily-attendance.sql dans Supabase",
      );
    }
    throw new Error(error.message);
  }

  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const present = rows.filter((r) => r.status === "PRESENT").length;
  return { closed: rows.length, absent, present };
}

export async function fetchDailyAttendance(
  companyId: string,
  attendanceDate: string,
): Promise<DailyAttendanceRecord[]> {
  const { data, error } = await supabase
    .from("daily_attendance")
    .select("*")
    .eq("company_id", companyId)
    .eq("attendance_date", attendanceDate)
    .order("status", { ascending: true });

  if (error) {
    if (error.message.includes("daily_attendance") || error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []) as DailyAttendanceRecord[];
}

export function isDayClosedForCompany(
  records: DailyAttendanceRecord[],
  employeeCount: number,
): boolean {
  return records.length > 0 && records.length >= employeeCount;
}

/** Clôture auto si admin connecté et heure de fermeture passée */
export async function closeCompanyDayIfNeeded(
  companyId: string,
  closingTime: string | null | undefined,
  employees: User[],
  todayCheckins: Checkin[],
): Promise<boolean> {
  if (!isPastClosingTime(new Date(), closingTime)) return false;

  const date = getLocalDateKey();
  const existing = await fetchDailyAttendance(companyId, date);
  const activeCount = employees.filter((e) => e.is_active !== false).length;
  if (isDayClosedForCompany(existing, activeCount)) return false;

  await closeCompanyDay(companyId, employees, todayCheckins, date);
  return true;
}
