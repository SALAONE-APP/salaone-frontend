import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle,
  CreditCard,
  Download,
  Filter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useTableSelection } from "@/hooks/useTableSelection";
import {
  listAllPayments,
  splitPayment,
  updatePayment,
  type PaymentMethod,
  type PaymentRecord,
  type PaymentStatus,
  type PaymentSummary,
  type PaymentType,
} from "@/service/paymentService";

type PaymentWithType = PaymentRecord & { paymentType: PaymentType };
type ApiPaymentWithType = PaymentRecord & { paymentType: PaymentType | "extra" };
type StatusFilter = "all" | PaymentStatus;
type TypeFilter = "all" | PaymentType;
type SplitMethod = "pix" | "debito" | "credito" | "dinheiro";
type SplitPart = { method: SplitMethod; amount: string };

const statusLabels: Record<PaymentStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  paid: "Pago",
  failed: "Falhou",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  covered: "Coberto",
};

const statusStyles: Record<PaymentStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  cancelled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  refunded: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  covered: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

const methodLabels: Record<PaymentMethod, string> = {
  credito: "Credito",
  debito: "Debito",
  dinheiro: "Dinheiro",
  local: "No local",
  pix: "PIX",
  subscription: "Assinatura",
};

const typeLabels: Record<PaymentType, string> = {
  appointment: "Agendamento",
  subscription: "Assinatura",
  service_tab: "Comanda",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function parseCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

function getPaymentDescription(payment: PaymentWithType) {
  if (payment.paymentType === "subscription") {
    return payment.subscription?.plan?.name || "Assinatura";
  }
  if (payment.paymentType === "service_tab") {
    return `Comanda #${payment.serviceTab?.code || payment.id.slice(0, 8).toUpperCase()}`;
  }

  const serviceNames = payment.appointment?.services
    ?.map((service) => service.serviceName)
    .filter(Boolean)
    .join(", ");

  return serviceNames || "Agendamento";
}

function shouldShowInPaymentsPage(payment: ApiPaymentWithType): payment is PaymentWithType {
  if (payment.paymentType === "appointment") return Boolean(payment.appointmentId);
  if (payment.paymentType === "subscription") return Boolean(payment.subscriptionId);
  if (payment.paymentType === "service_tab") return Boolean(payment.serviceTab?.id);
  return false;
}

function normalizeCancelledAppointmentPayment(payment: ApiPaymentWithType): ApiPaymentWithType {
  if (payment.paymentType === "appointment" && payment.appointment?.status === "cancelled") {
    return { ...payment, status: "cancelled" };
  }

  return payment;
}

function downloadCsv(payments: PaymentWithType[]) {
  const header = ["ID", "Cliente", "Tipo", "Descricao", "Valor", "Metodo", "Status", "Data"];
  const rows = payments.map((payment) => [
    payment.id,
    payment.user?.name || "",
    typeLabels[payment.paymentType],
    getPaymentDescription(payment),
    String(payment.amount).replace(".", ","),
    methodLabels[payment.method] || payment.method,
    statusLabels[payment.status] || payment.status,
    formatDateTime(payment.paidAt || payment.createdAt),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "pagamentos.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithType[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localPaymentDialog, setLocalPaymentDialog] = useState<PaymentWithType | null>(null);
  const [selectedLocalMethod, setSelectedLocalMethod] = useState<PaymentMethod>("dinheiro");
  const [splitParts, setSplitParts] = useState<SplitPart[]>([]);
  const [adjustedAmount, setAdjustedAmount] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [methodPaymentDialog, setMethodPaymentDialog] = useState<PaymentWithType | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("dinheiro");

  const limit = 20;

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listAllPayments({
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit,
      });

      const visibleItems = result.items
        .map(normalizeCancelledAppointmentPayment)
        .filter(shouldShowInPaymentsPage);

      setPayments(visibleItems);
      setTotal(result.total);
      if (result.summary) setSummary(result.summary);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    const term = normalizeText(search.trim());

    return payments.filter((payment) => {
      if (typeFilter !== "all" && payment.paymentType !== typeFilter) return false;
      if (!term) return true;

      const haystack = normalizeText(
        [
          payment.id,
          payment.user?.name,
          payment.user?.email,
          getPaymentDescription(payment),
          payment.appointment?.professional?.displayName,
          methodLabels[payment.method],
          statusLabels[payment.status],
        ]
          .filter(Boolean)
          .join(" "),
      );

      return haystack.includes(term);
    });
  }, [payments, search, typeFilter]);

  const { selectedRows, toggleRow, toggleAll } = useTableSelection(
    filteredPayments.map((payment) => payment.id),
  );

  // Usa o summary da API (todos os pagamentos) quando disponível;
  // cai no cálculo local (página atual) como fallback.
  const stats = useMemo(() => {
    if (summary) {
      return {
        paid: summary.paid,
        today: summary.today,
        pending: summary.pending,
        refunded: summary.refunded,
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    return {
      paid: payments
        .filter((p) => p.status === "paid" || p.status === "approved")
        .reduce((sum, p) => sum + p.amount, 0),
      today: payments
        .filter(
          (p) =>
            (p.paidAt || p.createdAt)?.slice(0, 10) === today &&
            (p.status === "paid" || p.status === "approved"),
        )
        .reduce((sum, p) => sum + p.amount, 0),
      pending: payments
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + p.amount, 0),
      refunded: payments
        .filter((p) => p.status === "refunded")
        .reduce((sum, p) => sum + p.amount, 0),
    };
  }, [summary, payments]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  async function changePaymentStatus(payment: PaymentWithType, status: PaymentStatus) {
    if (status === "paid" && payment.method === "local") {
      openLocalPaymentDialog(payment);
      return;
    }

    setUpdatingId(payment.id);
    try {
      await updatePayment(payment, { status });
      toast.success("Pagamento atualizado.");
      await loadPayments();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setUpdatingId(null);
    }
  }

  async function confirmLocalPayment() {
    if (!localPaymentDialog) return;
    const finalAmount = parseCurrencyInput(adjustedAmount);
    if (!(finalAmount > 0)) {
      toast.error("Informe um valor final maior que zero.");
      return;
    }
    const payment = localPaymentDialog;
    setLocalPaymentDialog(null);
    setUpdatingId(payment.id);
    try {
      await updatePayment(payment, {
        status: "paid",
        method: selectedLocalMethod,
        amount: finalAmount,
        discountAmount: Math.max(0, payment.amount - finalAmount),
      });
      toast.success("Pagamento confirmado.");
      await loadPayments();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setUpdatingId(null);
    }
  }

  function openLocalPaymentDialog(payment: PaymentWithType) {
    setSelectedLocalMethod("dinheiro");
    setSplitParts([{ method: "dinheiro", amount: payment.amount.toFixed(2) }]);
    setAdjustedAmount(formatCurrency(payment.amount));
    setDiscountInput(formatCurrency(0));
    setLocalPaymentDialog(payment);
  }

  const splitTotal = splitParts.reduce((sum, part) => sum + (Number(part.amount.replace(",", ".")) || 0), 0);
  const finalAmount = parseCurrencyInput(adjustedAmount);
  const discountAmount = Math.max(0, (localPaymentDialog?.amount ?? 0) - finalAmount);
  const splitDifference = finalAmount - splitTotal;

  function changeFinalAmount(value: string, syncDiscount = true) {
    const nextTotal = parseCurrencyInput(value);
    setAdjustedAmount(formatCurrency(nextTotal));
    if (syncDiscount && localPaymentDialog) setDiscountInput(formatCurrency(Math.max(0, localPaymentDialog.amount - nextTotal)));
    setSplitParts((parts) => {
      if (parts.length === 1) return [{ ...parts[0], amount: nextTotal.toFixed(2) }];
      const previousTotal = parts.slice(0, -1).reduce((sum, part) => sum + (Number(part.amount.replace(",", ".")) || 0), 0);
      return parts.map((part, index) => index === parts.length - 1 ? { ...part, amount: Math.max(0, nextTotal - previousTotal).toFixed(2) } : part);
    });
  }

  function changeDiscount(value: string) {
    const discount = parseCurrencyInput(value);
    setDiscountInput(formatCurrency(discount));
    if (!localPaymentDialog) return;
    changeFinalAmount(Math.max(0, localPaymentDialog.amount - discount).toFixed(2), false);
  }

  async function confirmSplitPayment() {
    if (!localPaymentDialog) return;
    if (splitParts.length < 2 || splitParts.some((part) => !(Number(part.amount.replace(",", ".")) > 0))) {
      toast.error("Informe ao menos duas partes com valores maiores que zero.");
      return;
    }
    if (Math.abs(splitDifference) > 0.005) {
      toast.error("A soma das partes deve ser igual ao valor do pagamento.");
      return;
    }
    const payment = localPaymentDialog;
    setLocalPaymentDialog(null);
    setUpdatingId(payment.id);
    try {
      await splitPayment(payment.id, splitParts.map((part) => ({
        method: part.method,
        amount: Number(part.amount.replace(",", ".")),
      })), finalAmount, discountAmount);
      toast.success("Pagamento dividido confirmado.");
      await loadPayments();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setUpdatingId(null);
    }
  }

  function openMethodDialog(payment: PaymentWithType) {
    setSelectedPaymentMethod(payment.method);
    setMethodPaymentDialog(payment);
  }

  async function confirmPaymentMethod() {
    if (!methodPaymentDialog || selectedPaymentMethod === methodPaymentDialog.method) {
      setMethodPaymentDialog(null);
      return;
    }

    const payment = methodPaymentDialog;
    setMethodPaymentDialog(null);
    setUpdatingId(payment.id);
    try {
      await updatePayment(payment, { method: selectedPaymentMethod });
      toast.success("Método de pagamento atualizado.");
      await loadPayments();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Recebido</p>
          <h3 className="text-2xl font-semibold text-foreground">{formatCurrency(stats.paid)}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Hoje</p>
          <h3 className="text-2xl font-semibold text-foreground">{formatCurrency(stats.today)}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Pendentes</p>
          <h3 className="text-2xl font-semibold text-foreground">{formatCurrency(stats.pending)}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Reembolsado</p>
          <h3 className="text-2xl font-semibold text-foreground">{formatCurrency(stats.refunded)}</h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">Todos Pagamentos</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar pagamentos..."
                className="h-9 w-full bg-secondary pl-9 text-sm sm:w-56"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter size={14} />
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as StatusFilter);
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="pending">Pendentes</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="approved">Aprovados</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="paid">Pagos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="failed">Falharam</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="cancelled">Cancelados</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="refunded">Reembolsados</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="covered">Cobertos</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CreditCard size={14} />
                  Tipo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={typeFilter}
                  onValueChange={(value) => setTypeFilter(value as TypeFilter)}
                >
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="appointment">Agendamentos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="subscription">Assinaturas</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="service_tab">Comandas</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => downloadCsv(filteredPayments)}
              disabled={filteredPayments.length === 0}
            >
              <Download size={14} />
              Exportar
            </Button>
          </div>
        </div>

        {error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-10 p-4">
                    <Checkbox
                      checked={
                        selectedRows.length === filteredPayments.length &&
                        filteredPayments.length > 0
                      }
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Origem
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Metodo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando pagamentos...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum pagamento encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                    >
                      <td className="p-4">
                        <Checkbox
                          checked={selectedRows.includes(payment.id)}
                          onCheckedChange={() => toggleRow(payment.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {payment.user?.name || "Cliente"}
                          </p>
                          <p className="text-xs text-muted-foreground">#{payment.id.slice(0, 8)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {getPaymentDescription(payment)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {typeLabels[payment.paymentType]}
                            {payment.appointment?.professional?.displayName
                              ? ` - ${payment.appointment.professional.displayName}`
                              : ""}
                          </p>
                          {payment.paymentType === "service_tab" && payment.serviceTab?.items.length ? (
                            <div className="mt-2 space-y-1 rounded-md border bg-secondary/30 p-2">
                              {payment.serviceTab.items.map((item) => (
                                <div key={item.id} className="flex justify-between gap-3 text-xs">
                                  <span>{item.quantity}× {item.name}</span>
                                  <span className="whitespace-nowrap font-medium">{formatCurrency(item.total)}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <CreditCard size={14} className="text-muted-foreground" />
                          {methodLabels[payment.method] || payment.method}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar size={14} />
                          {formatDateTime(payment.paidAt || payment.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2 py-0.5 text-xs ${statusStyles[payment.status]}`}
                        >
                          {(payment.status === "paid" || payment.status === "approved") && (
                            <CheckCircle size={12} className="mr-1 inline" />
                          )}
                          {statusLabels[payment.status] || payment.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                              disabled={updatingId === payment.id}
                            >
                              {updatingId === payment.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <MoreHorizontal size={16} />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openMethodDialog(payment)}>
                              <Pencil size={14} />
                              Alterar método de pagamento
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={payment.status === "paid"}
                              onClick={() => changePaymentStatus(payment, "paid")}
                            >
                              <CheckCircle size={14} />
                              Marcar como pago
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={payment.status === "pending"}
                              onClick={() => changePaymentStatus(payment, "pending")}
                            >
                              <RefreshCcw size={14} />
                              Marcar pendente
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={payment.status === "failed"}
                              onClick={() => changePaymentStatus(payment, "failed")}
                            >
                              <XCircle size={14} />
                              Marcar falha
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={payment.status === "refunded"}
                              onClick={() => changePaymentStatus(payment, "refunded")}
                            >
                              <RefreshCcw size={14} />
                              Marcar reembolso
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

        <div className="flex flex-col gap-3 border-t border-border p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Pagina {page} de {totalPages} - {total} pagamentos
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Proxima
            </Button>
          </div>
        </div>
      </div>
      <Dialog open={Boolean(localPaymentDialog)} onOpenChange={(open) => { if (!open) setLocalPaymentDialog(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Como foi realizado o pagamento?</DialogTitle>
            <DialogDescription>
              Selecione a forma de pagamento usada no local para{" "}
              <span className="font-medium text-foreground">
                {localPaymentDialog?.user?.name ?? "este cliente"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor original</span>
              <span className="font-medium">{formatCurrency(localPaymentDialog?.amount ?? 0)}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Desconto</label>
                <Input className="min-w-0 w-full" inputMode="numeric" value={discountInput} onChange={(event) => changeDiscount(event.target.value)} />
              </div>
              <div className="min-w-0 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Valor final</label>
                <Input className="min-w-0 w-full" inputMode="numeric" value={adjustedAmount} onChange={(event) => changeFinalAmount(event.target.value)} />
              </div>
            </div>
            {finalAmount > (localPaymentDialog?.amount ?? 0) && <p className="mt-2 text-xs text-amber-600">Acréscimo de {formatCurrency(finalAmount - (localPaymentDialog?.amount ?? 0))}</p>}
          </div>
          {splitParts.length === 1 ? <div className="grid grid-cols-2 gap-3 py-2">
            {(
              [
                { value: "dinheiro", label: "Dinheiro" },
                { value: "pix", label: "PIX" },
                { value: "credito", label: "Cartão Crédito" },
                { value: "debito", label: "Cartão Débito" },
              ] as { value: PaymentMethod; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSelectedLocalMethod(value);
                  setSplitParts((parts) => [{ ...parts[0], method: value as SplitMethod }]);
                }}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  selectedLocalMethod === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-secondary/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div> : (
            <div className="min-w-0 space-y-3 py-2">
              {splitParts.map((part, index) => (
                <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                  <div className="min-w-0 space-y-1">
                    <label className="text-xs text-muted-foreground">Forma</label>
                    <select
                      value={part.method}
                      onChange={(event) => setSplitParts((parts) => parts.map((item, itemIndex) => itemIndex === index ? { ...item, method: event.target.value as SplitMethod } : item))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="dinheiro">Dinheiro</option><option value="pix">PIX</option>
                      <option value="credito">Crédito</option><option value="debito">Débito</option>
                    </select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <label className="text-xs text-muted-foreground">Valor</label>
                    <Input
                      className="min-w-0 w-full"
                      inputMode="decimal"
                      value={part.amount}
                      onChange={(event) => setSplitParts((parts) => parts.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" disabled={splitParts.length <= 2} onClick={() => setSplitParts((parts) => parts.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setSplitParts((parts) => [...parts, { method: "pix", amount: "" }])}>
                <Plus size={15} className="mr-1" /> Adicionar forma
              </Button>
              <div className="rounded-md bg-secondary/50 p-3 text-sm">
                <div className="flex justify-between"><span>Total informado</span><strong>{formatCurrency(splitTotal)}</strong></div>
                <div className={`mt-1 flex justify-between ${Math.abs(splitDifference) <= 0.005 ? "text-emerald-600" : "text-amber-600"}`}>
                  <span>{splitDifference >= 0 ? "Falta" : "Excedente"}</span><strong>{formatCurrency(Math.abs(splitDifference))}</strong>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setLocalPaymentDialog(null)}>
              Cancelar
            </Button>
            {splitParts.length === 1 && (
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => {
                const half = finalAmount / 2;
                setSplitParts([{ method: selectedLocalMethod as SplitMethod, amount: half.toFixed(2) }, { method: "pix", amount: (finalAmount - half).toFixed(2) }]);
              }}>Dividir pagamento</Button>
            )}
            <Button className="w-full sm:w-auto" onClick={splitParts.length > 1 ? confirmSplitPayment : confirmLocalPayment}>
              {splitParts.length > 1 ? "Confirmar divisão" : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(methodPaymentDialog)}
        onOpenChange={(open) => { if (!open) setMethodPaymentDialog(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar método de pagamento</DialogTitle>
            <DialogDescription>
              Selecione o novo método para o pagamento de{" "}
              <span className="font-medium text-foreground">
                {methodPaymentDialog?.user?.name ?? "este cliente"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {(Object.entries(methodLabels) as [PaymentMethod, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedPaymentMethod(value)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  selectedPaymentMethod === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-secondary/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMethodPaymentDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmPaymentMethod}
              disabled={selectedPaymentMethod === methodPaymentDialog?.method}
            >
              Salvar método
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
