export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE";

export interface Company {
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
}

export interface User {
  id: string;
  company_id: string | null;   // nullable — pas de company au moment du signup
  role: UserRole;
  firstname: string;
  lastname: string;
  fullname?: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  device_fingerprint: string;
  last_login: string;
  trusted: boolean;
}

export type CheckinStatus = "VALID" | "INVALID" | "SUSPICIOUS";

export type DailyAttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

export interface DailyAttendance {
  id: string;
  company_id: string;
  user_id: string;
  attendance_date: string;
  status: DailyAttendanceStatus;
  closed_at: string;
  created_at: string;
}

export interface Checkin {
  id: string;
  user_id: string;
  company_id: string;
  qr_token: string;
  latitude: number;
  longitude: number;
  distance: number;
  status: CheckinStatus;
  device_info: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface QrSession {
  id: string;
  company_id: string;
  token: string;
  expires_at: string;
  active: boolean;
  used_at: string | null;
  created_at: string;
}

export interface SuspiciousLog {
  id: string;
  user_id: string | null;
  company_id: string;
  reason: string;
  device: string | null;
  ip: string | null;
  metadata: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
}

export interface AuthSession {
  user: User | null;
  company: Company | null;
  isLoading: boolean;
}