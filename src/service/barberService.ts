import api from "./api";

export interface Barber {
  id: string;
  displayName: string;
  specialty?: string | null;
  photoUrl?: string | null;
  userId?: string | null;
  serviceIds?: string[];
  salarioFixo?: number | null;
  commissionPercent?: number | null;
}

export interface ListBarbersResponse {
  page: number;
  limit: number;
  total: number;
  items: Barber[];
}

export async function listBarbers(params: { q?: string; page?: number; limit?: number; barbershopId?: string } = {}) {
  const response = await api.get<ListBarbersResponse>("/barbers", { params });
  return response.data;
}

export async function getMyBarber() {
  const response = await api.get<Barber>("/barbers/me");
  return response.data;
}

export interface CreateBarberPayload {
  displayName: string;
  commissionPercent?: number | null;
  serviceIds?: string[];
  userId: string;
  salarioFixo?: number | null;
}

export async function createBarber(data: CreateBarberPayload) {
  const response = await api.post<Barber>("/barbers", data);
  return response.data;
}

export interface UpdateBarberPayload {
  displayName?: string;
  commissionPercent?: number | null;
  serviceIds?: string[];
  salarioFixo?: number | null;
}

export async function updateBarber(barberId: string, data: UpdateBarberPayload) {
  const response = await api.patch<Barber>(`/barbers/${barberId}`, data);
  return response.data;
}
