import api from "./api";

// Etapas deixaram de ser fixas (Onda F): cada pipeline define as próprias,
// guardadas no backend. Este mapa só serve de fallback para rotular um
// `stage` quando não temos o pipeline à mão (ex.: eventos antigos do
// histórico) - a fonte de verdade passa a ser `pipeline.stages[].label`.
export const STAGE_LABELS: Record<string, string> = {
  contato_pendente: "Contato pendente",
  em_contato: "Em contato",
  aguardando_cliente: "Aguardando cliente",
  retorno_agendado: "Retorno agendado",
  recuperado: "Recuperado",
  encerrado: "Encerrado",
};

export const RELATIONSHIP_TERMINAL_OUTCOMES = ["recuperado", "encerrado"] as const;
export type RelationshipTerminalOutcome = (typeof RELATIONSHIP_TERMINAL_OUTCOMES)[number];

export interface RelationshipStageDefinition {
  key: string;
  label: string;
  sortOrder: number;
  isTerminal: boolean;
  terminalOutcome: RelationshipTerminalOutcome | null;
}

export interface RelationshipPipeline {
  id: string;
  salonId: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  stages: RelationshipStageDefinition[];
  createdAt: string;
  updatedAt: string;
}

// Ponto de partida sugerido ao criar um pipeline novo - as mesmas 6 etapas
// de sempre, prontas para editar em vez de começar em branco.
export const DEFAULT_STAGE_TEMPLATE: RelationshipStageDefinition[] = [
  { key: "contato_pendente", label: "Contato pendente", sortOrder: 0, isTerminal: false, terminalOutcome: null },
  { key: "em_contato", label: "Em contato", sortOrder: 1, isTerminal: false, terminalOutcome: null },
  { key: "aguardando_cliente", label: "Aguardando cliente", sortOrder: 2, isTerminal: false, terminalOutcome: null },
  { key: "retorno_agendado", label: "Retorno agendado", sortOrder: 3, isTerminal: false, terminalOutcome: null },
  { key: "recuperado", label: "Recuperado", sortOrder: 4, isTerminal: true, terminalOutcome: "recuperado" },
  { key: "encerrado", label: "Encerrado", sortOrder: 5, isTerminal: true, terminalOutcome: "encerrado" },
];

export const REASON_LABELS: Record<string, string> = {
  retorno_atrasado: "Retorno atrasado",
  primeiro_atendimento_sem_retorno: "1º atendimento sem retorno",
  aniversario: "Aniversário",
  pos_atendimento: "Pós-atendimento",
  avaliacao_baixa: "Avaliação baixa",
  tratamento_em_continuidade: "Tratamento em continuidade",
  oportunidade_manual: "Oportunidade identificada",
};

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  email: "E-mail",
  presencial: "Presencial",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  contact: "Contato registrado",
  stage_changed: "Mudou de estágio",
  note_added: "Observação adicionada",
  responsible_changed: "Responsável alterado",
  next_action_changed: "Próxima ação alterada",
  reopened: "Card reaberto",
  resolved: "Card resolvido",
};

export function reasonLabel(reason: string) {
  return REASON_LABELS[reason] ?? reason;
}

export function stageLabel(stage: string, stages?: RelationshipStageDefinition[]) {
  return stages?.find((item) => item.key === stage)?.label ?? STAGE_LABELS[stage] ?? stage;
}

