import api from "./api";

/* ─── tipos ─── */

export interface SuperAdminDashboard {
  totalSalons: number;
  activeSalons: number;
  inactiveSalons: number;
  blockedSalons: number;
  pendingSalons: number;
  activeSubscriptions: number;
  newSalonsThisMonth: number;
}

export type SalonStatus = "active" | "inactive" | "blocked" | "pending";
export type SubscriptionStatus = "active" | "paused" | "cancelled" | "expired" | "pending" | "none";

export interface SuperAdminPlatformSubscription {
  id: string;
  status: string;
  selected_plan: string;
  payment_method?: string | null;
  amount?: number | null;
  start_date?: string | null;
  next_billing_date?: string | null;
  canceled_at?: string | null;
  created_at: string;
  platform_plans?: {
    id: string;
    name: string;
    price: number;
    interval: string;
    interval_count: number;
  } | null;
}

export interface SuperAdminSalon {
  id: string;
  name: string;
  slug: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  status: SalonStatus;
  createdAt: string;
  blockedReason?: string | null;
  blockedAt?: string | null;
  deactivatedAt?: string | null;
  admin?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    created_at: string;
  } | null;
  subscription?: {
    id: string;
    status: string;
    created_at: string;
    next_billing_at?: string | null;
    last_billing_at?: string | null;
    subscription_plans?: {
      id: string;
      name: string;
      price: number;
    } | null;
  } | null;
  platformSubscription?: SuperAdminPlatformSubscription | null;
  metrics: {
    appointmentsCount: number;
    servicesCount: number;
    productsCount: number;
    clientsCount: number;
    employeesCount: number;
  };
}

export interface SuperAdminSalonDetail extends SuperAdminSalon {
  updated_at?: string;
  stripe_connect_account_id?: string | null;
  stripe_connect_charges_enabled?: boolean;
  stripe_connect_payouts_enabled?: boolean;
  subscriptions?: Array<{
    id: string;
    status: string;
    started_at?: string | null;
    next_billing_at?: string | null;
    ended_at?: string | null;
    created_at: string;
    users?: { id: string; name: string; email: string } | null;
    subscription_plans?: {
      id: string;
      name: string;
      price: number;
      cuts_per_month: number;
    } | null;
  }>;
}

export interface SuperAdminSalonUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_admin: boolean;
  current_salon_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  salonId?: string | null;
  salon?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
}

export interface ListSalonsParams {
  q?: string;
  status?: SalonStatus;
  plan?: string;
  subscriptionStatus?: SubscriptionStatus;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "updatedAt" | "status";
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface BackendSalon {
  id: string;
  name: string;
  slug: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  status: SalonStatus;
  created_at: string;
  updated_at?: string;
  selected_plan_id?: string | null;
  logo_url?: string | null;
}

interface BackendSalonUser {
  id: string;
  role: string;
  status?: string;
  created_at: string;
  updated_at: string;
  platform_users: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

function mapBackendSalon(salon: BackendSalon): SuperAdminSalon {
  return {
    id: salon.id,
    name: salon.name,
    slug: salon.slug,
    cnpj: salon.document ?? null,
    email: salon.email ?? null,
    phone: salon.phone ?? null,
    status: salon.status,
    createdAt: salon.created_at,
    metrics: {
      appointmentsCount: 0,
      servicesCount: 0,
      productsCount: 0,
      clientsCount: 0,
      employeesCount: 0,
    },
  };
}

/* ─── dashboard ─── */

export async function getSuperAdminDashboard(): Promise<SuperAdminDashboard> {
  const response = await api.get<SuperAdminDashboard>("/super-admin/dashboard");
  return response.data;
}

/* ─── salões ─── */

export async function listSuperAdminSalons(
  params: ListSalonsParams = {}
): Promise<PaginatedResponse<SuperAdminSalon>> {
  const response = await api.get<{ salons: BackendSalon[] }>("/salons");
  let items = (response.data.salons ?? []).map(mapBackendSalon);

  const query = params.q?.trim().toLocaleLowerCase("pt-BR");
  if (query) {
    items = items.filter((salon) =>
      [salon.name, salon.slug, salon.cnpj, salon.email, salon.phone]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(query))
    );
  }
  if (params.status) items = items.filter((salon) => salon.status === params.status);
  if (params.createdFrom) {
    const from = new Date(`${params.createdFrom}T00:00:00`).getTime();
    items = items.filter((salon) => new Date(salon.createdAt).getTime() >= from);
  }
  if (params.createdTo) {
    const to = new Date(`${params.createdTo}T23:59:59.999`).getTime();
    items = items.filter((salon) => new Date(salon.createdAt).getTime() <= to);
  }

  const direction = params.sortOrder === "asc" ? 1 : -1;
  items.sort((a, b) => {
    if (params.sortBy === "name") return a.name.localeCompare(b.name, "pt-BR") * direction;
    if (params.sortBy === "status") return a.status.localeCompare(b.status) * direction;
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
  });

