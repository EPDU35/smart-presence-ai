import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { fetchEmployees } from "@/services/employee.service";
import { DataTable } from "@/components/tables/DataTable";
import { EmployeeCard } from "@/components/cards/EmployeeCard";
import { Modal } from "@/components/modals/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Search, Plus, Grid3X3, List } from "lucide-react";
import type { User } from "@/types";

export function EmployeesPage() {
  const { user } = useAuthStore();
  const companyId = user?.company_id ?? "";
  const [view, setView] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => fetchEmployees(companyId),
    enabled: !!companyId,
  });

  const filtered = employees.filter((e) =>
    `${e.firstname} ${e.lastname} ${e.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: "name",
      header: "Nom",
      render: (row: User) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
            {row.firstname[0]}{row.lastname[0]}
          </div>
          <span className="font-medium text-slate-900">{row.firstname} {row.lastname}</span>
        </div>
      ),
    },
    { key: "email", header: "Email" },
    { key: "phone", header: "Telephone", render: (row: User) => row.phone ?? "-" },
    {
      key: "role",
      header: "Role",
      render: (row: User) => (
        <Badge variant={row.role === "EMPLOYEE" ? "default" : "success"}>{row.role}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employes</h1>
          <p className="text-sm text-slate-500">{employees.length} employes enregistres</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white">
          <button
            onClick={() => setView("grid")}
            className={view === "grid" ? "rounded-l-lg bg-slate-100 p-2" : "rounded-l-lg p-2 hover:bg-slate-50"}
          >
            <Grid3X3 className="h-4 w-4 text-slate-600" />
          </button>
          <button
            onClick={() => setView("list")}
            className={view === "list" ? "rounded-r-lg bg-slate-100 p-2" : "rounded-r-lg p-2 hover:bg-slate-50"}
          >
            <List className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <EmployeeCard key={e.id} employee={e} onClick={() => setSelected(e)} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(r) => r.id}
          onRowClick={setSelected}
        />
      )}

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Details employe" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
                {selected.firstname[0]}{selected.lastname[0]}
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {selected.firstname} {selected.lastname}
                </p>
                <Badge variant={selected.role === "EMPLOYEE" ? "default" : "success"}>
                  {selected.role}
                </Badge>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">Email:</span> {selected.email}</p>
              <p><span className="text-slate-500">Telephone:</span> {selected.phone ?? "Non renseigne"}</p>
              <p><span className="text-slate-500">Inscrit le:</span> {new Date(selected.created_at).toLocaleDateString("fr-FR")}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
