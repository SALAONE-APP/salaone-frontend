import api from "./api";

export interface FeatureUpdate {
  id: string;
  title: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureUpdatePayload {
  title: string;
  description: string;
  active: boolean;
}

export async function listFeatureUpdates() {
  const response = await api.get<FeatureUpdate[]>("/super-admin/feature-updates");
  return response.data;
}

export async function listActiveFeatureUpdates() {
  const response = await api.get<FeatureUpdate[]>("/feature-updates");
  return response.data;
}

export async function createFeatureUpdate(payload: FeatureUpdatePayload) {
  const response = await api.post<FeatureUpdate>("/super-admin/feature-updates", payload);
  return response.data;
}

export async function updateFeatureUpdate(id: string, payload: FeatureUpdatePayload) {
  const response = await api.patch<FeatureUpdate>(`/super-admin/feature-updates/${id}`, payload);
  return response.data;
}

export async function deleteFeatureUpdate(id: string) {
  await api.delete(`/super-admin/feature-updates/${id}`);
}
