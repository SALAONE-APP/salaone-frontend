import api from "./api";

export type FinancialPaymentMethod = "pix" | "credit_card" | "boleto" | "cash" | "bank_transfer" | "other";
export type FinancialPaymentStatus = "paid" | "pending" | "refunded" | "cancelled";

export interface FinancialPayment {
  id: string;
  salonId: string;
  salonName: string;
  planName?: string | null;
  amount: number;
  paidAt: string;
  paymentMethod: FinancialPaymentMethod;
  status: FinancialPaymentStatus;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface FinancialSummary { received: number; pending: number; refunded: number; paymentsCount: number; }

export interface DailyFinancialResponse {
  items: FinancialPayment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: FinancialSummary;
}

export interface DailyFinancialFilters {
  date?: string;
  search?: string;
  paymentMethod?: FinancialPaymentMethod;
  status?: FinancialPaymentStatus;
  page?: number;
  limit?: number;
}

interface PlatformSubscriptionPayment {
  id: string;
  salonId: string;
  salonName: string;
  planName?: string | null;
  paymentMethod?: string | null;
  amount: number;
  paidAt?: string | null;
  referenceCode?: string | null;
  createdAt: string;
}

interface PlatformSubscriptionPaymentResponse {
  items: PlatformSubscriptionPayment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function normalizePaymentMethod(value?: string | null): FinancialPaymentMethod {
  if (value === "pix" || value === "credit_card" || value === "cash") return value;
  if (value === "boleto" || value === "bank_transfer") return value;
  return "other";
}

function toFinancialPayment(payment: PlatformSubscriptionPayment): FinancialPayment {
  return {
    id: payment.id,
    salonId: payment.salonId,
    salonName: payment.salonName,
    planName: payment.planName ?? null,
    amount: Number(payment.amount || 0),
    paidAt: payment.paidAt ?? payment.createdAt,
    paymentMethod: normalizePaymentMethod(payment.paymentMethod),
    status: "paid",
    reference: payment.referenceCode ?? null,
    createdAt: payment.createdAt,
  };
}

export async function listDailyFinancialPayments(filters: DailyFinancialFilters): Promise<DailyFinancialResponse> {
  // O financeiro diário é composto pelos recebimentos das assinaturas da
  // plataforma. Esta é a rota já exposta pelo backend para o Super Admin.
  const response = await api.get<PlatformSubscriptionPaymentResponse>(
    "/super-admin/platform-subscription-payments",
    { params: { paymentDate: filters.date, page: filters.page, limit: filters.limit } },
  );
  const items = response.data.items
    .map(toFinancialPayment)
    .filter((payment) => {
      const term = filters.search?.trim().toLocaleLowerCase("pt-BR");
      const matchesSearch = !term || [payment.salonName, payment.planName, payment.reference]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("pt-BR").includes(term));
      const matchesMethod = !filters.paymentMethod || payment.paymentMethod === filters.paymentMethod;
      // O endpoint existente lista somente pagamentos confirmados.
      const matchesStatus = !filters.status || filters.status === "paid";
      return matchesSearch && matchesMethod && matchesStatus;
    });
  const received = items.reduce((total, payment) => total + payment.amount, 0);

  return {
    ...response.data,
    items,
    total: filters.search || filters.paymentMethod || filters.status ? items.length : response.data.total,
    totalPages: filters.search || filters.paymentMethod || filters.status ? 1 : response.data.totalPages,
    summary: { received, pending: 0, refunded: 0, paymentsCount: items.length },
  };
}

export async function createFinancialPayment(payload: {
  salonId: string;
  platformPlanId?: string;
  amount: number;
  paidAt: string;
  paymentMethod: FinancialPaymentMethod;
  reference?: string;
  notes?: string;
}): Promise<FinancialPayment> {
  let platformPlanId = payload.platformPlanId;
  if (!platformPlanId) {
    const salons = await api.get<{
      salons: Array<{
        id: string;
        salon_subscriptions?: { platform_plans?: { id?: string | null } | null } | null;
      }>;
    }>("/salons");
    platformPlanId = salons.data.salons.find((salon) => salon.id === payload.salonId)
      ?.salon_subscriptions?.platform_plans?.id ?? undefined;
  }
  if (!platformPlanId) {
    throw new Error("O salão selecionado não possui um plano de plataforma ativo.");
  }
  if (payload.paymentMethod !== "pix" && payload.paymentMethod !== "cash") {
    throw new Error("O registro manual de assinatura aceita somente PIX ou dinheiro.");
  }
  const paymentMethod = payload.paymentMethod;
  const response = await api.post<{ payment: PlatformSubscriptionPayment }>(
    `/super-admin/salons/${payload.salonId}/platform-subscription/payments`,
    {
      platformPlanId,
      paymentMethod,
      amount: payload.amount,
      paidAt: payload.paidAt,
      referenceCode: payload.reference,
      idempotencyKey: crypto.randomUUID(),
    },
  );
  return toFinancialPayment(response.data.payment);
}
