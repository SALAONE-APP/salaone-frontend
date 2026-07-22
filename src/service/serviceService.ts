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
  imagePublicId?: string | null;
  image_public_id?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  salonId?: string;
}

export interface ListServicesParams {
  q?: string;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
  salonId?: string;
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
  imagePublicId?: string | null;
  active?: boolean;
}

interface BackendService {
  id: string;
  name: string;
  price?: number | string;
  basePrice?: number;
  duration_minutes?: number;
  durationMinutes?: number;
  commission_value?: number | string | null;
  commissionPercent?: number | null;
  active?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  salon_id?: string;
  salonId?: string;
  service_points?: number;
  promotional_price?: number | string | null;
  image_url?: string | null;
  image_public_id?: string | null;
  covered_by_plan?: boolean;
}

function normalizeService(service: BackendService): Service {
  return {
    id: service.id,
    name: service.name,
    basePrice: Number(service.basePrice ?? service.price ?? 0),
    durationMinutes: Number(service.durationMinutes ?? service.duration_minutes ?? 0),
    commissionPercent:
      service.commissionPercent != null
        ? Number(service.commissionPercent)
        : service.commission_value != null
          ? Number(service.commission_value)
          : null,
    active: service.active ?? true,
    createdAt: service.createdAt ?? service.created_at,
    updatedAt: service.updatedAt ?? service.updated_at,
    salonId: service.salonId ?? service.salon_id,
    servicePoints: service.service_points ?? 1,
    service_points: service.service_points ?? 1,
    promotionalPrice: service.promotional_price == null ? null : Number(service.promotional_price),
    imageUrl: service.image_url ?? null,
    imagePublicId: service.image_public_id ?? null,
    image_public_id: service.image_public_id ?? null,
    covered_by_plan: service.covered_by_plan ?? false,
  };
}

export async function listServices(params: ListServicesParams = {}) {
  const response = await api.get<
    ListServicesResponse | { services?: BackendService[] }
  >("/services", { params });
  const data = response.data;
  const rawItems = "items" in data ? data.items : data.services;
  const items = Array.isArray(rawItems)
    ? rawItems.map((service) => normalizeService(service as BackendService))
    : [];

  return {
    page: "page" in data ? data.page : 1,
    limit: "limit" in data ? data.limit : items.length,
    total: "total" in data ? data.total : items.length,
    items,
  };
}

export async function createService(data: ServicePayload) {
  const response = await api.post<{ service: BackendService }>("/services", {
    name: data.name, price: data.basePrice, durationMinutes: data.durationMinutes,
    servicePoints: data.servicePoints, commissionType: "percentage", commissionValue: data.commissionPercent,
    promotionalPrice: data.promotionalPrice, coveredByPlan: data.covered_by_plan,
    imageUrl: data.imageUrl, imagePublicId: data.imagePublicId, active: data.active,
  });
  return normalizeService(response.data.service);
}

export async function updateService(serviceId: string, data: Partial<ServicePayload>) {
  const response = await api.patch<{ service: BackendService }>(`/services/${serviceId}`, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.basePrice !== undefined ? { price: data.basePrice } : {}),
    ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
    ...(data.servicePoints !== undefined ? { servicePoints: data.servicePoints } : {}),
    ...(data.commissionPercent !== undefined
      ? { commissionType: "percentage", commissionValue: data.commissionPercent }
      : {}),
    ...(data.promotionalPrice !== undefined ? { promotionalPrice: data.promotionalPrice } : {}),
    ...(data.covered_by_plan !== undefined ? { coveredByPlan: data.covered_by_plan } : {}),
    ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
    ...(data.imagePublicId !== undefined ? { imagePublicId: data.imagePublicId } : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
  });
  return normalizeService(response.data.service);
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
