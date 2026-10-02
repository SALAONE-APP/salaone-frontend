import api from "./api";

export const SALES_PRODUCTS = ["salaone", "barberone"] as const;
export type SalesProduct = (typeof SALES_PRODUCTS)[number];

export const SALES_PRODUCT_LABELS: Record<SalesProduct, string> = {
  salaone: "SalaOne",
  barberone: "BarberOne",
};

// Como o cliente-alvo de cada produto e chamado nos textos do CRM.
export const SALES_PRODUCT_BUSINESS_LABELS: Record<SalesProduct, { singular: string; plural: string }> = {
  salaone: { singular: "salão", plural: "salões" },
  barberone: { singular: "barbearia", plural: "barbearias" },
};

export function isSalesProduct(value: string): value is SalesProduct {
  return (SALES_PRODUCTS as readonly string[]).includes(value);
}

// Listas fechadas espelhando salesCrmSchemas.ts (backend) - validadas via Joi
// contra string, não enum de banco, para poder evoluir sem migration.
export const SALES_CHANNELS = ["instagram", "indicacao", "youtube", "google_meu_negocio", "outro"] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

export const SALES_LOST_REASONS = [
  "preco",
  "sem_interesse",
  "concorrente",
  "sem_resposta",
  "momento_inadequado",
  "outro",
] as const;
export type SalesLostReason = (typeof SALES_LOST_REASONS)[number];

export const SALES_CONTACT_TYPES = ["whatsapp", "instagram_dm", "ligacao", "email", "presencial", "reuniao"] as const;
export type SalesContactType = (typeof SALES_CONTACT_TYPES)[number];

export const SALES_ACTIVITY_TYPES = [
  "contact",
  "stage_changed",
  "note_added",
  "responsible_changed",
  "next_action_changed",
] as const;
export type SalesActivityTypeValue = (typeof SALES_ACTIVITY_TYPES)[number];

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  instagram: "Instagram",
  indicacao: "Indicação",
  youtube: "YouTube",
  google_meu_negocio: "Google Meu Negócio",
  outro: "Outro",
};

export const SALES_LOST_REASON_LABELS: Record<SalesLostReason, string> = {
  preco: "Preço",
  sem_interesse: "Sem interesse",
  concorrente: "Foi para concorrente",
  sem_resposta: "Sem resposta",
  momento_inadequado: "Momento inadequado",
  outro: "Outro",
};

export const SALES_CONTACT_TYPE_LABELS: Record<SalesContactType, string> = {
  whatsapp: "WhatsApp",
  instagram_dm: "DM no Instagram",
  ligacao: "Ligação",
  email: "E-mail",
  presencial: "Presencial",
  reuniao: "Reunião",
};

export const SALES_ACTIVITY_TYPE_LABELS: Record<SalesActivityTypeValue, string> = {
  contact: "Contato registrado",
  stage_changed: "Mudou de etapa",
  note_added: "Observação adicionada",
  responsible_changed: "Responsável alterado",
  next_action_changed: "Próxima ação alterada",
};

export function salesChannelLabel(channel: string) {
  return SALES_CHANNEL_LABELS[channel as SalesChannel] ?? channel;
}

export function salesLostReasonLabel(reason: string) {
  return SALES_LOST_REASON_LABELS[reason as SalesLostReason] ?? reason;
}

export function salesContactTypeLabel(contactType: string) {
  return SALES_CONTACT_TYPE_LABELS[contactType as SalesContactType] ?? contactType;
}

