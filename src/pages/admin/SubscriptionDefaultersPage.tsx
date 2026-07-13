import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  RefreshCw,
  Search,
  TimerReset,
  UserX,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  checkOverdueSubscriptions,
  listSubscriptions,
  renewSubscription,
  updateSubscription,
  type Subscription,
} from "@/service/subscriptionService";

const statusLabels: Record<Subscription["status"], string> = {
  active: "Ativo",
  pending: "Pendente",
  paused: "Pausado",
  cancelled: "Cancelado",
  expired: "Expirado",
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
  if (status === "pending") return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  if (status === "paused") return "border-amber-500/20 bg-amber-500/10 text-amber-600";
  if (status === "cancelled") return "border-rose-500/20 bg-rose-500/10 text-rose-600";
  if (status === "expired") return "border-muted-foreground/20 bg-muted text-muted-foreground";
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
}

function daysOverdue(sub: Subscription) {
  if (sub.daysOverdue && sub.daysOverdue > 0) return sub.daysOverdue;
  if (!sub.nextBillingAt) return 0;

  const due = new Date(sub.nextBillingAt);
  if (Number.isNaN(due.getTime())) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diff = today.getTime() - due.getTime();
  return diff > 0 ? Math.floor(diff / (24 * 60 * 60 * 1000)) : 0;
}

function isDefaulter(sub: Subscription) {
  const overdueDays = daysOverdue(sub);
  return sub.status === "paused" || sub.status === "cancelled" || sub.status === "expired" || overdueDays > 0;
}

export function SubscriptionDefaultersPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkingOverdue, setCheckingOverdue] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSubscriptions({ limit: 100 });
      setSubscriptions(result.items.filter(isDefaulter));
    } catch (err) {
      setSubscriptions([]);
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return subscriptions;
    const numericTerm = term.replace(/\D/g, "");

    return subscriptions.filter((sub) => {
      const name = sub.user?.name?.toLowerCase() ?? "";
      const email = sub.user?.email?.toLowerCase() ?? "";
      const plan = sub.plan?.name?.toLowerCase() ?? "";
      const cpf = sub.user?.cpf?.replace(/\D/g, "") ?? "";

      return (
        name.includes(term) ||
        email.includes(term) ||
        plan.includes(term) ||
        (numericTerm.length > 0 && cpf.includes(numericTerm))
      );
    });
  }, [search, subscriptions]);

  const stats = useMemo(() => {
    return filteredSubscriptions.reduce(
      (acc, sub) => {
        const amount = Number(sub.amount || 0);
        const overdue = daysOverdue(sub);
        acc.total += 1;
        acc.debt += amount;
        if (sub.status === "paused") acc.paused += 1;
        if (sub.status === "cancelled" || sub.status === "expired") acc.inactive += 1;
        if (overdue >= 5) acc.critical += 1;
        return acc;
      },
      { total: 0, paused: 0, inactive: 0, critical: 0, debt: 0 },
    );
  }, [filteredSubscriptions]);

  async function handleCheckOverdue() {
    setCheckingOverdue(true);
    try {
      const result = await checkOverdueSubscriptions();
      toast.success(result.message || "Inadimplencia atualizada.");
      await loadSubscriptions();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setCheckingOverdue(false);
    }
  }

  async function handleReactivate(sub: Subscription) {
    setBusyId(sub.id);
    try {
      await updateSubscription(sub.id, { status: "active" });
      toast.success("Assinatura reativada.");
      await loadSubscriptions();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRenew(sub: Subscription) {
    setBusyId(sub.id);
    try {
      await renewSubscription(sub.id);
      toast.success("Plano renovado.");
      await loadSubscriptions();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Clientes inadimplentes</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Valor em aberto</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">{formatCurrency(stats.debt)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Pausados por atraso</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{stats.paused}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Atraso critico</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.critical}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UserX size={18} className="text-rose-500" />
              <h3 className="text-base font-medium text-foreground">Inadimplentes</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Clientes com plano vencido, pausado, cancelado ou expirado sem renovacao.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente, CPF, email ou plano..."
                className="h-9 w-full pl-8 pr-8 text-sm sm:w-80"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCheckOverdue}
              disabled={checkingOverdue}
            >
              {checkingOverdue ? <Loader2 size={14} className="animate-spin" /> : <TimerReset size={14} />}
              Atualizar atrasos
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
                    Vencimento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Valor em aberto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando inadimplentes...
                    </td>
                  </tr>
                ) : filteredSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">
                      <WalletCards className="mx-auto mb-2 h-5 w-5" />
                      Nenhum cliente inadimplente encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredSubscriptions.map((sub) => {
                    const overdue = daysOverdue(sub);

                    return (
                      <tr
                        key={sub.id}
                        className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                      >
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {sub.user?.name ?? "-"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sub.user?.cpf ?? sub.user?.email ?? "-"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: sub.plan?.color ?? "#6366f1" }}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {sub.plan?.name ?? "-"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sub.plan?.cutsPerMonth ?? 0} cortes/mes
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                              <CalendarClock size={13} className="text-muted-foreground" />
                              {formatDate(sub.nextBillingAt)}
                            </span>
                            {overdue > 0 ? (
                              <p className="inline-flex items-center gap-1 text-xs text-destructive">
                                <AlertTriangle size={12} />
                                {overdue} dia(s) em atraso
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">Sem renovacao ativa</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">
                          {formatCurrency(sub.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={statusClass(sub.status)}>
                            {statusLabels[sub.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              disabled={busyId === sub.id}
                              onClick={() => void handleRenew(sub)}
                            >
                              {busyId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                              Renovar
                            </Button>
                            <Button
                              size="sm"
                              disabled={busyId === sub.id}
                              onClick={() => void handleReactivate(sub)}
                            >
                              Reativar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
