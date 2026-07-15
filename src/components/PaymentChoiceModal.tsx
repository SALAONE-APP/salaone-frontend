import { Banknote, CreditCard, Store, Scissors } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PaymentChoice = "cartao" | "pix" | "local" | "subscription";

export interface AppointmentSummary {
  professionalName: string;
  date: string;
  time: string;
  serviceName: string;
  totalAmount: number;
}

interface PaymentChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (method: PaymentChoice) => void;
  summary: AppointmentSummary;
  canPayCard?: boolean;
  canPayPix?: boolean;
  canPayLocal?: boolean;
  canPaySubscription?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

interface ChoiceCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
}

function ChoiceCard({ icon: Icon, title, description, onClick }: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center w-full",
        "transition-colors hover:border-primary/60 hover:bg-primary/5",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon size={24} />
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

export function PaymentChoiceModal({
  isOpen,
  onClose,
  onChoose,
  summary,
  canPayCard = true,
  canPayPix = true,
  canPayLocal = true,
  canPaySubscription = false,
}: PaymentChoiceModalProps) {
  function handleChoose(method: PaymentChoice) {
    onChoose(method);
    onClose();
  }

  const hasMethod = canPayCard || canPayPix || canPayLocal || canPaySubscription;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Como deseja pagar?</DialogTitle>
        </DialogHeader>

        {/* Resumo do agendamento */}
        <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1 text-sm">
          <p className="text-muted-foreground">
            Profissional: <span className="font-medium text-foreground">{summary.professionalName}</span>
          </p>
          <p className="text-muted-foreground">
            Data: <span className="font-medium text-foreground">{summary.date}</span>
          </p>
          <p className="text-muted-foreground">
            Horario: <span className="font-medium text-foreground">{summary.time}</span>
          </p>
          <p className="text-muted-foreground">
            Servico: <span className="font-medium text-foreground">{summary.serviceName}</span>
          </p>
          <p className="text-muted-foreground pt-1 border-t border-border">
            Total:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(summary.totalAmount)}
            </span>
          </p>
        </div>

        {/* Opções de pagamento */}
        {hasMethod ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {canPaySubscription && (
              <ChoiceCard
                icon={Scissors}
                title="Assinatura"
                description="Usar saldo do plano"
                onClick={() => handleChoose("subscription")}
              />
            )}
            {canPayCard && (
              <ChoiceCard
                icon={CreditCard}
                title="Cartao"
                description="Credito ou debito"
                onClick={() => handleChoose("cartao")}
              />
            )}
            {canPayPix && (
              <ChoiceCard
                icon={Banknote}
                title="Pix"
                description="Rapido e seguro"
                onClick={() => handleChoose("pix")}
              />
            )}
            {canPayLocal && (
              <ChoiceCard
                icon={Store}
                title="No local"
                description="Pague na salão"
                onClick={() => handleChoose("local")}
              />
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-destructive">
            Nenhuma forma de pagamento disponivel no momento.
          </p>
        )}

        <Button variant="outline" onClick={onClose} className="w-full">
          Voltar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
