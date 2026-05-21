import { useAuthInit } from "@/hooks/useAuth";
import { AppRoutes } from "@/routes";

export default function App() {
  // Init auth UNE SEULE FOIS ici — pas dans chaque route
  useAuthInit();
  return <AppRoutes />;
}