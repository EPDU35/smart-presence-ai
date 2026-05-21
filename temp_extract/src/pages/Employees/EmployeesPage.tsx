import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { fetchEmployees } from "@/services/employee.service";
import { fetchTodayCheckins } from "@/services/checkin.service";
import { DataTable } from "@/components/tables/DataTable";
import { EmployeeCard } from "@/components/cards/EmployeeCard";
import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { Modal } from "@/components/modals/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Search, Plus, Grid3X3, List, Users } from "lucide-react";
import type { User } from "@/types";

export function EmployeesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const companyId = user?.company_id ?? "";

  const [view, setView] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => fetchEmployees(companyId),
    enabled: !!companyId,
  });

  const { data: todayCheckins = [] } = useQuery({
    queryKey: ["checkins", "today", companyId],
    queryFn: () => fetchTodayCheckins(companyId),
    enabled: !!companyId,
  });

  const presentIds = new Set(todayCheckins.filter((c) => c.status === "VALID").map((c) => c.user_id));

  const filtered = employees.filter((e) =>
    `${e.firstname} ${e.lastname} ${e.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: "name",
      header: "Nom",
      render: (row: User) => (
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              {row.firstname[0]}{row.lastname[0]}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${presentIds.has(row.id) ? "bg-success-500" : "bg-slate-300"}`} />
          </div>
          <span className="font-medium text-slate-900">{row.firstname} {row.lastname}</span>
        </div>
      ),
    },
    { key: "email", header: "Email", render: (row: User) => <span className="text-slate-500">{row.email}</span> },
    { key: "phone", header: "Téléphone", render: (row: User) => <span className="text-slate-500">{row.phone ?? "—"}</span> },
    {
      key: "status",
      header: "Statut",
      render: (row: User) => (
        <Badge variant={presentIds.has(row.id) ? "success" : "default"}>
          {presentIds.has(row.id) ? "Présent" : "Absent"}
        </Badge>
      ),
    },
    {
      key: "role",
      header: "Rôle",
      render: (row: User) => (
        <Badge variant={row.role === "EMPLOYEE" ? "default" : row.role === "ADMIN" ? "success" : "warning"}>
          {row.role}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employés</h1>
          <p className="text-sm text-slate-500">{employees.length} membre{employees.length !== 1 ? "s" : ""} dans votre équipe</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white">
          <button onClick={() => setView("grid")} className={`rounded-l-lg p-2 ${view === "grid" ? "bg-slate-100" : "hover:bg-slate-50"}`}>
            <Grid3X3 className="h-4 w-4 text-slate-600" />
          </button>
          <button onClick={() => setView("list")} className={`rounded-r-lg p-2 ${view === "list" ? "bg-slate-100" : "hover:bg-slate-50"}`}>
            <List className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        {isLoading ? (
          view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white">
            <Users className="h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-500">
              {search ? "Aucun résultat pour cette recherche" : "Aucun employé ajouté"}
            </p>
            {!search && (
              <Button size="sm" onClick={() => setShowAddModal(true)} className="rounded-lg">
                <Plus className="mr-1 h-4 w-4" />
                Ajouter le premier
              </Button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <EmployeeCard key={e.id} employee={e} onClick={() => setSelected(e)} />
            ))}
          </div>
        ) : (
          <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.id} onRowClick={setSelected} />
        )}
      </motion.div>

      {/* Add employee modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Ajouter un employé" size="md">
        <EmployeeForm
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ["employees", companyId] });
          }}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* View employee modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Profil employé" size="md">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
                {selected.firstname[0]}{selected.lastname[0]}
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">{selected.firstname} {selected.lastname}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={selected.role === "EMPLOYEE" ? "default" : "success"}>{selected.role}</Badge>
                  <Badge variant={presentIds.has(selected.id) ? "success" : "default"}>
                    {presentIds.has(selected.id) ? "Présent aujourd'hui" : "Absent aujourd'hui"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-900">{selected.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Téléphone</span>
                <span className="font-medium text-slate-900">{selected.phone ?? "Non renseigné"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Membre depuis</span>
                <span className="font-medium text-slate-900">{new Date(selected.created_at).toLocaleDateString("fr-FR")}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
