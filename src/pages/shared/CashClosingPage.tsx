import { useCallback, useEffect, useMemo, useState } from "react";
import { BanknoteArrowDown, CheckCircle, CreditCard, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  createCashClosing,
  getCashClosingPreview,
  getCashClosingReport,
  listCashClosings,
  type CashClosing,
  type CashClosingPayment,
  type CashClosingSummary,
} from "@/service/cashClosingService";
import {
  createCashOut,
  createManualSubscriptionPayment,
  type CashOutCategory,
  type PaymentMethod,
} from "@/service/paymentService";
import { listSubscriptions, type Subscription } from "@/service/subscriptionService";
import { downloadPdfReport, type ReportColumn } from "@/utils/reportExport";

type OpenCashSession = {
  openedAt: string;
  openedBy: string;
  openedByName: string;
};

const openCashSessionKey = "cashClosing:openSession";

const methodLabels: Record<PaymentMethod, string> = {
  credito: "Credito",
  debito: "Debito",
  dinheiro: "Dinheiro",
  local: "No local",
  pix: "PIX",
  subscription: "Assinatura",
};

const manualSubscriptionMethods: Array<Exclude<PaymentMethod, "subscription">> = [
  "dinheiro",
  "pix",
  "debito",
  "credito",
  "local",
];

const cashOutCategoryLabels: Record<CashOutCategory, string> = {
  employees: "Funcionarios",
  other: "Outros",
  products: "Produtos",
  refunds: "Estornos",
};

const cashOutCategories: CashOutCategory[] = ["products", "employees", "refunds", "other"];

function toDateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function toDateInputValue(date: Date) {
  return toDateTimeLocalValue(date).slice(0, 10);
}

