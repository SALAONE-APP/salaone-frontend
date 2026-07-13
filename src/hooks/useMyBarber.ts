import { useEffect, useState } from "react";

import { getMyBarber, type Barber } from "@/service/barberService";

export function useMyBarber() {
  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyBarber()
      .then(setBarber)
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : "Erro ao carregar perfil do profissional");
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  return { barber, loading, error };
}
