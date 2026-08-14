import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ClientPickerModal } from "@/components/ClientPickerModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REASON_LABELS, createRelationshipCard } from "@/service/relationshipService";
import { listUsers, type UserProfile } from "@/service/userService";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function extractErrorMessage(error: unknown, fallback: string) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : fallback;
}

export function RelationshipCreateCardDialog({ open, onClose, onCreated }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [client, setClient] = useState<UserProfile | null>(null);
  const [primaryReason, setPrimaryReason] = useState("");
  const [responsibleId, setResponsibleId] = useState("none");
  const [responsibleOptions, setResponsibleOptions] = useState<UserProfile[]>([]);
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setClient(null);
      setPrimaryReason("");
      setResponsibleId("none");
      setNextAction("");
      setNextActionAt("");
      setNotes("");
      return;
    }
    listUsers({ excludeRole: "client", limit: 100 }).then((r) => setResponsibleOptions(r.items)).catch(() => null);
  }, [open]);

  async function handleSubmit() {
    if (!client) {
      toast.error("Selecione um cliente.");
      return;
    }
    if (!primaryReason) {
      toast.error("Selecione o motivo principal.");
      return;
    }
    setSubmitting(true);
    try {
      await createRelationshipCard({
        clientId: client.id,
        primaryReason,
        responsibleSalonUserId: responsibleId === "none" ? null : responsibleId,
        nextAction: nextAction.trim() || null,
        nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null,
        notes: notes.trim() || null,
      });
      toast.success("Card criado.");
      onCreated();
      onClose();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível criar o card."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo card de relacionamento</DialogTitle>
          </DialogHeader>

          <div>
            <Label>Cliente</Label>
            {client ? (
              <div className="mt-1.5 flex items-center justify-between rounded-lg border border-border p-2.5 text-sm">
                <div>
                  <p className="font-medium text-foreground">{client.name}</p>
                  {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="mt-1.5 w-full" onClick={() => setPickerOpen(true)}>
                Selecionar cliente
              </Button>
            )}
          </div>

          <div>
            <Label>Motivo principal</Label>
            <Select value={primaryReason} onValueChange={setPrimaryReason}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REASON_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Responsável</Label>
            <Select value={responsibleId} onValueChange={setResponsibleId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {responsibleOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Próxima ação</Label>
              <Input className="mt-1.5" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Ex.: Enviar WhatsApp" />
            </div>
            <div>
              <Label>Data/hora da próxima ação</Label>
              <Input className="mt-1.5" type="datetime-local" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea className="mt-1.5 min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-fit self-end">
            {submitting ? "Criando..." : "Criar card"}
          </Button>
        </DialogContent>
      </Dialog>

      <ClientPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setClient} />
    </>
  );
}
