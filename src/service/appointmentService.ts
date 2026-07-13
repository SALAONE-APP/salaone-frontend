import api from "./api";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: string;
  barberId: string;
  clientId: string;
  dependentId?: string | null;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes?: string | null;
  barber?: {
    id: string;
    displayName: string;
    photoUrl?: string | null;
  } | null;
  client?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    subscription?: {
      id: string;
      status: "active" | "paused" | "cancelled" | "expired" | string;
      daysOverdue?: number;
      nextBillingAt?: string | null;
      plan?: {
        id: string;
        name: string;
      } | null;
    } | null;
  } | null;
  dependent?: {
    id: string;
    name: string;
    age?: number | null;
  } | null;
  services: Array<{
    id: string;
    serviceId: string;
    serviceName: string;
    unitPrice: number;
    durationMinutes: number;
    quantity: number;
    servicePoints?: number;
    service_points?: number;
    totalPrice: number;
    commissionPercent?: number;
    commissionAmount?: number;
    commissionType?: string;
  }>;
  products: Array<{
    id: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  commissionAmount?: number;
  commissionPercent?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListAppointmentsParams {
  barberId?: string;
  clientId?: string;
  status?: AppointmentStatus | "active";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  allAppointments?: boolean;
}

export interface ListAppointmentsResponse {
  page: number;
  limit: number;
  total: number;
  items: Appointment[];
}

export interface CreateAppointmentPayload {
  barberId: string;
  clientId: string;
  dependentId?: string | null;
  date: string;
  time: string;
  notes?: string | null;
  allowOutsideBusinessHours?: boolean;
  services: Array<{
    id: string;
    name: string;
    basePrice?: number;
    durationMinutes?: number;
    quantity?: number;
  }>;
  products?: Array<{
    id: string;
    name: string;
    price: number;
    quantity?: number;
    discount?: number;
  }>;
}

export async function listAppointments(params: ListAppointmentsParams = {}) {
  const response = await api.get<ListAppointmentsResponse>("/appointments", {
    params,
  });

  return response.data;
}

export async function getAppointmentById(appointmentId: string) {
  const response = await api.get<Appointment>(`/appointments/${appointmentId}`);
  return response.data;
}

export async function createAppointment(data: CreateAppointmentPayload) {
  const response = await api.post<Appointment>("/appointments", data);

  return response.data;
}

export async function updateAppointment(
  appointmentId: string,
  data: { status?: AppointmentStatus; notes?: string | null; barberId?: string },
) {
  const response = await api.patch<Appointment>(`/appointments/${appointmentId}`, data);

  return response.data;
}

export async function cancelAppointment(appointmentId: string) {
  const response = await api.delete<Appointment>(`/appointments/${appointmentId}`);

  return response.data;
}

export async function getAvailableSlots(params: {
  barberId: string;
  date: string;
  duration: number;
}) {
  const response = await api.get<{ slots: string[] }>("/appointments/available-slots", {
    params,
  });

  return response.data.slots;
}