export interface RelationshipTrigger {
  id: string;
  reason: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface RelationshipCardStats {
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  totalAppointments: number;
  cancellationRate: number | null;
  averageFrequencyDays: number | null;
  favoriteService: string | null;
  favoriteProfessional: string | null;
  averageTicket: number | null;
  lifetimeValue: number | null;
}

export interface RelationshipCard {
  id: string;
  salonId: string;
  clientId: string;
  pipelineId: string;
  clientName: string;
  clientPhone: string;
  responsibleSalonUserId: string | null;
  responsibleName: string | null;
  createdBy: string | null;
  createdByName: string | null;
  stage: string;
  primaryReason: string | null;
  triggers: RelationshipTrigger[];
  nextAction: string | null;
  nextActionAt: string | null;
  notes: string | null;
  sortOrder: number;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: RelationshipCardStats;
}

export interface RelationshipEvent {
  id: string;
  salonId: string;
  cardId: string;
  eventType: string;
  fromStage: string | null;
  toStage: string | null;
  contactType: string | null;
  outcome: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export async function listRelationshipCards(
  params: { pipelineId?: string; stage?: string; responsibleSalonUserId?: string; q?: string } = {},
) {
  const response = await api.get<{ cards: RelationshipCard[] }>("/relationship/cards", { params });
  return response.data.cards;
}

export async function getRelationshipCard(id: string) {
  const response = await api.get<{ card: RelationshipCard }>(`/relationship/cards/${id}`);
  return response.data.card;
}

export async function deleteRelationshipCard(id: string) {
  await api.delete(`/relationship/cards/${id}`);
}

export async function updateRelationshipCard(
  id: string,
  data: {
    stage?: string;
    sortOrder?: number;
    responsibleSalonUserId?: string | null;
    nextAction?: string | null;
    nextActionAt?: string | null;
    notes?: string | null;
  },
) {
  const response = await api.patch<{ card: RelationshipCard }>(`/relationship/cards/${id}`, data);
  return response.data.card;
}

export async function createRelationshipCard(data: {
  clientId: string;
  pipelineId?: string;
  primaryReason: string;
  stage?: string;
  responsibleSalonUserId?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  notes?: string | null;
}) {
  const response = await api.post<{ card: RelationshipCard }>("/relationship/cards", data);
  return response.data.card;
}

export async function listRelationshipEvents(cardId: string) {
  const response = await api.get<{ events: RelationshipEvent[] }>(`/relationship/cards/${cardId}/events`);
  return response.data.events;
}

export async function createRelationshipEvent(
  cardId: string,
  data: { contactType?: string; outcome?: string; notes?: string | null },
) {
  const response = await api.post<{ event: RelationshipEvent }>(`/relationship/cards/${cardId}/events`, data);
  return response.data.event;
}

export async function addRelationshipTrigger(cardId: string, data: { reason: string; isPrimary?: boolean }) {
  const response = await api.post<{ card: RelationshipCard }>(`/relationship/cards/${cardId}/triggers`, data);
  return response.data.card;
}

export async function setRelationshipTriggerPrimary(cardId: string, triggerId: string) {
  const response = await api.patch<{ card: RelationshipCard }>(
    `/relationship/cards/${cardId}/triggers/${triggerId}`,
    { isPrimary: true },
  );
  return response.data.card;
}

export async function listRelationshipPipelines() {
  const response = await api.get<{ pipelines: RelationshipPipeline[] }>("/relationship/pipelines");
  return response.data.pipelines;
}

export async function createRelationshipPipeline(data: { name: string; stages: RelationshipStageDefinition[] }) {
  const response = await api.post<{ pipeline: RelationshipPipeline }>("/relationship/pipelines", data);
  return response.data.pipeline;
}

export async function updateRelationshipPipeline(
  id: string,
  data: { name?: string; sortOrder?: number; isDefault?: boolean; stages?: RelationshipStageDefinition[] },
) {
  const response = await api.patch<{ pipeline: RelationshipPipeline }>(`/relationship/pipelines/${id}`, data);
  return response.data.pipeline;
}

export async function deleteRelationshipPipeline(id: string) {
  await api.delete(`/relationship/pipelines/${id}`);
}

export interface RelationshipDashboardFunnelStage {
  stageKey: string;
  label: string;
  count: number;
}

export interface RelationshipDashboardReason {
  reason: string;
  count: number;
}

export interface RelationshipDashboardMonth {
  month: string;
  monthLabel: string;
  recovered: number;
  closed: number;
}

export interface RelationshipDashboardValueImpact {
  recoveredValue: number;
  recoveredCount: number;
  lostValue: number;
  lostCount: number;
}

export interface RelationshipDashboardResponsible {
  responsibleId: string | null;
  responsibleName: string;
  resolvedCount: number;
  avgResolutionDays: number | null;
}

export interface RelationshipDashboard {
  pipelineId: string;
  pipelineName: string;
  windowMonths: number;
  funnel: RelationshipDashboardFunnelStage[];
  reasons: RelationshipDashboardReason[];
  monthlyTrend: RelationshipDashboardMonth[];
  valueImpact: RelationshipDashboardValueImpact;
  responsiblePerformance: RelationshipDashboardResponsible[];
}

export async function getRelationshipDashboard(params: { pipelineId?: string; months?: number } = {}) {
  const response = await api.get<{ dashboard: RelationshipDashboard }>("/relationship/dashboard", { params });
  return response.data.dashboard;
}
