import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, Clock, Loader2, MessageCircle, Plus, QrCode, RefreshCcw, Send, Smartphone, Trash2, Unplug, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppMediaAttachment } from "@/components/WhatsAppMediaAttachment";
import { WhatsAppContactsPanel } from "@/components/whatsapp/WhatsAppContactsPanel";
import { WhatsAppCampaignsPanel } from "@/components/whatsapp/WhatsAppCampaignsPanel";
import { WhatsAppBookingCard } from "@/components/whatsapp/WhatsAppBookingCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  connectConnection,
  createConnection,
  deleteConnection,
  disconnectConnection,
  getConnectionStatus,
  listConnections,
  listConversations,
  listMessages,
  resumeBot,
  sendWhatsAppMessage,
  subscribeWhatsAppEvents,
  whatsappErrorMessage,
  type ConnectionStatus,
  type MessageStatus,
  type WhatsAppConnection,
  type WhatsAppConversation,
  type WhatsAppMessage,
  type WhatsAppEvent,
} from "@/service/whatsappHubService";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  CREATED: "Criado",
  CONNECTING: "Aguardando conexão",
  OPEN: "Conectado",
  CLOSED: "Desconectado",
  DELETED: "Excluído",
};

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const cls =
    status === "OPEN"
      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
      : status === "CONNECTING"
        ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
        : "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cls}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

// ✓ = servidor recebeu, ✓✓ = entregue, ✓✓ azul = lida. "Enviando" até o WhatsApp confirmar.
function MessageTicks({ status }: { status: MessageStatus }) {
  if (status === "ERROR") return <AlertTriangle className="size-3.5 text-destructive" aria-label="Falha no envio" />;
  if (status === "PENDING") return <Clock className="size-3.5 opacity-70" aria-label="Enviando" />;
  if (status === "SERVER_ACK") return <Check className="size-3.5 opacity-70" aria-label="Enviada" />;
  const read = status === "READ" || status === "PLAYED";
  return <CheckCheck className={`size-3.5 ${read ? "text-sky-500" : "opacity-70"}`} aria-label={read ? "Lida" : "Entregue"} />;
}

