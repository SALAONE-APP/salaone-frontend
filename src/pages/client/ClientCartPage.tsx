import { useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  clearCart,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
  type CartItem,
} from "@/service/cartService";
import { checkoutProductCart, listProducts } from "@/service/productService";

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function apiMessage(error: unknown) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : "Não foi possível finalizar a compra.";
}

export function ClientCartPage() {
  const [items, setItems] = useState<CartItem[]>(() => getCart());
  const [checkingOut, setCheckingOut] = useState(false);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  useEffect(() => {
    async function refresh() {
      try {
        const products = await listProducts({ active: true });
        const byId = new Map(products.map((product) => [product.id, product]));
        const refreshed = getCart().flatMap((item) => {
          const product = byId.get(item.productId);
          if (!product || product.stock <= 0) return [];
          return [{
            ...item,
            name: product.name,
            price: product.price,
            stock: product.stock,
            imageUrl: product.imageUrl ?? product.image_url,
            quantity: Math.min(item.quantity, product.stock),
          }];
        });
        localStorage.setItem("salaone-product-cart", JSON.stringify(refreshed));
        setItems(refreshed);
      } catch {
        // O backend valida preço e estoque novamente na finalização.
      }
    }
    void refresh();
  }, []);

  async function checkout() {
    if (!items.length || checkingOut) return;
    setCheckingOut(true);
    try {
      const order = await checkoutProductCart(items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })));
      clearCart();
      setItems([]);
      toast.success(`Pedido ${order.orderId.slice(0, 8).toUpperCase()} de ${currency(order.total)} realizado. Faça o pagamento na retirada.`);
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary"><ShoppingCart size={22} /></div>
          <div>
            <h2 className="text-xl font-semibold">Carrinho</h2>
            <p className="text-sm text-muted-foreground">Compre produtos sem precisar agendar um serviço.</p>
          </div>
        </div>
      </div>

      {!items.length ? (
        <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
          <div>
            <ShoppingCart className="mx-auto text-muted-foreground" size={38} />
            <h3 className="mt-3 font-semibold">Seu carrinho está vazio</h3>
            <p className="mt-1 text-sm text-muted-foreground">Adicione produtos pelo catálogo para continuar.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.productId} className="flex gap-4 rounded-xl border bg-card p-4">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                    : <div className="grid h-full place-items-center"><Package className="text-muted-foreground" /></div>}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                  <div className="flex justify-between gap-3">
                    <div><h3 className="font-semibold">{item.name}</h3><p className="text-sm text-primary">{currency(item.price)}</p></div>
                    <Button variant="ghost" size="icon" onClick={() => setItems(removeCartItem(item.productId))} aria-label={`Remover ${item.name}`}><Trash2 size={17} className="text-destructive" /></Button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setItems(updateCartItemQuantity(item.productId, item.quantity - 1))}><Minus size={14} /></Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={item.quantity >= item.stock} onClick={() => setItems(updateCartItemQuantity(item.productId, item.quantity + 1))}><Plus size={14} /></Button>
                    </div>
                    <strong>{currency(item.price * item.quantity)}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <aside className="h-fit rounded-xl border bg-card p-5 lg:sticky lg:top-6">
            <h3 className="font-semibold">Resumo do pedido</h3>
            <div className="my-4 space-y-2 border-y py-4 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Itens</span><span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span></div>
              <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{currency(total)}</span></div>
            </div>
            <Button className="w-full" disabled={checkingOut} onClick={() => void checkout()}>
              {checkingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Finalizar pedido
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Pagamento no salão no momento da retirada.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
