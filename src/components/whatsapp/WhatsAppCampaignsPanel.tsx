import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, Megaphone, Pause, Play, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  campaignAction,
  createCampaign,
  listCampaigns,
  previewCampaign,
  updateCampaign,
  whatsappErrorMessage,
  type CampaignPreview,
  type CampaignStatus,
  type WhatsAppCampaign,
} from "@/service/whatsappHubService";

const STATUS: Record<CampaignStatus, [string, string]> = {
  DRAFT: ["Rascunho", ""],
  RUNNING: ["Enviando", "bg-emerald-500/15 text-emerald-700"],
  PAUSED: ["Pausada", "bg-amber-500/15 text-amber-700"],
  COMPLETED: ["Concluída", "bg-sky-500/15 text-sky-700"],
  CANCELLED: ["Cancelada", "bg-muted text-muted-foreground"],
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export function WhatsAppCampaignsPanel({ connectionId }: { connectionId: string | null }) {
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [previewFor, setPreviewFor] = useState<WhatsAppCampaign | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCampaigns(await listCampaigns());
    } catch (error) {
      toast.error(whatsappErrorMessage(error, "Não foi possível carregar as campanhas"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Atualiza os indicadores enquanto houver campanha enviando
  const anyRunning = campaigns.some((c) => c.status === "RUNNING");
  useEffect(() => {
    if (!anyRunning) return;
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, [anyRunning, load]);

  async function act(c: WhatsAppCampaign, action: "pause" | "resume" | "cancel") {
    if (action === "cancel" && !window.confirm(`Cancelar "${c.name}"? Os envios pendentes não serão feitos.`)) return;
    setBusyId(c.id);
    try {
      await campaignAction(c.id, action);
      await load();
    } catch (error) {
      toast.error(whatsappErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  if (!connectionId) return <p className="text-sm text-muted-foreground">Conecte o WhatsApp para criar campanhas.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Para proteger o número do salão, os envios são feitos aos poucos (até 100 por dia, com intervalo entre mensagens) e só para clientes que
          aceitaram receber promoções. Toda mensagem termina com a opção de responder SAIR.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Nova campanha
        </Button>
      </div>

      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Megaphone className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma campanha ainda.</p>
        </div>
      ) : (
        campaigns.map((c) => (
          <div key={c.id} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  <Badge variant="outline" className={STATUS[c.status][1]}>
                    {STATUS[c.status][0]}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.text}</p>
                {c.tags.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Etiquetas: {c.tags.join(", ")}</p>}
                {c.status === "PAUSED" && c.pausedReason && <p className="mt-1 text-xs text-amber-700">Motivo: {c.pausedReason}</p>}
                {c.status === "RUNNING" && <p className="mt-1 text-xs text-muted-foreground">Próximo envio: {fmt(c.nextSendAt)}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {c.status === "DRAFT" && (
                  <Button size="sm" onClick={() => setPreviewFor(c)}>
                    <Eye className="size-4" /> Revisar e enviar
                  </Button>
                )}
                {c.status === "RUNNING" && (
                  <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => act(c, "pause")}>
                    <Pause className="size-4" /> Pausar
                  </Button>
                )}
                {c.status === "PAUSED" && (
                  <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => act(c, "resume")}>
                    <Play className="size-4" /> Retomar
                  </Button>
                )}
                {(c.status === "DRAFT" || c.status === "RUNNING" || c.status === "PAUSED") && (
                  <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => act(c, "cancel")}>
                    <XCircle className="size-4" /> Cancelar
                  </Button>
                )}
              </div>
            </div>
            {c.status !== "DRAFT" && (
              <div className="grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-6">
                {[
                  ["Público", c.stats.total],
                  ["Enviadas", c.stats.sent],
                  ["Entregues", c.stats.delivered],
                  ["Lidas", c.stats.read],
                  ["Pendentes", c.stats.pending],
                  ["Saíram", c.stats.optOuts],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-muted/50 p-2">
                    <p className="text-lg font-semibold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      <NewCampaignDialog
        open={creating}
        connectionId={connectionId}
        onClose={() => setCreating(false)}
        onCreated={(c) => {
          void load();
          setPreviewFor(c);
        }}
      />
      <PreviewDialog campaign={previewFor} onClose={() => setPreviewFor(null)} onConfirmed={load} />
    </div>
  );
}

function NewCampaignDialog({
  open,
  connectionId,
  onClose,
  onCreated,
}: {
  open: boolean;
  connectionId: string;
  onClose: () => void;
  onCreated: (c: WhatsAppCampaign) => void;
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const c = await createCampaign({
        connectionId,
        name,
        text,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      setName("");
      setText("");
      setTags("");
      setScheduledAt("");
      onClose();
      onCreated(c);
    } catch (error) {
      toast.error(whatsappErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
          <DialogDescription>Você verá a prévia antes de enviar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome (uso interno)</Label>
            <Input placeholder="Ex.: Promoção de novembro" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea rows={5} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} />
            <p className="text-right text-xs text-muted-foreground">{text.length}/1500</p>
          </div>
          <div className="space-y-1.5">
            <Label>Somente clientes com as etiquetas (opcional)</Label>
            <Input placeholder="vip, barba" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Começar em (opcional)</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy || name.trim().length < 2 || !text.trim()}>
            {busy && <Loader2 className="size-4 animate-spin" />} Continuar para a prévia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({ campaign, onClose, onConfirmed }: { campaign: WhatsAppCampaign | null; onClose: () => void; onConfirmed: () => void }) {
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  const loadPreview = useCallback((id: string) => {
    setPreview(null);
    previewCampaign(id)
      .then(setPreview)
      .catch((error) => toast.error(whatsappErrorMessage(error)));
  }, []);

  useEffect(() => {
    setTags(campaign?.tags ?? []);
    if (campaign) loadPreview(campaign.id);
    else setPreview(null);
  }, [campaign, loadPreview]);

  // Público zerado por causa das etiquetas: permite enviar a todos com aceite
  async function removeTags() {
    if (!campaign) return;
    setBusy(true);
    try {
      await updateCampaign(campaign.id, { tags: [] });
      setTags([]);
      loadPreview(campaign.id);
      onConfirmed();
    } catch (error) {
      toast.error(whatsappErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!campaign || !preview) return;
    if (!window.confirm(`Enviar para ${preview.audience} cliente(s)? Depois de confirmada, a campanha começa a ser enviada.`)) return;
    setBusy(true);
    try {
      await campaignAction(campaign.id, "confirm");
      toast.success("Campanha confirmada. Os envios começam em instantes.");
      onConfirmed();
      onClose();
    } catch (error) {
      toast.error(whatsappErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!campaign} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Revisar campanha</DialogTitle>
          <DialogDescription>{campaign?.name}</DialogDescription>
        </DialogHeader>
        {!preview ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <div className="space-y-3 text-sm">
            <div className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50">{preview.finalText}</div>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                <b className="text-foreground">{preview.audience}</b> cliente(s) com aceite vão receber.
              </li>
              {tags.length > 0 && (
                <li>
                  Somente clientes com as etiquetas: <b className="text-foreground">{tags.join(", ")}</b>.
                </li>
              )}
              <li>
                Até {preview.dailyLimit} por dia, com {preview.delaySeconds.min}–{preview.delaySeconds.max} s entre mensagens: cerca de{" "}
                {preview.estimatedDays} dia(s).
              </li>
            </ul>
            {preview.audience === 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
                {tags.length > 0 ? (
                  <>
                    <p>Nenhum cliente com aceite tem {tags.length > 1 ? "todas estas etiquetas" : "esta etiqueta"}. Adicione a etiqueta aos clientes na aba Contatos ou envie para todos com aceite.</p>
                    <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={removeTags}>
                      Remover etiquetas e enviar para todos com aceite
                    </Button>
                  </>
                ) : (
                  <p>Nenhum cliente aceitou receber promoções ainda. Registre o aceite na aba Contatos.</p>
                )}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={confirm} disabled={busy || !preview || preview.audience === 0}>
            {busy && <Loader2 className="size-4 animate-spin" />} Confirmar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
