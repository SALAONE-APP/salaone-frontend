import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  listSuperAdminUsers,
  updateSuperAdminUser,
  resetSuperAdminUserPassword,
  type SuperAdminUser,
} from "@/service/superAdminService";

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

export function SuperAdminUsersPage() {
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersPage, setUsersPage] = useState(1);
  const limit = 15;
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ q: "", role: "" });

  const [selectedUser, setSelectedUser] = useState<SuperAdminUser | null>(null);
  const [userForm, setUserForm] = useState({ email: "", phone: "", newPassword: "" });
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState({
    open: false, user: null as SuperAdminUser | null, newPassword: "", generatedPassword: "", isSubmitting: false,
  });

  const loadUsers = useCallback(async (overrides: { page?: number; q?: string; role?: string } = {}) => {
    const result = await listSuperAdminUsers({
      page: overrides.page ?? usersPage, limit,
      q: overrides.q !== undefined ? overrides.q : filters.q || undefined,
      role: overrides.role !== undefined ? overrides.role : filters.role || undefined,
    });
    setUsers(Array.isArray(result?.items) ? result.items : []);
    setTotal(Number(result?.total || 0));
    setTotalPages(Number(result?.totalPages || 1));
  }, [filters, usersPage]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try { await loadUsers(); } catch { toast.error("Nao foi possivel carregar os usuarios."); } finally { setLoading(false); }
    })();
  }, [loadUsers]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    setUsersPage(1);
    setLoading(true);
    try { await loadUsers({ page: 1 }); } catch { toast.error("Erro ao buscar usuarios."); } finally { setLoading(false); }
  };

  const openEditUser = (user: SuperAdminUser) => {
    setSelectedUser(user);
    setUserForm({ email: user.email ?? "", phone: user.phone ?? "", newPassword: "" });
  };

  const closeEditUser = () => { setSelectedUser(null); setUserForm({ email: "", phone: "", newPassword: "" }); };

  const submitEditUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSavingUserId(selectedUser.id);
    try {
      const payload: { email?: string; phone?: string; newPassword?: string } = {
        email: userForm.email.trim(),
        phone: userForm.phone.trim(),
      };
      const pw = userForm.newPassword.trim();
      if (pw) payload.newPassword = pw;
      await updateSuperAdminUser(selectedUser.id, payload);
      toast.success(`Usuario ${selectedUser.name} atualizado.`);
      closeEditUser();
      await loadUsers();
    } catch { toast.error("Nao foi possivel atualizar o usuario."); } finally { setSavingUserId(null); }
  };

  const openResetPasswordModal = (user: SuperAdminUser) =>
    setResetPasswordModal({ open: true, user, newPassword: "", generatedPassword: "", isSubmitting: false });

  const closeResetPasswordModal = () =>
    setResetPasswordModal({ open: false, user: null, newPassword: "", generatedPassword: "", isSubmitting: false });

  const submitResetPasswordModal = async () => {
    if (!resetPasswordModal.user) return;
    setResetPasswordModal((p) => ({ ...p, isSubmitting: true }));
    try {
      const pw = resetPasswordModal.newPassword.trim() || undefined;
      const res = await resetSuperAdminUserPassword(resetPasswordModal.user.id, pw);
      setResetPasswordModal((p) => ({ ...p, generatedPassword: res?.password ?? "", isSubmitting: false }));
      toast.success("Senha redefinida com sucesso.");
    } catch {
      setResetPasswordModal((p) => ({ ...p, isSubmitting: false }));
      toast.error("Erro ao redefinir senha.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Gestao de Usuarios</h3>
        <p className="text-sm text-muted-foreground">Acesse todas as contas e atualize email, telefone ou senha.</p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <input type="text" placeholder="Buscar por nome, email, telefone ou CPF"
          value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
          className="h-9 min-w-48 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <select value={filters.role} onChange={(e) => setFilters((p) => ({ ...p, role: e.target.value }))}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
          <option value="">Todos os papeis</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="barber">Barbeiro</option>
          <option value="receptionist">Recepcionista</option>
          <option value="client">Cliente</option>
        </select>
        <button type="submit" className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Buscar</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">Contato</th>
                <th className="px-5 py-3">Papel</th>
                <th className="px-5 py-3">Barbearia atual</th>
                <th className="px-5 py-3">Criacao</th>
                <th className="px-5 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 animate-spin" size={20} />Carregando...
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Nenhum usuario encontrado.</td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-5 py-3">
                    <strong className="block text-foreground">{user.name}</strong>
                    <small className="text-muted-foreground">ID: {user.id.slice(0, 8)}...</small>
                  </td>
                  <td className="px-5 py-3">
                    <strong className="block text-foreground">{user.email ?? "-"}</strong>
                    <small className="text-muted-foreground">{user.phone ?? "-"}</small>
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {String(user.role ?? "-").replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <strong className="block text-foreground">{user.barbershop?.name ?? "-"}</strong>
                    <small className="text-muted-foreground">{user.barbershop?.slug ?? "-"}</small>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(user.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => openEditUser(user)} className="rounded bg-secondary px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary/80">Editar</button>
                      <button type="button" onClick={() => openResetPasswordModal(user)} className="rounded border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary">Resetar senha</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
          <span>Pagina {usersPage} de {totalPages} | Total: {total}</span>
          <div className="flex gap-2">
            <button type="button" disabled={usersPage <= 1} onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
              className="rounded border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-secondary">Anterior</button>
            <button type="button" disabled={usersPage >= totalPages} onClick={() => setUsersPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-secondary">Proxima</button>
          </div>
        </div>
      </div>

      {/* Modal Editar usuario */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeEditUser}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Editar usuario</h3>
              <button type="button" onClick={closeEditUser} className="rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-secondary">Fechar</button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Ajuste os dados de <strong className="text-foreground">{selectedUser.name}</strong> e salve.</p>
            <form onSubmit={submitEditUser} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="usuario@exemplo.com"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                  <input type="text" value={userForm.phone} onChange={(e) => setUserForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Somente numeros"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="col-span-full space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nova senha (deixe em branco para nao alterar)</label>
                  <input type="password" value={userForm.newPassword} onChange={(e) => setUserForm((p) => ({ ...p, newPassword: e.target.value }))}
                    placeholder="Deixe em branco para nao alterar"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeEditUser} className="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                <button type="submit" disabled={savingUserId === selectedUser.id}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {savingUserId === selectedUser.id ? "Salvando..." : "Salvar alteracoes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resetar senha */}
      {resetPasswordModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeResetPasswordModal}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Redefinir Senha</h3>
              <button type="button" onClick={closeResetPasswordModal} className="rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-secondary">Fechar</button>
            </div>
            {!resetPasswordModal.generatedPassword ? (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Redefinir senha de <strong className="text-foreground">{resetPasswordModal.user?.name ?? resetPasswordModal.user?.email}</strong>.
                </p>
                <div className="mb-4 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nova senha (deixe vazio para gerar automaticamente)</label>
                  <input type="text" value={resetPasswordModal.newPassword}
                    onChange={(e) => setResetPasswordModal((p) => ({ ...p, newPassword: e.target.value }))}
                    placeholder="Ex.: Abc@1234"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={closeResetPasswordModal} className="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                  <button type="button" onClick={() => void submitResetPasswordModal()} disabled={resetPasswordModal.isSubmitting}
                    className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {resetPasswordModal.isSubmitting ? "Redefinindo..." : "Confirmar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">Senha de <strong className="text-foreground">{resetPasswordModal.user?.name}</strong> redefinida com sucesso!</p>
                <div className="mb-3 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Senha temporaria</label>
                  <input type="text" readOnly value={resetPasswordModal.generatedPassword}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="h-9 w-full cursor-text rounded-lg border border-border bg-secondary px-3 font-mono text-sm text-foreground focus:outline-none"
                  />
                </div>
                <p className="mb-4 text-xs text-muted-foreground">Compartilhe esta senha com o usuario. Ele devera altera-la no primeiro acesso.</p>
                <div className="flex justify-end">
                  <button type="button" onClick={closeResetPasswordModal} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Concluido</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
