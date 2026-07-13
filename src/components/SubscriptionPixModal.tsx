import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Plan } from "@/service/planService";
import {
  confirmClientPlanPixOrder,
  createClientPlanPixOrder,
} from "@/service/platformSubscriptionService";

interface SubscriptionPixModalProps {
  plan: Plan;
  user: { cpf?: string | null; phone?: string | null } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function SubscriptionPixModal({ plan, user, onClose, onSuccess }: SubscriptionPixModalProps) {
  const [loading, setLoading] = useState(true);
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState("");
  const [orderId, setOrderId] = useState("");
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generatingRef = useRef(false);

  function clearPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
  }

  async function confirmPayment(currentOrderId: string) {
    try {
      const result = await confirmClientPlanPixOrder({ planId: plan.id, orderId: currentOrderId });
      if (!result.paid) return;
      clearPolling();
      toast.success("Pagamento confirmado. Assinatura ativada!");
      onSuccess();
    } catch {
      // Mantem a consulta ativa enquanto o PIX estiver pendente.
    }
  }

  async function generatePix() {
    if (generatingRef.current) return;
    generatingRef.current = true;
    clearPolling();
    setLoading(true);
    try {
      const result = await createClientPlanPixOrder({
        planId: plan.id,
        customer: { document: user?.cpf ?? undefined, phone: user?.phone ?? undefined },
      });
      if (!result.orderId || !result.pixQrCode) {
        throw new Error("Nao foi possivel gerar o QR Code PIX.");
      }
      setOrderId(result.orderId);
      setPixQrCode(result.pixQrCode);
      setPixQrCodeUrl(result.pixQrCodeUrl ?? "");
      pollingRef.current = setInterval(() => void confirmPayment(result.orderId!), 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel gerar o PIX.");
    } finally {
      generatingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    void generatePix();
    return clearPolling;
    // O modal e recriado para cada plano selecionado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyPix() {
    if (!pixQrCode) return;
    void navigator.clipboard.writeText(pixQrCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento da assinatura via PIX</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{plan.name}</p>
          <p className="text-muted-foreground">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(plan.price)}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            Gerando QR Code PIX...
          </div>
        ) : orderId && pixQrCode ? (
          <div className="space-y-4">
            {pixQrCodeUrl ? (
              <div className="flex justify-center">
                <img src={pixQrCodeUrl} alt="QR Code PIX" className="w-56 rounded-xl border bg-white p-2" />
              </div>
            ) : null}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">PIX copia e cola</p>
              <div className="flex gap-2">
                <Input value={pixQrCode} readOnly className="text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyPix}>
                  {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                </Button>
              </div>
            </div>
            <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
              Aguardando pagamento. A assinatura sera ativada automaticamente apos a confirmacao.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Fechar</Button>
              <Button variant="outline" className="flex-1" onClick={() => void generatePix()}>Gerar novo PIX</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm text-destructive">Nao foi possivel gerar o PIX.</p>
            <Button onClick={() => void generatePix()}>Tentar novamente</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
