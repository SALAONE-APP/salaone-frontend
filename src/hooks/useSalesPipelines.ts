import { useCallback, useEffect, useState } from "react";

import { listSalesPipelines, type SalesPipeline, type SalesProduct } from "@/service/salesCrmService";

// Funis do produto (padrao primeiro). reload() reconsulta apos editar funis.
export function useSalesPipelines(product: SalesProduct) {
  const [pipelines, setPipelines] = useState<SalesPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const result = await listSalesPipelines(product);
      setPipelines(result);
      setError(false);
      return result;
    } catch {
      setError(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { pipelines, loading, error, reload };
}
