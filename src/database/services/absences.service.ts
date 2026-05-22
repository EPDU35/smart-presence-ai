import { supabase } from "@/lib/supabase";
import type { Checkin } from "@/types";

const SESSION_GAP_MINUTES = 30;
const ABSENCE_HOURS = 5;
const DISTANCE_THRESHOLD = 500; // meters

export async function detectAndPersistAbsences(daysBack = 1) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data, error } = await supabase
    .from("checkins")
    .select("id,user_id,company_id,created_at,distance,status")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch checkins: ${error.message}`);
  const checkins = (data ?? []) as unknown as Checkin[];

  // group by user -> date (YYYY-MM-DD)
  const byUserDate = new Map<string, Map<string, Checkin[]>>();

  for (const c of checkins) {
    if (!c.user_id) continue;
    const d = new Date(c.created_at);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!byUserDate.has(c.user_id)) byUserDate.set(c.user_id, new Map());
    const map = byUserDate.get(c.user_id)!;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }

  const created: any[] = [];

  for (const [userId, dateMap] of byUserDate.entries()) {
    for (const [date, items] of dateMap.entries()) {
      // sort by created_at
      const sorted = items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      // compute sessions
      const sessions: { start: Date; end: Date; lastDistance?: number; companyId?: string }[] = [];
      let curStart = new Date(sorted[0].created_at);
      let curEnd = new Date(sorted[0].created_at);
      let curLastDistance = (sorted[0].distance ?? 0) as number;
      let curCompany = sorted[0].company_id;

      for (let i = 1; i < sorted.length; i++) {
        const chk = sorted[i];
        const t = new Date(chk.created_at);
        const gapMin = (t.getTime() - curEnd.getTime()) / 60000;
        if (gapMin <= SESSION_GAP_MINUTES) {
          curEnd = t;
          curLastDistance = chk.distance ?? curLastDistance;
        } else {
          sessions.push({ start: curStart, end: curEnd, lastDistance: curLastDistance, companyId: curCompany });
          curStart = t;
          curEnd = t;
          curLastDistance = chk.distance ?? 0;
          curCompany = chk.company_id;
        }
      }
      sessions.push({ start: curStart, end: curEnd, lastDistance: curLastDistance, companyId: curCompany });

      // detect absences between sessions
      for (let i = 0; i < sessions.length - 1; i++) {
        const a = sessions[i];
        const b = sessions[i + 1];
        const durH = (b.start.getTime() - a.end.getTime()) / (1000 * 60 * 60);
        const offsite = (a.lastDistance ?? 0) >= DISTANCE_THRESHOLD || (b.lastDistance ?? 0) >= DISTANCE_THRESHOLD;
        if (durH >= ABSENCE_HOURS && offsite) {
          const start_ts = a.end.toISOString();
          const end_ts = b.start.toISOString();
          const duration_minutes = Math.round((new Date(end_ts).getTime() - new Date(start_ts).getTime()) / 60000);

          // avoid duplicates: check existing absences overlapping
          const { data: existing, error: errExist } = await supabase
            .from("absences")
            .select("id")
            .eq("user_id", userId)
            .gte("end_ts", start_ts)
            .lte("start_ts", end_ts)
            .limit(1);
          if (errExist) throw new Error(`Failed to check existing absences: ${errExist.message}`);
          if (existing && existing.length > 0) continue;

          const insert = {
            user_id: userId,
            company_id: a.companyId ?? b.companyId ?? null,
            start_ts,
            end_ts,
            duration_minutes,
            reason: `auto-detected: gap ${Math.round(durH)}h offsite=${offsite}`,
          };

          const { data: ins, error: insErr } = await supabase.from("absences").insert(insert).select("id");
          if (insErr) {
            console.warn("Failed to insert absence", insErr.message);
          } else {
            created.push(insert);
          }
        }
      }
    }
  }

  return { createdCount: created.length, created };
}
