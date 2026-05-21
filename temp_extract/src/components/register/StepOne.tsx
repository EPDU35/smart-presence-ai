import { useState } from "react";
import { useRegisterStore } from "@/store/registerStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ArrowRight } from "lucide-react";

interface StepOneProps {
  onNext: () => void;
}

export function StepOne({ onNext }: StepOneProps) {
  const { fullname, email, password, setField } = useRegisterStore();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullname.trim() || !email.trim() || !password) {
      setError("Tous les champs sont obligatoires");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caracteres");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onNext();
    }, 400);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}

      <Input
        label="Nom complet"
        placeholder="Jean Dupont"
        value={fullname}
        onChange={(e) => setField("fullname", e.target.value)}
        required
        autoFocus
      />

      <Input
        type="email"
        label="Email professionnel"
        placeholder="jean@entreprise.com"
        value={email}
        onChange={(e) => setField("email", e.target.value)}
        required
      />

      <div>
        <Input
          type="password"
          label="Mot de passe"
          placeholder="Min. 8 caracteres"
          value={password}
          onChange={(e) => setField("password", e.target.value)}
          required
          minLength={8}
        />
        <p className="mt-1.5 text-xs text-slate-500">Au moins 8 caracteres</p>
      </div>

      <Button type="submit" className="w-full" isLoading={loading}>
        Continuer
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  );
}
