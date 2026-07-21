import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle,
  CreditCard,
  Download,
  Filter,
  Loader2,
  MoreHorizontal,
  RefreshCcw,
  Search,
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

const statusLabels: Record<PaymentStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  paid: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
  covered: "Coberto",
};

const statusStyles: Record<PaymentStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
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
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
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

  const serviceNames = payment.appointment?.services
    ?.map((service) => service.serviceName)
    .filter(Boolean)
    .join(", ");

  return serviceNames || "Agendamento";
}

function shouldShowInPaymentsPage(payment: ApiPaymentWithType): payment is PaymentWithType {
  if (payment.paymentType === "appointment") return Boolean(payment.appointmentId);
  if (payment.paymentType === "subscription") return Boolean(payment.subscriptionId);
  return false;
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

      const visibleItems = result.items.filter(shouldShowInPaymentsPage);

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
      setSelectedLocalMethod("dinheiro");
      setLocalPaymentDialog(payment);
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
    const payment = localPaymentDialog;
    setLocalPaymentDialog(null);
    setUpdatingId(payment.id);
    try {
      await updatePayment(payment, { status: "paid", method: selectedLocalMethod });
      toast.success("Pagamento confirmado.");
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
        <DialogContent className="sm:max-w-sm">
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
          <div className="grid grid-cols-2 gap-3 py-2">
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
                onClick={() => setSelectedLocalMethod(value)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  selectedLocalMethod === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-secondary/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocalPaymentDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmLocalPayment}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
