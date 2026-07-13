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

interface BackendEmployee {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  is_professional?: boolean;
  is_active?: boolean;
  employee_services?: Array<{ service_id: string }>;
}

export interface ListBarbersResponse {
  page: number;
  limit: number;
  total: number;
  items: Barber[];
}

function normalizeProfessional(employee: BackendEmployee): Barber {
  return {
    id: employee.id,
    displayName: employee.name,
    specialty: employee.job_title ?? null,
    serviceIds: employee.employee_services?.map((item) => item.service_id) ?? [],
  };
}

export async function listBarbers(
  _params: { q?: string; page?: number; limit?: number; salonId?: string } = {},
): Promise<ListBarbersResponse> {
  void _params;
  const response = await api.get<{ employees: BackendEmployee[] }>("/employees");
  const items = response.data.employees
    .filter((employee) => employee.is_professional !== false)
    .map(normalizeProfessional);

  return { page: 1, limit: items.length, total: items.length, items };
}

export async function getMyBarber(): Promise<Barber> {
  const response = await listBarbers();
  const professional = response.items[0];
  if (!professional) throw new Error("Profissional não encontrado.");
  return professional;
}

export interface CreateBarberPayload {
  displayName: string;
  commissionPercent?: number | null;
  serviceIds?: string[];
  userId: string;
  salarioFixo?: number | null;
}

export async function createBarber(data: CreateBarberPayload) {
  const response = await api.post<{ employee: BackendEmployee }>("/employees", {
    name: data.displayName,
    isProfessional: true,
    isActive: true,
  });

  if (data.serviceIds?.length) {
    await api.post(`/employees/${response.data.employee.id}/services`, {
      serviceIds: data.serviceIds,
    });
  }

  return normalizeProfessional(response.data.employee);
}

export interface UpdateBarberPayload {
  displayName?: string;
  commissionPercent?: number | null;
  serviceIds?: string[];
  salarioFixo?: number | null;
}

export async function updateBarber(id: string, data: UpdateBarberPayload) {
  const response = await api.patch<{ employee: BackendEmployee }>(`/employees/${id}`, {
    ...(data.displayName !== undefined ? { name: data.displayName } : {}),
  });

  if (data.serviceIds?.length) {
    await api.post(`/employees/${id}/services`, { serviceIds: data.serviceIds });
  }

  return normalizeProfessional(response.data.employee);
}
