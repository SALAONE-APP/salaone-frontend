import { useEffect, useState } from "react";

import { getMyProfessional, type Professional } from "@/service/professionalService";

export function useMyProfessional(enabled = true) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    getMyProfessional()
      .then(setProfessional)
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : "Erro ao carregar perfil do profissional");
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [enabled]);

  return { professional, loading, error };
}