// Etapas sao editaveis por funil: o rotulo vem do funil; se a etapa nao existe
// mais (ex.: historico de uma etapa removida), cai numa versao legivel da key.
export function salesLeadStageLabel(stage: string, pipeline?: Pick<SalesPipeline, "stages"> | null) {
  const found = pipeline?.stages.find((item) => item.key === stage);
  if (found) return found.label;
  const readable = stage.replace(/_/g, " ").trim();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export function salesActivityTypeLabel(activityType: string) {
  return SALES_ACTIVITY_TYPE_LABELS[activityType as SalesActivityTypeValue] ?? activityType;
}

export type SalesTerminalOutcome = "ganho" | "perdido";

export interface SalesStageDefinition {
  key: string;
  label: string;
  sortOrder: number;
  isTerminal: boolean;
  terminalOutcome: SalesTerminalOutcome | null;
}

export interface SalesPipeline {
  id: string;
  product: SalesProduct;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  stages: SalesStageDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface SalesLead {
  id: string;
  product: SalesProduct;
  pipelineId: string;
  outcome: SalesTerminalOutcome | null;
  contactName: string;
  salonName: string | null;
  phone: string;
  instagramHandle: string | null;
  email: string | null;
  channel: string;
  stage: string;
  responsibleId: string;
  responsibleName: string | null;
  responsibleEmail: string | null;
  createdBy: string | null;
  createdByName: string | null;
  scriptId: string | null;
  scriptName: string | null;
  scriptVersion: string | null;
  lostReason: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  notes: string | null;
  sortOrder: number;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesLeadActivity {
  id: string;
  leadId: string;
  activityType: string;
  fromStage: string | null;
  toStage: string | null;
  contactType: string | null;
  outcome: string | null;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export type SalesScriptAttachmentType = "image" | "video" | "audio" | "pdf";

export interface SalesScriptAttachment {
  id: string;
  type: SalesScriptAttachmentType;
  name: string;
  url: string;
  mimeType: string;
  bytes: number;
  createdAt: string;
}

export interface SalesScript {
  id: string;
  product: SalesProduct;
  name: string;
  version: string;
  channel: string | null;
  content: string;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: SalesScriptAttachment[];
}

export interface SalesDashboardFunnelStage {
  stage: string;
  label: string;
  isTerminal: boolean;
  terminalOutcome: SalesTerminalOutcome | null;
  count: number;
}

export interface SalesDashboardChannel {
  channel: string;
  count: number;
}

export interface SalesDashboardLostReason {
  reason: string | null;
  count: number;
}

export interface SalesDashboardMonth {
  month: string;
  closed: number;
  lost: number;
}

export interface SalesDashboardResponsiblePerformance {
  responsibleId: string;
  responsibleName: string;
  closedCount: number;
  avgDaysToClose: number | null;
}

export interface SalesDashboardTotals {
  total: number;
  won: number;
  lost: number;
  open: number;
}

export interface SalesDashboard {
  pipelineId: string | null;
  totals: SalesDashboardTotals;
  funnel: SalesDashboardFunnelStage[];
  byChannel: SalesDashboardChannel[];
  lostReasons: SalesDashboardLostReason[];
  monthlyTrend: SalesDashboardMonth[];
  responsiblePerformance?: SalesDashboardResponsiblePerformance[];
}

export interface PaginatedSalesLeads {
  items: SalesLead[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListSalesLeadsFilters {
  product: SalesProduct;
  pipelineId?: string;
  stage?: string;
  channel?: string;
  responsibleId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface CreateSalesLeadInput {
  product: SalesProduct;
  pipelineId?: string;
  contactName: string;
  salonName?: string | null;
  phone: string;
  instagramHandle?: string | null;
  email?: string | null;
  channel: string;
  responsibleId: string;
  scriptId?: string | null;
  notes?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
}

export interface UpdateSalesLeadInput {
  contactName?: string;
  salonName?: string | null;
  phone?: string;
  instagramHandle?: string | null;
  email?: string | null;
  channel?: string;
  responsibleId?: string;
  scriptId?: string | null;
  notes?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  stage?: string;
  lostReason?: string;
  sortOrder?: number;
}

export interface CreateSalesActivityInput {
  activityType: string;
  contactType?: string;
  outcome?: string | null;
  notes?: string | null;
}

export interface CreateSalesScriptInput {
  product: SalesProduct;
  name: string;
  version: string;
  channel?: string | null;
  content: string;
  active?: boolean;
}

export interface UpdateSalesScriptInput {
  name?: string;
  version?: string;
  channel?: string | null;
  content?: string;
  active?: boolean;
}

export async function listSalesLeads(filters: ListSalesLeadsFilters) {
  const response = await api.get<PaginatedSalesLeads>("/sales-crm/leads", { params: filters });
  return response.data;
}

export async function getSalesLead(id: string) {
  const response = await api.get<{ lead: SalesLead }>(`/sales-crm/leads/${id}`);
  return response.data.lead;
}

export async function createSalesLead(input: CreateSalesLeadInput) {
  const response = await api.post<{ lead: SalesLead }>("/sales-crm/leads", input);
  return response.data.lead;
}

export async function updateSalesLead(id: string, input: UpdateSalesLeadInput) {
  const response = await api.patch<{ lead: SalesLead }>(`/sales-crm/leads/${id}`, input);
  return response.data.lead;
}

export async function deleteSalesLead(id: string) {
  await api.delete(`/sales-crm/leads/${id}`);
}

export async function listSalesActivities(leadId: string) {
  const response = await api.get<{ activities: SalesLeadActivity[] }>(`/sales-crm/leads/${leadId}/activities`);
  return response.data.activities;
}

export async function createSalesActivity(leadId: string, input: CreateSalesActivityInput) {
  const response = await api.post<{ activity: SalesLeadActivity }>(`/sales-crm/leads/${leadId}/activities`, input);
  return response.data.activity;
}

export async function listSalesScripts(filters: { product: SalesProduct; active?: boolean; channel?: string }) {
  const response = await api.get<{ scripts: SalesScript[] }>("/sales-crm/scripts", { params: filters });
  return response.data.scripts;
}

export async function createSalesScript(input: CreateSalesScriptInput) {
  const response = await api.post<{ script: SalesScript }>("/sales-crm/scripts", input);
  return response.data.script;
}

export async function updateSalesScript(id: string, input: UpdateSalesScriptInput) {
  const response = await api.patch<{ script: SalesScript }>(`/sales-crm/scripts/${id}`, input);
  return response.data.script;
}

export async function deleteSalesScript(id: string) {
  await api.delete(`/sales-crm/scripts/${id}`);
}

export async function uploadSalesScriptAttachment(scriptId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<{ attachment: SalesScriptAttachment }>(
    `/sales-crm/scripts/${scriptId}/attachments`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.attachment;
}

export async function deleteSalesScriptAttachment(scriptId: string, attachmentId: string) {
  await api.delete(`/sales-crm/scripts/${scriptId}/attachments/${attachmentId}`);
}

export async function getSalesDashboard(filters: { product: SalesProduct; pipelineId?: string; trendMonths?: number }) {
  const response = await api.get<SalesDashboard>("/sales-crm/dashboard", { params: filters });
  return response.data;
}

export interface SalesPipelineInput {
  name: string;
  stages: SalesStageDefinition[];
}

export interface UpdateSalesPipelineInput {
  name?: string;
  sortOrder?: number;
  isDefault?: true;
  stages?: SalesStageDefinition[];
  // { chaveDaEtapaRemovida: chaveDaEtapaDestino }
  stageMigrations?: Record<string, string>;
}

export interface StageHasLeadsDetail {
  key: string;
  label: string;
  count: number;
}

export async function listSalesPipelines(product: SalesProduct) {
  const response = await api.get<{ pipelines: SalesPipeline[] }>("/sales-crm/pipelines", { params: { product } });
  return response.data.pipelines;
}

export async function createSalesPipeline(product: SalesProduct, input: SalesPipelineInput) {
  const response = await api.post<{ pipeline: SalesPipeline }>("/sales-crm/pipelines", { product, ...input });
  return response.data.pipeline;
}

export async function updateSalesPipeline(id: string, input: UpdateSalesPipelineInput) {
  const response = await api.patch<{ pipeline: SalesPipeline }>(`/sales-crm/pipelines/${id}`, input);
  return response.data.pipeline;
}

export async function deleteSalesPipeline(id: string) {
  await api.delete(`/sales-crm/pipelines/${id}`);
}

// Modelos para criar um funil novo; as keys sao fixas so dentro do modelo.
export const SALES_PIPELINE_TEMPLATES: Array<{ id: string; name: string; description: string; stages: SalesStageDefinition[] }> = [
  {
    id: "padrao",
    name: "Funil padrão",
    description: "Novo Lead, Em conversa, Interessado, Quer saber mais, Fechado e Perdido.",
    stages: [
      { key: "novo_lead", label: "Novo Lead", sortOrder: 0, isTerminal: false, terminalOutcome: null },
      { key: "em_conversa", label: "Em conversa", sortOrder: 1, isTerminal: false, terminalOutcome: null },
      { key: "interessado", label: "Interessado", sortOrder: 2, isTerminal: false, terminalOutcome: null },
      { key: "quer_saber_mais", label: "Quer saber mais", sortOrder: 3, isTerminal: false, terminalOutcome: null },
      { key: "fechado", label: "Fechado", sortOrder: 4, isTerminal: true, terminalOutcome: "ganho" },
      { key: "perdido", label: "Perdido", sortOrder: 5, isTerminal: true, terminalOutcome: "perdido" },
    ],
  },
  {
    id: "simples",
    name: "Funil simples",
    description: "Só o essencial: Novo, Em andamento, Ganho e Perdido.",
    stages: [
      { key: "novo", label: "Novo", sortOrder: 0, isTerminal: false, terminalOutcome: null },
      { key: "em_andamento", label: "Em andamento", sortOrder: 1, isTerminal: false, terminalOutcome: null },
      { key: "ganho", label: "Ganho", sortOrder: 2, isTerminal: true, terminalOutcome: "ganho" },
      { key: "perdido", label: "Perdido", sortOrder: 3, isTerminal: true, terminalOutcome: "perdido" },
    ],
  },
];
