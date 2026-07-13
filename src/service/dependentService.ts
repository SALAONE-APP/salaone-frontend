import api from "./api";

export interface Dependent {
  id: string;
  name: string;
  age: number;
  cpf: string;
  parentId: string;
  parentName?: string;
  parent_id?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDependentPayload {
  name: string;
  age: number;
  cpf: string;
  parentId: string;
  parentName: string;
}

export interface UpdateDependentPayload {
  name?: string;
  age?: number;
  cpf?: string;
}

export async function listDependents(parentId?: string) {
  const response = await api.get<Dependent[]>("/dependents", {
    params: parentId ? { parentId } : {},
  });
  return response.data;
}

export async function createDependent(data: CreateDependentPayload) {
  const response = await api.post<Dependent>("/dependents", data);
  return response.data;
}

export async function updateDependent(dependentId: string, data: UpdateDependentPayload) {
  const response = await api.patch<Dependent>(`/dependents/${dependentId}`, data);
  return response.data;
}

export async function deleteDependent(dependentId: string) {
  const response = await api.delete<{ ok: boolean }>(`/dependents/${dependentId}`);
  return response.data;
}
