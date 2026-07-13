import api from "./api";

export type LandingLeadStatus = "new" | "in_contact" | "converted" | "discarded";
export interface LandingLead { id: string; name: string; email: string; phone: string; cnpj: string | null; source: string; status: LandingLeadStatus; notes: string | null; contactedAt: string | null; createdAt: string; updatedAt: string; }
export interface LandingLeadMetrics { total: number; new: number; inContact: number; converted: number; }
export interface LandingLeadList { items: LandingLead[]; page: number; limit: number; total: number; totalPages: number; metrics: LandingLeadMetrics; }

export async function createLandingLead(data: { name: string; email: string; phone: string; cnpj?: string | null }) {
  const response = await api.post<{ message: string; lead: LandingLead }>("/public/landing-leads", data);
  return response.data;
}
export async function listLandingLeads(params: { q?: string; status?: LandingLeadStatus; page?: number; limit?: number; sortOrder?: "asc" | "desc" }) { const response = await api.get<LandingLeadList>("/super-admin/landing-leads", { params }); return response.data; }
export async function getLandingLead(id: string) { const response = await api.get<LandingLead>(`/super-admin/landing-leads/${id}`); return response.data; }
export async function updateLandingLead(id: string, data: { status?: LandingLeadStatus; notes?: string | null; contactedAt?: string | null }) { const response = await api.patch<LandingLead>(`/super-admin/landing-leads/${id}`, data); return response.data; }
