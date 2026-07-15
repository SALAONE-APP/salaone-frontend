import api from "./api";

export interface Professional {
  id: string;
  displayName: string;
  specialty?: string | null;
  photoUrl?: string | null;
  userId?: string | null;
  serviceIds?: string[];
  salarioFixo?: number | null;
  commissionPercent?: number | null;
}

interface BackendEmployee {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  is_professional?: boolean;
  is_active?: boolean;
  platform_user_id?: string | null;
  commission_percent?: number | null;
  employee_services?: Array<{ service_id: string }>;
}

export interface ListProfessionalsResponse {
  page: number;
  limit: number;
  total: number;
  items: Professional[];
}

function normalizeProfessional(employee: BackendEmployee): Professional {
  return {
    id: employee.id,
    displayName: employee.name,
    specialty: employee.job_title ?? null,
    serviceIds: employee.employee_services?.map((item) => item.service_id) ?? [],
    userId: employee.platform_user_id ?? null,
    commissionPercent: employee.commission_percent ?? null,
  };
}

export async function listProfessionals(
  _params: { q?: string; page?: number; limit?: number; salonId?: string } = {},
): Promise<ListProfessionalsResponse> {
  void _params;
  const response = await api.get<{ employees: BackendEmployee[] }>("/employees");
  const items = response.data.employees
    .filter((employee) => employee.is_professional !== false)
    .map(normalizeProfessional);

  return { page: 1, limit: items.length, total: items.length, items };
}

export async function getMyProfessional(): Promise<Professional> {
  const response = await listProfessionals();
  const professional = response.items[0];
  if (!professional) throw new Error("Profissional não encontrado.");
  return professional;
}

export interface CreateProfessionalPayload {
  displayName: string;
  commissionPercent?: number | null;
  serviceIds?: string[];
  userId: string;
  salarioFixo?: number | null;
}

export async function createProfessional(data: CreateProfessionalPayload) {
  const response = await api.post<{ employee: BackendEmployee }>("/employees", {
    name: data.displayName,
    isProfessional: true,
    isActive: true,
    userId: data.userId,
    commissionPercent: data.commissionPercent,
  });

  if (data.serviceIds) {
    await api.post(`/employees/${response.data.employee.id}/services`, {
      serviceIds: data.serviceIds,
    });
  }

  return normalizeProfessional(response.data.employee);
}

export interface UpdateProfessionalPayload {
  displayName?: string;
  commissionPercent?: number | null;
  serviceIds?: string[];
  salarioFixo?: number | null;
}

export async function updateProfessional(id: string, data: UpdateProfessionalPayload) {
  const response = await api.patch<{ employee: BackendEmployee }>(`/employees/${id}`, {
    ...(data.displayName !== undefined ? { name: data.displayName } : {}),
    ...(data.commissionPercent !== undefined ? { commissionPercent: data.commissionPercent } : {}),
  });

  if (data.serviceIds) {
    await api.post(`/employees/${id}/services`, { serviceIds: data.serviceIds });
  }

  return normalizeProfessional(response.data.employee);
}
