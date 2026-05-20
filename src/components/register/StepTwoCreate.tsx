import { useState } from "react";
import { useRegisterStore } from "@/store/registerStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ArrowRight, Building2 } from "lucide-react";

interface StepTwoCreateProps {
  onSubmit: () => void;
}

export function StepTwoCreate({ onSubmit }: StepTwoCreateProps) {
  const { companyName, companyLocation, setField } = useRegisterStore();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!companyName.trim()) {
      setError("Le nom de l entreprise est obligatoire");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSubmit();
    }, 400);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex items-center gap-3 rounded-lg bg-primary-50 p-3">
        <Building2 className="h-5 w-5 text-primary-600" />
        <p className="text-sm text-primary-700">Vous pourrez inviter vos employes ensuite</p>
      </div>

      <Input
        label="Nom de l entreprise"
        placeholder="Ma Societe SA"
        value={companyName}
        onChange={(e) => setField("companyName", e.target.value)}
        required
        autoFocus
      />

      <Input
        label="Localisation"
        placeholder="Abidjan, Cocody"
        value={companyLocation}
        onChange={(e) => setField("companyLocation", e.target.value)}
      />

      <Button type="submit" className="w-full" isLoading={loading}>
        Acceder a mon espace
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  );
}
