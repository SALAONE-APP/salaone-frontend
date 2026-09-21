import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
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
  SALES_CHANNELS,
  SALES_CONTACT_TYPES,
  SALES_LEAD_STAGES,
  SALES_LOST_REASONS,
  deleteSalesLead,
  getSalesLead,
  createSalesActivity,
  listSalesActivities,
  listSalesScripts,
  salesActivityTypeLabel,
  salesChannelLabel,
  salesContactTypeLabel,
  salesLeadStageLabel,
  salesLostReasonLabel,
  updateSalesLead,
  type SalesLead,
  type SalesLeadActivity,
  type SalesScript,
} from "@/service/salesCrmService";
import { listSuperAdminUsers, type SuperAdminUser } from "@/service/superAdminService";

interface Props {
  leadId: string | null;
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

export function SalesLeadDetailDialog({ leadId, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [lead, setLead] = useState<SalesLead | null>(null);
  const [activities, setActivities] = useState<SalesLeadActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [responsibleOptions, setResponsibleOptions] = useState<SuperAdminUser[]>([]);
  const [scriptOptions, setScriptOptions] = useState<SalesScript[]>([]);

  const [contactName, setContactName] = useState("");
  const [salonName, setSalonName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [scriptId, setScriptId] = useState("none");
  const [stage, setStage] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [notes, setNotes] = useState("");

  const [contactType, setContactType] = useState("");
  const [contactOutcome, setContactOutcome] = useState("");
  const [contactNotes, setContactNotes] = useState("");

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [leadData, activitiesData] = await Promise.all([getSalesLead(id), listSalesActivities(id)]);
      setLead(leadData);
      setActivities(activitiesData);
      setContactName(leadData.contactName);
      setSalonName(leadData.salonName ?? "");
      setPhone(leadData.phone);
      setInstagramHandle(leadData.instagramHandle ?? "");
      setEmail(leadData.email ?? "");
      setChannel(leadData.channel);
      setResponsibleId(leadData.responsibleId);
      setScriptId(leadData.scriptId ?? "none");
      setStage(leadData.stage);
      setLostReason(leadData.lostReason ?? "");
      setNextAction(leadData.nextAction ?? "");
      setNextActionAt(toDateTimeLocalInput(leadData.nextActionAt));
      setNotes(leadData.notes ?? "");
    } catch {
      toast.error("Não foi possível carregar o lead.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (leadId) {
      void load(leadId);
      listSalesScripts({ active: true }).then(setScriptOptions).catch(() => null);
      if (isSuperAdmin) {
        Promise.all([
          listSuperAdminUsers({ role: "sales_rep", limit: 100 }),
          listSuperAdminUsers({ role: "super_admin", limit: 100 }),
        ])
          .then(([reps, admins]) => setResponsibleOptions([...reps.items, ...admins.items]))
          .catch(() => null);
      }
    } else {
      setLead(null);
      setActivities([]);
      setConfirmingDelete(false);
    }
  }, [leadId, load, isSuperAdmin]);

  async function handleSave() {
    if (!lead) return;
    if (stage === "perdido" && !lostReason) {
      toast.error("Selecione o motivo da perda antes de salvar.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateSalesLead(lead.id, {
        contactName: contactName.trim(),
        salonName: salonName.trim() || null,
        phone: phone.trim(),
        instagramHandle: instagramHandle.trim() || null,
        email: email.trim() || null,
        channel,
        responsibleId,
        scriptId: scriptId === "none" ? null : scriptId,
        notes: notes.trim() || null,
        nextAction: nextAction.trim() || null,
        nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null,
        stage,
        lostReason: stage === "perdido" ? lostReason : undefined,
      });
      setLead(updated);
      setStage(updated.stage);
      setActivities(await listSalesActivities(lead.id));
      onChanged();
      toast.success("Lead atualizado.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível salvar as alterações."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterContact() {
    if (!lead) return;
    if (!contactType) {
      toast.error("Selecione o tipo de contato.");
      return;
    }
    try {
      await createSalesActivity(lead.id, {
        activityType: "contact",
        contactType,
        outcome: contactOutcome.trim() || undefined,
        notes: contactNotes.trim() || null,
      });
      setActivities(await listSalesActivities(lead.id));
      setContactType("");
      setContactOutcome("");
      setContactNotes("");
      toast.success("Contato registrado.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível registrar o contato."));
    }
  }

  async function handleDelete() {
    if (!lead) return;
    try {
      await deleteSalesLead(lead.id);
      toast.success("Lead excluído.");
      setConfirmingDelete(false);
      onChanged();
      onClose();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível excluir o lead."));
    }
  }

  return (
    <>
      <Dialog open={Boolean(leadId)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lead ? (
                <>
                  {lead.contactName}
                  <Badge variant="outline">{salesLeadStageLabel(lead.stage)}</Badge>
                </>
              ) : (
                "Carregando lead..."
              )}
            </DialogTitle>
          </DialogHeader>

          {loading || !lead ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Nome do contato</Label>
                  <Input className="mt-1.5" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
                <div>
                  <Label>Nome do salão</Label>
                  <Input className="mt-1.5" value={salonName} onChange={(e) => setSalonName(e.target.value)} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input className="mt-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Instagram</Label>
                  <Input className="mt-1.5" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input className="mt-1.5" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Canal de origem</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {SALES_CHANNELS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {salesChannelLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Etapa</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {SALES_LEAD_STAGES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {salesLeadStageLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {stage === "perdido" && (
                <div>
                  <Label>Motivo da perda</Label>
                  <Select value={lostReason} onValueChange={setLostReason}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {SALES_LOST_REASONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {salesLostReasonLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Vendedor responsável</Label>
                {isSuperAdmin ? (
                  <Select value={responsibleId} onValueChange={setResponsibleId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {responsibleOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input className="mt-1.5" value={lead.responsibleName ?? ""} disabled />
                )}
              </div>

              <div>
                <Label>Script utilizado</Label>
                <Select value={scriptId} onValueChange={setScriptId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione um script" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {scriptOptions.map((script) => (
                      <SelectItem key={script.id} value={script.id}>
                        {script.name} ({script.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Próxima ação</Label>
                  <Input className="mt-1.5" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Ex.: Ligar novamente" />
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

              <Button size="sm" onClick={handleSave} disabled={saving} className="w-fit gap-2">
                <Save size={14} />
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>

              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <Label>Registrar contato</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Select value={contactType} onValueChange={setContactType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {SALES_CONTACT_TYPES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {salesContactTypeLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Resultado (ex.: respondeu, sem resposta)"
                    value={contactOutcome}
                    onChange={(e) => setContactOutcome(e.target.value)}
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
                {activities.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma atividade registrada ainda.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {activities.map((activity) => (
                      <div key={activity.id} className="rounded-lg border border-border bg-card p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{salesActivityTypeLabel(activity.activityType)}</span>
                          <span className="text-muted-foreground">{formatDateTime(activity.createdAt)}</span>
                        </div>
                        {activity.fromStage && activity.toStage && (
                          <p className="mt-1 text-muted-foreground">
                            {salesLeadStageLabel(activity.fromStage)} → {salesLeadStageLabel(activity.toStage)}
                          </p>
                        )}
                        {activity.contactType && (
                          <p className="mt-1 text-muted-foreground">
                            {salesContactTypeLabel(activity.contactType)}
                            {activity.outcome ? ` — ${activity.outcome}` : ""}
                          </p>
                        )}
                        {activity.notes && <p className="mt-1 text-foreground">{activity.notes}</p>}
                        {activity.createdByName && <p className="mt-1 text-muted-foreground">Por {activity.createdByName}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit gap-2 border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={14} />
                  Excluir lead
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o lead de {lead?.contactName} e todo o histórico associado. Não pode ser desfeita.
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
