import api from "./api";

export interface DashboardRevenueDay {
  date: string;
  day: string;
  total: number;
}

export interface DashboardStaffMember {
  id: string;
  name: string;
  photo: string | null;
  specialty: string | null;
  appointmentsThisMonth: number;
}

export interface DashboardAppointment {
  id: string;
  startAt: string;
  status: string;
  clientName: string;
  barberName: string;
  serviceLabel: string;
  serviceCount: number;
}

export interface DashboardStats {
  appointmentsToday: number;
  appointmentsThisMonth: number;
  appointmentsCancelledThisMonth: number;
  totalClients: number;
  newClientsThisMonth: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
  revenueThisMonth: number;
  revenueByDay: DashboardRevenueDay[];
  recentAppointments: DashboardAppointment[];
  staff: DashboardStaffMember[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await api.get<DashboardStats>("/admin/dashboard/stats");
  return response.data;
}
