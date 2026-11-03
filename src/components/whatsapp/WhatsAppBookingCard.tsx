import { useEffect, useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getBookingStatus, setBookingEnabled, whatsappErrorMessage, type BookingStatus } from "@/service/whatsappHubService";

// Liga/desliga o assistente que agenda pelo WhatsApp usando a agenda do SalaOne.
export function WhatsAppBookingCard() {
  const [status, setStatus] = useState<BookingStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBookingStatus()
      .then(setStatus)
      .catch(() => setStatus({ configured: false, enabled: false }));
  }, []);

  async function toggle(enabled: boolean) {
    if (!enabled && !window.confirm("Desativar o agendamento automático? Os clientes passam a ser atendidos só pela equipe.")) return;
    setBusy(true);
    try {
      setStatus(await setBookingEnabled(enabled));
      toast.success(enabled ? "Agendamento pelo WhatsApp ativado" : "Agendamento pelo WhatsApp desativado");
    } catch (error) {
      toast.error(whatsappErrorMessage(error, "Não foi possível alterar o agendamento automático"));
    } finally {
      setBusy(false);
    }
  }

  const enabled = !!status?.enabled;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-primary" />
            <h3 className="font-semibold">Agendamento pelo WhatsApp</h3>
            {status && (enabled ? <Badge className="bg-emerald-500/15 text-emerald-700" variant="outline">Ativo</Badge> : <Badge variant="outline">Desativado</Badge>)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando o cliente escreve <b>AGENDAR</b>, <b>MARCAR</b> ou <b>HORÁRIO</b>, um assistente mostra serviços, profissionais e horários livres da sua agenda
            e cria o agendamento. Também atende <b>CANCELAR</b> e <b>REMARCAR</b>. Se o cliente pedir <b>ATENDENTE</b> ou você responder pelo painel, o assistente
            para naquela conversa por 2 horas.
          </p>
        </div>
        {status === null ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Button size="sm" variant={enabled ? "outline" : "default"} disabled={busy} onClick={() => toggle(!enabled)}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        )}
      </div>
    </div>
  );
}
