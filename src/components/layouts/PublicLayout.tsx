import { Outlet, useLocation } from "react-router-dom";
import { PublicNavbar } from "./PublicNavbar";

// Pages qui n'affichent PAS la navbar (auth pages)
const NO_NAVBAR_PATHS = ["/login", "/register", "/forgot-password"];

export function PublicLayout() {
  const { pathname } = useLocation();
  const showNavbar = !NO_NAVBAR_PATHS.includes(pathname);

  return (
    <div className="min-h-screen bg-white">
      {showNavbar && <PublicNavbar />}
      <Outlet />
    </div>
  );
}