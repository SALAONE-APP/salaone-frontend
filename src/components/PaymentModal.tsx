import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Copy, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cancelAppointment } from "@/service/appointmentService";
import { updatePayment } from "@/service/paymentService";
import {
  checkPagarmeOrderStatus,
  createPagarmeCardToken,
  createPagarmeOrder,
  isFailedOrder,
  isPaidOrder,
  type CardFormData,
  type PagarmeOrderPayload,
} from "@/service/pagarmeService";

export type OnlinePaymentMethod = "cartao" | "pix";

export interface PaymentModalData {
  appointmentId: string;
  paymentId: string;
  amount: number;
  serviceName: string;
  paymentMethod: OnlinePaymentMethod;
  userId: string;
  userEmail: string;
  userName: string;
  salonId: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAbort?: () => void;
  data: PaymentModalData;
  onSuccess: () => void;
}

const emptyCard: CardFormData = {
  number: "",
  holderName: "",
  expMonth: "",
  expYear: "",
  cvv: "",
  document: "",
  phone: "",
  installments: 1,
};

function onlyNumbers(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

type ScreenState = "form" | "pix" | "processing" | "rejected";

export function PaymentModal({ isOpen, onClose, onAbort, data, onSuccess }: PaymentModalProps) {
  const [screen, setScreen] = useState<ScreenState>("form");
  const [cardForm, setCardForm] = useState<CardFormData>(emptyCard);
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState("");
  const [pixOrderId, setPixOrderId] = useState("");
  const [pixCopied, setPixCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  const pixPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const method = data.paymentMethod;

  useEffect(() => {
    if (!isOpen) {
      clearPixPolling();
      setScreen(method === "pix" ? "pix" : "form");
      setCardForm(emptyCard);
      setPixQrCode("");
      setPixQrCodeUrl("");
      setPixOrderId("");
      setPixCopied(false);
      setProcessing(false);
    }
  }, [isOpen, method]);

  useEffect(() => () => clearPixPolling(), []);

  // Sair sem pagar: se não estava na tela "rejeitado" o agendamento ainda existe
  function handleAbort() {
    if (screen === "rejected") {
      onClose();
    } else {
      (onAbort ?? onClose)();
    }
  }

  function clearPixPolling() {
    if (pixPollingRef.current) {
      clearInterval(pixPollingRef.current);
      pixPollingRef.current = null;
    }
  }

  function updateCard<K extends keyof CardFormData>(key: K, value: CardFormData[K]) {
    setCardForm((prev) => ({ ...prev, [key]: value }));
  }

  async function rollback() {
    try {
      await cancelAppointment(data.appointmentId);
    } catch {
      // silent
    }
  }

  function buildOrderPayload(pm: "card" | "pix"): PagarmeOrderPayload {
    return {
      amount: data.amount,
      paymentMethod: pm,
      installments: Number(cardForm.installments || 1),
      customer: {
        id: data.userId,
        name: cardForm.holderName || data.userName,
        email: data.userEmail,
        document: onlyNumbers(cardForm.document),
        phone: onlyNumbers(cardForm.phone),
      },
      item: {
        id: data.appointmentId,
        name: data.serviceName || "Agendamento",
      },
      metadata: {
        userId: data.userId,
        isAppointmentPayment: "true",
        paymentId: data.paymentId,
        appointmentId: data.appointmentId,
        salonId: data.salonId,
      },
    };
  }

  async function persistSuccess(order: Awaited<ReturnType<typeof createPagarmeOrder>>, pm: "card" | "pix") {
    await updatePayment(
      { id: data.paymentId, appointmentId: data.appointmentId },
      {
        status: "paid",
        method: pm === "card" ? "credito" : "pix",
        paidAt: new Date().toISOString(),
      },
    );
    void order; // used via Pagar.me webhook in production
  }

  async function handleCardSubmit(e: FormEvent) {
    e.preventDefault();

    if (!cardForm.holderName.trim()) {
      toast.error("Informe o nome do titular do cartao.");
      return;
    }

    setProcessing(true);
    setScreen("processing");

    try {
      const cardToken = await createPagarmeCardToken(cardForm);
      const result = await createPagarmeOrder({ ...buildOrderPayload("card"), cardToken });

      if (isPaidOrder(result)) {
        await persistSuccess(result, "card");
        setProcessing(false);
        onClose();
        onSuccess();
        return;
      }

      if (isFailedOrder(result)) {
        await rollback();
        setProcessing(false);
        setScreen("rejected");
        return;
      }

      // processing/pending — wait for webhook
      await persistSuccess(result, "card");
      setProcessing(false);
      onClose();
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao processar pagamento.";
      toast.error(msg);
      await rollback();
      setProcessing(false);
      setScreen("form");
    }
  }

  async function handleGeneratePix() {
    if (!data.userEmail) {
      toast.error("Nao foi possivel identificar o e-mail do pagador.");
      return;
    }

    setProcessing(true);

    try {
      const result = await createPagarmeOrder(buildOrderPayload("pix"));

      if (!result.pixQrCode) throw new Error("Nao foi possivel gerar o QR Code PIX.");

      setPixOrderId(result.orderId ?? "");
      setPixQrCode(result.pixQrCode);
      setPixQrCodeUrl(result.pixQrCodeUrl ?? "");
      startPixPolling(result.orderId ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PIX.";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  }

  function startPixPolling(orderId: string) {
    clearPixPolling();
    pixPollingRef.current = setInterval(async () => {
      try {
        const latest = await checkPagarmeOrderStatus(orderId);

        if (isPaidOrder(latest)) {
          clearPixPolling();
          setProcessing(true);
          await persistSuccess(latest, "pix");
          setProcessing(false);
          onClose();
          onSuccess();
          return;
        }

        if (isFailedOrder(latest)) {
          clearPixPolling();
          await rollback();
          setPixOrderId("");
          setPixQrCode("");
          setPixQrCodeUrl("");
          setScreen("rejected");
        }
      } catch {
        // silent — keep polling
      }
    }, 3000);
  }

  function handleCopyPix() {
    if (!pixQrCode) return;
    void navigator.clipboard.writeText(pixQrCode);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2500);
  }

  const title =
    screen === "rejected"
      ? "Pagamento Recusado"
      : screen === "processing"
        ? "Processando Pagamento"
        : method === "pix"
          ? "Pagamento via PIX"
          : "Dados do Cartao";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !processing) handleAbort(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Valor */}
        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {data.serviceName || "Agendamento"} —{" "}
            <span className="font-semibold text-foreground">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                data.amount,
              )}
            </span>
          </p>
        </div>

        {/* Recusado */}
        {screen === "rejected" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <XCircle size={28} className="text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Pagamento recusado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Verifique os dados e tente novamente.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={() => setScreen(method === "pix" ? "pix" : "form")}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {/* Processando overlay */}
        {screen === "processing" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Loader2 size={40} className="animate-spin text-primary" />
            <div>
              <p className="font-semibold text-foreground">Processando pagamento</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Aguarde enquanto confirmamos sua transacao...
              </p>
            </div>
          </div>
        )}

        {/* Formulário cartão */}
        {screen === "form" && method === "cartao" && (
          <form onSubmit={handleCardSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label>Numero do cartao</Label>
              <Input
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                value={cardForm.number}
                onChange={(e) => updateCard("number", e.target.value)}
                autoComplete="cc-number"
              />
            </div>

            <div className="space-y-2">
              <Label>Nome impresso no cartao</Label>
              <Input
                placeholder="Nome completo"
                value={cardForm.holderName}
                onChange={(e) => updateCard("holderName", e.target.value)}
                autoComplete="cc-name"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>Mes</Label>
                <Input
                  inputMode="numeric"
                  placeholder="MM"
                  maxLength={2}
                  value={cardForm.expMonth}
                  onChange={(e) => updateCard("expMonth", e.target.value)}
                  autoComplete="cc-exp-month"
                />
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input
                  inputMode="numeric"
                  placeholder="AAAA"
                  maxLength={4}
                  value={cardForm.expYear}
                  onChange={(e) => updateCard("expYear", e.target.value)}
                  autoComplete="cc-exp-year"
                />
              </div>
              <div className="space-y-2">
                <Label>CVV</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="•••"
                  maxLength={4}
                  value={cardForm.cvv}
                  onChange={(e) => updateCard("cvv", e.target.value)}
                  autoComplete="cc-csc"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>CPF do pagador</Label>
                <Input
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cardForm.document}
                  onChange={(e) => updateCard("document", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  inputMode="numeric"
                  placeholder="(11) 99999-9999"
                  value={cardForm.phone}
                  onChange={(e) => updateCard("phone", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Parcelamento</Label>
              <Select
                value={String(cardForm.installments)}
                onValueChange={(v) => updateCard("installments", Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1x sem parcelamento</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                  <SelectItem value="3">3x</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleAbort}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Pagar"
                )}
              </Button>
            </div>
          </form>
        )}

        {/* PIX */}
        {screen === "form" && method === "pix" && (
          <div className="space-y-4">
            {!pixOrderId ? (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleAbort}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleGeneratePix} disabled={processing}>
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    "Gerar QR Code Pix"
                  )}
                </Button>
              </div>
            ) : (
              <>
                {pixQrCodeUrl && (
                  <div className="flex justify-center">
                    <img
                      src={pixQrCodeUrl}
                      alt="QR Code Pix"
                      className="w-56 rounded-xl border border-border bg-white p-2 shadow-md"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Pix copia e cola</p>
                  <div className="flex gap-2">
                    <Input value={pixQrCode} readOnly className="text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={handleCopyPix}>
                      {pixCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                  Aguardando confirmacao do pagamento. Esta tela fecha automaticamente apos aprovacao.
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleAbort}>
                    Fechar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleGeneratePix}
                    disabled={processing}
                  >
                    Gerar novo Pix
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
