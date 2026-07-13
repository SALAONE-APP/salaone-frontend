import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Filter,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  Play,
  RefreshCw,
  Search,
  Scissors,
  TimerReset,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listBarbers, type Barber } from "@/service/barberService";
import { listPlans, type Plan } from "@/service/planService";

import {
  cancelSubscription,
  checkOverdueSubscriptions,
  listSubscriptions,
  renewSubscription,
  toggleSubscriptionRecurring,
  updateSubscription,
  type Subscription,
} from "@/service/subscriptionService";

type StatusFilter = "all" | Subscription["status"];
type SearchTab = "name" | "cpf";

const statusLabels: Record<Subscription["status"], string> = {
  active: "Ativo",
  pending: "Pendente",
  paused: "Pausado",
  cancelled: "Cancelado",
  expired: "Expirado",
};

const paymentLabels: Record<string, string> = {
  pix: "Pix",
  debito: "Cartao de debito",
  credito: "Cartao de credito",
  dinheiro: "Dinheiro",
  local: "Pagamento local",
  subscription: "Assinatura",
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function getApiMessage(error: unknown) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(responseData)) return responseData.join(" ");
  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel concluir a operacao.";
}

function statusClass(status: Subscription["status"]) {
  if (status === "active") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
  if (status === "pending") return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  if (status === "paused") return "border-amber-500/20 bg-amber-500/10 text-amber-600";
  if (status === "cancelled") return "border-rose-500/20 bg-rose-500/10 text-rose-600";
  return "border-muted-foreground/20 bg-muted text-muted-foreground";
}

