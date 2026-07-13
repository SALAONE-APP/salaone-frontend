import api from "./api";

export type PlanPaymentMethod = "pix" | "debito" | "credito" | "local";

export interface Plan {
  id: string;
  barbershopId?: string;
  name: string;
  subtitle?: string | null;
  price: number;
  color?: string | null;
  cutsPerMonth: number;
  paymentMethod: PlanPaymentMethod;
  maxBarbers?: number | null;
  maxReceptionists?: number | null;
  maxAdmins?: number | null;
  active: boolean;
  recommended: boolean;
  features: string[];
  subscriptionUrl?: string | null;
  externalPlanId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListPlansParams {
  active?: boolean;
}

export interface PlanPayload {
  name: string;
  subtitle?: string | null;
  price: number;
  color?: string | null;
  cutsPerMonth: number;
  paymentMethod: PlanPaymentMethod;
  maxBarbers?: number | null;
  maxReceptionists?: number | null;
  maxAdmins?: number | null;
  active?: boolean;
  recommended?: boolean;
  features?: string[];
  syncStripe?: boolean;
}

export async function listPlans(params: ListPlansParams = {}) {
  const response = await api.get<Plan[]>("/subscription-plans", { params });
  return response.data;
}

export async function getPlanById(planId: string) {
  const response = await api.get<Plan>(`/subscription-plans/${planId}`);
  return response.data;
}

export async function createPlan(data: PlanPayload) {
  const response = await api.post<Plan>("/subscription-plans", {
    ...data,
    syncStripe: false,
  });
  return response.data;
}

export async function updatePlan(planId: string, data: Partial<PlanPayload>) {
  const response = await api.patch<Plan>(`/subscription-plans/${planId}`, {
    ...data,
    syncStripe: false,
  });
  return response.data;
}

export async function deletePlan(planId: string) {
  const response = await api.delete<{ message: string }>(`/subscription-plans/${planId}`);
  return response.data;
}
