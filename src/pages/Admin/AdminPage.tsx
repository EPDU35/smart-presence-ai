import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Shield, Users, Building2, AlertTriangle } from "lucide-react";

export function AdminPage() {
  const { user } = useAuthStore();

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Acces refuse</h2>
          <p className="mt-1 text-sm text-slate-500">Vous n avez pas les permissions necessaires.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
        <p className="text-sm text-slate-500">Gestion globale de la plateforme</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-lg bg-primary-50 p-3">
              <Building2 className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Entreprises</p>
              <p className="text-2xl font-bold text-slate-900">0</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-lg bg-success-50 p-3">
              <Users className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Utilisateurs</p>
              <p className="text-2xl font-bold text-slate-900">0</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-lg bg-warning-50 p-3">
              <AlertTriangle className="h-5 w-5 text-warning-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Alertes</p>
              <p className="text-2xl font-bold text-slate-900">0</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-lg bg-danger-50 p-3">
              <Shield className="h-5 w-5 text-danger-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Suspicions</p>
              <p className="text-2xl font-bold text-slate-900">0</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activite recente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Aucune activite recente</p>
        </CardContent>
      </Card>
    </div>
  );
}
