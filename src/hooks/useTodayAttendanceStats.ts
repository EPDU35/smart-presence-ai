import { useMemo } from "react";
import type { DailyAttendanceRecord } from "@/database/services/daily-attendance.service";
import { isDayClosedForCompany } from "@/database/services/daily-attendance.service";
import type { Checkin, User } from "@/types";

export function useTodayAttendanceStats(
  employees: User[],
  checkins: Checkin[],
  dailyRecords: DailyAttendanceRecord[],
) {
  return useMemo(() => {
    const active = employees.filter((e) => e.is_active !== false);
    const dayClosed = isDayClosedForCompany(dailyRecords, active.length);

    if (dayClosed) {
      return {
        dayClosed: true as const,
        total: active.length,
        present: dailyRecords.filter((r) => r.status === "PRESENT").length,
        absent: dailyRecords.filter((r) => r.status === "ABSENT").length,
        late: dailyRecords.filter((r) => r.status === "LATE").length,
        presentIds: new Set(
          dailyRecords.filter((r) => r.status === "PRESENT").map((r) => r.user_id),
        ),
      };
    }

    const presentIds = new Set(
      checkins.filter((c) => c.status === "VALID").map((c) => c.user_id),
    );
    const lateIds = new Set(
      checkins.filter((c) => c.status === "SUSPICIOUS").map((c) => c.user_id),
    );

    return {
      dayClosed: false as const,
      total: active.length,
      present: presentIds.size,
      absent: Math.max(0, active.length - presentIds.size),
      late: lateIds.size,
      presentIds,
    };
  }, [employees, checkins, dailyRecords]);
}
