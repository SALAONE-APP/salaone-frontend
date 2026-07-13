import api from "./api";

export interface Service {
  id: string;
  name: string;
  basePrice: number;
  durationMinutes: number;
  servicePoints?: number;
  service_points?: number;
  commissionPercent?: number | null;
  comissionPercent?: number | null;
  commission_percent?: number | null;
  promotionalPrice?: number | null;
  covered_by_plan?: boolean;
  imageUrl?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  barbershopId?: string;
}

export interface ListServicesParams {
  q?: string;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
  barbershopId?: string;
}

export interface ListServicesResponse {
  page: number;
  limit: number;
  total: number;
  items: Service[];
}

export interface ServicePayload {
  name: string;
  basePrice: number;
  durationMinutes: number;
  servicePoints?: number;
  commissionPercent?: number | null;
  promotionalPrice?: number;
  covered_by_plan?: boolean;
  imageUrl?: string | null;
  active?: boolean;
}

export async function listServices(params: ListServicesParams = {}) {
  const response = await api.get<ListServicesResponse>("/services", { params });

  return response.data;
}

export async function createService(data: ServicePayload) {
  const response = await api.post<Service>("/services", data);

  return response.data;
}

export async function updateService(serviceId: string, data: Partial<ServicePayload>) {
  const response = await api.patch<Service>(`/services/${serviceId}`, data);

  return response.data;
}

export async function deleteService(serviceId: string) {
  const response = await api.delete<{
    ok: boolean;
    service: Service;
    deletedHard: boolean;
    reason: string;
  }>(`/services/${serviceId}`);

  return response.data;
}

export async function reactivateService(serviceId: string) {
  const response = await api.patch<{
    ok: boolean;
    service: Service;
    reason: string;
  }>(`/services/${serviceId}/reactivate`);

  return response.data;
}
