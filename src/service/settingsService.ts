import api from "./api";

export type BookingPaymentMethod = "cartao" | "pix" | "local";
export type PaymentFrequency = "weekly" | "biweekly" | "monthly";
export type SubscriptionBarberRule = "fixed" | "free_choice";
export type CommissionRuleType = "FIXED_BARBER" | "FREE_BARBER";

export interface Settings {
  pixKey: string;
  termsDocumentUrl: string;
  termsDocumentName: string;
  hiddenBookingPaymentMethods: BookingPaymentMethod[];
  subscriptionBarberRule: SubscriptionBarberRule;
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
  subscriptionBarberRule?: SubscriptionBarberRule;
  commissionPoolPercent?: number;
}

interface HomeInfoSettingsResponse {
  barber_payment_frequency?: PaymentFrequency | null;
  employee_payment_frequency?: PaymentFrequency | null;
  barberPaymentFrequency?: PaymentFrequency | null;
  employeePaymentFrequency?: PaymentFrequency | null;
}

export interface PaymentFrequencySettings {
  barberPaymentFrequency: PaymentFrequency;
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
    subscriptionBarberRule: data.subscriptionBarberRule ?? "fixed",
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
    barberPaymentFrequency: normalizePaymentFrequency(
      data.barberPaymentFrequency ?? data.barber_payment_frequency
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
    barberPaymentFrequency: data.barberPaymentFrequency,
    employeePaymentFrequency: data.employeePaymentFrequency,
  });

  return mapPaymentFrequencySettings(response.data);
}
