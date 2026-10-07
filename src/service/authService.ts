import api from "./api";

export const SUPER_ADMIN_ACCESS_STORAGE_KEY = "superAdminSalonAccess";

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
  id?: string | null;
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
    salonUserId?: string | null;
  };
  memberships?: SalonMembership[];
  salon?: StoredSalon | null;
}

export interface AccessibleSalon extends StoredSalon {
  role: string;
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
  return role === "professional" ? "professional" : role;
}

function normalizePermissions(permissions?: Record<string, boolean> | null) {
  if (!permissions) return permissions ?? null;
  return {
    ...permissions,
    manageAgendamentos: permissions.manageAgendamentos ?? permissions.manageAppointments ?? false,
  };
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

  // Um superadmin pode também ter vínculo com algum salão (por exemplo,
  // como cliente). O vínculo não representa seu papel global de plataforma.
  const isSuperAdmin = response.data.user.role === "super_admin";
  const membership = isSuperAdmin ? undefined : response.data.memberships[0];
  const user = {
    ...response.data.user,
    role: isSuperAdmin ? "super_admin" : normalizeRole(membership?.role ?? response.data.user.role),
    permissions: isSuperAdmin ? null : normalizePermissions(membership?.permissions),
    salonUserId: membership?.id ?? null,
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

function persistAuthResponse(response: AuthResponse) {
  const token = response.accessToken || response.token || "";
  if (!token) throw new Error("O servidor não retornou um token de acesso.");

  localStorage.setItem("token", token);
  if (response.refreshToken) localStorage.setItem("refreshToken", response.refreshToken);
  else localStorage.removeItem("refreshToken");
  localStorage.setItem("user", JSON.stringify(response.user));

  if (response.salon) localStorage.setItem("salon", JSON.stringify(response.salon));
  else localStorage.removeItem("salon");
  window.dispatchEvent(new Event("salon:updated"));
}

export async function switchSalon(salonId: string | null): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/switch-salon", { salonId });
  persistAuthResponse(response.data);
  return response.data;
}

export async function listAccessibleSalons(): Promise<AccessibleSalon[]> {
  const response = await api.get<{ items: AccessibleSalon[] }>("/auth/salons");
  return Array.isArray(response.data.items) ? response.data.items : [];
}

export async function register(_data: RegisterPayload) {
  void _data;
  throw new Error("O backend atual não oferece autocadastro público.");
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("salon");
  localStorage.removeItem(SUPER_ADMIN_ACCESS_STORAGE_KEY);
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem("token"));
}

export async function fetchMe() {
  const response = await api.get<{
    user: AuthResponse["user"] & { photo_url?: string | null };
    memberships: SalonMembership[];
    tenantContext: { salonId: string } | null;
  }>("/auth/me");
  const user = response.data.user;
  // O superadmin pode possuir um vínculo comum (inclusive como cliente) em
  // algum salão. Esse vínculo não pode substituir seu papel global enquanto
  // ele acessa o contexto do salão, ou o painel passa a renderizar como
  // cliente e encerra o acesso de suporte.
  const isSuperAdmin = user.role === "super_admin";
  const membership = isSuperAdmin
    ? undefined
    : response.data.memberships.find(
      (item) => item.salon_id === response.data.tenantContext?.salonId,
    ) ?? response.data.memberships[0];

  return {
    ...user,
    photoUrl: user.photoUrl ?? user.photo_url ?? null,
    role: isSuperAdmin ? "super_admin" : normalizeRole(membership?.role ?? user.role),
    permissions: isSuperAdmin ? null : normalizePermissions(membership?.permissions),
    salonUserId: membership?.id ?? null,
    activeSalonId: response.data.tenantContext?.salonId ?? null,
  };
}

export async function forgotPassword(_email: string): Promise<{ message: string }> {
  void _email;
  throw new Error("O backend atual não oferece recuperação de senha.");
}

export async function resetPassword(_password: string, _token: string): Promise<{ message: string }> {
  void _password;
  void _token;
  throw new Error("O backend atual não oferece redefinição pública de senha.");
}
