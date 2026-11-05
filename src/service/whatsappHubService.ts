import api from "./api";
import { env } from "../config/env";

// Módulo WhatsApp (ADTECH WhatsApp Hub). O backend do SalaOne fala com o Hub;
// o navegador nunca recebe credenciais do Hub nem do provedor.

export type ConnectionStatus = "CREATED" | "CONNECTING" | "OPEN" | "CLOSED" | "DELETED";
export type MessageStatus = "PENDING" | "SERVER_ACK" | "DELIVERY_ACK" | "READ" | "PLAYED" | "ERROR";

export interface WhatsAppConnection {
  id: string;
  name: string;
  phone: string | null;
  status: ConnectionStatus;
  lastStatusAt: string | null;
  createdAt: string;
}

export interface ConnectResult {
  status: ConnectionStatus;
  qrCodeBase64: string | null;
  pairingCode: string | null;
}

export interface WhatsAppConversation {
  id: string;
  connectionId: string;
  lastMessageAt: string | null;
  // Atendimento humano: o assistente automático não responde até esta data
  botPausedUntil?: string | null;
  contact: { id: string; phone: string; name: string | null };
}

export interface WhatsAppMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  text: string | null;
  status: MessageStatus;
  sentAt: string;
  statusAt: string | null;
  media?: WhatsAppMediaInfo | null;
}

export type MediaKind = "image" | "audio" | "document" | "sticker" | "video";
export type MediaStatus = "PENDING" | "STORED" | "SKIPPED" | "FAILED" | "EXPIRED";

export interface WhatsAppMediaInfo {
  kind: MediaKind;
  status: MediaStatus;
  mimetype: string | null;
  fileName: string | null;
  reason: string | null;
}

export interface WhatsAppMediaAccess extends WhatsAppMediaInfo {
  url: string | null;
  expiresInSeconds?: number;
}

// Link temporário (5 min) gerado pelo Hub; só o salão dono da mensagem consegue.
export async function getMessageMedia(messageId: string) {
  return (await api.get<WhatsAppMediaAccess>(`/whatsapp-hub/messages/${messageId}/media`)).data;
}

export function whatsappErrorMessage(error: unknown, fallback = "Não foi possível concluir a operação"): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(data) && data[0]) return String(data[0]);
  if (data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string") {
    return (data as { message: string }).message;
  }
  return fallback;
}

export async function listConnections() {
  return (await api.get<WhatsAppConnection[]>("/whatsapp-hub/connections")).data;
}

export async function createConnection(name: string) {
  return (await api.post<WhatsAppConnection>("/whatsapp-hub/connections", { name })).data;
}

export async function connectConnection(id: string, mode: "qrcode" | "pairing", phone?: string) {
  return (await api.post<ConnectResult>(`/whatsapp-hub/connections/${id}/connect`, { mode, phone })).data;
}

export async function getConnectionStatus(id: string) {
  return (await api.get<WhatsAppConnection>(`/whatsapp-hub/connections/${id}/status`)).data;
}

export async function disconnectConnection(id: string) {
  return (await api.post<WhatsAppConnection>(`/whatsapp-hub/connections/${id}/disconnect`)).data;
}

export async function deleteConnection(id: string) {
  await api.delete(`/whatsapp-hub/connections/${id}`);
}

export async function listConversations(connectionId?: string) {
  return (await api.get<WhatsAppConversation[]>("/whatsapp-hub/conversations", { params: { connectionId } })).data;
}

export async function listMessages(conversationId: string) {
  return (await api.get<WhatsAppMessage[]>(`/whatsapp-hub/conversations/${conversationId}/messages`)).data;
}

export type WhatsAppEvent =
  | { type: "message"; conversationId: string; messageId: string; direction: "INBOUND" | "OUTBOUND" }
  | { type: "status"; conversationId: string; messageId: string; status: MessageStatus }
  | { type: "connection"; connectionId: string; status: ConnectionStatus };

