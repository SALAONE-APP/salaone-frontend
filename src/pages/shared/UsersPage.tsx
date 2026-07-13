import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Calendar,
  Camera,
  Edit,
  Filter,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { uploadProfilePhoto } from "@/service/uploadService";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  updateUserPermissions,
  type ListUsersParams,
  type UserProfile,
} from "@/service/userService";
import {
  createBarber,
  listBarbers,
  updateBarber,
  type Barber,
} from "@/service/barberService";
import { listServices, type Service } from "@/service/serviceService";

type UserRole = NonNullable<ListUsersParams["role"]>;
type ManagedUserRole = Exclude<UserRole, "client">;
type RoleFilter = "all" | ManagedUserRole;
type PermissionKey =
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

type UserPermissions = Record<PermissionKey, boolean>;

const permissionOptions: Array<{
  key: PermissionKey;
  label: string;
  description: string;
}> = [
  { key: "viewAdmin", label: "Acessar painel admin", description: "Permite entrar nas areas administrativas." },
  { key: "manageEmployees", label: "Gerenciar funcionarios", description: "Permite cadastrar, editar e remover funcionarios." },
  { key: "manageCustomers", label: "Gerenciar clientes", description: "Permite cadastrar, editar e remover clientes." },
  { key: "manageAgendamentos", label: "Gerenciar agendamentos", description: "Permite criar, alterar e cancelar agendamentos." },
  { key: "manageOffScheduleAppointments", label: "Agendamentos fora do horario", description: "Permite encaixes fora da grade configurada." },
  { key: "manageBlockedDates", label: "Bloquear agenda", description: "Permite criar e remover bloqueios de agenda." },
  { key: "manageServices", label: "Gerenciar servicos", description: "Permite administrar servicos." },
  { key: "addServices", label: "Adicionar servicos", description: "Permite cadastrar novos servicos." },
  { key: "editServices", label: "Editar servicos", description: "Permite alterar servicos existentes." },
  { key: "manageProducts", label: "Gerenciar produtos", description: "Permite administrar produtos." },
  { key: "addProducts", label: "Adicionar produtos", description: "Permite cadastrar novos produtos." },
  { key: "editProducts", label: "Editar produtos", description: "Permite alterar produtos existentes." },
  { key: "managePayments", label: "Gerenciar pagamentos", description: "Permite acessar e administrar pagamentos." },
  { key: "managePayroll", label: "Gerenciar pagamentos de equipe", description: "Permite controlar vales e repasses." },
  { key: "manageBenefits", label: "Gerenciar beneficios", description: "Permite administrar planos e assinaturas." },
  { key: "manageGallery", label: "Gerenciar galeria", description: "Permite alterar imagens da salão." },
  { key: "manageSettings", label: "Gerenciar configuracoes", description: "Permite alterar configuracoes gerais." },
];

const emptyPermissions = permissionOptions.reduce((acc, permission) => {
  acc[permission.key] = false;
  return acc;
}, {} as UserPermissions);

interface UserFormState {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  role: ManagedUserRole;
  password: string;
  resetPassword: boolean;
  photoUrl: string | null;
  salary: string;
  commissionPercent: string;
  serviceIds: string[];
}

const emptyForm: UserFormState = {
  name: "",
  email: "",
  phone: "",
  cpf: "",
  role: "barber",
  password: "",
  resetPassword: false,
  photoUrl: null,
  salary: "",
  commissionPercent: "",
  serviceIds: [],
};

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  barber: "Profissional",
  receptionist: "Recepcionista",
  client: "Cliente",
};

const roleClasses: Record<UserRole, string> = {
  admin: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  barber: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  receptionist: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  client: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCurrency(value: string): string {
  const digits = onlyDigits(value).slice(0, 13);
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  return `${reais.toLocaleString("pt-BR")},${String(centavos).padStart(2, "0")}`;
}

function parseCurrency(masked: string): number {
  return parseFloat(onlyDigits(masked)) / 100;
}

function maskCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value?: string | null) {
  const digits = onlyDigits(value ?? "");

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return value || "Sem telefone";
}

