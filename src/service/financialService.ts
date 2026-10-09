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

export async function listDailyFinancialPayments(filters: DailyFinancialFilters): Promise<DailyFinancialResponse> {
  const response = await api.get<DailyFinancialResponse>("/super-admin/financial/payments", { params: filters });
  return response.data;
}

export async function createFinancialPayment(payload: {
  salonId: string;
  amount: number;
  paidAt: string;
  paymentMethod: FinancialPaymentMethod;
  reference?: string;
  notes?: string;
}): Promise<FinancialPayment> {
  const response = await api.post<FinancialPayment>("/super-admin/financial/payments", payload);
  return response.data;
}