function currentMonthRange() {
  const now = new Date();
  return {
    start: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function dateInputToLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function isCurrentMonthRange(start: string, end: string) {
  const current = currentMonthRange();
  return start === current.start && end === current.end;
}

function formatReportRangeLabel(startDate: string, endDate: string) {
  const start = startDate ? formatReportDateTime(startOfLocalDay(dateInputToLocalDate(startDate)).toISOString()) : "-";
  const end = endDate ? formatReportDateTime(endOfLocalDay(dateInputToLocalDate(endDate)).toISOString()) : "-";
  return `${start} ate ${end}`;
}

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

function formatReportDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getStoredOpenCashSession() {
  const storedSession = localStorage.getItem(openCashSessionKey);

  if (!storedSession) return null;

  try {
    return JSON.parse(storedSession) as OpenCashSession;
  } catch {
    localStorage.removeItem(openCashSessionKey);
    return null;
  }
}

function getCashPaymentDescription(payment: CashClosingPayment) {
  if (payment.type === "cash_out") {
    const label = cashOutCategoryLabels[payment.cashOutCategory as CashOutCategory] || "Saida de caixa";
    const description = getValidCashOutDescription(payment);
    return description ? `Saida: ${label} - ${description}` : `Saida: ${label}`;
  }
  if (payment.type === "subscription") return payment.subscriptionPlanName || "Assinatura";
  if (payment.type === "extra") return "Pagamento extra";
  return "Agendamento";
}

function getValidCashOutDescription(payment: CashClosingPayment) {
  if (payment.type !== "cash_out") return payment.description || "";

  const description = String(payment.description || "").trim();
  if (!description) return getDefaultCashOutDescription(payment);

  const normalized = normalizeText(description);
  if (normalized === "agua" || normalized === "aguas") return getDefaultCashOutDescription(payment);

  return description;
}

function getDefaultCashOutDescription(payment: CashClosingPayment) {
  if (payment.cashOutCategory === "products") return "compra de produtos";
  if (payment.cashOutCategory === "employees") return "pagamento de funcionarios";
  if (payment.cashOutCategory === "refunds") return "estorno";
  return "";
}

function reportTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function closingMatchesSearch(closing: CashClosing, search: string) {
  const term = normalizeText(search.trim());
  if (!term) return true;

  const haystack = normalizeText(
    [
      closing.id,
      closing.closedByName,
      closing.closedBy,
      formatCurrency(closing.totalAmount),
      formatDateTime(closing.closedAt),
      formatDateTime(closing.periodStart),
      formatDateTime(closing.periodEnd),
      String(closing.paymentCount),
    ]
      .filter(Boolean)
      .join(" "),
  );

  return haystack.includes(term);
}

function getCashPaymentClientLabel(payment: CashClosingPayment) {
  if (payment.type === "cash_out") return "Saida de caixa";
  return payment.clientName || "Cliente nao informado";
}

function getCashPaymentTypeLabel(payment: CashClosingPayment) {
  if (payment.type === "cash_out") return "Saida";
  if (payment.type === "subscription") return "Assinatura";
  if (payment.type === "extra") return "Extra";
  return "Agendamento";
}

function getCashPaymentCategoryLabel(payment: CashClosingPayment) {
  if (payment.type !== "cash_out") return "-";
  return cashOutCategoryLabels[payment.cashOutCategory as CashOutCategory] || "Saida de caixa";
}

function getCashPaymentDetailLabel(payment: CashClosingPayment) {
  if (payment.type === "cash_out") return getValidCashOutDescription(payment) || "-";
  if (payment.type === "subscription") return payment.subscriptionPlanName || "Assinatura";
  if (payment.type === "extra") return payment.description || "Pagamento extra";
  return payment.appointmentStartAt ? `Agendamento em ${formatReportDateTime(payment.appointmentStartAt)}` : "Agendamento";
}

function getCashPaymentReportDescription(payment: CashClosingPayment) {
  if (payment.type === "cash_out") return getCashPaymentDescription(payment);
  return getCashPaymentDetailLabel(payment);
}

function getSortedCashPayments(payments: CashClosingPayment[] = []) {
  return [...payments].sort(
    (a, b) =>
      new Date(b.paidAt || b.createdAt).getTime() -
      new Date(a.paidAt || a.createdAt).getTime(),
  );
}

type CashClosingReportRow = {
  closing: CashClosing;
  closingIndex: number;
  payment: CashClosingPayment | null;
};

function buildCashClosingReportRows(closings: CashClosing[]): CashClosingReportRow[] {
  return closings.flatMap<CashClosingReportRow>((closing, closingIndex) => {
    const payments = [...(closing.payments ?? [])].sort(
      (a, b) =>
        new Date(a.paidAt || a.createdAt).getTime() -
        new Date(b.paidAt || b.createdAt).getTime(),
    );

    if (payments.length === 0) {
      return [{ closing, closingIndex, payment: null }];
    }

    return payments.map((payment) => ({ closing, closingIndex, payment }));
  });
}

function getClosingMethodsLabel(closing: CashClosing) {
  const methods = Object.keys(closing.totalsByMethod ?? {});
  return methods.length
    ? methods.map((method) => methodLabels[method as PaymentMethod] || method).join(", ")
    : "-";
}

function collectCashClosingReportData(closings: CashClosing[]) {
  const orderedClosings = [...closings]
    .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
  const movements = buildCashClosingReportRows(orderedClosings);
  const paymentRows = movements.filter((item) => item.payment);
  const totalAmount = orderedClosings.reduce((sum, closing) => sum + closing.totalAmount, 0);
  const totalAppointments = paymentRows.filter((item) => item.payment?.type === "appointment").length;
  const totalCashOut = paymentRows.filter((item) => item.payment?.type === "cash_out").length;
  const totalsByMethod = orderedClosings.reduce<Record<string, number>>((acc, closing) => {
    Object.entries(closing.totalsByMethod ?? {}).forEach(([method, amount]) => {
      acc[method] = (acc[method] ?? 0) + Number(amount || 0);
    });
    return acc;
  }, {});
  const periodLabel = orderedClosings.length
    ? `${formatReportDateTime(orderedClosings[0].periodStart)} ate ${formatReportDateTime(orderedClosings[orderedClosings.length - 1].periodEnd)}`
    : "-";

  return {
    orderedClosings,
    movements,
    totalAmount,
    totalAppointments,
    totalCashOut,
    totalsByMethod,
    periodLabel,
  };
}

async function downloadCashClosingsPdf(closings: CashClosing[], selectedPeriodLabel: string) {
  const validClosings = closings;
  if (validClosings.length === 0) {
    toast.error("Nao ha fechamentos com movimentacoes para exportar.");
    return;
  }

  const data = collectCashClosingReportData(validClosings);
  const columns: ReportColumn<(typeof data.movements)[number]>[] = [
    { header: "Fech.", getValue: ({ closingIndex }) => String(closingIndex + 1), align: "center" },
    { header: "Data", getValue: ({ closing, payment }) => formatReportDateTime(payment?.paidAt || payment?.createdAt || closing.closedAt) },
    { header: "Origem", getValue: ({ closing, payment }) => payment ? getCashPaymentClientLabel(payment) : closing.closedByName || "Fechamento" },
    { header: "Tipo", getValue: ({ payment }) => payment ? getCashPaymentTypeLabel(payment) : "Fechamento", align: "center" },
    { header: "Categoria", getValue: ({ payment }) => payment ? getCashPaymentCategoryLabel(payment) : "-", align: "center" },
    { header: "Descricao", getValue: ({ closing, payment }) => payment ? getCashPaymentReportDescription(payment) : `Fechamento #${closing.id.slice(0, 8)}` },
    { header: "Forma", getValue: ({ closing, payment }) => payment ? methodLabels[payment.method] || payment.method : getClosingMethodsLabel(closing), align: "center" },
    { header: "Status", getValue: ({ payment }) => payment?.status || "fechado", align: "center" },
    { header: "Valor", getValue: ({ closing, payment }) => formatCurrency(payment?.amount ?? closing.totalAmount), align: "right" },
  ];

  downloadPdfReport(
    `fechamentos-caixa-${reportTimestamp()}.pdf`,
    {
      title: "Relatorio de Fechamento de Caixa",
      subtitle: `Periodo selecionado: ${selectedPeriodLabel}`,
      columns,
      rows: data.movements,
      summary: [
        ["Fechamentos", data.orderedClosings.length],
        ["Atendimentos", data.totalAppointments],
        ["Saidas", data.totalCashOut],
        ["Total geral", formatCurrency(data.totalAmount)],
      ],
    },
  );
}

function downloadCashClosingsCsv(closings: CashClosing[]) {
  const orderedClosings = [...closings]
    .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());

  if (orderedClosings.length === 0) {
    toast.error("Nao ha fechamentos com movimentacoes para exportar.");
    return;
  }

  const data = collectCashClosingReportData(orderedClosings);
  const header = [
    "Numero do fechamento",
    "ID do fechamento",
    "ID da movimentacao",
    "Fechado por",
    "Fechado em",
    "Periodo inicial",
    "Periodo final",
    "Origem",
    "Tipo",
    "Categoria",
    "Descricao",
    "Valor",
    "Metodo",
    "Status",
    "Pago em",
    "Criado em",
    "ID do agendamento",
    "ID da assinatura",
  ];
  const movementRows = data.movements.map(({ closing, closingIndex, payment }) => {
    return [
      String(closingIndex + 1),
      closing.id,
      payment?.id || "",
      closing.closedByName || "Usuario nao identificado",
      formatReportDateTime(closing.closedAt),
      formatReportDateTime(closing.periodStart),
      formatReportDateTime(closing.periodEnd),
      payment ? getCashPaymentClientLabel(payment) : closing.closedByName || "Fechamento",
      payment ? getCashPaymentTypeLabel(payment) : "Fechamento",
      payment ? getCashPaymentCategoryLabel(payment) : "-",
      payment ? getCashPaymentReportDescription(payment) : `Fechamento #${closing.id.slice(0, 8)}`,
      String(payment?.amount ?? closing.totalAmount).replace(".", ","),
      payment ? methodLabels[payment.method] || payment.method : getClosingMethodsLabel(closing),
      payment?.status || "fechado",
      formatReportDateTime(payment?.paidAt || payment?.createdAt || closing.closedAt),
      payment ? formatReportDateTime(payment.createdAt) : "",
      payment?.appointmentId || "",
      payment?.subscriptionId || "",
    ];
  });
  const summaryRows = [
    [],
    ["Resumo financeiro consolidado"],
    ["Quantidade de fechamentos", String(data.orderedClosings.length)],
    ["Quantidade de atendimentos", String(data.totalAppointments)],
    ["Quantidade de saidas", String(data.totalCashOut)],
    ["Quantidade de linhas", String(data.movements.length)],
    ...Object.entries(data.totalsByMethod)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([method, amount]) => [
        methodLabels[method as PaymentMethod] || method,
        String(amount).replace(".", ","),
      ]),
    ["Total Geral do Fechamento", String(data.totalAmount).replace(".", ",")],
  ];
  const csv = [header, ...movementRows, ...summaryRows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `fechamentos-caixa-${reportTimestamp()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function CashClosingPage() {
  const { user } = useAuth();
  const [closingCash, setClosingCash] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [cashPreview, setCashPreview] = useState<CashClosingSummary | null>(null);
  const [cashClosings, setCashClosings] = useState<CashClosing[]>([]);
  const [openCashSession, setOpenCashSession] = useState<OpenCashSession | null>(() =>
    getStoredOpenCashSession(),
  );
  const [loading, setLoading] = useState(true);
  const initialReportRange = currentMonthRange();
  const [reportStartDate, setReportStartDate] = useState(initialReportRange.start);
  const [reportEndDate, setReportEndDate] = useState(initialReportRange.end);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openCashPage, setOpenCashPage] = useState(1);
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionOptions, setSubscriptionOptions] = useState<Subscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState("");
  const [selectedSubscriptionLabel, setSelectedSubscriptionLabel] = useState("");
  const [manualPaymentAmount, setManualPaymentAmount] = useState("");
  const [manualPaymentMethod, setManualPaymentMethod] =
    useState<Exclude<PaymentMethod, "subscription">>("dinheiro");
  const [manualPaidAt, setManualPaidAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [savingManualPayment, setSavingManualPayment] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [cashOutCategory, setCashOutCategory] = useState<CashOutCategory>("products");
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [cashOutMethod, setCashOutMethod] = useState<Exclude<PaymentMethod, "subscription">>("dinheiro");
  const [cashOutPaidAt, setCashOutPaidAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [cashOutDescription, setCashOutDescription] = useState("");
  const [savingCashOut, setSavingCashOut] = useState(false);
  const limit = 10;
  const openCashLimit = 10;

  const loadCashClosings = useCallback(async () => {
    setLoading(true);

    try {
      const preview = await getCashClosingPreview();
      setCashPreview(preview);
    } catch (err) {
      setCashPreview(null);
      toast.error(getApiMessage(err));
    }

    try {
      const closings = await listCashClosings({
          periodStart: reportStartDate ? startOfLocalDay(dateInputToLocalDate(reportStartDate)).toISOString() : undefined,
          periodEnd: reportEndDate ? endOfLocalDay(dateInputToLocalDate(reportEndDate)).toISOString() : undefined,
      });
      setCashClosings(closings);
    } catch (err) {
      setCashClosings([]);
      toast.error(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [reportStartDate, reportEndDate]);

  useEffect(() => {
    void loadCashClosings();
  }, [loadCashClosings]);

  const loadSubscriptionOptions = useCallback(async () => {
    setLoadingSubscriptions(true);
    try {
      const result = await listSubscriptions({
        search: subscriptionSearch.trim() || undefined,
        searchType: "name",
        page: 1,
        limit: 50,
      });
      setSubscriptionOptions(result.items);
    } catch (err) {
      setSubscriptionOptions([]);
      toast.error(getApiMessage(err));
    } finally {
      setLoadingSubscriptions(false);
    }
  }, [subscriptionSearch]);

  useEffect(() => {
    if (!manualPaymentOpen) return;

    const timeout = window.setTimeout(() => {
      void loadSubscriptionOptions();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [manualPaymentOpen, subscriptionSearch, loadSubscriptionOptions]);

  useEffect(() => {
    setPage(1);
  }, [reportStartDate, reportEndDate, search]);

  const filteredClosings = useMemo(() => {
    return cashClosings.filter((closing) => closingMatchesSearch(closing, search));
  }, [cashClosings, search]);

  const totalPages = Math.max(1, Math.ceil(filteredClosings.length / limit));
  const paginatedClosings = filteredClosings.slice((page - 1) * limit, page * limit);
  const openCashPayments = useMemo(
    () => getSortedCashPayments(cashPreview?.payments ?? []),
    [cashPreview?.payments],
  );
  const openCashTotalPages = Math.max(1, Math.ceil(openCashPayments.length / openCashLimit));
  const paginatedOpenCashPayments = openCashPayments.slice(
    (openCashPage - 1) * openCashLimit,
    openCashPage * openCashLimit,
  );

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setOpenCashPage((current) => Math.min(current, openCashTotalPages));
  }, [openCashTotalPages]);

  const cashIsOpen = Boolean(openCashSession);

  function handleOpenCash() {
    const session = {
      openedAt: new Date().toISOString(),
      openedBy: user?.id || "",
      openedByName: user?.name || "Usuario nao identificado",
    };

    localStorage.setItem(openCashSessionKey, JSON.stringify(session));
    setOpenCashSession(session);
    toast.success("Caixa aberto com sucesso.");
  }

  async function handleCloseCash() {
    setClosingCash(true);
    try {
      await createCashClosing();
      localStorage.removeItem(openCashSessionKey);
      setOpenCashSession(null);
      toast.success("Caixa fechado com sucesso.");
      await loadCashClosings();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setClosingCash(false);
    }
  }

  async function handleCashAction() {
    if (!cashIsOpen) {
      handleOpenCash();
      return;
    }

    await handleCloseCash();
  }

  async function loadCashClosingReports() {
    if (cashClosings.length === 0) {
      return [];
    }

    return Promise.all(cashClosings.map((closing) => getCashClosingReport(closing.id)));
  }

  async function handleExportCashClosingsPdf() {
    setExportingPdf(true);
    try {
      const reports = await loadCashClosingReports();
      if (reports.length === 0) {
        toast.error("Nao ha fechamentos com movimentacoes para exportar.");
        return;
      }
      await downloadCashClosingsPdf(reports, formatReportRangeLabel(reportStartDate, reportEndDate));
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportCashClosingsCsv() {
    setExportingCsv(true);
    try {
      const reports = await loadCashClosingReports();
      if (reports.length === 0) {
        toast.error("Nao ha fechamentos com movimentacoes para exportar.");
        return;
      }
      downloadCashClosingsCsv(reports);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setExportingCsv(false);
    }
  }

  function handleSelectSubscription(subscriptionId: string) {
    setSelectedSubscriptionId(subscriptionId);
    const selected = subscriptionOptions.find((subscription) => subscription.id === subscriptionId);
    if (selected) {
      if (selected.hasPagarmeSubscription) {
        toast.error("Esta assinatura possui recorrencia no Pagar.me. Cancele ou altere a recorrencia antes de registrar pagamento presencial.");
        setSelectedSubscriptionId("");
        setSelectedSubscriptionLabel("");
        setManualPaymentAmount("");
        return;
      }

      setSelectedSubscriptionLabel(
        `${selected.user?.name || "Cliente"} - ${selected.plan?.name || "Plano"}`
      );
      setSubscriptionSearch(selected.user?.name || "");
      setManualPaymentAmount(String(selected.amount || selected.plan?.price || ""));
    }
  }

  async function handleRegisterManualSubscriptionPayment() {
    if (!cashIsOpen) {
      toast.error("Abra o caixa antes de registrar pagamentos.");
      return;
    }

    if (!selectedSubscriptionId) {
      toast.error("Selecione uma assinatura.");
      return;
    }

    const amount = Number(String(manualPaymentAmount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor valido.");
      return;
    }

    setSavingManualPayment(true);
    try {
      await createManualSubscriptionPayment({
        subscriptionId: selectedSubscriptionId,
        amount,
        method: manualPaymentMethod,
        paidAt: manualPaidAt ? new Date(manualPaidAt).toISOString() : undefined,
      });
      toast.success("Pagamento de assinatura registrado.");
      setManualPaymentOpen(false);
      setSelectedSubscriptionId("");
      setSelectedSubscriptionLabel("");
      setManualPaymentAmount("");
      setSubscriptionSearch("");
      setManualPaymentMethod("dinheiro");
      setManualPaidAt(toDateTimeLocalValue(new Date()));
      await loadCashClosings();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSavingManualPayment(false);
    }
  }

  async function handleRegisterCashOut() {
    if (!cashIsOpen) {
      toast.error("Abra o caixa antes de registrar saidas.");
      return;
    }

    const amount = Number(String(cashOutAmount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor valido.");
      return;
    }

    setSavingCashOut(true);
    try {
      await createCashOut({
        category: cashOutCategory,
        amount,
        method: cashOutMethod,
        description: cashOutDescription.trim() || undefined,
        paidAt: cashOutPaidAt ? new Date(cashOutPaidAt).toISOString() : undefined,
      });
      toast.success("Saida de caixa registrada.");
      setCashOutOpen(false);
      setCashOutCategory("products");
      setCashOutAmount("");
      setCashOutMethod("dinheiro");
      setCashOutDescription("");
      setCashOutPaidAt(toDateTimeLocalValue(new Date()));
      await loadCashClosings();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSavingCashOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Status do caixa</p>
          <h3 className="text-2xl font-semibold text-foreground">
            {cashIsOpen ? "Aberto" : "Fechado"}
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Caixa aberto</p>
          <h3 className="text-2xl font-semibold text-foreground">
            {formatCurrency(cashPreview?.totalAmount ?? 0)}
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Pagamentos em aberto</p>
          <h3 className="text-2xl font-semibold text-foreground">
            {cashPreview?.paymentCount ?? 0}
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Aberto por</p>
          <h3 className="truncate text-2xl font-semibold text-foreground">
            {openCashSession?.openedByName || "-"}
          </h3>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-medium text-foreground">Fechamento de caixa</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {cashIsOpen
                ? `Caixa aberto por ${openCashSession?.openedByName || "Usuario nao identificado"}.`
                : "Abra o caixa para iniciar um novo periodo de trabalho."}
            </p>
            {cashIsOpen && openCashSession ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Aberto em: {formatDateTime(openCashSession.openedAt)}
              </p>
            ) : null}
            {cashPreview && cashIsOpen ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Movimentacoes: {formatCurrency(cashPreview.totalAmount)} em {cashPreview.paymentCount} pagamento(s).
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <Button
              variant="outline"
              onClick={() => setManualPaymentOpen(true)}
              disabled={!cashIsOpen || loading}
              className="gap-2"
            >
              <CreditCard size={14} />
              Registrar assinatura
            </Button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="report-start-date" className="text-xs text-muted-foreground">
                  Data inicial
                </Label>
                <Input
                  id="report-start-date"
                  type="date"
                  value={reportStartDate}
                  onChange={(event) => setReportStartDate(event.target.value)}
                  className="h-10 text-sm sm:w-40"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="report-end-date" className="text-xs text-muted-foreground">
                  Data final
                </Label>
                <Input
                  id="report-end-date"
                  type="date"
                  value={reportEndDate}
                  onChange={(event) => setReportEndDate(event.target.value)}
                  className="h-10 text-sm sm:w-40"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setCashOutOpen(true)}
              disabled={!cashIsOpen || loading}
              className="gap-2"
            >
              <BanknoteArrowDown size={14} />
              Registrar saida
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCashClosingsPdf}
              disabled={exportingPdf || cashClosings.length === 0}
              className="gap-2"
            >
              {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download size={14} />}
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCashClosingsCsv}
              disabled={exportingCsv || cashClosings.length === 0}
              className="gap-2"
            >
              {exportingCsv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download size={14} />}
              Exportar CSV
            </Button>
            <Button onClick={handleCashAction} disabled={closingCash || loading} className="gap-2">
              {closingCash ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle size={14} />}
              {cashIsOpen ? "Fechar caixa" : "Abrir caixa"}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">Resumo do caixa aberto</p>
            <div className="space-y-2 text-sm">
              {!cashIsOpen ? (
                <p className="text-muted-foreground">O caixa ainda nao foi aberto.</p>
              ) : cashPreview && Object.keys(cashPreview.totalsByMethod).length > 0 ? (
                Object.entries(cashPreview.totalsByMethod).map(([method, amount]) => (
                  <div key={method} className="flex justify-between">
                    <span className="text-muted-foreground">{methodLabels[method as PaymentMethod] || method}</span>
                    <span className="font-medium text-foreground">{formatCurrency(amount)}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Nenhum pagamento recebido no caixa aberto.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="flex flex-col gap-1 border-b border-border bg-secondary/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Movimentacoes do caixa aberto</p>
              <p className="text-xs text-muted-foreground">
                Entradas e saidas que serao consideradas no fechamento.
              </p>
            </div>
            {cashIsOpen ? (
              <Badge variant="outline" className="w-fit rounded-full px-2 py-0.5 text-xs">
                {openCashPayments.length} mov.
              </Badge>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Descricao
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Forma
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {!cashIsOpen ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      Abra o caixa para acompanhar as movimentacoes.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando movimentacoes...
                    </td>
                  </tr>
                ) : openCashPayments.length > 0 ? (
                  paginatedOpenCashPayments.map((payment) => {
                    const isCashOut = payment.type === "cash_out";

                    return (
                      <tr
                        key={payment.id}
                        className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                          {formatDateTime(payment.paidAt || payment.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={isCashOut ? "destructive" : "outline"}
                            className="rounded-full px-2 py-0.5 text-xs"
                          >
                            {getCashPaymentTypeLabel(payment)}
                          </Badge>
                        </td>
                        <td className="min-w-64 px-4 py-3">
                          <p className="text-sm font-medium text-foreground">
                            {getCashPaymentDescription(payment)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getCashPaymentClientLabel(payment)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                          {methodLabels[payment.method] || payment.method}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${
                            payment.amount < 0 ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {formatCurrency(payment.amount)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma movimentacao no caixa aberto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Pagina {openCashPage} de {openCashTotalPages} - {openCashPayments.length} movimentacao(oes)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={openCashPage <= 1 || loading || openCashPayments.length === 0}
                onClick={() => setOpenCashPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={openCashPage >= openCashTotalPages || loading || openCashPayments.length === 0}
                onClick={() => setOpenCashPage((current) => Math.min(openCashTotalPages, current + 1))}
              >
                Proxima
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-medium text-foreground">Historico de fechamento</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredClosings.length} fechamento(s) encontrado(s).
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar fechamento..."
                className="h-9 w-full bg-secondary pl-9 text-sm sm:w-56"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const current = currentMonthRange();
                setReportStartDate(current.start);
                setReportEndDate(current.end);
                setSearch("");
              }}
              disabled={!search && isCurrentMonthRange(reportStartDate, reportEndDate)}
            >
              Limpar
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Fechamento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Periodo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Fechado por
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Pagamentos
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Carregando fechamentos...
                  </td>
                </tr>
              ) : paginatedClosings.length > 0 ? (
                paginatedClosings.map((closing) => (
                  <tr
                    key={closing.id}
                    className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">
                        {formatDateTime(closing.closedAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">#{closing.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDateTime(closing.periodStart)} - {formatDateTime(closing.periodEnd)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">
                        {closing.closedByName || "Usuario nao identificado"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                        {closing.paymentCount} pag.
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                      {formatCurrency(closing.totalAmount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum fechamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Pagina {page} de {totalPages} - {filteredClosings.length} fechamento(s)
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

      <Dialog open={manualPaymentOpen} onOpenChange={setManualPaymentOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar pagamento de assinatura</DialogTitle>
            <DialogDescription>
              Use quando o cliente pagar presencialmente em dinheiro, PIX ou cartao.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subscription-search">Cliente</Label>
              <div className="space-y-2">
                <Input
                  id="subscription-search"
                  value={subscriptionSearch}
                  onChange={(event) => {
                    setSubscriptionSearch(event.target.value);
                    setSelectedSubscriptionId("");
                    setSelectedSubscriptionLabel("");
                  }}
                  placeholder="Digite para pesquisar por nome"
                />
                <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-background">
                  {loadingSubscriptions ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando clientes...
                    </div>
                  ) : subscriptionOptions.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      Nenhuma assinatura encontrada.
                    </p>
                  ) : (
                    subscriptionOptions.map((subscription) => {
                      const selected = selectedSubscriptionId === subscription.id;
                      const blockedByPagarme = Boolean(subscription.hasPagarmeSubscription);

                      return (
                        <button
                          key={subscription.id}
                          type="button"
                          disabled={blockedByPagarme}
                          onClick={() => handleSelectSubscription(subscription.id)}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-55 ${
                            selected ? "bg-primary/10 text-primary" : "text-foreground"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {subscription.user?.name || "Cliente"}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {subscription.plan?.name || "Plano"} - {formatCurrency(subscription.amount || subscription.plan?.price || 0)}
                              {blockedByPagarme ? " - recorrente no Pagar.me" : ""}
                            </span>
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            {blockedByPagarme && (
                              <Badge variant="outline" className="rounded-full border-amber-500/40 px-2 py-0.5 text-[11px] text-amber-500">
                                Pagar.me
                              </Badge>
                            )}
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
                              {subscription.status}
                            </Badge>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedSubscriptionLabel ? (
                  <p className="text-xs text-muted-foreground">
                    Selecionado: <span className="font-medium text-foreground">{selectedSubscriptionLabel}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="manual-payment-amount">Valor</Label>
                <Input
                  id="manual-payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manualPaymentAmount}
                  onChange={(event) => setManualPaymentAmount(event.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-payment-method">Forma</Label>
                <select
                  id="manual-payment-method"
                  value={manualPaymentMethod}
                  onChange={(event) => setManualPaymentMethod(event.target.value as Exclude<PaymentMethod, "subscription">)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  {manualSubscriptionMethods.map((method) => (
                    <option key={method} value={method}>
                      {methodLabels[method]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-paid-at">Pago em</Label>
                <Input
                  id="manual-paid-at"
                  type="datetime-local"
                  value={manualPaidAt}
                  onChange={(event) => setManualPaidAt(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setManualPaymentOpen(false)}
              disabled={savingManualPayment}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleRegisterManualSubscriptionPayment}
              disabled={savingManualPayment || loadingSubscriptions}
              className="gap-2"
            >
              {savingManualPayment && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cashOutOpen} onOpenChange={setCashOutOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar saida de caixa</DialogTitle>
            <DialogDescription>
              Lance pagamentos de produtos, funcionarios, estornos e outras saidas do caixa aberto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cash-out-category">Categoria</Label>
                <select
                  id="cash-out-category"
                  value={cashOutCategory}
                  onChange={(event) => setCashOutCategory(event.target.value as CashOutCategory)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  {cashOutCategories.map((category) => (
                    <option key={category} value={category}>
                      {cashOutCategoryLabels[category]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cash-out-method">Forma</Label>
                <select
                  id="cash-out-method"
                  value={cashOutMethod}
                  onChange={(event) => setCashOutMethod(event.target.value as Exclude<PaymentMethod, "subscription">)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  {manualSubscriptionMethods.map((method) => (
                    <option key={method} value={method}>
                      {methodLabels[method]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cash-out-amount">Valor</Label>
                <Input
                  id="cash-out-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={cashOutAmount}
                  onChange={(event) => setCashOutAmount(event.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cash-out-paid-at">Data da saida</Label>
                <Input
                  id="cash-out-paid-at"
                  type="datetime-local"
                  value={cashOutPaidAt}
                  onChange={(event) => setCashOutPaidAt(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-out-description">Descricao</Label>
              <Input
                id="cash-out-description"
                value={cashOutDescription}
                onChange={(event) => setCashOutDescription(event.target.value)}
                placeholder="Ex.: compra de produtos, vale funcionario, estorno do cliente"
                maxLength={255}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCashOutOpen(false)}
              disabled={savingCashOut}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleRegisterCashOut}
              disabled={savingCashOut}
              className="gap-2"
            >
              {savingCashOut && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar saida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
