import { useAuth } from "./useAuth";

export type PermissionKey =
  | "viewAdmin"
  | "manageEmployees"
  | "manageCustomers"
  | "manageProducts"
  | "addProducts"
  | "editProducts"
  | "manageServices"
  | "addServices"
  | "editServices"
  | "managePayments"
  | "managePayroll"
  | "manageAgendamentos"
  | "manageOffScheduleAppointments"
  | "manageBlockedDates"
  | "manageBenefits"
  | "manageSettings"
  | "manageGallery";

/**
 * Permissões que o recepcionista tem POR PADRÃO.
 * Aplicadas quando o campo permissions do usuário não contém um valor explícito
 * para a chave (null, undefined ou chave ausente).
 * O admin pode revogar qualquer uma delas salvando explicitamente false.
 */
const RECEPTIONIST_DEFAULTS: Partial<Record<PermissionKey, boolean>> = {
  manageAgendamentos: true,
  manageOffScheduleAppointments: true,
  manageSettings: true,
};

export function usePermissions() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true || user?.role === "admin";
  const isReceptionist = user?.role === "receptionist";

  function can(permission: PermissionKey): boolean {
    if (isAdmin) return true;

    const explicit = user?.permissions?.[permission];

    // Valor explícito no banco tem prioridade (true ou false)
    if (explicit !== undefined && explicit !== null) return explicit === true;

    // Sem valor explícito: aplica defaults do role
    if (isReceptionist) return RECEPTIONIST_DEFAULTS[permission] === true;

    return false;
  }

  return { can, isAdmin };
}
