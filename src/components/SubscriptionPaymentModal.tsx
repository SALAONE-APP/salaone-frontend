import { useState } from 'react';
import { X, CreditCard, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { subscribeSalonPlatformPlan, type PlatformPlan } from '@/service/platformSubscriptionService';
import { useAuth } from '@/hooks/useAuth';

interface SubscriptionPaymentModalProps {
  isOpen: boolean;
  plan: PlatformPlan | null;
  onClose: () => void;
  onSuccess: () => void;
}

function formatCardNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

export function SubscriptionPaymentModal({ isOpen, plan, onClose, onSuccess }: SubscriptionPaymentModalProps) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [cardForm, setCardForm] = useState({
    number: '',
    holderName: '',
    expMonth: '',
    expYear: '',
    cvv: '',
    document: '',
    phone: '',
    installments: 1,
  });

  if (!isOpen || !plan) return null;

  const amount = Number(plan.price ?? 0);

  function update(field: keyof typeof cardForm, value: string | number) {
    setCardForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): string | null {
    if (!cardForm.number.replace(/\s/g, '').trim()) return 'Informe o número do cartão.';
    if (!cardForm.holderName.trim()) return 'Informe o nome impresso no cartão.';
    if (!cardForm.expMonth.trim()) return 'Informe o mês de validade.';
    if (!cardForm.expYear.trim()) return 'Informe o ano de validade.';
    if (!cardForm.cvv.trim()) return 'Informe o CVV.';
    if (!cardForm.document.replace(/\D/g, '')) return 'Informe o CPF do pagador.';
    if (!cardForm.phone.replace(/\D/g, '')) return 'Informe o telefone do pagador.';
    if (!acceptedTerms) return 'Você precisa aceitar os termos da assinatura.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    if (!plan) return;
    setProcessing(true);
    try {
      await subscribeSalonPlatformPlan({
        platformPlanId: plan.id,
        amount,
        cardForm: { ...cardForm, number: cardForm.number.replace(/\s/g, '') },
        customer: { name: user?.name, email: user?.email },
      });
      toast.success('Assinatura criada com sucesso!');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as { message?: string })?.message ||
        'Não foi possível criar a assinatura.';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-y-auto max-h-[90vh] rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center gap-2 border-b border-border px-6 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CreditCard size={22} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Finalizar assinatura</h2>
          <p className="text-sm text-muted-foreground">Assinatura recorrente mensal no cartão de crédito.</p>
        </div>

        {/* Resumo */}
        <div className="mx-6 mt-4 flex justify-between rounded-lg bg-secondary/60 px-4 py-3 text-sm">
          <div>
            <p className="text-muted-foreground">Plano selecionado</p>
            <p className="font-semibold text-foreground">{plan.name}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Valor mensal</p>
            <p className="font-semibold text-foreground">
              R$ {amount.toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Número do cartão</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              value={cardForm.number}
              onChange={(e) => update('number', formatCardNumber(e.target.value))}
              autoComplete="cc-number"
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Nome impresso no cartão</label>
            <input
              type="text"
              placeholder="Nome como está no cartão"
              value={cardForm.holderName}
              onChange={(e) => update('holderName', e.target.value)}
              autoComplete="cc-name"
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Mês</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM"
                maxLength={2}
                value={cardForm.expMonth}
                onChange={(e) => update('expMonth', e.target.value.replace(/\D/g, ''))}
                autoComplete="cc-exp-month"
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Ano</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="AAAA"
                maxLength={4}
                value={cardForm.expYear}
                onChange={(e) => update('expYear', e.target.value.replace(/\D/g, ''))}
                autoComplete="cc-exp-year"
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">CVV</label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="123"
                maxLength={4}
                value={cardForm.cvv}
                onChange={(e) => update('cvv', e.target.value.replace(/\D/g, ''))}
                autoComplete="cc-csc"
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">CPF do pagador</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cardForm.document}
                onChange={(e) => update('document', e.target.value)}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Telefone</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={cardForm.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>Li e aceito a cobrança recorrente mensal deste plano.</span>
          </label>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            Pagamento seguro processado pelo Pagar.me.
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={processing}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={processing}>
              {processing && <Spinner />}
              {processing ? 'Criando assinatura...' : 'Confirmar assinatura'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
