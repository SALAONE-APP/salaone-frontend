import api from "./api";

export const RELATIONSHIP_STAGES = [
  "contato_pendente",
  "em_contato",
  "aguardando_cliente",
  "retorno_agendado",
  "recuperado",
  "encerrado",
] as const;

export type RelationshipStage = (typeof RELATIONSHIP_STAGES)[number];

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
  clientName: string;
  clientPhone: string;
  responsibleSalonUserId: string | null;
  responsibleName: string | null;
  stage: RelationshipStage;
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

export async function listRelationshipCards(params: { stage?: string; responsibleSalonUserId?: string; q?: string } = {}) {
  const response = await api.get<{ cards: RelationshipCard[] }>("/relationship/cards", { params });
  return response.data.cards;
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
