import type { ComponentType } from "react";
import { useSalesProduct } from "@/hooks/useSalesProduct";

// As 3 paginas do CRM comercial sao as mesmas para todos os produtos; o key
// remonta a pagina ao trocar de produto e descarta leads/filtros do anterior.
export function keyedByProduct(Page: ComponentType): ComponentType {
  return function KeyedByProduct() {
    const product = useSalesProduct();
    return <Page key={product} />;
  };
}
