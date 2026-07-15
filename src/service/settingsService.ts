import api from "./api";

export type BookingPaymentMethod = "cartao" | "pix" | "local";
export type PaymentFrequency = "weekly" | "biweekly" | "monthly";
export type SubscriptionProfessionalRule = "fixed" | "free_choice";
export type CommissionRuleType = "FIXED_PROFESSIONAL" | "FREE_PROFESSIONAL";

export interface Settings {
  pixKey: string;
  termsDocumentUrl: string;
  termsDocumentName: string;
  hiddenBookingPaymentMethods: BookingPaymentMethod[];
  subscriptionProfessionalRule: SubscriptionProfessionalRule;
  commissionRuleType: CommissionRuleType;
  commission_rule_type?: CommissionRuleType;
  commissionPoolPercent?: number;
  commission_pool_percent?: number;
}

export interface UpdateSettingsPayload {
  pixKey?: string;
  termsDocumentUrl?: string;
  termsDocumentName?: string;
  hiddenBookingPaymentMethods: BookingPaymentMethod[];
  subscriptionProfessionalRule?: SubscriptionProfessionalRule;
  commissionPoolPercent?: number;
}

interface HomeInfoSettingsResponse {
  professional_payment_frequency?: PaymentFrequency | null;
  employee_payment_frequency?: PaymentFrequency | null;
  professionalPaymentFrequency?: PaymentFrequency | null;
  employeePaymentFrequency?: PaymentFrequency | null;
}

export interface PaymentFrequencySettings {
  professionalPaymentFrequency: PaymentFrequency;
  employeePaymentFrequency: PaymentFrequency;
}

export async function getSettings() {
  const response = await api.get<Settings>("/settings");
  return response.data;
}

export async function updateSettings(data: UpdateSettingsPayload) {
  const response = await api.put<Settings>("/settings", {
    pixKey: data.pixKey ?? "",
    termsDocumentUrl: data.termsDocumentUrl ?? "",
    termsDocumentName: data.termsDocumentName ?? "",
    hiddenBookingPaymentMethods: data.hiddenBookingPaymentMethods,
    subscriptionProfessionalRule: data.subscriptionProfessionalRule ?? "fixed",
    commissionPoolPercent: data.commissionPoolPercent,
  });

  return response.data;
}

function normalizePaymentFrequency(value?: PaymentFrequency | null) {
  return value ?? "monthly";
}

function mapPaymentFrequencySettings(
  data: HomeInfoSettingsResponse
): PaymentFrequencySettings {
  return {
    professionalPaymentFrequency: normalizePaymentFrequency(
      data.professionalPaymentFrequency ?? data.professional_payment_frequency
    ),
    employeePaymentFrequency: normalizePaymentFrequency(
      data.employeePaymentFrequency ?? data.employee_payment_frequency
    ),
  };
}

export async function getPaymentFrequencySettings() {
  const response = await api.get<HomeInfoSettingsResponse>("/home-info");
  return mapPaymentFrequencySettings(response.data);
}

export async function updatePaymentFrequencySettings(
  data: PaymentFrequencySettings
) {
  const response = await api.put<HomeInfoSettingsResponse>("/home-info", {
    professionalPaymentFrequency: data.professionalPaymentFrequency,
    employeePaymentFrequency: data.employeePaymentFrequency,
  });

  return mapPaymentFrequencySettings(response.data);
}
