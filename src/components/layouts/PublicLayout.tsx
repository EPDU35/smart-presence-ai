import { Outlet, useLocation } from "react-router-dom";
import { PublicNavbar } from "./PublicNavbar";
import { AuthPageHeader } from "./AuthPageHeader";

const AUTH_HEADER_PATHS = ["/login", "/register", "/forgot-password"];

export function PublicLayout() {
  const { pathname } = useLocation();
  const showNavbar = !AUTH_HEADER_PATHS.includes(pathname);
  const showAuthHeader = AUTH_HEADER_PATHS.includes(pathname);

  return (
    <div className="min-h-screen bg-white">
      {showNavbar && <PublicNavbar />}
      {showAuthHeader && <AuthPageHeader />}
      <Outlet />
    </div>
  );
}