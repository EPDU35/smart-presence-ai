export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE";

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  plan: string;
  latitude: number;
  longitude: number;
  radius: number;
  created_at: string;
}

export interface User {
  id: string;
  company_id: string;
  role: UserRole;
  firstname: string;
  lastname: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  created_at: string;
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

export interface Checkin {
  id: string;
  user_id: string;
  company_id: string;
  qr_token: string;
  latitude: number;
  longitude: number;
  distance: number;
  status: CheckinStatus;
  created_at: string;
}

export interface QrSession {
  id: string;
  company_id: string;
  token: string;
  expires_at: string;
  active: boolean;
}

export interface SuspiciousLog {
  id: string;
  user_id: string;
  reason: string;
  device: string;
  ip: string;
  created_at: string;
}

export interface AuthSession {
  user: User | null;
  company: Company | null;
  isLoading: boolean;
}
