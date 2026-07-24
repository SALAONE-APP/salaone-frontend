import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Scissors,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMyProfessional } from "@/hooks/useMyProfessional";
import { listAppointments, type Appointment } from "@/service/appointmentService";
import {
  getMyPayrollSummary,
  type EmployeePayment,
  type EmployeePayrollRow,
} from "@/service/employeePayrollService";
import { getHomeInfo } from "@/service/homeInfoService";

/* ─── types ─── */

type PaymentFrequency = "weekly" | "biweekly" | "monthly";

/* ─── period helpers ─── */

function dateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeFrequency(raw: string | null | undefined): PaymentFrequency {
  if (raw === "weekly") return "weekly";
  if (raw === "biweekly" || raw === "quinzenal") return "biweekly";
  return "monthly";
}

function getInitialPeriodStart(frequency: PaymentFrequency): Date {
  const now = new Date();
  if (frequency === "weekly") {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  }
  if (frequency === "biweekly") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() <= 15 ? 1 : 16);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getPeriodEnd(start: Date, frequency: PaymentFrequency): Date {
  if (frequency === "weekly") {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  }
  if (frequency === "biweekly") {
    if (start.getDate() === 1) return new Date(start.getFullYear(), start.getMonth(), 15);
    return new Date(start.getFullYear(), start.getMonth() + 1, 0);
  }
  return new Date(start.getFullYear(), start.getMonth() + 1, 0);
}

function goPrevPeriod(start: Date, frequency: PaymentFrequency): Date {
  if (frequency === "weekly") {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
  }
  if (frequency === "biweekly") {
    if (start.getDate() === 1) return new Date(start.getFullYear(), start.getMonth() - 1, 16);
    return new Date(start.getFullYear(), start.getMonth(), 1);
  }
  return new Date(start.getFullYear(), start.getMonth() - 1, 1);
}