function formatDate(value?: string | null) {
  if (!value) return "Nunca";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function normalizePermissions(permissions?: Record<string, boolean> | null): UserPermissions {
  return permissionOptions.reduce((acc, permission) => {
    acc[permission.key] = permissions?.[permission.key] === true;
    return acc;
  }, {} as UserPermissions);
}

function countEnabledPermissions(permissions?: Record<string, boolean> | null) {
  return permissionOptions.filter((permission) => permissions?.[permission.key] === true).length;
}

function getApiMessage(error: unknown) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;

  if (Array.isArray(responseData)) return responseData.join(" ");

  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  if (error instanceof Error) return error.message;

  return "Nao foi possivel concluir a operacao.";
}

function roleFromUser(user: UserProfile): UserRole {
  if (
    user.role === "admin" ||
    user.role === "barber" ||
    user.role === "receptionist" ||
    user.role === "client"
  ) {
    return user.role;
  }

  return user.isAdmin ? "admin" : "client";
}

function userToForm(user: UserProfile, barber?: Barber | null): UserFormState {
  const role = roleFromUser(user);

  return {
    name: user.name ?? "",
    email: user.email ?? "",
    phone: maskPhone(user.phone ?? ""),
    cpf: maskCpf(user.cpf ?? ""),
    role: role === "client" ? "barber" : role,
    password: "",
    resetPassword: false,
    photoUrl: user.photoUrl ?? null,
    salary: user.salary != null ? maskCurrency(String(Math.round(user.salary * 100))) : "",
    commissionPercent: barber?.commissionPercent != null ? String(barber.commissionPercent) : "",
    serviceIds: barber?.serviceIds ?? [],
  };
}

