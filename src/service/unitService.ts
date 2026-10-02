import api from "./api";

export interface OwnerUnit {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface OwnerUnitsSummary {
  maxSalonUnits: number | null;
  currentUnits: number;
  units: OwnerUnit[];
}

export async function getMyUnits(): Promise<OwnerUnitsSummary> {
  const response = await api.get<OwnerUnitsSummary>("/salons/my-units");
  return response.data;
}

export async function createMyUnit(data: { name: string; businessType: string; phone?: string; email?: string; document?: string; slug?: string }) {
  const response = await api.post<{ salon: OwnerUnit; currentUnits: number; maxSalonUnits: number | null }>("/salons/my-units", data);
  return response.data;
}
