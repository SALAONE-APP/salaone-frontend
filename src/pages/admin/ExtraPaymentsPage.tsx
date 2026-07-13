import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar, Download, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { AppCalendar } from "@/components/AppCalendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createExtraEmployeePayment,
  listExtraEmployeePayments,
  type ExtraEmployeePayment,
} from "@/service/employeePayrollService";
import { listUsers, type UserProfile } from "@/service/userService";
import { downloadCsvReport, downloadPdfReport, type ReportColumn } from "@/utils/reportExport";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateStringToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function currentMonthRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function todayDate() {
  return toDateString(new Date());
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function maskCurrency(value: string): string {
  const digits = onlyDigits(value).slice(0, 13);
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  return `${reais.toLocaleString("pt-BR")},${String(centavos).padStart(2, "0")}`;
}

function parseCurrency(masked: string): number {
  return parseFloat(onlyDigits(masked)) / 100;
}

function getApiMessage(error: unknown) {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(data)) return data.join(" ");
  if (data && typeof data === "object") {
    const msg = (data as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel concluir a operacao.";
}

interface ExtraPaymentForm {
  employeeId: string;
  amount: string;
  date: string;
}

const emptyForm: ExtraPaymentForm = {
  employeeId: "",
  amount: "",
  date: todayDate(),
};

export function ExtraPaymentsPage() {
  const [payments, setPayments] = useState<ExtraEmployeePayment[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ExtraPaymentForm>(emptyForm);
  const [filterRange, setFilterRange] = useState<DateRange>(currentMonthRange);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listExtraEmployeePayments();
      setPayments(result);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
    listUsers({ excludeRole: "client", limit: 200 })
      .then((res) => setEmployees(res.items))
      .catch(() => {});
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    if (!filterRange?.from) return payments;
    const from = filterRange.from;
    const to = filterRange.to ?? filterRange.from;
    const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);
    return payments.filter((p) => {
      const dateRef = p.periodStart || p.createdAt;
      if (!dateRef) return false;
      const d = new Date(`${dateRef.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(d.getTime())) return false;
      return d >= fromDay && d <= toDay;
    });
  }, [payments, filterRange]);

  const stats = useMemo(() => {
    const total = payments.length;
    const totalPago = payments.reduce((s, p) => s + (p.liquido || 0), 0);
    const range = currentMonthRange();
    const thisMes = payments.filter((p) => {
      const d = new Date(`${(p.periodStart || p.createdAt).slice(0, 10)}T00:00:00`);
      return d >= range.from! && d <= range.to!;
    }).length;
    return { total, totalPago, thisMes };
  }, [payments]);

  const reportColumns: ReportColumn<ExtraEmployeePayment>[] = useMemo(() => [
    { header: "Funcionario", getValue: (payment) => payment.employeeName },
    { header: "Valor", getValue: (payment) => formatCurrency(payment.liquido), align: "right" },
    { header: "Data do pagamento", getValue: (payment) => formatDate(payment.periodStart), align: "center" },
    { header: "Registrado por", getValue: (payment) => payment.paidByName || "Admin" },
  ], []);

  const filteredTotal = useMemo(
    () => filteredPayments.reduce((sum, payment) => sum + Number(payment.liquido || 0), 0),
    [filteredPayments],
  );

  function reportPeriodLabel() {
    const from = filterRange.from ? formatDate(toDateString(filterRange.from)) : "-";
    const to = filterRange.to ? formatDate(toDateString(filterRange.to)) : from;
    return `${from} - ${to}`;
  }

  function ensureReportRows() {
    if (filteredPayments.length === 0) {
      toast.error("Nao ha registros para gerar o relatorio.");
      return false;
    }

    return true;
  }

  function handleExportPdf() {
    if (!ensureReportRows()) return;
    downloadPdfReport(
      `pagamentos-extras-${new Date().toISOString().slice(0, 10)}.pdf`,
      {
        title: "Relatorio de Pagamentos Extras",
        subtitle: `Periodo: ${reportPeriodLabel()}`,
        columns: reportColumns,
        rows: filteredPayments,
        summary: [
          ["Registros", filteredPayments.length],
          ["Total pago", formatCurrency(filteredTotal)],
        ],
      },
    );
  }

  function handleExportCsv() {
    if (!ensureReportRows()) return;
    downloadCsvReport(
      `pagamentos-extras-${new Date().toISOString().slice(0, 10)}.csv`,
      reportColumns,
      filteredPayments,
    );
  }

  function setField<K extends keyof ExtraPaymentForm>(key: K, value: ExtraPaymentForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openDialog() {
    setForm(emptyForm);
    setDialogOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const amount = parseCurrency(form.amount);
    if (!form.employeeId) { toast.error("Selecione um funcionario."); return; }
    if (isNaN(amount) || amount <= 0) { toast.error("Informe um valor valido maior que zero."); return; }
    if (!form.date) { toast.error("Informe a data do pagamento."); return; }

    setSaving(true);
    try {
      const created = await createExtraEmployeePayment({
        employeeId: form.employeeId,
        amount,
        date: form.date,
      });
      setPayments((prev) => [created, ...prev]);
      toast.success("Pagamento extra registrado com sucesso!");
      setDialogOpen(false);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Total de Registros</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.total}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Total Pago</p>
          <h3 className="text-2xl font-semibold text-emerald-600">
            {formatCurrency(stats.totalPago)}
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Registros este Mes</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.thisMes}</h3>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">Historico de Pagamentos Extras</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <AppCalendar
              mode="range"
              rangeValue={filterRange}
              onRangeChange={(range) => setFilterRange(range ?? currentMonthRange())}
              placeholder="Filtrar periodo"
              className="h-9 rounded-md text-sm sm:w-64"
            />
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPdf}>
              <Download size={14} />
              PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv}>
              <Download size={14} />
              CSV
            </Button>
            <Button size="sm" className="gap-2" onClick={openDialog}>
              <Plus size={14} />
              Registrar Pagamento Extra
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Funcionario
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Valor
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Data do pagamento
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Registrado por
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Carregando pagamentos...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum pagamento extra encontrado para o periodo selecionado.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {payment.employeeName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">
                      {formatCurrency(payment.liquido)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Calendar size={13} />
                        {formatDate(payment.periodStart)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                      {payment.paidByName || "Admin"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border p-4 text-sm text-muted-foreground">
          {filteredPayments.length} registro(s) encontrado(s)
        </div>
      </div>

      {/* Dialog de registro */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento Extra</DialogTitle>
              <DialogDescription>
                Registre um pagamento extra (bonus) para um funcionario.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ep-employee">Funcionario</Label>
                <Select
                  value={form.employeeId}
                  onValueChange={(value) => setField("employeeId", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ep-amount">Valor (R$)</Label>
                <Input
                  id="ep-amount"
                  value={form.amount}
                  onChange={(e) => setField("amount", maskCurrency(e.target.value))}
                  placeholder="0,00"
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <Label>Data do pagamento</Label>
                <AppCalendar
                  mode="single"
                  value={dateStringToDate(form.date)}
                  onChange={(date) => {
                    if (date) setField("date", toDateString(date));
                  }}
                  placeholder="Selecionar data"
                  toYear={new Date().getFullYear() + 1}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Registrar pagamento extra"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
