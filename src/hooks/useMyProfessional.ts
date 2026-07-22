import { useEffect, useState } from "react";

import { getMyProfessional, type Professional } from "@/service/professionalService";

export function useMyProfessional() {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyProfessional()
      .then(setProfessional)
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : "Erro ao carregar perfil do profissional");
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  return { professional, loading, error };
}
