export type UserRole = "client" | "professional" | "admin" | "super_admin" | "receptionist";

export interface ProfileConfig {
  role: UserRole;
  label: string;
  panelTitle: string;
  defaultRoute: string;
}

const roles: UserRole[] = ["client", "professional", "admin", "super_admin", "receptionist"];

export function normalizeRole(role?: string | null): UserRole {
  const rawRole = String(role || "").trim().toLowerCase();
  const normalized = rawRole === "professional" ? "professional" : rawRole;

  return roles.includes(normalized as UserRole) ? (normalized as UserRole) : "client";
}

export const profileConfigs: Record<UserRole, ProfileConfig> = {
  client: {
    role: "client",
    label: "Cliente",
    panelTitle: "Area do Cliente",
    defaultRoute: "/home",
  },
  professional: {
    role: "professional",
    label: "Profissional",
    panelTitle: "Painel do Profissional",
    defaultRoute: "/home",
  },
  admin: {
    role: "admin",
    label: "Administrador",
    panelTitle: "Painel da Salão",
    defaultRoute: "/home",
  },
  super_admin: {
    role: "super_admin",
    label: "Super Admin",
    panelTitle: "Admin Global",
    defaultRoute: "/home",
  },
  receptionist: {
    role: "receptionist",
    label: "Recepcionista",
    panelTitle: "Recepcao",
    defaultRoute: "/home",
  },
};

export function getProfileConfig(role?: string | null) {
  return profileConfigs[normalizeRole(role)];
}

export function getDefaultRouteForRole(role?: string | null) {
  return getProfileConfig(role).defaultRoute;
}
