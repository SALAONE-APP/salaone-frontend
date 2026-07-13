import api from "./api";

export interface PagarmeWithdrawalBalance {
  recipientId: string;
  recipientStatus: string | null;
  balance: {
    availableAmount: number;
    waitingFundsAmount: number;
    transferredAmount: number;
    raw?: unknown;
  };
}

export interface PagarmeWithdrawalResult {
  recipientId: string;
  requestedAmount: number;
  requestedAmountCents: number;
  withdrawal: unknown;
}

export async function getPagarmeWithdrawalBalance() {
  const { data } = await api.get<PagarmeWithdrawalBalance>("/pagarme/withdrawals/balance");
  return data;
}

export async function requestPagarmeWithdrawal(amount: number) {
  const { data } = await api.post<PagarmeWithdrawalResult>("/pagarme/withdrawals", { amount });
  return data;
}
