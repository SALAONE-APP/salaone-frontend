import api from "./api";

export interface BlockedDate {
  id: string;
  salonId: string;
  date: string;
  reason?: string | null;
  barberId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  barber?: {
    id: string;
    displayName: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlockedDatePayload {
  date: string;
  reason?: string | null;
  barberId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

export async function listBlockedDates(params: {
  dateFrom?: string;
  dateTo?: string;
  barberId?: string;
} = {}) {
  const response = await api.get<BlockedDate[]>("/blocked-dates", { params });
  return response.data;
}

export async function createBlockedDate(data: BlockedDatePayload) {
  const response = await api.post<BlockedDate>("/blocked-dates", data);
  return response.data;
}

export async function updateBlockedDate(id: string, data: BlockedDatePayload) {
  const response = await api.put<BlockedDate>(`/blocked-dates/${id}`, data);
  return response.data;
}

export async function deleteBlockedDate(id: string) {
  const response = await api.delete<{ message: string }>(`/blocked-dates/${id}`);
  return response.data;
}
