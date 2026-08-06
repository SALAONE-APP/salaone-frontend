import api from "./api";

export type ServiceTabItemType = "service" | "product" | "consumption";

export interface ServiceTabItem {
  id: string;
  type: ServiceTabItemType;
  referenceId?: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
  professional?: { id: string; displayName: string } | null;
  createdAt: string;
}

export interface ServiceTab {
  id: string;
  appointmentId: string;
  saleId: string;
  status: "open" | "paid" | "cancelled";
  notes?: string | null;
  total: number;
  openedAt: string;
  closedAt?: string | null;
  appointment: {
    id: string;
    status: string;
    startAt: string;
    client: { id: string; name: string };
    professional: { id: string; displayName: string };
  };
  items: ServiceTabItem[];
}

export async function listServiceTabs(status?: "open" | "paid") {
  const response = await api.get<ServiceTab[]>("/service-tabs", { params: { status } });
  return response.data;
}

export async function openServiceTab(appointmentId: string) {
  const response = await api.post<ServiceTab>("/service-tabs", { appointmentId });
  return response.data;
}

export async function addServiceTabItem(tabId: string, data: {
  type: ServiceTabItemType;
  referenceId?: string | null;
  name?: string | null;
  quantity: number;
  unitPrice?: number | null;
  professionalId?: string | null;
}) {
  const response = await api.post<ServiceTab>(`/service-tabs/${tabId}/items`, data);
  return response.data;
}

export async function removeServiceTabItem(tabId: string, itemId: string) {
  const response = await api.delete<ServiceTab>(`/service-tabs/${tabId}/items/${itemId}`);
  return response.data;
}

export async function updateServiceTabItem(tabId: string, itemId: string, data: {
  referenceId?: string | null;
  name?: string | null;
  quantity: number;
  unitPrice?: number | null;
  professionalId?: string | null;
}) {
  const response = await api.put<ServiceTab>(`/service-tabs/${tabId}/items/${itemId}`, data);
  return response.data;
}

export async function cancelServiceTab(tabId: string) {
  const response = await api.post<ServiceTab>(`/service-tabs/${tabId}/cancel`);
  return response.data;
}

export async function payServiceTab(tabId: string, method: "pix" | "debito" | "credito" | "dinheiro") {
  const response = await api.post<ServiceTab>(`/service-tabs/${tabId}/pay`, { method });
  return response.data;
}
