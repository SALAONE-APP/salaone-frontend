import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Coffee, Loader2, Minus, Package, Pencil, Plus, ReceiptText, Scissors, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listAppointments, type Appointment } from "@/service/appointmentService";
import { listProducts, type Product } from "@/service/productService";
import { listBookableProfessionals, type Professional } from "@/service/professionalService";
import { listServices, type Service } from "@/service/serviceService";
import {
  addServiceTabItem,
  cancelServiceTab,
  listServiceTabs,
  openServiceTab,
  payServiceTab,
  removeServiceTabItem,
  updateServiceTabItem,
  type ServiceTab,
  type ServiceTabItemType,
} from "@/service/serviceTabService";

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

function message(error: unknown) {
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || (error instanceof Error ? error.message : "Nao foi possivel concluir a operacao.");
}

const emptyItem = {
  type: "service" as ServiceTabItemType,
  referenceId: "",
  name: "",
  quantity: 1,
  unitPrice: "",
  professionalId: "",
};

export function ServiceTabsPage() {
  const [tabs, setTabs] = useState<ServiceTab[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [itemTab, setItemTab] = useState<ServiceTab | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [cancelTab, setCancelTab] = useState<ServiceTab | null>(null);
  const [payTab, setPayTab] = useState<ServiceTab | null>(null);
  const [newTabOpen, setNewTabOpen] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "debito" | "credito" | "dinheiro">("dinheiro");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tabData, appointmentData, serviceData, productData, professionalData] = await Promise.all([
        listServiceTabs(),
        listAppointments({ status: "in_service", allAppointments: true, limit: 100 }),
        listServices({ limit: 100 }),
        listProducts({ active: true }),
        listBookableProfessionals(),
      ]);
      setTabs(tabData);
      setAppointments(appointmentData.items);
      setServices(serviceData.items.filter((service) => service.active));
      setProducts(productData.filter((product) => product.active));
      setProfessionals(professionalData.items);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openTabs = tabs.filter((tab) => tab.status === "open");
  const paidTabs = tabs.filter((tab) => tab.status === "paid");
  const cancelledTabs = tabs.filter((tab) => tab.status === "cancelled");
  const tabAppointmentIds = useMemo(() => new Set(tabs.map((tab) => tab.appointmentId)), [tabs]);
  const availableAppointments = appointments.filter((appointment) => !tabAppointmentIds.has(appointment.id));

  async function handleOpen(appointmentId: string) {
    setBusy(true);
    try {
      await openServiceTab(appointmentId);
      toast.success("Comanda aberta.");
      setNewTabOpen(false);
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddItem(event: FormEvent) {
    event.preventDefault();
    if (!itemTab) return;
    if (itemForm.type !== "consumption" && !itemForm.referenceId) {
      toast.error("Selecione o item.");
      return;
    }
    if ((itemForm.type === "service" || itemForm.type === "consumption") && !itemForm.professionalId) {
      toast.error("Selecione o funcionário responsável.");
      return;
    }
    if (itemForm.type === "consumption" && (!itemForm.name.trim() || parseMoneyInput(itemForm.unitPrice) < 0)) {
      toast.error("Informe o consumo e o valor.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        type: itemForm.type,
        referenceId: itemForm.referenceId || null,
        name: itemForm.name || null,
        quantity: itemForm.quantity,
        unitPrice: itemForm.type === "consumption" ? parseMoneyInput(itemForm.unitPrice) : null,
        professionalId: itemForm.type === "service" || itemForm.type === "consumption" ? itemForm.professionalId : null,
      };
      if (editingItemId) {
        await updateServiceTabItem(itemTab.id, editingItemId, payload);
        toast.success("Item atualizado.");
      } else {
        await addServiceTabItem(itemTab.id, payload);
        toast.success("Item adicionado a comanda.");
      }
      setItemTab(null);
      setEditingItemId(null);
      setItemForm(emptyItem);
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  }

  function handleEditItem(tab: ServiceTab, item: ServiceTab["items"][number]) {
    setItemTab(tab);
    setEditingItemId(item.id);
    setItemForm({
      type: item.type,
      referenceId: item.referenceId ?? "",
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.type === "consumption" ? money(item.unitPrice) : String(item.unitPrice),
      professionalId: item.professional?.id ?? tab.appointment.professional.id,
    });
  }

  async function handleCancel() {
    if (!cancelTab) return;
    setBusy(true);
    try {
      await cancelServiceTab(cancelTab.id);
      toast.success("Comanda cancelada.");
      setCancelTab(null);
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(tabId: string, itemId: string) {
    setBusy(true);
    try {
      await removeServiceTabItem(tabId, itemId);
      toast.success("Item removido.");
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function handlePay() {
    if (!payTab) return;
    setBusy(true);
    try {
      await payServiceTab(payTab.id, paymentMethod);
      toast.success("Comanda paga e encerrada.");
      setPayTab(null);
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  }

  function renderTab(tab: ServiceTab, readOnly = false) {
    return (
      <div key={tab.id} className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{tab.appointment.client.name}</h3>
              <Badge variant={tab.status === "open" ? "secondary" : "outline"}>
                {tab.status === "open" ? "Em aberto" : tab.status === "paid" ? "Paga" : "Cancelada"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {tab.appointment.professional.displayName} · {new Date(tab.appointment.startAt).toLocaleString("pt-BR")}
            </p>
          </div>
          <strong className="text-xl text-foreground">{money(tab.total)}</strong>
        </div>
        <div className="divide-y divide-border">
          {tab.items.length === 0 ? (
            <p className="p-5 text-center text-sm text-muted-foreground">Nenhum consumo adicionado.</p>
          ) : tab.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                {item.type === "service" ? <Scissors size={18} /> : item.type === "product" ? <Package size={18} /> : <Coffee size={18} />}
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} × {money(item.unitPrice)}</p>
                  {(item.type === "service" || item.type === "consumption") && item.professional && (
                    <p className="text-xs text-muted-foreground">Responsável: {item.professional.displayName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{money(item.total)}</span>
                {!readOnly && (
                  <><Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={`Editar ${item.name}`} onClick={() => handleEditItem(tab, item)}><Pencil className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={`Remover ${item.name}`} onClick={() => void handleRemove(tab.id, item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></>
                )}
              </div>
            </div>
          ))}
        </div>
        {!readOnly && (
          <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
            <Button variant="destructive" onClick={() => setCancelTab(tab)} disabled={busy}><XCircle className="mr-2 h-4 w-4" /> Cancelar comanda</Button>
            <Button variant="outline" onClick={() => { setItemTab(tab); setItemForm({ ...emptyItem, professionalId: tab.appointment.professional.id }); }}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar item
            </Button>
            <Button disabled={tab.total <= 0 || busy} onClick={() => setPayTab(tab)}>
              <ReceiptText className="mr-2 h-4 w-4" /> Receber e fechar
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Comandas</h2>
          <p className="text-sm text-muted-foreground">
            Abra uma comanda para um cliente que já está em atendimento.
          </p>
        </div>
        <Button onClick={() => setNewTabOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova comanda
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Em atendimento</p><strong className="text-2xl">{appointments.length}</strong></div>
        <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Comandas abertas</p><strong className="text-2xl">{openTabs.length}</strong></div>
        <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Valor em aberto</p><strong className="text-2xl">{money(openTabs.reduce((sum, tab) => sum + tab.total, 0))}</strong></div>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="attendance">Em atendimento</TabsTrigger>
          <TabsTrigger value="open">Comandas abertas</TabsTrigger>
          <TabsTrigger value="paid">Finalizadas</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-3">
          {loading ? <Loader2 className="mx-auto mt-10 animate-spin" /> : availableAppointments.length === 0 ? (
            <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Nenhum atendimento aguardando abertura de comanda.</p>
          ) : availableAppointments.map((appointment) => (
            <div key={appointment.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><strong>{appointment.client?.name ?? "Cliente"}</strong><p className="text-sm text-muted-foreground">{appointment.professional?.displayName ?? "Profissional"}</p></div>
              <Button disabled={busy} onClick={() => void handleOpen(appointment.id)}>Abrir comanda</Button>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="open" className="space-y-4">
          {loading ? <Loader2 className="mx-auto mt-10 animate-spin" /> : openTabs.length ? openTabs.map((tab) => renderTab(tab)) : <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma comanda aberta.</p>}
        </TabsContent>
        <TabsContent value="paid" className="space-y-4">
          {paidTabs.length ? paidTabs.map((tab) => renderTab(tab, true)) : <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma comanda finalizada.</p>}
        </TabsContent>
        <TabsContent value="cancelled" className="space-y-4">{cancelledTabs.length ? cancelledTabs.map((tab) => renderTab(tab, true)) : <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma comanda cancelada.</p>}</TabsContent>
      </Tabs>

      <Dialog open={newTabOpen} onOpenChange={setNewTabOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova comanda</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {loading ? (
              <Loader2 className="mx-auto my-10 animate-spin" />
            ) : availableAppointments.length === 0 ? (
              <p className="rounded-lg border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
                Não há clientes em atendimento sem comanda. Inicie o atendimento de um agendamento para abrir uma nova comanda.
              </p>
            ) : (
              availableAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <strong>{appointment.client?.name ?? "Cliente"}</strong>
                    <p className="text-sm text-muted-foreground">
                      {appointment.professional?.displayName ?? "Profissional"} ·{" "}
                      {new Date(appointment.startAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Button disabled={busy} onClick={() => void handleOpen(appointment.id)}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Abrir comanda
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewTabOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(itemTab)} onOpenChange={(open) => { if (!open) { setItemTab(null); setEditingItemId(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItemId ? "Editar item da comanda" : "Adicionar item a comanda"}</DialogTitle></DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="space-y-2"><Label>Tipo</Label><Select disabled={Boolean(editingItemId)} value={itemForm.type} onValueChange={(type: ServiceTabItemType) => setItemForm({ ...emptyItem, type, professionalId: type === "service" || type === "consumption" ? itemTab?.appointment.professional.id ?? "" : "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="service">Outros serviços</SelectItem><SelectItem value="product">Produto</SelectItem><SelectItem value="consumption">Outro consumo</SelectItem></SelectContent></Select></div>
            {itemForm.type === "service" && <div className="space-y-2"><Label>Serviço extra</Label><Select value={itemForm.referenceId} onValueChange={(referenceId) => setItemForm((form) => ({ ...form, referenceId }))}><SelectTrigger><SelectValue placeholder="Escolha outro serviço para o atendimento" /></SelectTrigger><SelectContent>{services.map((service) => { const price = Number(service.promotionalPrice ?? 0) > 0 ? Number(service.promotionalPrice) : service.basePrice; return <SelectItem key={service.id} value={service.id} disabled={price <= 0}>{service.name} · {money(price)}</SelectItem>; })}</SelectContent></Select><p className="text-xs text-muted-foreground">Selecione qualquer serviço adicional oferecido durante o atendimento.</p></div>}
            {itemForm.type === "service" && <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3"><Label>Funcionário responsável</Label><Select value={itemForm.professionalId} onValueChange={(professionalId) => setItemForm((form) => ({ ...form, professionalId }))}><SelectTrigger><SelectValue placeholder="Escolha quem realizou o serviço" /></SelectTrigger><SelectContent>{professionals.map((professional) => <SelectItem key={professional.id} value={professional.id}>{professional.displayName}{professional.id === itemTab?.appointment.professional.id ? " (atendimento principal)" : ""}</SelectItem>)}</SelectContent></Select>{professionals.length === 0 ? <p className="text-xs text-destructive">Nenhum profissional ativo disponível.</p> : <p className="text-xs text-muted-foreground">Selecione o funcionário que realizou este serviço, mesmo que seja diferente do atendimento principal.</p>}</div>}
            {itemForm.type === "product" && <div className="space-y-2"><Label>Produto</Label><Select value={itemForm.referenceId} onValueChange={(referenceId) => setItemForm((form) => ({ ...form, referenceId }))}><SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger><SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id} disabled={product.stock <= 0}>{product.name} · {money(product.price)} · estoque {product.stock}</SelectItem>)}</SelectContent></Select></div>}
            {itemForm.type === "consumption" && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Consumo</Label><Input value={itemForm.name} onChange={(event) => setItemForm((form) => ({ ...form, name: event.target.value }))} placeholder="Cafe, agua..." /></div><div className="space-y-2"><Label>Valor unitário</Label><Input inputMode="numeric" placeholder="R$ 0,00" value={itemForm.unitPrice} onChange={(event) => setItemForm((form) => ({ ...form, unitPrice: money(parseMoneyInput(event.target.value)) }))} /></div></div>}
            {itemForm.type === "consumption" && <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3"><Label>Funcionário responsável</Label><Select value={itemForm.professionalId} onValueChange={(professionalId) => setItemForm((form) => ({ ...form, professionalId }))}><SelectTrigger><SelectValue placeholder="Escolha o responsável pelo consumo" /></SelectTrigger><SelectContent>{professionals.map((professional) => <SelectItem key={professional.id} value={professional.id}>{professional.displayName}{professional.id === itemTab?.appointment.professional.id ? " (atendimento principal)" : ""}</SelectItem>)}</SelectContent></Select>{professionals.length === 0 ? <p className="text-xs text-destructive">Nenhum profissional ativo disponível.</p> : <p className="text-xs text-muted-foreground">Selecione o funcionário responsável por este consumo.</p>}</div>}
            <div className="space-y-2"><Label>Quantidade</Label><div className="flex items-center gap-2"><Button type="button" size="icon" variant="outline" onClick={() => setItemForm((form) => ({ ...form, quantity: Math.max(1, form.quantity - 1) }))}><Minus size={16} /></Button><span className="w-10 text-center">{itemForm.quantity}</span><Button type="button" size="icon" variant="outline" onClick={() => setItemForm((form) => ({ ...form, quantity: form.quantity + 1 }))}><Plus size={16} /></Button></div></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => { setItemTab(null); setEditingItemId(null); }}>Cancelar</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingItemId ? "Salvar alterações" : "Adicionar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(cancelTab)} onOpenChange={(open) => { if (!open) setCancelTab(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancelar esta comanda?</AlertDialogTitle><AlertDialogDescription>Esta ação encerra a comanda como cancelada. Os produtos lançados serão devolvidos ao estoque e o registro continuará disponível no histórico.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void handleCancel(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cancelar comanda</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <Dialog open={Boolean(payTab)} onOpenChange={(open) => { if (!open) setPayTab(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Receber comanda</DialogTitle></DialogHeader>
          <div className="rounded-lg border bg-secondary/30 p-4"><p className="text-sm text-muted-foreground">Total</p><strong className="text-3xl">{money(payTab?.total ?? 0)}</strong></div>
          <div className="space-y-2"><Label>Forma de pagamento</Label><Select value={paymentMethod} onValueChange={(value: typeof paymentMethod) => setPaymentMethod(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="pix">PIX</SelectItem><SelectItem value="debito">Debito</SelectItem><SelectItem value="credito">Credito</SelectItem></SelectContent></Select></div>
          <DialogFooter><Button variant="outline" onClick={() => setPayTab(null)}>Cancelar</Button><Button onClick={() => void handlePay()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar pagamento</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
