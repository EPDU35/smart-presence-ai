import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { createEmployee } from "@/services/employee.service";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/types";

interface EmployeeFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EmployeeForm({ onSuccess, onCancel }: EmployeeFormProps) {
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
    role: "EMPLOYEE" as UserRole,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await createEmployee({
        company_id: user?.company_id ?? "",
        role: form.role,
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        phone: form.phone || null,
        avatar: null,
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la creation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Prenom"
          value={form.firstname}
          onChange={(e) => updateField("firstname", e.target.value)}
          required
        />
        <Input
          label="Nom"
          value={form.lastname}
          onChange={(e) => updateField("lastname", e.target.value)}
          required
        />
      </div>

      <Input
        type="email"
        label="Email"
        value={form.email}
        onChange={(e) => updateField("email", e.target.value)}
        required
      />

      <Input
        label="Telephone"
        value={form.phone}
        onChange={(e) => updateField("phone", e.target.value)}
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
        <select
          value={form.role}
          onChange={(e) => updateField("role", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option value="EMPLOYEE">Employe</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" isLoading={loading}>
          Creer
        </Button>
      </div>
    </form>
  );
}
