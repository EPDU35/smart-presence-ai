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
          code: string;
          email: string | null;
          phone: string | null;
          location: string | null;
          plan: string;
          latitude: number;
          longitude: number;
          radius: number;
          opening_time: string | null;
          closing_time: string | null;
          late_tolerance: number | null;
          owner_id: string | null;
          logo_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          email?: string | null;
          phone?: string | null;
          location?: string | null;
          plan?: string;
          latitude: number;
          longitude: number;
          radius?: number;
          opening_time?: string | null;
          closing_time?: string | null;
          late_tolerance?: number | null;
          owner_id?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          email?: string | null;
          phone?: string | null;
          location?: string | null;
          plan?: string;
          latitude?: number;
          longitude?: number;
          radius?: number;
          opening_time?: string | null;
          closing_time?: string | null;
          late_tolerance?: number | null;
          owner_id?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          company_id: string | null;
          role: string;
          firstname: string;
          lastname: string;
          email: string;
          phone: string | null;
          avatar: string | null;
          is_active: boolean;
          last_seen: string | null;
          two_fa_enabled: boolean;
          two_fa_channel: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_id?: string | null;
          role?: string;
          firstname: string;
          lastname: string;
          email: string;
          phone?: string | null;
          avatar?: string | null;
          is_active?: boolean;
          last_seen?: string | null;
          two_fa_enabled?: boolean;
          two_fa_channel?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          role?: string;
          firstname?: string;
          lastname?: string;
          email?: string;
          phone?: string | null;
          avatar?: string | null;
          is_active?: boolean;
          last_seen?: string | null;
          two_fa_enabled?: boolean;
          two_fa_channel?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      absences: {
        Row: {
          id: string;
          user_id: string;
          company_id: string;
          start_ts: string;
          end_ts: string;
          duration_minutes: number;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_id: string | null;
          start_ts: string;
          end_ts: string;
          duration_minutes: number;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_id?: string;
          start_ts?: string;
          end_ts?: string;
          duration_minutes?: number;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      otp_codes: {
        Row: {
          id: string;
          user_id: string;
          code_hash: string;
          channel: string;
          expires_at: string;
          attempts: number;
          used: boolean;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code_hash: string;
          channel: string;
          expires_at: string;
          attempts?: number;
          used?: boolean;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code_hash?: string;
          channel?: string;
          expires_at?: string;
          attempts?: number;
          used?: boolean;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
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
        Insert: {
          id?: string;
          user_id: string;
          device_name: string;
          device_fingerprint: string;
          last_login?: string;
          trusted?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_name?: string;
          device_fingerprint?: string;
          last_login?: string;
          trusted?: boolean;
        };
        Relationships: [];
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
          device_info: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_id: string;
          qr_token: string;
          latitude: number;
          longitude: number;
          distance: number;
          status: string;
          device_info?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_id?: string;
          qr_token?: string;
          latitude?: number;
          longitude?: number;
          distance?: number;
          status?: string;
          device_info?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      qr_sessions: {
        Row: {
          id: string;
          company_id: string;
          token: string;
          expires_at: string;
          active: boolean;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          token: string;
          expires_at: string;
          active?: boolean;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          token?: string;
          expires_at?: string;
          active?: boolean;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      suspicious_logs: {
        Row: {
          id: string;
          user_id: string | null;
          company_id: string;
          reason: string;
          device: string | null;
          ip: string | null;
          metadata: Json;
          resolved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          company_id: string;
          reason: string;
          device?: string | null;
          ip?: string | null;
          metadata?: Json;
          resolved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          company_id?: string;
          reason?: string;
          device?: string | null;
          ip?: string | null;
          metadata?: Json;
          resolved?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
