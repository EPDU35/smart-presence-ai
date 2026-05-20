import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { fetchCheckins } from "@/services/checkin.service";
import { AttendanceChart } from "@/components/charts/AttendanceChart";
import { PresencePieChart } from "@/components/charts/PresencePieChart";
import { DataTable } from "@/components/tables/DataTable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/utils/format";
import type { Checkin } from "@/types";

export function AnalyticsPage() {
  const { user } = useAuthStore();
  const companyId = user?.company_id ?? "";
  const [period, setPeriod] = useState<"week" | "month">("week");

  const { data: checkins = [], isLoading } = useQuery({
    queryKey: ["checkins", companyId],
    queryFn: () => fetchCheckins(companyId),
    enabled: !!companyId,
  });

  const valid = checkins.filter((c) => c.status === "VALID").length;
  const invalid = checkins.filter((c) => c.status === "INVALID").length;
  const suspicious = checkins.filter((c) => c.status === "SUSPICIOUS").length;

  const pieData = [
    { name: "Valides", value: valid },
    { name: "Invalides", value: invalid },
    { name: "Suspects", value: suspicious },
  ];

  const chartData = [
    { date: "Lun", present: 12, absent: 3 },
    { date: "Mar", present: 14, absent: 1 },
    { date: "Mer", present: 11, absent: 4 },
    { date: "Jeu", present: 15, absent: 0 },
    { date: "Ven", present: 13, absent: 2 },
  ];

  const columns = [
    {
      key: "status",
      header: "Statut",
      render: (row: Checkin) => (
        <Badge
          variant={
            row.status === "VALID" ? "success" : row.status === "INVALID" ? "danger" : "warning"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    { key: "distance", header: "Distance (m)", render: (row: Checkin) => `${Math.round(row.distance)}m` },
    { key: "created_at", header: "Date", render: (row: Checkin) => formatDateTime(row.created_at) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analyses</h1>
          <p className="text-sm text-slate-500">Statistiques et historique des pointages</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={
                period === p
                  ? "bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900"
                  : "px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
              }
            >
              {p === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Presences</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repartition</CardTitle>
          </CardHeader>
          <CardContent>
            <PresencePieChart data={pieData} />
            <div className="mt-4 space-y-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{d.name}</span>
                  <span className="font-medium text-slate-900">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des pointages</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={checkins}
              keyExtractor={(r) => r.id}
              pageSize={8}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
