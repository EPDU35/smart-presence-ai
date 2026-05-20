import { useState } from "react";
import { useRegisterStore } from "@/store/registerStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ArrowRight, KeyRound } from "lucide-react";

interface StepTwoJoinProps {
  onSubmit: () => void;
}

export function StepTwoJoin({ onSubmit }: StepTwoJoinProps) {
  const { joinCode, setField } = useRegisterStore();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!joinCode.trim()) {
      setError("Le code entreprise est obligatoire");
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

      <div className="flex items-center gap-3 rounded-lg bg-slate-100 p-3">
        <KeyRound className="h-5 w-5 text-slate-600" />
        <p className="text-sm text-slate-600">Demandez ce code a votre administrateur</p>
      </div>

      <Input
        label="Code entreprise"
        placeholder="SP-9XK2L"
        value={joinCode}
        onChange={(e) => setField("joinCode", e.target.value.toUpperCase())}
        required
        autoFocus
      />

      <Button type="submit" className="w-full" isLoading={loading}>
        Acceder a mon espace
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  );
}
