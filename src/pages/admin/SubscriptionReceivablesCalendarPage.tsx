import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  WalletCards,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listSubscriptions,
  type Subscription,
} from "@/service/subscriptionService";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

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

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getApiMessage(error: unknown) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(responseData)) return responseData.join(" ");
  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel carregar os recebiveis.";
}

function statusClass(status: Subscription["status"]) {
  if (status === "active") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
  if (status === "pending") return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  if (status === "paused") return "border-amber-500/20 bg-amber-500/10 text-amber-600";
  if (status === "cancelled") return "border-rose-500/20 bg-rose-500/10 text-rose-600";
  return "border-muted-foreground/20 bg-muted text-muted-foreground";
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Array<{ date: Date; inMonth: boolean }> = [];

  for (let i = firstDay.getDay(); i > 0; i -= 1) {
    days.push({ date: new Date(year, month, 1 - i), inMonth: false });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push({ date: new Date(year, month, day), inMonth: true });
  }

  while (days.length % 7 !== 0) {
    const nextDay = days.length - firstDay.getDay() + 1;
    days.push({ date: new Date(year, month, nextDay), inMonth: false });
  }

  return days;
}

export function SubscriptionReceivablesCalendarPage() {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSubscriptions({ limit: 100 });
      setSubscriptions(result.items.filter((item) => Boolean(item.nextBillingAt)));
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

    return subscriptions.filter((sub) => {
      const name = sub.user?.name?.toLowerCase() ?? "";
      const cpf = sub.user?.cpf?.replace(/\D/g, "") ?? "";
      const plan = sub.plan?.name?.toLowerCase() ?? "";
      const normalizedTerm = term.replace(/\D/g, "");

      return (
        name.includes(term) ||
        plan.includes(term) ||
        (normalizedTerm.length > 0 && cpf.includes(normalizedTerm))
      );
    });
  }, [search, subscriptions]);

  const receivablesByDay = useMemo(() => {
    const map = new Map<string, Subscription[]>();

    filteredSubscriptions.forEach((sub) => {
      if (!sub.nextBillingAt) return;
      const date = new Date(sub.nextBillingAt);
      if (Number.isNaN(date.getTime())) return;
      const key = toDateKey(date);
      const items = map.get(key) ?? [];
      items.push(sub);
      map.set(key, items);
    });

    return map;
  }, [filteredSubscriptions]);

  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
  const selectedReceivables = receivablesByDay.get(selectedDateKey) ?? [];

  const monthReceivables = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    return filteredSubscriptions.filter((sub) => {
      if (!sub.nextBillingAt) return false;
      const date = new Date(sub.nextBillingAt);
      return date.getFullYear() === year && date.getMonth() === month;
    });
  }, [filteredSubscriptions, monthDate]);

  const monthTotal = monthReceivables.reduce((sum, sub) => sum + Number(sub.amount || 0), 0);
  const activeMonthTotal = monthReceivables
    .filter((sub) => sub.status === "active")
    .reduce((sum, sub) => sum + Number(sub.amount || 0), 0);

  const upcomingReceivables = useMemo(() => {
    return [...monthReceivables]
      .sort((a, b) => {
        const aTime = a.nextBillingAt ? new Date(a.nextBillingAt).getTime() : 0;
        const bTime = b.nextBillingAt ? new Date(b.nextBillingAt).getTime() : 0;
        return aTime - bTime;
      })
      .slice(0, 8);
  }, [monthReceivables]);

  function changeMonth(offset: number) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Recebiveis no mes</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrency(monthTotal)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Recebiveis ativos</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {formatCurrency(activeMonthTotal)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Cobrancas no mes</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{monthReceivables.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-primary" />
                <h3 className="text-base font-medium text-foreground">Calendario de recebiveis</h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Datas baseadas no proximo vencimento das assinaturas.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar cliente, CPF ou plano..."
                  className="h-9 w-full pl-8 text-sm sm:w-72"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => void loadSubscriptions()}>
                <RefreshCw size={14} />
                Atualizar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border p-4">
            <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </Button>
            <h4 className="text-sm font-semibold capitalize text-foreground">{formatMonth(monthDate)}</h4>
            <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Proximo mes">
              <ChevronRight size={16} />
            </Button>
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
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
              Carregando recebiveis...
            </div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => (
                  <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}

                {calendarDays.map(({ date, inMonth }) => {
                  const key = toDateKey(date);
                  const dayReceivables = receivablesByDay.get(key) ?? [];
                  const total = dayReceivables.reduce((sum, sub) => sum + Number(sub.amount || 0), 0);
                  const isSelected = key === selectedDateKey;
                  const isToday = key === toDateKey(new Date());

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDateKey(key)}
                      className={`min-h-28 rounded-lg border p-2 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-secondary/50"
                      } ${inMonth ? "" : "opacity-45"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                            isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        {dayReceivables.length > 0 ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            {dayReceivables.length}
                          </span>
                        ) : null}
                      </div>

                      {dayReceivables.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {formatCurrency(total)}
                          </p>
                          {dayReceivables.slice(0, 2).map((sub) => (
                            <p key={sub.id} className="truncate text-xs text-muted-foreground">
                              {sub.user?.name ?? "Cliente"}
                            </p>
                          ))}
                          {dayReceivables.length > 2 ? (
                            <p className="text-xs text-muted-foreground">
                              +{dayReceivables.length - 2} recebiveis
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h3 className="text-base font-medium text-foreground">{formatDate(new Date(`${selectedDateKey}T12:00:00`))}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedReceivables.length} recebivel(is) no dia
              </p>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {selectedReceivables.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Nenhum recebivel previsto para esta data.
                </div>
              ) : (
                selectedReceivables.map((sub) => (
                  <div key={sub.id} className="border-b border-border p-4 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {sub.user?.name ?? "Cliente"}
                        </p>
                        <p className="text-xs text-muted-foreground">{sub.plan?.name ?? "Plano"}</p>
                      </div>
                      <Badge variant="outline" className={statusClass(sub.status)}>
                        {statusLabels[sub.status]}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Valor previsto</span>
                      <span className="font-semibold text-foreground">{formatCurrency(sub.amount)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <WalletCards size={18} className="text-primary" />
              <h3 className="text-base font-medium text-foreground">Proximos do mes</h3>
            </div>

            <div>
              {upcomingReceivables.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Nenhuma cobranca neste mes.
                </div>
              ) : (
                upcomingReceivables.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      if (sub.nextBillingAt) setSelectedDateKey(toDateKey(new Date(sub.nextBillingAt)));
                    }}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-secondary/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {sub.user?.name ?? "Cliente"}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(sub.nextBillingAt)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {formatCurrency(sub.amount)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
