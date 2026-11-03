import api from "./api";
import type { SalonStatus } from "./superAdminService";

// Ficha do salao no superadmin: dados, assinatura (cobranca SaaS), pagamentos
// e historico das acoes.

export interface SalonFilePlan {
  id: string;
  name: string;
  price: number;
  interval: string;
  intervalCount: number;
}

export interface SalonFilePayment {
  id: string;
  amount: number;
  status: "paid" | "reverted" | string;
  paidAt: string | null;
  method: string | null;
  note: string | null;
  source: "pagarme" | "manual";
  revertible: boolean;
  revertedAt: string | null;
  revertReason: string | null;
  createdAt: string;
}

export interface SalonFileSubscription {
  id: string;
  status: string;
  billingMode: string;
  paymentMethod: string | null;
  manualPaymentStatus: string;
  billingInterval: string | null;
  amount: number;
  plan: SalonFilePlan;
  scheduledPlan: SalonFilePlan | null;
  scheduledPlanAt: string | null;
  startDate: string | null;
  nextBillingDate: string | null;
  dueAt: string | null;
  trialEndsAt: string | null;
  trialUsedAt: string | null;
  trialGrantsCount: number;
  inTrial: boolean;
  trialActive: boolean;
  canceled: boolean;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelReasonCode: string | null;
  cancelReasonNote: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  accessReleasedUntil: string | null;
  nextChargeAdjustment: number;
  nextChargeAmount: number;
  overdue: boolean;
  hasRemoteRecurrence: boolean;
  hasSavedCard: boolean;
  payments: SalonFilePayment[];
}

export interface SalonFileEvent {
  id: string;
  action: string;
  actorType: "platform_user" | "system" | string;
  actorName: string | null;
  reason: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SalonFile {
  salon: {
    id: string;
    name: string;
    slug: string;
    status: SalonStatus;
    businessType: string | null;
    email: string | null;
    phone: string | null;
    document: string | null;
    blockedReason: string | null;
    blockedAt: string | null;
    deactivatedAt: string | null;
    createdAt: string;
  };
  billingSalon: { id: string; name: string; slug: string } | null;
  owner: { id: string; name: string; email: string; phone: string | null } | null;
  units: { current: number; max: number | null };
  access: { allowed: boolean; reason: string | null; blockAt: string | null };
  subscription: SalonFileSubscription | null;
  events: SalonFileEvent[];
  cancelReasons: Record<string, string>;
  manualPaymentMethods: Record<string, string>;
  overdueGraceDays: number;
}

export interface DueDatePreview {
  allowed: boolean;
  error?: string;
  shiftDays: number;
  latestAllowedAt: string;
  prorationCents: number;
  transitionAmountCents: number;
  currentDueAt: string;
}

type ActionResponse = { result: unknown; file: SalonFile };

const base = (salonId: string) => `/super-admin/salons/${salonId}`;

async function post(salonId: string, path: string, body: Record<string, unknown>) {
  const response = await api.post<ActionResponse>(`${base(salonId)}${path}`, body);
  return response.data;
}

export async function getSalonFile(salonId: string) {
  const response = await api.get<SalonFile>(`${base(salonId)}/file`);
  return response.data;
}

export async function previewSalonDueDate(salonId: string, newDueDate: string, prorate: boolean) {
  const response = await api.get<DueDatePreview>(`${base(salonId)}/subscription/due-date/preview`, { params: { newDueDate, prorate } });
  return response.data;
}

export const salonFileActions = {
  extendTrial: (id: string, body: { days?: number; until?: string; reason: string }) => post(id, "/subscription/trial/extend", body),
  endTrial: (id: string, reason: string) => post(id, "/subscription/trial/end", { reason }),
  convertTrial: (id: string, reason: string) => post(id, "/subscription/trial/convert", { reason }),
  grantTrial: (id: string, body: { days: number; reason: string }) => post(id, "/subscription/trial/grant", body),
  manualPayment: (
    id: string,
    body: { amount: number; paidAt: string; method: string; note?: string; nextBillingDate?: string | null; reason: string },
  ) => post(id, "/subscription/payments/manual", body),
  revertPayment: (id: string, paymentId: string, reason: string) => post(id, `/subscription/payments/${paymentId}/revert`, { reason }),
  changePlan: (id: string, body: { planId: string; reason: string }) => post(id, "/subscription/plan", body),
  cancelScheduledPlan: (id: string, reason: string) => post(id, "/subscription/plan/cancel-scheduled", { reason }),
  changeDueDate: (id: string, body: { newDueDate: string; prorate: boolean; reason: string }) => post(id, "/subscription/due-date", body),
  cancel: (id: string, body: { mode: "immediate" | "period_end"; reasonCode: string; reason: string }) => post(id, "/subscription/cancel", body),
  reactivate: (id: string, body: { planId?: string | null; billing: "manual" | "card"; reason: string }) => post(id, "/subscription/reactivate", body),
  suspend: (id: string, reason: string) => post(id, "/suspend", { reason }),
  inactivate: (id: string, reason: string) => post(id, "/inactivate", { reason }),
  unblock: (id: string, body: { days: number; reason: string }) => post(id, "/unblock", body),
};
