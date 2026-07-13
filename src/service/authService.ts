import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface SalonMembership {
  salon_id: string;
  role: string;
  permissions?: Record<string, boolean> | null;
  status: string;
}

export interface StoredSalon {
  id: string;
  name: string;
  slug: string;
  status?: string;
  logoUrl?: string;
}

export interface AuthResponse {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  trialExpired?: boolean;
  trialExpiredAt?: string;
  message?: string;
  requiresProfileCompletion?: boolean;
  created?: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
    isAdmin?: boolean;
    photoUrl?: string | null;
    permissions?: Record<string, boolean> | null;
  };
  memberships?: SalonMembership[];
  salon?: StoredSalon | null;
}

interface BackendAuthResponse {
  token: string;
  user: AuthResponse["user"];
  memberships: SalonMembership[];
}

interface BackendSalon {
  id: string;
  name: string;
  slug: string;
  status?: string;
  logo_url?: string | null;
}

function normalizeRole(role?: string) {
  return role === "professional" ? "barber" : role;
}

function normalizeSalon(salon: BackendSalon): StoredSalon {
  return {
    id: salon.id,
    name: salon.name,
    slug: salon.slug,
    status: salon.status,
    logoUrl: salon.logo_url ?? undefined,
  };
}

export async function login(data: LoginPayload): Promise<AuthResponse> {
  const response = await api.post<BackendAuthResponse>("/auth/login", {
    email: data.email,
    password: data.password,
  });

  const membership = response.data.memberships[0];
  const user = {
    ...response.data.user,
    role: normalizeRole(membership?.role ?? response.data.user.role),
    permissions: membership?.permissions ?? null,
  };

  localStorage.setItem("token", response.data.token);
  localStorage.removeItem("refreshToken");
  localStorage.setItem("user", JSON.stringify(user));

  let salon: StoredSalon | null = null;
  if (membership) {
    const salonResponse = await api.get<{ salon: BackendSalon }>("/salons/me");
    salon = normalizeSalon(salonResponse.data.salon);
    localStorage.setItem("salon", JSON.stringify(salon));
  } else {
    localStorage.removeItem("salon");
  }

  return {
    token: response.data.token,
    user,
    memberships: response.data.memberships,
    salon,
  };
}

export async function register(_data: RegisterPayload) {
  throw new Error("O backend atual não oferece autocadastro público.");
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("salon");
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem("token"));
}

export async function fetchMe() {
  const response = await api.get<{
    user: AuthResponse["user"];
    memberships: SalonMembership[];
    tenantContext: { salonId: string } | null;
  }>("/auth/me");
  const membership = response.data.memberships.find(
    (item) => item.salon_id === response.data.tenantContext?.salonId,
  ) ?? response.data.memberships[0];

  return {
    ...response.data.user,
    role: normalizeRole(membership?.role ?? response.data.user.role),
    permissions: membership?.permissions ?? null,
  };
}

export async function forgotPassword(_email: string): Promise<{ message: string }> {
  throw new Error("O backend atual não oferece recuperação de senha.");
}

export async function resetPassword(_password: string, _token: string): Promise<{ message: string }> {
  throw new Error("O backend atual não oferece redefinição pública de senha.");
}