export function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<UserProfile | null>(null);
  const [permissionsForm, setPermissionsForm] = useState<UserPermissions>({
    ...emptyPermissions,
  });
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);

  const limit = 20;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listUsers({
        role: roleFilter === "all" ? undefined : roleFilter,
        excludeRole: roleFilter === "all" ? "client" : undefined,
        q: search.trim() || undefined,
        page,
        limit,
      });

      setUsers(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [limit, page, roleFilter, search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadUsers();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [loadUsers]);

  const stats = useMemo(() => {
    const admins = users.filter((user) => roleFromUser(user) === "admin").length;
    const barbers = users.filter((user) => roleFromUser(user) === "barber").length;
    const receptionists = users.filter((user) => roleFromUser(user) === "receptionist").length;

    return { admins, barbers, receptionists };
  }, [users]);



  const totalPages = Math.max(1, Math.ceil(total / limit));

  function setField<TField extends keyof UserFormState>(
    field: TField,
    value: UserFormState[TField],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateDialog() {
    setEditingUser(null);
    setEditingBarber(null);
    setForm({ ...emptyForm, password: "123456" });
    setDialogOpen(true);
    void listServices({ limit: 100 })
      .then((res) => setServices(res.items))
      .catch((err) => toast.error(getApiMessage(err)));
  }

  async function openEditDialog(user: UserProfile) {
    setEditingUser(user);
    setDialogOpen(true);
    void listServices({ limit: 100 })
      .then((res) => setServices(res.items))
      .catch((err) => toast.error(getApiMessage(err)));

    if (roleFromUser(user) === "barber") {
      try {
        const res = await listBarbers({ limit: 200 });
        const barber = res.items.find((b) => b.userId === user.id) ?? null;
        setEditingBarber(barber);
        setForm(userToForm(user, barber));
      } catch {
        setEditingBarber(null);
        setForm(userToForm(user));
      }
    } else {
      setEditingBarber(null);
      setForm(userToForm(user));
    }
  }

  function openPermissionsDialog(user: UserProfile) {
    setPermissionsUser(user);
    setPermissionsForm(normalizePermissions(user.permissions));
    setPermissionsDialogOpen(true);
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePhoto(file);
      setField("photoUrl", url);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function setPermission(permission: PermissionKey, checked: boolean) {
    setPermissionsForm((current) => ({
      ...current,
      [permission]: checked,
    }));
  }

  function setAllPermissions(checked: boolean) {
    setPermissionsForm(
      permissionOptions.reduce((acc, permission) => {
        acc[permission.key] = checked;
        return acc;
      }, {} as UserPermissions),
    );
  }

  function validateForm() {
    if (!form.name.trim()) return "Informe o nome do funcionario.";
    if (!form.email.trim()) return "Informe o e-mail do funcionario.";

    const phone = onlyDigits(form.phone);
    if (phone && (phone.length < 10 || phone.length > 15)) {
      return "O telefone deve ter entre 10 e 15 digitos.";
    }

    const cpf = onlyDigits(form.cpf);
    if (cpf && cpf.length !== 11) {
      return "O CPF deve ter 11 digitos.";
    }

    if (!editingUser && form.password.trim().length < 4) {
      return "A senha inicial deve ter no minimo 4 caracteres.";
    }

    if (editingUser && form.resetPassword && form.password.trim().length < 4) {
      return "A nova senha deve ter no minimo 4 caracteres.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: onlyDigits(form.phone) || null,
      cpf: onlyDigits(form.cpf) || null,
      role: form.role,
      isAdmin: form.role === "admin",
      photoUrl: form.photoUrl,
      salary: form.salary !== "" ? parseCurrency(form.salary) : null,
    };

    const commissionValue = form.commissionPercent !== ""
      ? Math.min(100, Math.max(0, parseInt(form.commissionPercent, 10)))
      : null;

    setSaving(true);

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          ...payload,
          resetPassword: form.resetPassword,
          newPassword: form.resetPassword ? form.password.trim() : undefined,
        });

        if (form.role === "barber") {
          const barberData = {
            displayName: form.name.trim(),
            commissionPercent: commissionValue,
            serviceIds: form.serviceIds,
          };
          if (editingBarber) {
            await updateBarber(editingBarber.id, barberData);
          } else {
            await createBarber({ ...barberData, userId: editingUser.id });
          }
        }

        toast.success("Funcionario atualizado.");
      } else {
        const created = await createUser({
          ...payload,
          password: form.password.trim(),
        });

        if (form.role === "barber" && created?.id) {
          await createBarber({
            displayName: form.name.trim(),
            commissionPercent: commissionValue,
            serviceIds: form.serviceIds,
            userId: created.id,
          });
        }

        toast.success("Funcionario cadastrado.");
      }

      setDialogOpen(false);
      await loadUsers();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!userToDelete) return;

    try {
      await deleteUser(userToDelete.id);
      toast.success("Funcionario removido.");
      setUserToDelete(null);

      if (users.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadUsers();
      }
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  async function handlePermissionsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!permissionsUser) return;

    const role = roleFromUser(permissionsUser);
    const permissions = role === "admin" ? { ...emptyPermissions } : permissionsForm;

    setSavingPermissions(true);

    try {
      await updateUserPermissions(permissionsUser.id, permissions);
      toast.success("Permissoes atualizadas.");
      setPermissionsDialogOpen(false);
      setPermissionsUser(null);
      await loadUsers();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSavingPermissions(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Funcionarios internos</p>
          <h3 className="text-2xl font-semibold text-foreground">{total}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Profissionais nesta pagina</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.barbers}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Admins nesta pagina</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.admins}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Recepcionistas nesta pagina</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.receptionists}</h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">Todos os Funcionarios</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar funcionarios..."
                className="h-9 w-full bg-secondary pl-9 text-sm sm:w-60"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter size={14} />
                  Perfil
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={roleFilter}
                  onValueChange={(value) => {
                    setRoleFilter(value as RoleFilter);
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="admin">Administradores</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="barber">Profissionais</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="receptionist">
                    Recepcionistas
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="gap-2" onClick={openCreateDialog}>
              <Plus size={14} />
              Adicionar Funcionario
            </Button>
          </div>
        </div>

        {error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">

                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Funcionario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Perfil
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Permissoes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Contato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ultima atividade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Criado em
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando funcionarios...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum funcionario encontrado.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const role = roleFromUser(user);

                    return (
                      <tr
                        key={user.id}
                        className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                      >

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.photoUrl ?? undefined} alt={user.name} />
                              <AvatarFallback className="bg-primary/10 text-sm text-primary">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {user.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Mail size={10} />
                                {user.email || "Sem e-mail"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`rounded-full px-2 py-0.5 text-xs ${roleClasses[role]}`}
                          >
                            <Shield size={10} className="mr-1" />
                            {roleLabels[role]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {role === "admin" ? (
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                              Acesso total
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {countEnabledPermissions(user.permissions)} ativas
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2"
                                onClick={() => openPermissionsDialog(user)}
                              >
                                <Shield size={14} />
                                Alterar
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone size={12} />
                            {formatPhone(user.phone)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar size={14} />
                            {formatDate(user.lastVisit)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 text-muted-foreground transition-colors hover:text-foreground">
                                <MoreHorizontal size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Edit size={14} />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPermissionsDialog(user)}>
                                <Shield size={14} />
                                Permissoes
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setUserToDelete(user)}
                              >
                                <Trash2 size={14} />
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Pagina {page} de {totalPages} - {total} funcionarios
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Proxima
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setUploadingPhoto(false);
        }}
      >
        {/* p-0 gap-0 overflow-hidden para controlar padding e scroll manualmente */}
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden">
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">

            {/* Cabeçalho fixo */}
            <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Editar Funcionario" : "Adicionar Funcionario"}
                </DialogTitle>
                <DialogDescription>
                  {editingUser
                    ? "Atualize os dados de acesso e perfil deste funcionario."
                    : "Cadastre um funcionario vinculado a esta salão."}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Corpo com scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-20 w-20 ring-2 ring-border">
                  <AvatarImage src={form.photoUrl ?? undefined} alt={form.name} />
                  <AvatarFallback className="bg-primary/10 text-lg text-primary">
                    {getInitials(form.name || "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Camera size={14} />
                        Alterar foto
                      </>
                    )}
                  </Button>
                  {form.photoUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setField("photoUrl", null)}
                      disabled={uploadingPhoto}
                    >
                      Remover
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="user-name">Nome</Label>
                  <Input
                    id="user-name"
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-email">E-mail</Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setField("email", event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-role">Perfil</Label>
                  <Select
                    value={form.role}
                    onValueChange={(value) => setField("role", value as ManagedUserRole)}
                  >
                    <SelectTrigger id="user-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <UserCog size={14} />
                        Administrador
                      </SelectItem>
                      <SelectItem value="barber">Profissional</SelectItem>
                      <SelectItem value="receptionist">Recepcionista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-phone">Telefone</Label>
                  <Input
                    id="user-phone"
                    value={form.phone}
                    onChange={(event) => setField("phone", maskPhone(event.target.value))}
                    placeholder="(11) 99999-9999"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-cpf">CPF</Label>
                  <Input
                    id="user-cpf"
                    value={form.cpf}
                    onChange={(event) => setField("cpf", maskCpf(event.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </div>

                {editingUser ? (
                  <div className="space-y-2">
                    <Label htmlFor="user-salary">Salario fixo (R$)</Label>
                    <Input
                      id="user-salary"
                      value={form.salary}
                      onChange={(event) => setField("salary", maskCurrency(event.target.value))}
                      placeholder="0,00"
                      inputMode="numeric"
                    />
                  </div>
                ) : null}

                {editingUser ? (
                  <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm md:col-span-2">
                    <Checkbox
                      checked={form.resetPassword}
                      onCheckedChange={(checked) => setField("resetPassword", checked === true)}
                    />
                    Redefinir senha deste funcionario
                  </label>
                ) : null}

                {editingUser && !form.resetPassword ? null : (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="user-password">
                      {editingUser ? "Nova senha" : "Senha inicial"}
                    </Label>
                    <Input
                      id="user-password"
                      type="password"
                      value={form.password}
                      onChange={(event) => setField("password", event.target.value)}
                      placeholder="Minimo 4 caracteres"
                      required={!editingUser || form.resetPassword}
                    />
                  </div>
                )}
              </div>

              {/* Seção exclusiva para profissionais */}
              {form.role === "barber" && (
                <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
                  <h4 className="text-sm font-semibold text-foreground">Configurações do profissional</h4>

                  <div className="space-y-2">
                    <Label htmlFor="user-commission">Comissão padrão (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="user-commission"
                        type="number"
                        min="0"
                        max="100"
                        value={form.commissionPercent}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "" || (/^\d+$/.test(v) && parseInt(v, 10) <= 100)) {
                            setField("commissionPercent", v);
                          }
                        }}
                        placeholder="Ex: 50"
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        % sobre cada serviço realizado
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Serviços sem comissão própria usarão este percentual como padrão.
                    </p>
                  </div>

                  {services.length > 0 && (
                    <div className="space-y-2">
                      <Label>Serviços que o profissional realiza</Label>
                      <p className="text-xs text-muted-foreground">
                        Selecione os serviços disponíveis para este profissional.
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {services.map((service) => (
                          <label
                            key={service.id}
                            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm cursor-pointer hover:border-primary/50 transition-colors"
                          >
                            <Checkbox
                              checked={form.serviceIds.includes(service.id)}
                              onCheckedChange={(checked) => {
                                setField(
                                  "serviceIds",
                                  checked
                                    ? [...form.serviceIds, service.id]
                                    : form.serviceIds.filter((id) => id !== service.id),
                                );
                              }}
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{service.name}</p>
                              {service.commissionPercent != null && (
                                <p className="text-xs text-muted-foreground">
                                  Comissão própria: {service.commissionPercent}%
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer sticky */}
            <div className="shrink-0 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end px-6 py-4 border-t border-border bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={permissionsDialogOpen}
        onOpenChange={(open) => {
          setPermissionsDialogOpen(open);
          if (!open) setPermissionsUser(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <form onSubmit={handlePermissionsSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Permissoes do funcionario</DialogTitle>
              <DialogDescription>
                {permissionsUser
                  ? `Defina os acessos de ${permissionsUser.name}.`
                  : "Defina os acessos deste funcionario."}
              </DialogDescription>
            </DialogHeader>

            {permissionsUser && roleFromUser(permissionsUser) === "admin" ? (
              <div className="rounded-md border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
                Administradores possuem acesso total automaticamente.
              </div>
            ) : (
              <>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions(true)}>
                    Marcar todas
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions(false)}>
                    Limpar
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {permissionOptions.map((permission) => (
                    <div
                      key={permission.key}
                      className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
                    >
                      <div className="min-w-0">
                        <Label
                          htmlFor={`permission-dialog-${permission.key}`}
                          className="text-sm font-medium"
                        >
                          {permission.label}
                        </Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {permission.description}
                        </p>
                      </div>
                      <Switch
                        id={`permission-dialog-${permission.key}`}
                        checked={permissionsForm[permission.key]}
                        onCheckedChange={(checked) => setPermission(permission.key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPermissionsDialogOpen(false)}
                disabled={savingPermissions}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  savingPermissions ||
                  !permissionsUser ||
                  roleFromUser(permissionsUser) === "admin"
                }
              >
                {savingPermissions ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando
                  </>
                ) : (
                  "Salvar permissoes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(userToDelete)}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover funcionario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao remove {userToDelete?.name} do cadastro da salão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
