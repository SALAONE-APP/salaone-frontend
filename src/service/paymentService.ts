import api from "./api";

export type PaymentMethod = "pix" | "debito" | "credito" | "dinheiro" | "local" | "subscription";
export type PaymentStatus = "pending" | "approved" | "paid" | "failed" | "refunded" | "covered";
export type PaymentType = "appointment" | "subscription";

export interface PaymentRecord {
  id: string;
  salonId: string;
  userId?: string | null;
  user?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  appointmentId?: string | null;
  appointment?: {
    id: string;
    startAt: string;
    endAt: string;
    status: string;
    professional?: {
      id: string;
      displayName: string;
    } | null;
    services?: Array<{
      id: string;
      serviceName: string;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
    }>;
  } | null;
  subscriptionId?: string | null;
  subscription?: {
    id: string;
    status: string;
    plan?: {
      id: string;
      name: string;
    } | null;
  } | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  statusRaw?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListPaymentsParams {
  userId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  page?: number;
  limit?: number;
}

export interface ListPaymentsResponse {
  page: number;
  limit: number;
  total: number;
  items: PaymentRecord[];
}

export interface PaymentSummary {
  paid: number;
  pending: number;
  refunded: number;
  today: number;
}

export interface PaymentListResult extends ListPaymentsResponse {
  items: Array<PaymentRecord & { paymentType: PaymentType | "extra" }>;
  summary?: PaymentSummary;
}

export async function listSubscriptionPayments(params: ListPaymentsParams = {}) {
  const response = await api.get<ListPaymentsResponse>("/payments", { params });

  return response.data;
}

export async function listAppointmentPayments(params: ListPaymentsParams = {}) {
  const response = await api.get<ListPaymentsResponse>("/appointmentPayments", { params });

  return response.data;
}

export interface CreateAppointmentPaymentPayload {
  appointmentId: string;
  userId: string;
  amount: number;
  method: PaymentMethod;
  status?: PaymentStatus;
}

export async function createAppointmentPayment(data: CreateAppointmentPaymentPayload) {
  const response = await api.post<PaymentRecord>("/appointmentPayments", data);

  return response.data;
}

export interface CreateManualSubscriptionPaymentPayload {
  subscriptionId: string;
  amount: number;
  method: Exclude<PaymentMethod, "subscription">;
  paidAt?: string;
}

export async function createManualSubscriptionPayment(data: CreateManualSubscriptionPaymentPayload) {
  const response = await api.post<PaymentRecord>("/payments/subscriptions/manual", data);

  return response.data;
}

export type CashOutCategory = "products" | "employees" | "refunds" | "other";

export interface CreateCashOutPayload {
  category: CashOutCategory;
  amount: number;
  method: Exclude<PaymentMethod, "subscription">;
  description?: string | null;
  paidAt?: string;
}

export async function createCashOut(data: CreateCashOutPayload) {
  const response = await api.post<PaymentRecord>("/payments/cash-out", data);

  return response.data;
}

export async function listAllPayments(params: ListPaymentsParams = {}): Promise<PaymentListResult> {
  const response = await api.get<PaymentListResult>("/payments/all", { params });

  return response.data;
}

export async function updatePayment(
  payment: Pick<PaymentRecord, "id" | "appointmentId">,
  data: { status?: PaymentStatus; method?: PaymentMethod; paidAt?: string; noShow?: boolean },
) {
  const response = await api.patch<PaymentRecord>(`/payments/${payment.id}`, data);

  return response.data;
}

/* ═══════ Extra Payments ═══════ */

export interface ExtraPaymentRecord extends PaymentRecord {
  description?: string | null;
}

export interface CreateExtraPaymentPayload {
  userId?: string | null;
  amount: number;
  method: Exclude<PaymentMethod, "subscription">;
  status?: PaymentStatus;
  description?: string | null;
}

export interface ListExtraPaymentsResponse {
  page: number;
  limit: number;
  total: number;
  items: ExtraPaymentRecord[];
}

export async function listExtraPayments(params: ListPaymentsParams = {}) {
  const response = await api.get<ListExtraPaymentsResponse>("/extraPayments", { params });
  return response.data;
}

export async function createExtraPayment(data: CreateExtraPaymentPayload) {
  const response = await api.post<ExtraPaymentRecord>("/extraPayments", data);
  return response.data;
}

export async function updateExtraPayment(
  id: string,
  data: { status?: PaymentStatus; method?: PaymentMethod; paidAt?: string },
) {
  const response = await api.patch<ExtraPaymentRecord>(`/extraPayments/${id}`, data);
  return response.data;
}

export async function deleteExtraPayment(id: string) {
  const response = await api.delete<{ ok: boolean }>(`/extraPayments/${id}`);
  return response.data;
}
