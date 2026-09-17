import api from "./api";

const PAGARME_PUBLIC_KEY = import.meta.env.VITE_PAGARME_PUBLIC_KEY as string;
// A Pagar.me usa o mesmo host para chaves de teste (`pk_test_*`) e de produção.
// O ambiente é definido pelo tipo da chave, não por um endpoint `sdx-api` separado.
const DEFAULT_PAGARME_BASE_URL = "https://api.pagar.me/core/v5";
const PAGARME_BASE_URL = String(
  import.meta.env.VITE_PAGARME_BASE_URL || DEFAULT_PAGARME_BASE_URL,
).replace(/\/+$/, "");

function onlyNumbers(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

export interface CardFormData {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  document: string;
  phone: string;
  installments: number;
  billingAddress?: {
    line1: string;
    zipCode: string;
    city: string;
    state: string;
  };
}

export interface PagarmeOrderPayload {
  amount: number;
  paymentMethod: "card" | "pix";
  installments?: number;
  cardToken?: string;
  customer: {
    id: string;
    name: string;
    email: string;
    document: string;
    phone: string;
  };
  item: {
    id: string;
    name: string;
  };
  metadata: Record<string, string>;
}

export interface PagarmeOrderResult {
  orderId?: string;
  orderCode?: string;
  status?: string;
  chargeId?: string;
  chargeStatus?: string;
  amount: number;
  paymentMethod?: string;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  cardBrand?: string;
  cardLastDigits?: string;
  failureReason?: string;
}

export async function createPagarmeCardToken(
  card: CardFormData,
  options: { requireBillingAddress?: boolean } = {},
): Promise<string> {
  if (!PAGARME_PUBLIC_KEY) {
    throw new Error("VITE_PAGARME_PUBLIC_KEY nao foi definida no .env do frontend.");
  }

  const number = onlyNumbers(card.number);
  const cvv = onlyNumbers(card.cvv);
  const expMonth = Number(card.expMonth);
  // A API de tokenização preserva o ano informado pelo portador. Em especial,
  // enviar 2030 quando o campo recebeu "30" gera um token que falha na
  // verificação do cartão ao criar a assinatura.
  const expYear = Number(card.expYear);
  const validationYear = String(card.expYear).length === 2 ? 2000 + expYear : expYear;
  const billingAddress = card.billingAddress;

  if (!number || number.length < 13) throw new Error("Numero do cartao invalido.");
  if (!card.holderName?.trim()) throw new Error("Nome impresso no cartao e obrigatorio.");
  if (!expMonth || expMonth < 1 || expMonth > 12) throw new Error("Mes de validade invalido.");
  const now = new Date();
  if (
    !validationYear ||
    validationYear < now.getFullYear() ||
    (validationYear === now.getFullYear() && expMonth < now.getMonth() + 1)
  ) throw new Error("Ano de validade invalido.");
  if (!cvv || cvv.length < 3) throw new Error("CVV invalido.");
  if (options.requireBillingAddress && (
    !billingAddress?.line1?.trim() ||
    billingAddress.zipCode.replace(/\D/g, "").length !== 8 ||
    !billingAddress.city?.trim() ||
    !/^[a-z]{2}$/i.test(billingAddress.state?.trim() || "")
  )) throw new Error("Informe o endereco de cobranca completo.");

  const address = billingAddress
    ? {
        line_1: billingAddress.line1.trim(),
        zip_code: billingAddress.zipCode.replace(/\D/g, ""),
        city: billingAddress.city.trim(),
        state: billingAddress.state.trim().toUpperCase(),
        country: "BR",
      }
    : {
        line_1: "50, Rua Goias, Teste",
        zip_code: "36036646",
        city: "Juiz de Fora",
        state: "MG",
        country: "BR",
      };

  const response = await fetch(
    `${PAGARME_BASE_URL}/tokens?appId=${encodeURIComponent(PAGARME_PUBLIC_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "card",
        card: {
          number,
          holder_name: card.holderName.trim(),
          holder_document: card.document,
          exp_month: expMonth,
          exp_year: expYear,
          cvv,
          billing_address: address,
        },
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const errors = data?.errors as Record<string, string[]> | undefined;
    const msg =
      (data?.message as string) ||
      errors?.card?.[0] ||
      "Erro ao tokenizar cartao no Pagar.me.";
    throw new Error(msg);
  }

  const token = (data?.id || data?.token) as string | undefined;
  if (!token) throw new Error("Pagar.me nao retornou o token do cartao.");

  return token;
}

export async function createPagarmeOrder(
  payload: PagarmeOrderPayload,
): Promise<PagarmeOrderResult> {
  const { data } = await api.post<PagarmeOrderResult>("/pagarme/orders", payload);
  return data;
}

export async function checkPagarmeOrderStatus(orderId: string): Promise<PagarmeOrderResult> {
  const { data } = await api.get<PagarmeOrderResult>(`/pagarme/orders/${orderId}/status`);
  return data;
}

export async function createPagarmeRecipient(payload: Record<string, unknown>) {
  const { data } = await api.post("/pagarme/recipients", payload);
  return data;
}

export async function getPagarmeRecipient(recipientId: string) {
  const { data } = await api.get(`/pagarme/recipients/${recipientId}`);
  return data;
}

export async function updatePagarmeRecipient(recipientId: string, payload: Record<string, unknown>) {
  const { data } = await api.put(`/pagarme/recipients/${recipientId}`, payload);
  return data;
}


const PAID_STATUSES = ["paid", "approved", "succeeded"];
const FAILED_STATUSES = ["failed", "canceled", "cancelled", "rejected"];

export function isPaidOrder(order: PagarmeOrderResult): boolean {
  const status = String(order?.status ?? "").toLowerCase();
  const charge = String(order?.chargeStatus ?? "").toLowerCase();
  return PAID_STATUSES.includes(status) || PAID_STATUSES.includes(charge);
}

export function isFailedOrder(order: PagarmeOrderResult): boolean {
  const status = String(order?.status ?? "").toLowerCase();
  const charge = String(order?.chargeStatus ?? "").toLowerCase();
  return FAILED_STATUSES.includes(status) || FAILED_STATUSES.includes(charge);
}
