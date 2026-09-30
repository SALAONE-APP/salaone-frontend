import { useParams } from "react-router-dom";

import { isSalesProduct, type SalesProduct } from "@/service/salesCrmService";

// Produto do CRM comercial vem da rota (/crm-comercial/:product/...).
// Valor invalido cai em salaone - mesmo default do backend.
export function useSalesProduct(): SalesProduct {
  const { product } = useParams<{ product: string }>();
  return product && isSalesProduct(product) ? product : "salaone";
}
