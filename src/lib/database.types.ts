export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          plan: string;
          latitude: number;
          longitude: number;
          radius: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["companies"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
      };
      users: {
        Row: {
          id: string;
          company_id: string;
          role: string;
          firstname: string;
          lastname: string;
          email: string;
          phone: string | null;
          avatar: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      devices: {
        Row: {
          id: string;
          user_id: string;
          device_name: string;
          device_fingerprint: string;
          last_login: string;
          trusted: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["devices"]["Row"], "id" | "last_login">;
        Update: Partial<Database["public"]["Tables"]["devices"]["Insert"]>;
      };
      checkins: {
        Row: {
          id: string;
          user_id: string;
          company_id: string;
          qr_token: string;
          latitude: number;
          longitude: number;
          distance: number;
          status: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["checkins"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["checkins"]["Insert"]>;
      };
      qr_sessions: {
        Row: {
          id: string;
          company_id: string;
          token: string;
          expires_at: string;
          active: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["qr_sessions"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["qr_sessions"]["Insert"]>;
      };
      suspicious_logs: {
        Row: {
          id: string;
          user_id: string;
          reason: string;
          device: string;
          ip: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["suspicious_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["suspicious_logs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
