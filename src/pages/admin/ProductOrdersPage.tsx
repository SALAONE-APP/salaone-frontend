import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Loader2, PackageCheck, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listSalonProductOrders, type SalonProductOrder } from "@/service/productService";
import { updatePayment, type PaymentMethod } from "@/service/paymentService";

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function message(error: unknown) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : "Não foi possível carregar os pedidos.";
}

export function ProductOrdersPage() {
  const [orders, setOrders] = useState<SalonProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<SalonProductOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<Extract<PaymentMethod, "dinheiro" | "pix" | "debito" | "credito">>("dinheiro");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await listSalonProductOrders());
    } catch (error) {
      toast.error(message(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markAsPaid() {
    const order = paymentOrder;
    if (!order?.payment) return;
    setUpdatingId(order.orderId);
    try {
      await updatePayment({ id: order.payment.id, appointmentId: null }, {
        status: "paid",
        method: paymentMethod,
        paidAt: new Date().toISOString(),
      });
      toast.success("Pagamento do pedido confirmado.");
      setPaymentOrder(null);
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary"><PackageCheck size={23} /></div>
          <div>
            <h2 className="text-xl font-semibold">Pedidos de produtos</h2>
            <p className="text-sm text-muted-foreground">Compras realizadas pelos clientes sem agendamento.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-52 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">Nenhum pedido de produto encontrado.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const paid = order.payment?.status === "paid" || order.payment?.status === "approved";
            return (
              <article key={order.orderId} className="rounded-xl border bg-card">
                <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">Pedido #{order.orderId.slice(0, 8).toUpperCase()}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${paid ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-700"}`}>
                        {paid ? "Pago" : "Pendente"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{order.client?.name || "Cliente"}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={12} />{new Date(order.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong className="text-xl">{currency(order.total)}</strong>
                    {!paid && order.payment && (
                      <Button
                        disabled={updatingId === order.orderId}
                        onClick={() => {
                          setPaymentMethod("dinheiro");
                          setPaymentOrder(order);
                        }}
                      >
                        {updatingId === order.orderId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Confirmar pagamento
                      </Button>
                    )}
                  </div>
                </div>
                <div className="divide-y">
                  {order.items.map((item) => (
                    <div key={`${order.orderId}-${item.productId}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span className="flex items-center gap-2"><ReceiptText size={15} className="text-muted-foreground" />{item.quantity}× {item.name}</span>
                      <span className="font-medium">{currency(item.total)}</span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(paymentOrder)} onOpenChange={(open) => { if (!open && !updatingId) setPaymentOrder(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pagamento</DialogTitle>
            <DialogDescription>
              Informe como o pedido #{paymentOrder?.orderId.slice(0, 8).toUpperCase()} foi pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-secondary/30 p-4">
              <p className="text-sm text-muted-foreground">Valor recebido</p>
              <strong className="text-2xl">{currency(paymentOrder?.total ?? 0)}</strong>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={(value: typeof paymentMethod) => setPaymentMethod(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="debito">Cartão de débito</SelectItem>
                  <SelectItem value="credito">Cartão de crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={Boolean(updatingId)} onClick={() => setPaymentOrder(null)}>Cancelar</Button>
            <Button disabled={Boolean(updatingId)} onClick={() => void markAsPaid()}>
              {updatingId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
