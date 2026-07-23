import { toast } from "sonner";

import type { Appointment } from "@/service/appointmentService";
import type { SalonProfile } from "@/service/salonProfileService";

export interface WhatsAppMessageData {
  clientName: string;
  salonName: string;
  professionalName: string;
  date: string;
  time: string;
  services: string[];
  products?: Array<{ name: string; quantity: number; totalPrice?: number }>;
  total?: number;
  notes?: string;
  googleMapsUrl?: string | null;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 10) return digits;
  if (digits.length >= 8) return `55${digits}`;
  return "";
}

export function hasWhatsAppPhone(phone: string | null | undefined): boolean {
  return Boolean(formatPhone(phone ?? ""));
}

function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDateTimeBR(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return { date: "-", time: "-" };
  return {
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d),
    time: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d),
  };
}

export function buildWhatsAppMessage(data: WhatsAppMessageData): string {
  const serviceList = data.services.map((s) => `  - ${s}`).join("\n");
  const productLines = (data.products ?? []).map((product) =>
    `  - ${product.quantity}x ${product.name}${
      product.totalPrice != null ? ` - ${formatCurrencyBR(product.totalPrice)}` : ""
    }`,
  );
  const productsSection = productLines.length
    ? ["*Produtos:*", productLines.join("\n")]
    : [];
  const totalLine =
    data.total != null && data.total > 0
      ? `\n*Total:* ${formatCurrencyBR(data.total)}`
      : "";
  const notesLine = data.notes?.trim() ? ` Observacoes: ${data.notes.trim()}` : "";
  const mapsLine = data.googleMapsUrl?.trim()
    ? ["", `*Localizacao:* ${data.googleMapsUrl.trim()}`]
    : [];

  return [
    `*AGENDAMENTO CONFIRMADO*`,
    ``,
    `Ola, ${data.clientName}!`,
    ``,
    `Seu agendamento foi confirmado com sucesso.`,
    ``,
    `*Salão:* ${data.salonName}`,
    `*Profissional:* ${data.professionalName}`,
    `*Data:* ${data.date}`,
    `*Horario:* ${data.time}`,
    `*Servicos:*`,
    serviceList,
    ...productsSection,
    ...(notesLine ? [notesLine] : []),
    totalLine,
    ...mapsLine,
    ``,
    `Aguardamos voce. Obrigado pela preferencia!`,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function openWhatsApp(phone: string | null | undefined, message: string): void {
  const rawPhone = phone ?? "";
  const cleanPhone = rawPhone.replace(/\D/g, "");
  const formattedPhone = formatPhone(rawPhone);

  console.log("[WhatsApp] Numero recebido:", rawPhone);
  console.log("[WhatsApp] Numero limpo:", cleanPhone);
  console.log("[WhatsApp] Numero formatado:", formattedPhone);

  if (!formattedPhone) {
    console.warn("[WhatsApp] Nenhum numero valido - abertura cancelada.");
    toast.error("Nao foi possivel enviar: o cliente nao possui telefone valido cadastrado.");
    return;
  }

  const encoded = encodeURIComponent(message);
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  let whatsappUrl: string;
  if (isMobile) {
    whatsappUrl = `whatsapp://send?phone=${formattedPhone}&text=${encoded}`;
  } else {
    whatsappUrl = `https://wa.me/${formattedPhone}?text=${encoded}`;
  }

  console.log("[WhatsApp] URL gerada:", whatsappUrl);

  if (isMobile) {
    window.location.href = whatsappUrl;
  } else {
    window.open(whatsappUrl, "_blank");
  }
}

export function openWhatsAppShare(message: string): void {
  const encoded = encodeURIComponent(message);
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.href = `whatsapp://send?text=${encoded}`;
    return;
  }

  window.open(`https://wa.me/?text=${encoded}`, "_blank");
}

function buildConfirmationMessage(
  appointment: Appointment,
  salon: SalonProfile | null,
): string {
  const clientName =
    appointment.dependent?.name ??
    appointment.client?.name ??
    "Cliente";
  const { date, time } = formatDateTimeBR(appointment.startAt);
  const services = appointment.services.map((s) => s.serviceName).join(" e ");
  const products = appointment.products.map((product) =>
    `${product.quantity}x ${product.productName}`,
  ).join(", ");
  const professionalName = appointment.professional?.displayName ?? "Profissional";

  return [
    `Ola ${clientName}!`,
    ``,
    `Estamos entrando em contato para CONFIRMAR seu agendamento:`,
    ``,
    ` Data: ${date}`,
    ` Horario: ${time}`,
    ` Servico: ${services}`,
    ...(products ? [` Produtos: ${products}`] : []),
    ` Profissional: ${professionalName}`,
    ...(appointment.notes?.trim() ? [``, ` Observacao: ${appointment.notes.trim()}`] : []),
    ...(salon?.googleMapsUrl?.trim()
      ? [``, ` Localizacao: ${salon.googleMapsUrl.trim()}`]
      : []),
  ].join("\n");
}

export function sendAppointmentWhatsApp(
  appointment: Appointment,
  salon: SalonProfile | null,
): void {
  const clientPhone = appointment.client?.phone ?? "";
  console.log("[WhatsApp] Dados da salão:", salon);
  console.log("[WhatsApp] Telefone do cliente:", clientPhone);

  openWhatsApp(clientPhone, buildConfirmationMessage(appointment, salon));
}
