import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type TableName = "checkins" | "qr_sessions" | "users" | "devices" | "suspicious_logs";

interface RealtimeOptions {
  table: TableName;
  filter?: string;
  onInsert?: (payload: unknown) => void;
  onUpdate?: (payload: unknown) => void;
  onDelete?: (payload: unknown) => void;
}

export function useRealtime({ table, filter, onInsert, onUpdate, onDelete }: RealtimeOptions) {
  const callbacks = useRef({ onInsert, onUpdate, onDelete });
  callbacks.current = { onInsert, onUpdate, onDelete };

  useEffect(() => {
    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table, filter },
        (payload) => {
          if (payload.eventType === "INSERT") callbacks.current.onInsert?.(payload.new);
          if (payload.eventType === "UPDATE") callbacks.current.onUpdate?.(payload.new);
          if (payload.eventType === "DELETE") callbacks.current.onDelete?.(payload.old);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);
}
