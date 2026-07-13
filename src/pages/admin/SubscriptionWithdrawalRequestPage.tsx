import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BanknoteArrowDown,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPagarmeWithdrawalBalance,
  requestPagarmeWithdrawal,
  type PagarmeWithdrawalBalance,
} from "@/service/pagarmeWithdrawalService";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function parseCurrency(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getApiMessage(error: unknown) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(responseData)) return responseData.join(" ");
  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel concluir a solicitacao.";
}

export function SubscriptionWithdrawalRequestPage() {
  const [balance, setBalance] = useState<PagarmeWithdrawalBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const availableAmount = balance?.balance.availableAmount ?? 0;
  const requestedAmount = useMemo(() => parseCurrency(amount), [amount]);
  const canRequest = requestedAmount > 0 && requestedAmount <= availableAmount && !submitting;

  const loadBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPagarmeWithdrawalBalance();
      setBalance(data);
    } catch (err) {
      setBalance(null);
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  function fillAvailableAmount() {
    setAmount(
      availableAmount.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);

    if (requestedAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    if (requestedAmount > availableAmount) {
      toast.error("O valor solicitado e maior que o saldo disponivel.");
      return;
    }

    setSubmitting(true);
    try {
      await requestPagarmeWithdrawal(requestedAmount);
      setSuccessMessage(`Solicitacao de saque enviada: ${formatCurrency(requestedAmount)}.`);
      setAmount("");
      toast.success("Solicitacao de saque enviada.");
      await loadBalance();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Saldo disponivel</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {loading ? "-" : formatCurrency(availableAmount)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">A receber</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {loading ? "-" : formatCurrency(balance?.balance.waitingFundsAmount)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Ja transferido</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {loading ? "-" : formatCurrency(balance?.balance.transferredAmount)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BanknoteArrowDown size={20} className="text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Solicitar saque</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Solicite o saque do saldo disponivel dos pagamentos processados no cartao.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void loadBalance()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Atualizar saldo
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            Carregando saldo Pagar.me...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <XCircle size={30} className="text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Nao foi possivel carregar o saldo.</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void loadBalance()}>
              <RefreshCw size={14} />
              Tentar novamente
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 p-5">
            {successMessage ? (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <p className="text-sm text-emerald-700">{successMessage}</p>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recebedor Pagar.me</p>
                  <p className="mt-0.5 font-medium text-foreground">{balance?.recipientId}</p>
                </div>
                <Badge variant="outline">
                  {balance?.recipientStatus ?? "Status nao informado"}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="withdrawal-amount" className="text-sm font-medium text-foreground">
                Valor do saque
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="withdrawal-amount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value.replace(/[^\d,.]/g, ""))}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="pl-9"
                  />
                </div>
                <Button type="button" variant="outline" onClick={fillAvailableAmount} disabled={availableAmount <= 0}>
                  Usar saldo total
                </Button>
              </div>
              {requestedAmount > availableAmount ? (
                <p className="text-xs text-destructive">
                  O valor informado excede o saldo disponivel.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Disponivel para saque: {formatCurrency(availableAmount)}.
                </p>
              )}
            </div>

            <Button type="submit" className="gap-2" disabled={!canRequest}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <BanknoteArrowDown size={16} />}
              {submitting ? "Solicitando..." : "Solicitar saque"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