export function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTab, setSearchTab] = useState<SearchTab>("name");
  const [searchValue, setSearchValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkingOverdue, setCheckingOverdue] = useState(false);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoading, setBarbersLoading] = useState(false);
  const [barberDialogSubscription, setBarberDialogSubscription] = useState<Subscription | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [savingBarber, setSavingBarber] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planDialogSubscription, setPlanDialogSubscription] = useState<Subscription | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);


  const stats = useMemo(() => {
    return subscriptions.reduce(
      (acc, sub) => {
        acc.total += 1;
        acc.revenue += sub.status === "active" ? Number(sub.amount || 0) : 0;
        acc[sub.status] += 1;
        return acc;
      },
      { total: 0, active: 0, pending: 0, paused: 0, cancelled: 0, expired: 0, revenue: 0 },
    );
  }, [subscriptions]);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSubscriptions({
        limit: 100,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchValue.trim() || undefined,
        searchType: searchTab,
      });
      setSubscriptions(result.items);
      setTotal(result.total);
    } catch (err) {
      setSubscriptions([]);
      setTotal(0);
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [searchTab, searchValue, statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSubscriptions();
    }, searchValue ? 350 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadSubscriptions, searchValue]);

  useEffect(() => {
    setBarbersLoading(true);
    listBarbers({ page: 1, limit: 200 })
      .then((result) => setBarbers(result.items))
      .catch(() => setBarbers([]))
      .finally(() => setBarbersLoading(false));
  }, []);

  useEffect(() => {
    setPlansLoading(true);
    listPlans({ active: true })
      .then((result) => setPlans(result))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, []);



  async function runAction(subscription: Subscription, action: "activate" | "pause" | "cancel" | "renew" | "recurring") {
    if (busyId) return;

    setBusyId(subscription.id);
    try {
      if (action === "activate") {
        await updateSubscription(subscription.id, { status: "active" });
        toast.success("Assinatura ativada.");
      }
      if (action === "pause") {
        await updateSubscription(subscription.id, { status: "paused" });
        toast.success("Assinatura pausada.");
      }
      if (action === "cancel") {
        await cancelSubscription(subscription.id);
        toast.success("Assinatura cancelada.");
      }
      if (action === "renew") {
        await renewSubscription(subscription.id);
        toast.success("Assinatura renovada.");
      }
      if (action === "recurring") {
        await toggleSubscriptionRecurring(subscription.id);
        toast.success("Recorrencia atualizada.");
      }
      await loadSubscriptions();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function openBarberDialog(subscription: Subscription) {
    setBarberDialogSubscription(subscription);
    setSelectedBarberId(subscription.monthlyBarberId ?? "");
  }

  function openPlanDialog(subscription: Subscription) {
    setPlanDialogSubscription(subscription);
    setSelectedPlanId(subscription.planId ?? "");
  }

  async function handleSavePlan() {
    if (!planDialogSubscription || !selectedPlanId) return;
    if (selectedPlanId === planDialogSubscription.planId) {
      setPlanDialogSubscription(null);
      setSelectedPlanId("");
      return;
    }

    setSavingPlan(true);
    try {
      await updateSubscription(planDialogSubscription.id, {
        planId: selectedPlanId,
      });
      toast.success("Plano do cliente atualizado.");
      setPlanDialogSubscription(null);
      setSelectedPlanId("");
      await loadSubscriptions();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleSaveMonthlyBarber() {
    if (!barberDialogSubscription) return;
    setSavingBarber(true);
    try {
      await updateSubscription(barberDialogSubscription.id, {
        monthlyBarberId: selectedBarberId || null,
      });
      toast.success(selectedBarberId ? "Barbeiro do cliente atualizado." : "Barbeiro fixo removido.");
      setBarberDialogSubscription(null);
      setSelectedBarberId("");
      await loadSubscriptions();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSavingBarber(false);
    }
  }

  async function handleCheckOverdue() {
    setCheckingOverdue(true);
    try {
      const result = await checkOverdueSubscriptions();
      toast.success(result.message || "Assinaturas vencidas verificadas.");
      await loadSubscriptions();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setCheckingOverdue(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Assinaturas listadas</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Ativas</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Pausadas</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{stats.paused}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Canceladas/expiradas</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {stats.cancelled + stats.expired}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Receita ativa mensal</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrency(stats.revenue)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-base font-medium text-foreground">Assinaturas de clientes</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Acompanhe status, ciclos, vencimentos e recorrencia dos planos.
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex overflow-hidden rounded-md border border-border text-sm">
              <button
                type="button"
                onClick={() => { setSearchTab("name"); setSearchValue(""); }}
                className={`px-3 py-1.5 transition-colors ${
                  searchTab === "name"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                Nome
              </button>
              <button
                type="button"
                onClick={() => { setSearchTab("cpf"); setSearchValue(""); }}
                className={`px-3 py-1.5 transition-colors ${
                  searchTab === "cpf"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                CPF
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={searchTab === "name" ? "Buscar cliente..." : "Buscar CPF..."}
                className="h-8 w-full pl-8 pr-8 text-sm lg:w-64"
              />
              {searchValue ? (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter size={14} />
                  {statusFilter === "all" ? "Todos" : statusLabels[statusFilter]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="active">Ativos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="pending">Pendentes</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="paused">Pausados</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="cancelled">Cancelados</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="expired">Expirados</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCheckOverdue}
              disabled={checkingOverdue}
            >
              {checkingOverdue ? <Loader2 size={14} className="animate-spin" /> : <TimerReset size={14} />}
              Verificar vencidas
            </Button>
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <XCircle size={28} className="text-destructive" />
            <p className="text-sm text-foreground">{error}</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void loadSubscriptions()}>
              <RefreshCw size={14} />
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Plano
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ciclo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Barbeiro
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Recorrencia
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando assinaturas...
                    </td>
                  </tr>
                ) : subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-sm text-muted-foreground">
                      <Users className="mx-auto mb-2 h-5 w-5" />
                      Nenhuma assinatura encontrada.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((subscription) => (
                    <tr
                      key={subscription.id}
                      className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                    >
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {subscription.user?.name ?? "-"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {subscription.user?.cpf ?? subscription.user?.email ?? "-"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: subscription.plan?.color ?? "#6366f1" }}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {subscription.plan?.name ?? "-"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {subscription.plan?.cutsPerMonth ?? 0} cortes/mes
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-1.5 text-foreground">
                            <CalendarClock size={13} className="text-muted-foreground" />
                            {formatDate(subscription.nextBillingAt)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {subscription.currentCycle
                              ? `${subscription.currentCycle.cutsRemaining}/${subscription.currentCycle.cutsIncluded} cortes restantes`
                              : "Sem ciclo aberto"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Scissors size={14} className="text-muted-foreground" />
                          <span className="max-w-40 truncate">
                            {subscription.monthlyBarber?.displayName ?? "Sem barbeiro fixo"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency(subscription.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {paymentLabels[subscription.paymentMethod ?? ""] ?? "Metodo nao informado"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusClass(subscription.status)}>
                          {statusLabels[subscription.status]}
                        </Badge>
                        {subscription.daysOverdue ? (
                          <p className="mt-1 text-xs text-destructive">
                            {subscription.daysOverdue} dia(s) em atraso
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CreditCard size={12} />
                            {subscription.isRecurring ? "Recorrente" : "Manual"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            {subscription.autoRenewal ? "Renovacao automatica" : "Renovacao desligada"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                              disabled={busyId === subscription.id}
                            >
                              {busyId === subscription.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <MoreHorizontal size={16} />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {subscription.status !== "active" ? (
                              <DropdownMenuItem disabled={busyId === subscription.id} onClick={() => runAction(subscription, "activate")}>
                                <Play size={14} />
                                {subscription.status === "pending" ? "Confirmar pagamento" : "Ativar"}
                              </DropdownMenuItem>
                            ) : null}
                            {subscription.status === "active" ? (
                              <DropdownMenuItem disabled={busyId === subscription.id} onClick={() => runAction(subscription, "pause")}>
                                <PauseCircle size={14} />
                                Pausar
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              disabled={busyId === subscription.id || subscription.status === "pending"}
                              onClick={() => runAction(subscription, "renew")}
                            >
                              <RefreshCw size={14} />
                              Renovar ciclo
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={busyId === subscription.id} onClick={() => runAction(subscription, "recurring")}>
                              <TimerReset size={14} />
                              Alternar recorrencia
                            </DropdownMenuItem>
                            {subscription.status === "active" && (
                              <DropdownMenuItem onClick={() => openBarberDialog(subscription)}>
                                <Scissors size={14} />
                                Trocar barbeiro
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => openPlanDialog(subscription)}
                            >
                              <CreditCard size={14} />
                              Trocar plano
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={subscription.status === "cancelled"}
                              onClick={() => runAction(subscription, "cancel")}
                            >
                              <XCircle size={14} />
                              Cancelar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > subscriptions.length ? (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Exibindo {subscriptions.length} de {total} assinaturas. Refine a busca para localizar registros fora dos primeiros 100.
          </div>
        ) : null}
      </div>

      <Dialog
        open={Boolean(barberDialogSubscription)}
        onOpenChange={(open) => {
          if (!open && !savingBarber) {
            setBarberDialogSubscription(null);
            setSelectedBarberId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar barbeiro do cliente</DialogTitle>
            <DialogDescription>
              Altere o barbeiro fixo da assinatura de {barberDialogSubscription?.user?.name ?? "este cliente"}.
              Esta acao pode ser feita pelo admin a qualquer momento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
              <p className="font-medium text-foreground">{barberDialogSubscription?.plan?.name ?? "Plano"}</p>
              <p className="text-xs text-muted-foreground">
                Atual: {barberDialogSubscription?.monthlyBarber?.displayName ?? "Sem barbeiro fixo"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Novo barbeiro fixo</Label>
              <Select value={selectedBarberId || "none"} onValueChange={(value) => setSelectedBarberId(value === "none" ? "" : value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={barbersLoading ? "Carregando barbeiros..." : "Selecionar barbeiro"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem barbeiro fixo</SelectItem>
                  {barbers.map((barber) => (
                    <SelectItem key={barber.id} value={barber.id}>
                      {barber.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingBarber}
              onClick={() => {
                setBarberDialogSubscription(null);
                setSelectedBarberId("");
              }}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={savingBarber || barbersLoading} onClick={() => void handleSaveMonthlyBarber()}>
              {savingBarber && <Loader2 size={14} className="animate-spin" />}
              Salvar barbeiro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(planDialogSubscription)}
        onOpenChange={(open) => {
          if (!open && !savingPlan) {
            setPlanDialogSubscription(null);
            setSelectedPlanId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar plano do cliente</DialogTitle>
            <DialogDescription>
              Altere o plano da assinatura de {planDialogSubscription?.user?.name ?? "este cliente"}.
              O valor mensal e os cortes do ciclo atual serao ajustados pelo novo plano.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
              <p className="font-medium text-foreground">{planDialogSubscription?.plan?.name ?? "Plano atual"}</p>
              <p className="text-xs text-muted-foreground">
                Atual: {formatCurrency(planDialogSubscription?.amount)} - {planDialogSubscription?.plan?.cutsPerMonth ?? 0} cortes/mes
              </p>
            </div>

            {planDialogSubscription?.hasPagarmeSubscription ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
                Esta assinatura possui recorrencia no Pagar.me. Cancele ou altere a cobranca externa antes de trocar o plano manualmente.
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Novo plano</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={plansLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={plansLoading ? "Carregando planos..." : "Selecionar plano"} />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {formatCurrency(plan.price)} - {plan.cutsPerMonth} cortes/mes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingPlan}
              onClick={() => {
                setPlanDialogSubscription(null);
                setSelectedPlanId("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                savingPlan ||
                plansLoading ||
                !selectedPlanId ||
                selectedPlanId === planDialogSubscription?.planId ||
                Boolean(planDialogSubscription?.hasPagarmeSubscription)
              }
              onClick={() => void handleSavePlan()}
            >
              {savingPlan && <Loader2 size={14} className="animate-spin" />}
              Salvar plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
