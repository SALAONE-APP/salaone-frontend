import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Save, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  CONTACT_TYPE_LABELS,
  EVENT_TYPE_LABELS,
  REASON_LABELS,
  addRelationshipTrigger,
  createRelationshipEvent,
  deleteRelationshipCard,
  getRelationshipCard,
  listRelationshipEvents,
  reasonLabel,
  setRelationshipTriggerPrimary,
  stageLabel,
  updateRelationshipCard,
  type RelationshipCard,
  type RelationshipEvent,
  type RelationshipPipeline,
} from "@/service/relationshipService";
import { listUsers, type UserProfile } from "@/service/userService";

interface Props {
  cardId: string | null;
  pipelines: RelationshipPipeline[];
  onClose: () => void;
  onChanged: () => void;
}

function extractErrorMessage(error: unknown, fallback: string) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : fallback;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toDateTimeLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function RelationshipCardDetailDialog({ cardId, pipelines, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const [card, setCard] = useState<RelationshipCard | null>(null);
  const [events, setEvents] = useState<RelationshipEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [responsibleOptions, setResponsibleOptions] = useState<UserProfile[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [responsibleId, setResponsibleId] = useState("none");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [notes, setNotes] = useState("");

  const [newTriggerReason, setNewTriggerReason] = useState("");

  const [contactType, setContactType] = useState("");
  const [contactOutcome, setContactOutcome] = useState("");
  const [contactNotes, setContactNotes] = useState("");

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [cardData, eventsData] = await Promise.all([getRelationshipCard(id), listRelationshipEvents(id)]);
      setCard(cardData);
      setEvents(eventsData);
      setResponsibleId(cardData.responsibleSalonUserId ?? "none");
      setNextAction(cardData.nextAction ?? "");
      setNextActionAt(toDateTimeLocalInput(cardData.nextActionAt));
      setNotes(cardData.notes ?? "");
    } catch {
      toast.error("Não foi possível carregar o card.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cardId) {
      void load(cardId);
      listUsers({ excludeRole: "client", limit: 100 }).then((r) => setResponsibleOptions(r.items)).catch(() => null);
    } else {
      setCard(null);
      setEvents([]);
      setConfirmingDelete(false);
    }
  }, [cardId, load]);

  async function handleSaveFields() {
    if (!card) return;
    setSaving(true);
    try {
      const updated = await updateRelationshipCard(card.id, {
        responsibleSalonUserId: responsibleId === "none" ? null : responsibleId,
        nextAction: nextAction.trim() || null,
        nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null,
        notes: notes.trim() || null,
      });
      setCard(updated);
      onChanged();
      toast.success("Card atualizado.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível salvar as alterações."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTrigger() {
    if (!card || !newTriggerReason) return;
    try {
      const updated = await addRelationshipTrigger(card.id, { reason: newTriggerReason });
      setCard(updated);
      setNewTriggerReason("");
      onChanged();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível adicionar o motivo."));
    }
  }

  async function handleSetPrimary(triggerId: string) {
    if (!card) return;
    try {
      const updated = await setRelationshipTriggerPrimary(card.id, triggerId);
      setCard(updated);
      onChanged();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível atualizar o motivo principal."));
    }
  }

  async function handleRegisterContact() {
    if (!card) return;
    if (!contactType && !contactNotes.trim()) {
      toast.error("Selecione um canal de contato ou escreva uma observação.");
      return;
    }
    try {
      await createRelationshipEvent(card.id, {
        contactType: contactType || undefined,
        outcome: contactType ? contactOutcome.trim() || undefined : undefined,
        notes: contactNotes.trim() || null,
      });
      setEvents(await listRelationshipEvents(card.id));
      setContactType("");
      setContactOutcome("");
      setContactNotes("");
      toast.success("Registrado.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível registrar o contato."));
    }
  }

  async function handleDelete() {
    if (!card) return;
    try {
      await deleteRelationshipCard(card.id);
      toast.success("Card excluído.");
      setConfirmingDelete(false);
      onChanged();
      onClose();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível excluir o card."));
    }
  }

  const cardStages = card ? pipelines.find((pipeline) => pipeline.id === card.pipelineId)?.stages : undefined;

  const canDelete = Boolean(
    card && user && (user.role === "admin" || user.role === "super_admin" || card.createdBy === user.id),
  );

  return (
    <>
      <Dialog open={Boolean(cardId)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {card ? (
                <>
                  {card.clientName}
                  <Badge variant="outline">{stageLabel(card.stage, cardStages)}</Badge>
                </>
              ) : (
                "Carregando card..."
              )}
            </DialogTitle>
          </DialogHeader>

          {loading || !card ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label>Motivos</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {card.triggers.map((trigger) => (
                    <Badge key={trigger.id} variant={trigger.isPrimary ? "default" : "outline"} className="gap-1 text-[11px]">
                      {reasonLabel(trigger.reason)}
                      {!trigger.isPrimary && (
                        <button
                          type="button"
                          title="Tornar principal"
                          onClick={() => handleSetPrimary(trigger.id)}
                          className="ml-1 opacity-70 hover:opacity-100"
                        >
                          <Star size={11} />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select value={newTriggerReason} onValueChange={setNewTriggerReason}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Adicionar motivo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REASON_LABELS)
                        .filter(([key]) => !card.triggers.some((trigger) => trigger.reason === key))
                        .map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" disabled={!newTriggerReason} onClick={handleAddTrigger}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Última visita</span>
                  <p className="font-medium text-foreground">
                    {card.stats.daysSinceLastVisit === null ? "Sem visitas" : `${card.stats.daysSinceLastVisit} dias`}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Frequência média</span>
                  <p className="font-medium text-foreground">
                    {card.stats.averageFrequencyDays === null ? "-" : `~${Math.round(card.stats.averageFrequencyDays)} dias`}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Serviço favorito</span>
                  <p className="truncate font-medium text-foreground">{card.stats.favoriteService ?? "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Profissional preferido</span>
                  <p className="truncate font-medium text-foreground">{card.stats.favoriteProfessional ?? "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ticket médio</span>
                  <p className="font-medium text-foreground">
                    {card.stats.averageTicket === null
                      ? "-"
                      : card.stats.averageTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total de atendimentos</span>
                  <p className="font-medium text-foreground">{card.stats.totalAppointments}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Responsável</Label>
                    {user?.salonUserId && responsibleId !== user.salonUserId && (
                      <button
                        type="button"
                        onClick={() => setResponsibleId(user.salonUserId!)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Atribuir a mim
                      </button>
                    )}
                  </div>
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
                <Button size="sm" onClick={handleSaveFields} disabled={saving} className="w-fit gap-2">
                  <Save size={14} />
                  {saving ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <Label>Registrar contato</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Select value={contactType} onValueChange={setContactType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTACT_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Resultado (ex.: respondeu, sem resposta)"
                    value={contactOutcome}
                    onChange={(e) => setContactOutcome(e.target.value)}
                    disabled={!contactType}
                  />
                </div>
                <Textarea
                  placeholder="Observação (opcional)"
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  className="min-h-16"
                />
                <Button size="sm" variant="outline" onClick={handleRegisterContact} className="w-fit">
                  Registrar
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Histórico</Label>
                {events.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {events.map((event) => (
                      <div key={event.id} className="rounded-lg border border-border bg-card p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}</span>
                          <span className="text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                        </div>
                        {event.fromStage && event.toStage && (
                          <p className="mt-1 text-muted-foreground">
                            {stageLabel(event.fromStage, cardStages)} → {stageLabel(event.toStage, cardStages)}
                          </p>
                        )}
                        {event.contactType && (
                          <p className="mt-1 text-muted-foreground">
                            {CONTACT_TYPE_LABELS[event.contactType] ?? event.contactType}
                            {event.outcome ? ` — ${event.outcome}` : ""}
                          </p>
                        )}
                        {event.notes && <p className="mt-1 text-foreground">{event.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit gap-2 border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={14} />
                  Excluir card
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o card de {card?.clientName} e todo o histórico associado. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