const formatPhone = (p?: string | null) => {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    return `(${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
  }
  return p;
};
const formatCode = (c?: string | null) => (c && c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c || "");
const formatTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

export function WhatsAppPage() {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [connectTarget, setConnectTarget] = useState<WhatsAppConnection | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "disconnect" | "delete"; connection: WhatsAppConnection } | null>(null);

  const load = useCallback(async () => {
    try {
      setConnections(await listConnections());
    } catch (error) {
      toast.error(whatsappErrorMessage(error, "Não foi possível carregar as conexões"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Tempo real: o Hub avisa quando chega mensagem, muda status ou a conexão cai/volta.
  const [live, setLive] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ seq: number; event: WhatsAppEvent } | null>(null);
  useEffect(() => {
    let seq = 0;
    return subscribeWhatsAppEvents(
      (event) => {
        setLastEvent({ seq: ++seq, event });
        if (event.type === "connection") void load();
      },
      setLive,
    );
  }, [load]);

  const openConnection = connections.find((c) => c.status === "OPEN") ?? null;

  const handleConnected = useCallback(() => {
    setConnectTarget(null);
    toast.success("WhatsApp conectado!");
    void load();
  }, [load]);
  const handleCloseDialog = useCallback(() => setConnectTarget(null), []);

  async function handleCreate() {
    setCreating(true);
    try {
      const c = await createConnection("WhatsApp do salão");
      await load();
      setConnectTarget(c);
    } catch (error) {
      toast.error(whatsappErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    try {
      if (confirm.kind === "disconnect") {
        await disconnectConnection(confirm.connection.id);
        toast.success("WhatsApp desconectado");
      } else {
        await deleteConnection(confirm.connection.id);
        toast.success("Conexão excluída");
      }
      await load();
    } catch (error) {
      toast.error(whatsappErrorMessage(error));
    } finally {
      setConfirm(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Situação</p>
          <h3 className="text-2xl font-semibold text-foreground">{openConnection ? "Conectado" : "Não conectado"}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Número</p>
          <h3 className="text-2xl font-semibold text-foreground">{formatPhone(openConnection?.phone)}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Conexões</p>
          <h3 className="text-2xl font-semibold text-foreground">{connections.length}</h3>
        </div>
      </div>

      <Tabs defaultValue="connections">
        <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="connections">Conexões</TabsTrigger>
          <TabsTrigger value="conversations" disabled={!connections.length}>
            Conversas
          </TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="campaigns" disabled={!connections.length}>
            Campanhas
          </TabsTrigger>
        </TabsList>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title={live ? "Atualizações chegam na hora" : "Atualizando a cada poucos segundos"}>
            <span className={`size-2 rounded-full ${live ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            {live ? "Ao vivo" : "Atualização periódica"}
          </span>
        </div>

        <TabsContent value="connections" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </div>
          ) : connections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <MessageCircle className="mx-auto mb-3 size-10 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Conecte o WhatsApp do salão</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Receba e responda as mensagens dos seus clientes por aqui. Use o número de WhatsApp do salão.
              </p>
              <Button className="mt-4" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Conectar WhatsApp
              </Button>
            </div>
          ) : (
            connections.map((c) => (
              <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPhone(c.phone)}
                    {c.lastStatusAt ? ` · atualizado em ${formatTime(c.lastStatusAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.status !== "OPEN" && (
                    <Button size="sm" onClick={() => setConnectTarget(c)}>
                      <QrCode className="size-4" /> Conectar
                    </Button>
                  )}
                  {c.status === "OPEN" && (
                    <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "disconnect", connection: c })}>
                      <Unplug className="size-4" /> Desconectar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "delete", connection: c })}>
                    <Trash2 className="size-4" /> Excluir
                  </Button>
                </div>
              </div>
            ))
          )}
          {openConnection && <WhatsAppBookingCard />}
        </TabsContent>

        <TabsContent value="conversations" className="mt-4">
          <ConversationsPanel connection={openConnection} live={live} lastEvent={lastEvent} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <WhatsAppContactsPanel />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <WhatsAppCampaignsPanel connectionId={openConnection?.id ?? null} />
        </TabsContent>
      </Tabs>

      <ConnectDialog connection={connectTarget} onClose={handleCloseDialog} onConnected={handleConnected} />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "delete" ? "Excluir conexão?" : "Desconectar WhatsApp?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? "O número será desconectado e a conexão removida. O histórico de conversas desta conexão deixará de aparecer."
                : "Você deixará de receber e enviar mensagens por aqui até conectar novamente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-xs text-muted-foreground">
        Integração com WhatsApp baseada em Evolution API (Apache 2.0, Evolution Foundation). Não é uma integração oficial do WhatsApp.
      </p>
    </div>
  );
}

function ConnectDialog({
  connection,
  onClose,
  onConnected,
}: {
  connection: WhatsAppConnection | null;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [mode, setMode] = useState<"qrcode" | "pairing">("qrcode");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connection) return;
    setMode("qrcode");
    setQr(null);
    setCode(null);
    setError(null);
    setPhone(connection.phone ? formatPhone(connection.phone) : "");
  }, [connection]);

  // Acompanha só o status (consulta leve). Nunca pede código novo automaticamente:
  // muitos pedidos seguidos fazem o WhatsApp bloquear o pareamento por um tempo.
  useEffect(() => {
    if (!connection) return;
    const timer = window.setInterval(async () => {
      try {
        const s = await getConnectionStatus(connection.id);
        if (s.status === "OPEN") onConnected();
      } catch {
        /* status é melhor esforço; erros aparecem nas ações */
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [connection, onConnected]);

  async function request(m: "qrcode" | "pairing") {
    if (!connection) return;
    setBusy(true);
    setError(null);
    try {
      const r = await connectConnection(connection.id, m, m === "pairing" ? phone : undefined);
      if (r.status === "OPEN") return onConnected();
      if (m === "qrcode") setQr(r.qrCodeBase64);
      else setCode(r.pairingCode);
    } catch (err) {
      setError(whatsappErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!connection} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>No celular do salão: WhatsApp › Aparelhos conectados › Conectar um aparelho.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "qrcode" | "pairing")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qrcode">
              <QrCode className="size-4" /> QR Code
            </TabsTrigger>
            <TabsTrigger value="pairing">
              <Smartphone className="size-4" /> Número de telefone
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qrcode" className="space-y-3 pt-3">
            <div className="mx-auto grid size-64 place-items-center rounded-lg border border-dashed border-border bg-white">
              {qr ? <img src={qr} alt="QR Code para conectar o WhatsApp" className="size-full" /> : <QrCode className="size-12 text-muted-foreground" />}
            </div>
            <p className="text-center text-xs text-muted-foreground">O QR Code expira em alguns segundos. Se expirar, gere outro.</p>
            <Button className="w-full" onClick={() => request("qrcode")} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />} {qr ? "Gerar novo QR Code" : "Gerar QR Code"}
            </Button>
          </TabsContent>

          <TabsContent value="pairing" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="wa-phone">Número do WhatsApp do salão</Label>
              <Input id="wa-phone" inputMode="tel" placeholder="(85) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {code && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                <p className="font-mono text-3xl font-semibold tracking-[0.3em]">{formatCode(code)}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  No celular, toque em <b>Conectar com número de telefone</b> e digite o código.
                </p>
              </div>
            )}
            <Button className="w-full" onClick={() => request("pairing")} disabled={busy || phone.replace(/\D/g, "").length < 10}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />} {code ? "Ver código atual" : "Gerar código"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Só gere o código quando estiver com o celular nessa tela. Pedidos repetidos podem fazer o WhatsApp bloquear o pareamento por alguns minutos.
            </p>
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}

function ConversationsPanel({
  connection,
  live,
  lastEvent,
}: {
  connection: WhatsAppConnection | null;
  live: boolean;
  lastEvent: { seq: number; event: WhatsAppEvent } | null;
}) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selected, setSelected] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await listConversations(connection?.id));
    } catch (error) {
      toast.error(whatsappErrorMessage(error, "Não foi possível carregar as conversas"));
    }
  }, [connection?.id]);

  const loadMessages = useCallback(async () => {
    if (!selected) return;
    try {
      setMessages(await listMessages(selected.id));
    } catch {
      /* tenta de novo no próximo ciclo */
    }
  }, [selected]);

  // Com tempo real ativo, a consulta periódica vira só reserva (30 s).
  useEffect(() => {
    void loadConversations();
    const t = window.setInterval(loadConversations, live ? 30000 : 10000);
    return () => window.clearInterval(t);
  }, [loadConversations, live]);

  useEffect(() => {
    void loadMessages();
    const t = window.setInterval(loadMessages, live ? 30000 : 5000);
    return () => window.clearInterval(t);
  }, [loadMessages, live]);

  // Evento em tempo real: atualiza a lista e, se for da conversa aberta, as mensagens.
  useEffect(() => {
    if (!lastEvent || lastEvent.event.type === "connection") return;
    void loadConversations();
    if (selected && lastEvent.event.conversationId === selected.id) void loadMessages();
  }, [lastEvent, loadConversations, loadMessages, selected]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const title = useMemo(() => (selected ? selected.contact.name || formatPhone(selected.contact.phone) : ""), [selected]);

  async function handleSend() {
    if (!selected || !connection || !text.trim()) return;
    setSending(true);
    try {
      await sendWhatsAppMessage({ connectionId: connection.id, to: selected.contact.phone, text: text.trim() });
      setText("");
      await loadMessages();
    } catch (error) {
      toast.error(whatsappErrorMessage(error, "Mensagem não enviada"));
    } finally {
      setSending(false);
    }
  }

  if (!connection) {
    return <p className="text-sm text-muted-foreground">Conecte o WhatsApp para ver e responder as conversas.</p>;
  }

  return (
    <div className="grid min-h-[480px] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[280px_1fr]">
      <div className="border-b border-border md:border-b-0 md:border-r">
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa ainda. As mensagens recebidas aparecem aqui.</p>
        ) : (
          <ul className="max-h-[480px] overflow-y-auto">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`w-full px-4 py-3 text-left hover:bg-muted/60 ${selected?.id === c.id ? "bg-muted" : ""}`}
                >
                  <p className="truncate font-medium">{c.contact.name || formatPhone(c.contact.phone)}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(c.lastMessageAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex min-h-[480px] flex-col">
        {!selected ? (
          <p className="m-auto text-sm text-muted-foreground">Selecione uma conversa</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">{formatPhone(selected.contact.phone)}</p>
              </div>
              {(() => {
                // Usa a versão mais recente da lista (a seleção é uma cópia do momento do clique)
                const current = conversations.find((c) => c.id === selected.id) ?? selected;
                const until = current.botPausedUntil ? new Date(current.botPausedUntil) : null;
                if (!until || until <= new Date()) return null;
                return (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Atendimento pela equipe até {until.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await resumeBot(current.id);
                          toast.success("Conversa devolvida ao assistente");
                          void loadConversations();
                        } catch (error) {
                          toast.error(whatsappErrorMessage(error));
                        }
                      }}
                    >
                      Devolver ao assistente
                    </Button>
                  </div>
                );
              })()}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      m.direction === "OUTBOUND" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    {m.media && <WhatsAppMediaAttachment messageId={m.id} media={m.media} />}
                    {(m.text || !m.media) && <p className="whitespace-pre-wrap break-words">{m.text ?? `[${m.type}]`}</p>}
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
                      {formatTime(m.sentAt)}
                      {m.direction === "OUTBOUND" && <MessageTicks status={m.status} />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="flex gap-2 border-t border-border p-3">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escreva uma resposta…"
                className="min-h-10 resize-none"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button onClick={handleSend} disabled={sending || !text.trim()} aria-label="Enviar">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
