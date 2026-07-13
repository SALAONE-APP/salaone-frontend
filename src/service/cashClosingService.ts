import api from "./api";
import type { PaymentMethod } from "./paymentService";

export interface CashClosingPayment {
  id: string;
  userId?: string | null;
  clientName?: string | null;
  appointmentId?: string | null;
  subscriptionId?: string | null;
  amount: number;
  method: PaymentMethod;
  status: string;
  paidAt?: string | null;
  createdAt: string;
  appointmentStartAt?: string | null;
  subscriptionPlanName?: string | null;
  description?: string | null;
  cashOutCategory?: "products" | "employees" | "refunds" | "other" | string | null;
  type: "appointment" | "subscription" | "extra" | "cash_out";
}

export interface CashClosingSummary {
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  paymentCount: number;
  totalsByMethod: Record<string, number>;
  payments: CashClosingPayment[];
}

export interface CashClosing extends CashClosingSummary {
  id: string;
  closedAt: string;
  closedBy: string;
  closedByName?: string | null;
  paymentIds: string[];
  note?: string | null;
}

export async function getCashClosingPreview() {
  const response = await api.get<CashClosingSummary>("/cashClosings/preview");
  return response.data;
}

export async function listCashClosings(params: { date?: string; periodStart?: string; periodEnd?: string } = {}) {
  const response = await api.get<CashClosing[]>("/cashClosings", { params });
  return response.data;
}

export async function createCashClosing(data: { note?: string | null } = {}) {
  const response = await api.post<CashClosing>("/cashClosings", data);
  return response.data;
}

export async function getCashClosingReport(id: string) {
  const response = await api.get<CashClosing>(`/cashClosings/${id}/report`);
  return response.data;
}