function goNextPeriod(start: Date, frequency: PaymentFrequency): Date {
  if (frequency === "weekly") {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  }
  if (frequency === "biweekly") {
    if (start.getDate() === 1) return new Date(start.getFullYear(), start.getMonth(), 16);
    return new Date(start.getFullYear(), start.getMonth() + 1, 1);
  }
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

function formatPeriodLabel(start: Date, end: Date, frequency: PaymentFrequency): string {
  if (frequency === "monthly") {
    return start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/* ─── misc helpers ─── */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatDate(isoStr: string | null | undefined): string {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
}

function formatTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function getApiMessage(error: unknown): string {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(responseData)) return responseData.join(" ");
  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return "Erro ao carregar dados.";
}

function isPaidStatus(status: string): boolean {
  return status === "confirmed" || status === "completed";
}

function isCancelledStatus(status: string): boolean {
  return status === "cancelled" || status === "no_show";
}

function statusLabel(status: string): string {
  switch (status) {
    case "scheduled":   return "Agendado";
    case "confirmed":   return "Confirmado";
    case "completed":   return "Finalizado";
    case "cancelled":   return "Cancelado";
    case "no_show":     return "Não compareceu";
    default:            return status;
  }
}

function isExtraPayment(p: EmployeePayment): boolean {
  return (
    p.periodStart === p.periodEnd &&
    Number(p.commission) === 0 &&
    Number(p.totalVales) === 0 &&
    Number(p.salarioFixo) > 0
  );
}

function roundMoney(v: number): number {
  return Math.round((v || 0) * 100) / 100;
}

function calcServicesTotal(apt: Appointment): number {
  return apt.services.reduce((sum, s) => sum + (s.totalPrice ?? 0), 0);
}

/* ─── EarningsStats ─── */

interface EarningsStats {
  // Receita e comissão dos atendimentos realizados (confirmed/completed)
  earnedRevenue: number;
  earnedCommission: number;
  // Cancelados / não compareceu
  cancelledRevenue: number;
  cancelledCommission: number;
  cancelledCount: number;
  // Contagem de atendimentos realizados
  appointmentsCount: number;
  // Status de pagamento baseado no que o admin efetuou
  adminPaidAmount: number;
  pendingPayment: number;
  // Parte da salão (receita dos realizados - comissão dos realizados)
  shopEarnings: number;
  // Percentual de comissão do profissional
  commissionPercent: number;
  commissionLabel: string;
  // Listas para exibição
  filteredAppointments: Appointment[];
  extraPayments: EmployeePayment[];
  payrollPayments: EmployeePayment[];
  extraPaymentsTotal: number;
  payrollPaymentsTotal: number;
  valesTotal: number;
  totalReceivedPayments: number;
}

/* ─── component ─── */

export function ProfessionalEarningsPage() {
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [periodStart, setPeriodStart] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [row, setRow] = useState<EmployeePayrollRow | null>(null);
  const [loading, setLoading] = useState(false);

  const { professional, loading: professionalLoading } = useMyProfessional();

  const periodEnd = getPeriodEnd(periodStart, frequency);
  const periodStartStr = dateToStr(periodStart);
  const periodEndStr = dateToStr(periodEnd);

  useEffect(() => {
    getHomeInfo()
      .then((homeInfo) => {
        const freq = normalizeFrequency(homeInfo.professional_payment_frequency);
        setFrequency(freq);
        setPeriodStart(getInitialPeriodStart(freq));
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!professional) return;
    setLoading(true);
    try {
      const [appointmentsRes, summaryRes] = await Promise.all([
        listAppointments({
          professionalId: professional.id,
          dateFrom: periodStartStr,
          dateTo: periodEndStr,
          allAppointments: true,
          limit: 100,
        }),
        getMyPayrollSummary({ periodStart: periodStartStr, periodEnd: periodEndStr }),
      ]);
      setAppointments(appointmentsRes.items);
      setRow(summaryRes.items[0] ?? null);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [professional, periodStartStr, periodEndStr]);

  useEffect(() => {
    void load();
  }, [load]);

  const isCurrentPeriod =
    dateToStr(periodStart) === dateToStr(getInitialPeriodStart(frequency));

  function prevPeriod() {
    setPeriodStart((prev) => goPrevPeriod(prev, frequency));
  }

  function nextPeriod() {
    if (isCurrentPeriod) return;
    setPeriodStart((prev) => goNextPeriod(prev, frequency));
  }

  const stats = useMemo((): EarningsStats => {
    let earnedRevenue = 0;
    let earnedCommission = 0;
    let cancelledRevenue = 0;
    let cancelledCommission = 0;
    let cancelledCount = 0;
    let appointmentsCount = 0;

    for (const apt of appointments) {
      const total = calcServicesTotal(apt);
      const commission = apt.commissionAmount ?? 0;

      if (isPaidStatus(apt.status)) {
        // Atendimento realizado (confirmado/finalizado) → entra nos ganhos do profissional
        earnedRevenue += total;
        earnedCommission += commission;
        appointmentsCount++;
      } else if (isCancelledStatus(apt.status)) {
        // Cancelado / não compareceu → prejuízo
        cancelledRevenue += total;
        cancelledCommission += commission;
        cancelledCount++;
      }
      // "scheduled" (agendados futuros) não entram em nenhum cálculo de ganhos
    }

    const allPayments: EmployeePayment[] = row?.payments ?? [];
    const extraPayments = allPayments.filter(isExtraPayment);
    const payrollPayments = allPayments.filter((p) => !isExtraPayment(p));
    const extraPaymentsTotal = roundMoney(
      extraPayments.reduce((sum, p) => sum + Number(p.liquido || 0), 0)
    );
    const payrollPaymentsTotal = roundMoney(
      payrollPayments.reduce((sum, p) => sum + Number(p.liquido || 0), 0)
    );
    const valesTotal = roundMoney(Number(row?.totalVales || 0));
    const totalReceivedPayments = roundMoney(
      extraPaymentsTotal + payrollPaymentsTotal + valesTotal
    );
    // Vales são adiantamentos já recebidos pelo profissional e também quitam comissão.
    const adminPaidAmount = roundMoney(payrollPaymentsTotal + valesTotal);

    if (row) {
      earnedRevenue = Number(row.totalRevenue || earnedRevenue);
      earnedCommission = Number(row.commission || earnedCommission);
      appointmentsCount = Number(row.appointmentsCount || appointmentsCount);
    }

    // Pendente = comissão ganha que o admin ainda não pagou via folha
    const pendingPayment = roundMoney(
      Math.max(roundMoney(earnedCommission) - adminPaidAmount, 0)
    );

    const shopEarnings = roundMoney(
      row ? Number(row.salonShare || 0) : Math.max(earnedRevenue - earnedCommission, 0)
    );
    const commissionPercent = professional?.commissionPercent ?? 50;
    const hasSubscriptionPool = Number(row?.subscriptionPoolCommission || 0) > 0;
    const commissionLabel = hasSubscriptionPool
      ? `Seus Ganhos (${Number(row?.subscriptionParticipationPercent || 0).toFixed(2)}% do pote)`
      : `Seus Ganhos (${commissionPercent}%)`;

    // Tabela: exibe atendimentos realizados e cancelados (não exibe agendados futuros)
    const filteredAppointments = [...appointments]
      .filter((apt) => isPaidStatus(apt.status) || isCancelledStatus(apt.status))
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

    return {
      earnedRevenue: roundMoney(earnedRevenue),
      earnedCommission: roundMoney(earnedCommission),
      cancelledRevenue: roundMoney(cancelledRevenue),
      cancelledCommission: roundMoney(cancelledCommission),
      cancelledCount,
      appointmentsCount,
      adminPaidAmount,
      pendingPayment,
      shopEarnings,
      commissionPercent,
      commissionLabel,
      filteredAppointments,
      extraPayments,
      payrollPayments,
      extraPaymentsTotal,
      payrollPaymentsTotal,
      valesTotal,
      totalReceivedPayments,
    };
  }, [appointments, row, professional]);

  const hasData =
    stats.appointmentsCount > 0 ||
    stats.cancelledCount > 0 ||
    stats.extraPayments.length > 0 ||
    stats.payrollPayments.length > 0 ||
    (row?.vales?.length ?? 0) > 0;

  const isPageLoading = professionalLoading || loading;

  return (
    <div className="space-y-6">
      {/* Navegação de período */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
        <div>
          <p className="text-sm text-muted-foreground">Período</p>
          <p className="text-lg font-semibold text-foreground">
            {formatPeriodLabel(periodStart, periodEnd, frequency)}
          </p>
          <p className="text-xs text-muted-foreground">
            {periodStartStr.split("-").reverse().join("/")} a{" "}
            {periodEndStr.split("-").reverse().join("/")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevPeriod}>
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={nextPeriod}
            disabled={isCurrentPeriod}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {isPageLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : !hasData ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum dado encontrado para este período.
        </div>
      ) : (
        <>
          {/* 5 cards de resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="mt-1 text-xl font-bold text-red-500">
                {formatCurrency(stats.pendingPayment)}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="mt-1 text-xl font-bold text-emerald-500">
                {formatCurrency(stats.adminPaidAmount)}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Ganhos</p>
              <p className="mt-1 text-xl font-bold text-primary">
                {formatCurrency(stats.earnedCommission)}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Cancelados</p>
              <p className="mt-1 text-xl font-bold text-amber-500">
                {formatCurrency(stats.cancelledRevenue)}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Salão</p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {formatCurrency(stats.shopEarnings)}
              </p>
            </div>
          </div>

          {/* Card de estatísticas do profissional */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4 border-b border-border px-5 py-4">
              {professional?.photoUrl ? (
                <img
                  src={professional.photoUrl}
                  alt={professional.displayName}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <User size={20} className="text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-semibold text-foreground">{professional?.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  {professional?.specialty ?? "Profissional"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-4">
              {(
                [
                  {
                    label: "Atendimentos",
                    value: String(stats.appointmentsCount),
                  },
                  {
                    label: "Faturamento Total",
                    value: formatCurrency(stats.earnedRevenue),
                  },
                  {
                    label: stats.commissionLabel,
                    value: formatCurrency(stats.earnedCommission),
                    highlight: true,
                  },
                  {
                    label: "Pendente (a receber)",
                    value: formatCurrency(stats.pendingPayment),
                    warning: true,
                  },
                  {
                    label: "Pag. extras",
                    value: formatCurrency(stats.extraPaymentsTotal),
                  },
                  {
                    label: "Folha recebida",
                    value: formatCurrency(stats.payrollPaymentsTotal),
                  },
                  {
                    label: "Vales recebidos",
                    value: formatCurrency(stats.valesTotal),
                  },
                  {
                    label: "Salão",
                    value: formatCurrency(stats.shopEarnings),
                  },
                  {
                    label: "Total recebido",
                    value: formatCurrency(stats.totalReceivedPayments),
                    bold: true,
                  },
                ] as Array<{
                  label: string;
                  value: string;
                  highlight?: boolean;
                  bold?: boolean;
                  warning?: boolean;
                }>
              ).map(({ label, value, highlight, bold, warning }) => (
                <div key={label} className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p
                    className={`mt-0.5 text-sm font-semibold ${
                      highlight
                        ? "text-emerald-500"
                        : warning
                          ? "text-red-500"
                          : bold
                            ? "text-primary"
                            : "text-foreground"
                    }`}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela de atendimentos realizados e cancelados */}
          {stats.filteredAppointments.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <Scissors size={18} className="text-primary" />
                  <h3 className="text-base font-semibold text-foreground">
                    Atendimentos do período
                  </h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Cliente</th>
                      <th className="px-4 py-3 text-left font-medium">Data</th>
                      <th className="px-4 py-3 text-left font-medium">Horário</th>
                      <th className="px-4 py-3 text-left font-medium">Serviços</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                      <th className="px-4 py-3 text-right font-medium">Seus Ganhos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.filteredAppointments.map((apt) => {
                      const aptTotal = calcServicesTotal(apt);
                      const commission = apt.commissionAmount ?? 0;
                      const paid = isPaidStatus(apt.status);
                      const cancelled = isCancelledStatus(apt.status);
                      const serviceNames = apt.services.map((s) => s.serviceName).join(", ");

                      return (
                        <tr
                          key={apt.id}
                          className={`transition-colors hover:bg-muted/40 ${cancelled ? "opacity-60" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <Badge
                              variant={paid ? "default" : "secondary"}
                              className={
                                paid
                                  ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0"
                                  : cancelled
                                    ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-0"
                                    : ""
                              }
                            >
                              {statusLabel(apt.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {apt.client?.name ?? apt.dependent?.name ?? "Cliente"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(apt.startAt)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatTime(apt.startAt)}
                          </td>
                          <td
                            className="max-w-[180px] truncate px-4 py-3 text-muted-foreground"
                            title={serviceNames}
                          >
                            {serviceNames || "-"}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-medium ${
                              cancelled ? "text-amber-500 line-through" : "text-foreground"
                            }`}
                          >
                            {formatCurrency(aptTotal)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${
                              cancelled
                                ? "text-muted-foreground"
                                : paid
                                  ? "text-emerald-500"
                                  : "text-red-500"
                            }`}
                          >
                            {cancelled ? "-" : formatCurrency(commission)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* Tabela de pagamentos extras */}
          {stats.extraPayments.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <Wallet size={18} className="text-primary" />
                  <h3 className="text-base font-semibold text-foreground">
                    Pagamentos extras do período
                  </h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium">Tipo</th>
                      <th className="px-4 py-3 text-left font-medium">Data</th>
                      <th className="px-4 py-3 text-right font-medium">Valor</th>
                      <th className="px-4 py-3 text-left font-medium">Registrado por</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.extraPayments.map((payment) => (
                      <tr key={payment.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium text-foreground">
                          Pagamento Extra
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(payment.paidAt || payment.periodStart)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-500">
                          {formatCurrency(Number(payment.liquido || 0))}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {payment.paidByName ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabela de vales recebidos */}
          {(row?.vales?.length ?? 0) > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <Wallet size={18} className="text-primary" />
                  <h3 className="text-base font-semibold text-foreground">
                    Vales recebidos no período
                  </h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium">Data</th>
                      <th className="px-4 py-3 text-left font-medium">Descrição</th>
                      <th className="px-4 py-3 text-left font-medium">Observação</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Valor recebido
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...(row?.vales ?? [])]
                      .sort(
                        (a, b) =>
                          new Date(b.data).getTime() - new Date(a.data).getTime()
                      )
                      .map((vale) => (
                        <tr key={vale.id} className="transition-colors hover:bg-muted/40">
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(vale.data)}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {vale.descricao || vale.motivo || "Vale"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {vale.observacao || "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-500">
                            {formatCurrency(Number(vale.valor || 0))}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabela de pagamentos de folha */}
          {stats.payrollPayments.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-primary" />
                  <h3 className="text-base font-semibold text-foreground">
                    Pagamentos de folha do período
                  </h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium">Data Pgto.</th>
                      <th className="px-4 py-3 text-left font-medium">Período</th>
                      <th className="px-4 py-3 text-right font-medium">Salário</th>
                      <th className="px-4 py-3 text-right font-medium">Comissão</th>
                      <th className="px-4 py-3 text-right font-medium">Vales</th>
                      <th className="px-4 py-3 text-right font-medium">Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...stats.payrollPayments]
                      .sort(
                        (a, b) =>
                          new Date(b.paidAt ?? 0).getTime() -
                          new Date(a.paidAt ?? 0).getTime()
                      )
                      .map((payment) => (
                        <tr key={payment.id} className="transition-colors hover:bg-muted/40">
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(payment.paidAt)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {payment.periodStart?.split("-").reverse().join("/")}{" "}
                            →{" "}
                            {payment.periodEnd?.split("-").reverse().join("/")}
                          </td>
                          <td className="px-4 py-3 text-right text-foreground">
                            {formatCurrency(Number(payment.salarioFixo || 0))}
                          </td>
                          <td className="px-4 py-3 text-right text-foreground">
                            {formatCurrency(Number(payment.commission || 0))}
                          </td>
                          <td className="px-4 py-3 text-right text-destructive">
                            − {formatCurrency(Number(payment.totalVales || 0))}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-500">
                            {formatCurrency(Number(payment.liquido || 0))}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