  const total = items.length;
  const limit = Math.max(1, params.limit ?? 15);
  const page = Math.max(1, params.page ?? 1);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  return { items: items.slice(start, start + limit), total, page, limit, totalPages };
}

export async function getSuperAdminSalonById(
  id: string
): Promise<SuperAdminSalonDetail> {
  const response = await api.get<{ salon: BackendSalon }>(`/salons/${id}`);
  const salon = response.data.salon;
  return { ...mapBackendSalon(salon), updated_at: salon.updated_at };
}

export async function listSuperAdminSalonUsers(
  salonId: string
): Promise<{ items: SuperAdminSalonUser[]; total: number }> {
  const response = await api.get<{ users: BackendSalonUser[] }>("/users", {
    headers: { "x-salon-id": salonId },
  });
  const items = (response.data.users ?? []).map((membership) => ({
    id: membership.platform_users.id,
    name: membership.platform_users.name,
    email: membership.platform_users.email,
    role: membership.role,
    is_admin: membership.role === "admin",
    current_salon_id: salonId,
    created_at: membership.created_at,
    updated_at: membership.updated_at,
  }));
  return { items, total: items.length };
}

export async function updateSuperAdminSalonStatus(
  id: string,
  status: SalonStatus,
  reason?: string | null
): Promise<{ id: string; name: string; status: string; blocked_reason?: string | null }> {
  const response = await api.patch(`/super-admin/salons/${id}/status`, {
    status,
    reason: reason || undefined,
  });
  return response.data;
}

export async function activatePixPlatformSubscription(
  salonId: string,
  payload: {
    platformPlanId: string;
    paidAt?: string;
    nextBillingDate?: string;
    amount?: number;
  }
): Promise<SuperAdminPlatformSubscription> {
  const response = await api.post<SuperAdminPlatformSubscription>(
    `/super-admin/salons/${salonId}/platform-subscription/pix/activate`,
    payload
  );
  return response.data;
}

/* ─── usuários globais ─── */

export async function listSuperAdminUsers(params: {
  q?: string;
  role?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<SuperAdminUser>> {
  const response = await api.get<PaginatedResponse<SuperAdminUser>>(
    "/super-admin/users",
    { params }
  );
  return response.data;
}

export async function updateSuperAdminUser(
  id: string,
  data: { email?: string; phone?: string | null; newPassword?: string }
): Promise<SuperAdminUser> {
  const response = await api.patch<SuperAdminUser>(`/super-admin/users/${id}`, data);
  return response.data;
}

export async function resetSuperAdminUserPassword(
  id: string,
  newPassword?: string
): Promise<{ id: string; password: string }> {
  const response = await api.patch<{ id: string; password: string }>(
    `/super-admin/users/${id}/password`,
    newPassword ? { newPassword } : {}
  );
  return response.data;
}

/* ─── planos da plataforma ─── */

export interface PlatformPlan {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  interval: string;
  intervalCount?: number | null;
  interval_count?: number | null;
  trialPeriodDays?: number | null;
  trial_period_days?: number | null;
  statementDescriptor?: string | null;
  paymentMethods?: string[];
  payment_methods?: string[];
  features?: string[];
  maxBarbers?: number | null;
  max_barbers?: number | null;
  maxAdmins?: number | null;
  max_admins?: number | null;
  maxReceptionists?: number | null;
  max_receptionists?: number | null;
  isPublic?: boolean;
  is_public?: boolean;
  isRecommended?: boolean;
  is_recommended?: boolean;
  sortOrder?: number;
  sort_order?: number;
  active?: boolean;
  pagarmePlanId?: string | null;
  pagarme_plan_id?: string | null;
}

export async function getPlatformPlans(): Promise<PlatformPlan[]> {
  const response = await api.get<PlatformPlan[] | { items: PlatformPlan[] }>("/platform-plans");
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as { items: PlatformPlan[] }).items)) {
    return (data as { items: PlatformPlan[] }).items;
  }
  return [];
}

export async function createPlatformPlan(payload: {
  name: string;
  description?: string | null;
  price: number;
  interval: string;
  intervalCount: number;
  trialPeriodDays?: number;
  statementDescriptor?: string;
  paymentMethods?: string[];
  features?: string[];
  maxBarbers?: number | null;
  maxAdmins?: number | null;
  maxReceptionists?: number | null;
  isPublic?: boolean;
  isRecommended?: boolean;
  sortOrder?: number;
  syncPagarme?: boolean;
}): Promise<PlatformPlan & { pagarmeSkipped?: boolean }> {
  const response = await api.post<PlatformPlan & { pagarmeSkipped?: boolean }>("/platform-plans", payload);
  return response.data;
}

export async function updatePlatformPlan(
  id: string,
  payload: Partial<{
    name: string;
    description: string | null;
    price: number;
    features: string[];
    isPublic: boolean;
    isRecommended: boolean;
    sortOrder: number;
    maxBarbers: number | null;
    maxAdmins: number | null;
    maxReceptionists: number | null;
    statementDescriptor: string;
    paymentMethods: string[];
    active: boolean;
  }>
): Promise<PlatformPlan> {
  const response = await api.patch<PlatformPlan>(`/platform-plans/${id}`, payload);
  return response.data;
}

export async function deletePlatformPlan(id: string): Promise<void> {
  await api.delete(`/platform-plans/${id}`);
}
