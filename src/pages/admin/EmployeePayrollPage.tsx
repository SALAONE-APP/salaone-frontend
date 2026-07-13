import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { DateRange } from "react-day-picker";
import {
  Banknote,
  Calendar,
  CheckCircle,
  Download,
  Eye,
  Filter,
  HandCoins,
  Loader2,
  MoreHorizontal,
  ReceiptText,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { AppCalendar } from "@/components/AppCalendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmployeePayment,
  createEmployeeVale,
  getEmployeePayrollSummary,
  type EmployeePayrollRow,
  type EmployeePaymentStatus,
} from "@/service/employeePayrollService";
import {
  getPaymentFrequencySettings,
  type PaymentFrequency,
  type PaymentFrequencySettings,
} from "@/service/settingsService";
import { downloadCsvReport, downloadPdfReport, type ReportColumn } from "@/utils/reportExport";

type StatusFilter = "all" | EmployeePaymentStatus;
type RoleFilter = "all" | "admin" | "barber" | "receptionist";

const statusLabels: Record<EmployeePaymentStatus, string> = {
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago",
  empty: "Sem valor",
};

const statusStyles: Record<EmployeePaymentStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  partial: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  empty: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

const roleLabels: Record<RoleFilter, string> = {
  all: "Todas funcoes",
  admin: "Administradores",
  barber: "Barbeiros",
  receptionist: "Recepcionistas",
};

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start: toDateInput(start),
    end: toDateInput(end),
  };
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateStringToDate(value: string) {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(date);
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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const frequencyLabels: Record<PaymentFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

function frequencyToPeriod(freq: PaymentFrequency): "semanal" | "quinzenal" | "mensal" {
  if (freq === "weekly") return "semanal";
  if (freq === "biweekly") return "quinzenal";
  return "mensal";
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

export function EmployeePayrollPage() {
  const initialRange = useMemo(monthRange, []);
  const [rows, setRows] = useState<EmployeePayrollRow[]>([]);
  const [totals, setTotals] = useState({
    employees: 0,
    grossAmount: 0,
    commission: 0,
    totalVales: 0,
    netAmount: 0,
    paidAmount: 0,
    amountDue: 0,
    pending: 0,
    partial: 0,
    paid: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [periodStart, setPeriodStart] = useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = useState(initialRange.end);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<EmployeePayrollRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [valeOpen, setValeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [valeForm, setValeForm] = useState({
    valor: "",
    data: toDateInput(new Date()),
    descricao: "",
    observacao: "",
  });
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequencySettings>({
    barberPaymentFrequency: "monthly",
    employeePaymentFrequency: "monthly",
  });

  useEffect(() => {
    getPaymentFrequencySettings()
      .then(setPaymentFrequency)
      .catch(() => {});
  }, []);
  const periodStartDate = dateStringToDate(periodStart);
  const periodEndDate = dateStringToDate(periodEnd);

  function handlePeriodRangeChange(range?: DateRange) {
    if (range?.from) {
      setPeriodStart(toDateInput(range.from));
    }

    if (range?.to) {
      setPeriodEnd(toDateInput(range.to));
    }
  }

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getEmployeePayrollSummary({
        periodStart,
        periodEnd,
        role: roleFilter === "all" ? undefined : roleFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      });

      setRows(result.items);
      setTotals(result.totals);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [periodEnd, periodStart, roleFilter, statusFilter]);

  useEffect(() => {
    void loadPayroll();
  }, [loadPayroll]);

  const filteredRows = useMemo(() => {
    const term = normalizeText(search.trim());
    if (!term) return rows;

    return rows.filter((row) =>
      normalizeText(
        [
          row.employeeName,
          row.employeeEmail,
          row.roleLabel,
          row.functionType,
          statusLabels[row.status],
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(term),
    );
  }, [rows, search]);

  const reportColumns: ReportColumn<EmployeePayrollRow>[] = useMemo(() => [
    { header: "Funcionario", getValue: (row) => row.employeeName },
    { header: "Funcao", getValue: (row) => `${row.roleLabel} - ${row.functionType}` },
    {
      header: "Periodo",
      getValue: (row) => `${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}`,
    },
    { header: "Salario Fixo", getValue: (row) => formatCurrency(row.baseSalary), align: "center" },
    { header: "Comissao Avulsa", getValue: (row) => formatCurrency(row.regularCommission ?? row.commission), align: "center" },
    { header: "Comissao Avulsa Paga", getValue: (row) => formatCurrency(row.folhaPago), align: "center" },
    { header: "Vales", getValue: (row) => formatCurrency(row.totalVales), align: "center" },
    { header: "Liquido", getValue: (row) => formatCurrency(row.netAmount), align: "center" },
    { header: "Pendente", getValue: (row) => formatCurrency(row.amountDue), align: "center" },
    { header: "Status", getValue: (row) => statusLabels[row.status] },
  ], []);

  function ensureReportRows() {
    if (filteredRows.length === 0) {
      toast.error("Nao ha registros para gerar o relatorio.");
      return false;
    }

    return true;
  }

  function handleExportCsv() {
    if (!ensureReportRows()) return;
    downloadCsvReport(
      `pagamentos-funcionarios-${periodStart}-${periodEnd}.csv`,
      reportColumns,
      filteredRows,
    );
  }

  function handleExportPdf() {
    if (!ensureReportRows()) return;
    downloadPdfReport(
      `pagamentos-funcionarios-${periodStart}-${periodEnd}.pdf`,
      {
        title: "Relatorio de Pagamento de Funcionarios",
        subtitle: `Periodo: ${formatDate(periodStart)} - ${formatDate(periodEnd)}`,
        columns: reportColumns,
        rows: filteredRows,
        summary: [
          ["Comissoes avulsas", formatCurrency(totals.commission)],
          ["Vales/descontos", formatCurrency(totals.totalVales)],
          ["Valor liquido", formatCurrency(totals.netAmount)],
          ["Saldo pendente", formatCurrency(totals.amountDue)],
        ],
      },
    );
  }

  function openVale(row: EmployeePayrollRow) {
    setSelectedRow(row);
    setValeForm({
      valor: "",
      data: toDateInput(new Date()),
      descricao: "",
      observacao: "",
    });
    setValeOpen(true);
  }

  function openDetails(row: EmployeePayrollRow) {
    setSelectedRow(row);
    setDetailsOpen(true);
  }

  function openPayment(row: EmployeePayrollRow) {
    setSelectedRow(row);
    setPaymentOpen(true);
  }

  async function handleValeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRow) return;

    const amount = Number(String(valeForm.valor).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor de vale valido.");
      return;
    }

    const availableCommission = Math.max(
      Number(selectedRow.commission || 0) - Number(selectedRow.totalVales || 0),
      0,
    );

    if (amount > availableCommission) {
      toast.error(
        `O vale nao pode ultrapassar a comissao disponivel de ${formatCurrency(availableCommission)}.`,
      );
      return;
    }

    if (!valeForm.descricao.trim()) {
      toast.error("Informe a descricao ou motivo do vale.");
      return;
    }

    setSaving(true);

    try {
      await createEmployeeVale({
        employeeId: selectedRow.employeeId,
        valor: amount,
        data: valeForm.data,
        descricao: valeForm.descricao.trim(),
        observacao: valeForm.observacao.trim() || null,
        periodStart: selectedRow.periodStart,
        periodEnd: selectedRow.periodEnd,
      });
      toast.success("Vale registrado.");
      setValeOpen(false);
      await loadPayroll();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handlePaymentSubmit() {
    if (!selectedRow) return;

    setSaving(true);

    const freq = selectedRow.role === "barber"
      ? paymentFrequency.barberPaymentFrequency
      : paymentFrequency.employeePaymentFrequency;

    try {
      await createEmployeePayment({
        employeeId: selectedRow.employeeId,
        period: frequencyToPeriod(freq),
        periodStart: periodStart,
        periodEnd: periodEnd,
      });
      toast.success("Pagamento registrado.");
      setPaymentOpen(false);
      await loadPayroll();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Comissoes avulsas</p>
          <h3 className="text-2xl font-semibold text-foreground">
            {formatCurrency(totals.commission)}
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Vales/descontos</p>
          <h3 className="text-2xl font-semibold text-foreground">
            {formatCurrency(totals.totalVales)}
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Valor liquido</p>
          <h3 className="text-2xl font-semibold text-foreground">
            {formatCurrency(totals.netAmount)}
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Valor pago</p>
          <h3 className="text-2xl font-semibold text-foreground">
            {formatCurrency(totals.paidAmount)}
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Saldo pendente</p>
          <h3 className="text-2xl font-semibold text-foreground">
            {formatCurrency(totals.amountDue)}
          </h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-base font-medium text-foreground">Pagamento Funcionário</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Barbeiros: {frequencyLabels[paymentFrequency.barberPaymentFrequency]}
              {" · "}
              Outros: {frequencyLabels[paymentFrequency.employeePaymentFrequency]}
              {" · "}
              Assinaturas sao apuradas separadamente em Comissoes Plano.
            </p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar funcionario..."
                className="h-9 w-full bg-secondary pl-9 text-sm lg:w-56"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <AppCalendar
                mode="range"
                rangeValue={{ from: periodStartDate, to: periodEndDate }}
                onRangeChange={handlePeriodRangeChange}
                placeholder="Periodo"
                className="h-9 rounded-md text-sm sm:w-64"
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
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="pending">Pendentes</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="partial">Parciais</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="paid">Pagos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="empty">Sem valor</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ReceiptText size={14} />
                  Funcao
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={roleFilter}
                  onValueChange={(value) => setRoleFilter(value as RoleFilter)}
                >
                  <DropdownMenuRadioItem value="all">{roleLabels.all}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="barber">{roleLabels.barber}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="receptionist">
                    {roleLabels.receptionist}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="admin">{roleLabels.admin}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPdf}>
              <Download size={14} />
              PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv}>
              <Download size={14} />
              CSV
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
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Funcionario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Periodo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Salario Fixo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Comissao Avulsa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Comissao Avulsa Paga
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Vales
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Pendente
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
                    <td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando pagamentos de funcionarios...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum funcionario encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.employeeId}
                      className={`border-b border-border transition-colors last:border-b-0 ${
                        row.status === "paid"
                          ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                          : "hover:bg-secondary/30"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={row.photoUrl ?? undefined} alt={row.employeeName} />
                            <AvatarFallback className="bg-primary/10 text-sm text-primary">
                              {getInitials(row.employeeName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {row.employeeName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.roleLabel} - {row.functionType}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar size={14} />
                          {row.paidAt ? formatDate(row.paidAt) : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatCurrency(row.baseSalary)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {formatCurrency(row.regularCommission ?? row.commission)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-emerald-600">
                        {row.folhaPago > 0 ? formatCurrency(row.folhaPago) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {row.totalVales > 0 ? formatCurrency(row.totalVales) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">
                        {row.amountDue > 0 ? formatCurrency(row.amountDue) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2 py-0.5 text-xs ${statusStyles[row.status]}`}
                        >
                          {row.status === "paid" ? (
                            <CheckCircle size={12} className="mr-1 inline" />
                          ) : null}
                          {statusLabels[row.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 text-muted-foreground transition-colors hover:text-foreground">
                              <MoreHorizontal size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetails(row)}>
                              <Eye size={14} />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openVale(row)}>
                              <HandCoins size={14} />
                              Registrar vale
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={row.status === "paid" || row.amountDue <= 0}
                              onClick={() => openPayment(row)}
                            >
                              <Banknote size={14} />
                              Registrar pagamento
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
      </div>

      <Dialog open={valeOpen} onOpenChange={setValeOpen}>
        <DialogContent>
          <form onSubmit={handleValeSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Registrar Vale</DialogTitle>
              <DialogDescription>
                O valor sera descontado automaticamente no periodo correspondente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Funcionario selecionado</Label>
                <Input value={selectedRow?.employeeName ?? ""} disabled />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vale-valor">Valor do vale</Label>
                  <Input
                    id="vale-valor"
                    value={valeForm.valor}
                    onChange={(event) =>
                      setValeForm((current) => ({ ...current, valor: event.target.value }))
                    }
                    placeholder="0,00"
                    inputMode="decimal"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vale-data">Data</Label>
                  <Input
                    id="vale-data"
                    type="date"
                    value={valeForm.data}
                    onChange={(event) =>
                      setValeForm((current) => ({ ...current, data: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vale-descricao">Descricao/motivo</Label>
                <Input
                  id="vale-descricao"
                  value={valeForm.descricao}
                  onChange={(event) =>
                    setValeForm((current) => ({ ...current, descricao: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vale-observacao">Observacao opcional</Label>
                <Textarea
                  id="vale-observacao"
                  value={valeForm.observacao}
                  onChange={(event) =>
                    setValeForm((current) => ({ ...current, observacao: event.target.value }))
                  }
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setValeOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Confirme o pagamento de {selectedRow?.employeeName} no periodo selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 rounded-lg border border-border bg-secondary/30 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium text-foreground">
                {formatCurrency(selectedRow?.grossAmount ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vales/descontos</span>
              <span className="font-medium text-foreground">
                {formatCurrency(selectedRow?.totalVales ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor liquido</span>
              <span className="font-medium text-foreground">
                {formatCurrency(selectedRow?.netAmount ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor pago</span>
              <span className="font-medium text-foreground">
                {formatCurrency(selectedRow?.paidAmount ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo pendente</span>
              <span className="font-medium text-foreground">
                {formatCurrency(selectedRow?.amountDue ?? 0)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePaymentSubmit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do pagamento</DialogTitle>
            <DialogDescription>{selectedRow?.employeeName}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="mb-3 text-sm font-medium text-foreground">Resumo</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salario/base</span>
                  <span>{formatCurrency(selectedRow?.baseSalary ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comissoes avulsas</span>
                  <span>{formatCurrency(selectedRow?.regularCommission ?? selectedRow?.commission ?? 0)}</span>
                </div>
                {(selectedRow?.subscriptionPoolCommission ?? 0) > 0 ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pote de assinaturas</span>
                      <span>{formatCurrency(selectedRow?.subscriptionPoolCommission ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Participacao</span>
                      <span>
                        {(selectedRow?.subscriptionParticipationPercent ?? 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Atendimentos de plano</span>
                      <span>{selectedRow?.subscriptionAppointmentsCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pontos de plano</span>
                      <span>{selectedRow?.subscriptionPoints ?? 0}</span>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vales/descontos</span>
                  <span>{formatCurrency(selectedRow?.totalVales ?? 0)}</span>
                </div>
                <div className="flex justify-between font-medium text-foreground">
                  <span>Liquido</span>
                  <span>{formatCurrency(selectedRow?.netAmount ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor pago</span>
                  <span>{formatCurrency(selectedRow?.paidAmount ?? 0)}</span>
                </div>
                <div className="flex justify-between font-medium text-foreground">
                  <span>Saldo pendente</span>
                  <span>{formatCurrency(selectedRow?.amountDue ?? 0)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="mb-3 text-sm font-medium text-foreground">Vales do periodo</p>
              <div className="max-h-52 space-y-3 overflow-y-auto text-sm">
                {selectedRow?.vales.length ? (
                  selectedRow.vales.map((vale) => (
                    <div key={vale.id} className="border-b border-border pb-2 last:border-b-0">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium text-foreground">
                          {vale.descricao || vale.motivo || "Vale"}
                        </span>
                        <span>{formatCurrency(vale.valor)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(vale.data)}</p>
                      {vale.observacao ? (
                        <p className="mt-1 text-xs text-muted-foreground">{vale.observacao}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">Nenhum vale registrado.</p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">
              Historico de pagamentos
            </p>
            <div className="max-h-64 overflow-y-auto">
              {selectedRow?.paymentHistory.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Periodo
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Comissao
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Vales
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Liquido pago
                      </th>
                      <th className="py-2 pl-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Pago em
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRow.paymentHistory.map((payment) => (
                      <tr key={payment.id} className="border-b border-border last:border-b-0">
                        <td className="py-2 pr-3 text-muted-foreground">
                          {formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          {formatCurrency(payment.commission)}
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          {formatCurrency(payment.totalVales)}
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {formatCurrency(payment.netAmount ?? payment.liquido)}
                        </td>
                        <td className="py-2 pl-3 text-muted-foreground">
                          {formatDateTime(payment.paidAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum pagamento registrado para este funcionario.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
