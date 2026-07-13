import api from "./api";

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(
  userId: string,
  data: ChangePasswordPayload
) {
  const response = await api.patch(`/users/${userId}`, {
    currentPassword: data.currentPassword,
    newPassword: data.newPassword,
  });

  return response.data;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  birth_date?: string | null;
  role?: string;
  isAdmin?: boolean;
  permissions?: Record<string, boolean> | null;
  photoUrl?: string | null;
  salary?: number | null;
  createdAt?: string;
  updatedAt?: string;
  visits?: number;
  lastVisit?: string | null;
  lastAppointmentStatus?: string | null;
}

export interface ListUsersParams {
  role?: "admin" | "barber" | "receptionist" | "client";
  excludeRole?: "admin" | "barber" | "receptionist" | "client";
  q?: string;
  page?: number;
  limit?: number;
}

export interface ListUsersResponse {
  page: number;
  limit: number;
  total: number;
  items: UserProfile[];
}

export interface CreateUserPayload {
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  password: string;
  role: "admin" | "barber" | "receptionist" | "client";
  isAdmin?: boolean;
  permissions?: Record<string, boolean>;
  photoUrl?: string | null;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  role?: "admin" | "barber" | "receptionist" | "client";
  isAdmin?: boolean;
  photoUrl?: string | null;
  salary?: number | null;
  resetPassword?: boolean;
  newPassword?: string;
}

export async function listUsers(params: ListUsersParams = {}) {
  const response = await api.get<ListUsersResponse>("/users", { params });

  return response.data;
}

export async function createUser(data: CreateUserPayload) {
  const response = await api.post<UserProfile>("/users", data);

  return response.data;
}

export async function updateUser(userId: string, data: UpdateUserPayload) {
  const response = await api.patch<UserProfile>(`/users/${userId}`, data);

  return response.data;
}

export async function updateUserPermissions(
  userId: string,
  permissions: Record<string, boolean>
) {
  const response = await api.patch<UserProfile>(`/users/${userId}/permissions`, {
    permissions,
  });

  return response.data;
}

export async function deleteUser(userId: string) {
  const response = await api.delete<{ ok: boolean }>(`/users/${userId}`);

  return response.data;
}

export async function updateProfilePhoto(userId: string, photoUrl: string | null) {
  const response = await api.patch<UserProfile>(`/users/${userId}`, {
    photoUrl,
  });

  return response.data;
}
