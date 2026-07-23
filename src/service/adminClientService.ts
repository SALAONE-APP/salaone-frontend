import api from "./api";
import type { UserProfile } from "./userService";

interface BackendClient {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  appointments?: Array<{ start_at: string; status: string }>;
}

function mapClient(client: BackendClient): UserProfile {
  const visits = (client.appointments ?? []).filter((item) => item.status === "completed");
  const lastVisit = visits.map((item) => item.start_at).sort().at(-1) ?? null;
  const birthDate = client.birth_date?.slice(0, 10) ?? null;
  return {
    id: client.id, name: client.name, email: client.email ?? "", phone: client.phone, cpf: client.cpf ?? null,
    birthDate, birth_date: birthDate,
    role: "client", isAdmin: false, createdAt: client.created_at, updatedAt: client.updated_at,
    visits: visits.length, lastVisit,
    lastAppointmentStatus: client.is_active ? null : "inactive",
  };
}

export async function listAdminClients(params: { q?: string; page?: number; limit?: number } = {}) {
  const response = await api.get<{ clients: BackendClient[] }>("/clients");
  let items = (response.data.clients ?? []).map(mapClient);
  const query = params.q?.trim().toLocaleLowerCase("pt-BR");
  if (query) items = items.filter((item) => [item.name, item.email, item.phone].some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(query)));
  const total = items.length;
  const limit = Math.max(1, params.limit ?? 20);
  const page = Math.max(1, params.page ?? 1);
  return { items: items.slice((page - 1) * limit, page * limit), total, page, limit };
}

export async function createAdminClient(data: { name: string; email?: string | null; phone: string; cpf?: string | null; birthDate?: string | null }) {
  const response = await api.post<{ client: BackendClient }>("/clients", data);
  return mapClient(response.data.client);
}

export async function updateAdminClient(id: string, data: { name?: string; email?: string | null; phone?: string; cpf?: string | null; birthDate?: string | null; isActive?: boolean }) {
  const response = await api.patch<{ client: BackendClient }>(`/clients/${id}`, data);
  return mapClient(response.data.client);
}

export async function deleteAdminClient(id: string) {
  await api.delete(`/clients/${id}`);
}