// Eventos em tempo real (SSE) via backend do SalaOne. Usa fetch porque EventSource não envia
// o cabeçalho Authorization. Reconecta sozinho com espera crescente. Retorna a função para parar.
export function subscribeWhatsAppEvents(onEvent: (e: WhatsAppEvent) => void, onStatus?: (live: boolean) => void): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retry = 1000;

  const connect = async () => {
    if (stopped) return;
    controller = new AbortController();
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${env.API_URL}/whatsapp-hub/events`, {
        headers: { Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      onStatus?.(true);
      retry = 1000;
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const type = /^event: (.+)$/m.exec(block)?.[1];
          const data = /^data: (.+)$/m.exec(block)?.[1];
          if (!type || !data || type === "ready") continue;
          try {
            onEvent(JSON.parse(data) as WhatsAppEvent);
          } catch {
            /* evento malformado: ignora */
          }
        }
      }
    } catch {
      /* queda de rede ou Hub indisponível: tenta de novo abaixo */
    }
    onStatus?.(false);
    if (!stopped) {
      window.setTimeout(connect, retry);
      retry = Math.min(retry * 2, 30000);
    }
  };

  void connect();
  return () => {
    stopped = true;
    controller?.abort();
  };
}

export async function sendWhatsAppMessage(input: { connectionId: string; to: string; text: string }) {
  return (await api.post<{ id: string; status: MessageStatus }>("/whatsapp-hub/messages", input)).data;
}

// ---- Contatos (consentimento para campanhas) ----

export interface WhatsAppContact {
  id: string;
  phone: string;
  name: string | null;
  tags: string[];
  marketingOptIn: boolean;
  optInAt: string | null;
  optInSource: string | null;
  optOutAt: string | null;
  createdAt: string;
}

export interface ContactInput {
  phone: string;
  name?: string;
  tags?: string[];
  // Origem do aceite (obrigatória para registrar que o cliente aceitou receber promoções)
  optInSource?: string;
}

export async function listContacts(params: { optIn?: boolean; tag?: string; search?: string } = {}) {
  return (await api.get<WhatsAppContact[]>("/whatsapp-hub/contacts", { params })).data;
}

export async function createContact(input: ContactInput) {
  return (await api.post<WhatsAppContact>("/whatsapp-hub/contacts", input)).data;
}

export async function importContacts(contacts: ContactInput[]) {
  return (
    await api.post<{ created: number; updated: number; optIns: number; invalid: { line: number; reason: string }[] }>(
      "/whatsapp-hub/contacts/import",
      { contacts },
    )
  ).data;
}

export async function setContactConsent(id: string, kind: "opt-in" | "opt-out", source: string) {
  return (await api.post<WhatsAppContact>(`/whatsapp-hub/contacts/${id}/${kind}`, { source })).data;
}

// ---- Campanhas ----

export type CampaignStatus = "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";

export interface CampaignStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  unknown: number;
  optOuts: number;
}

export interface WhatsAppCampaign {
  id: string;
  connectionId: string;
  name: string;
  text: string;
  tags: string[];
  status: CampaignStatus;
  pausedReason: string | null;
  scheduledAt: string | null;
  nextSendAt: string | null;
  confirmedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  stats: CampaignStats;
}

export interface CampaignPreview {
  audience: number;
  finalText: string;
  dailyLimit: number;
  delaySeconds: { min: number; max: number };
  estimatedDays: number;
}

export async function listCampaigns() {
  return (await api.get<WhatsAppCampaign[]>("/whatsapp-hub/campaigns")).data;
}

export async function createCampaign(input: { connectionId: string; name: string; text: string; tags?: string[]; scheduledAt?: string }) {
  return (await api.post<WhatsAppCampaign>("/whatsapp-hub/campaigns", input)).data;
}

export async function previewCampaign(id: string) {
  return (await api.get<CampaignPreview>(`/whatsapp-hub/campaigns/${id}/preview`)).data;
}

export async function campaignAction(id: string, action: "confirm" | "pause" | "resume" | "cancel") {
  return (await api.post<WhatsAppCampaign>(`/whatsapp-hub/campaigns/${id}/${action}`)).data;
}

export async function updateContact(id: string, data: { name?: string; tags?: string[] }) {
  return (await api.patch<WhatsAppContact>(`/whatsapp-hub/contacts/${id}`, data)).data;
}

// Só campanhas em rascunho podem ser alteradas
export async function updateCampaign(id: string, data: { name?: string; text?: string; tags?: string[]; scheduledAt?: string }) {
  return (await api.patch<WhatsAppCampaign>(`/whatsapp-hub/campaigns/${id}`, data)).data;
}

// ---- Agendamento pelo WhatsApp (assistente automático) ----

export interface BookingStatus {
  configured: boolean;
  enabled: boolean;
}

export async function getBookingStatus() {
  return (await api.get<BookingStatus>("/whatsapp-hub/booking")).data;
}

export async function setBookingEnabled(enabled: boolean) {
  return (await api.post<BookingStatus>(`/whatsapp-hub/booking/${enabled ? "enable" : "disable"}`)).data;
}

// Devolve a conversa ao assistente (a equipe terminou o atendimento)
export async function resumeBot(conversationId: string) {
  await api.post(`/whatsapp-hub/conversations/${conversationId}/bot/resume`);
}
