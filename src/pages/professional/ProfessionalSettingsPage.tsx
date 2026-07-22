import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleUserRound, Copy, Check, Link2, Save, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordInput } from '@/components/PasswordInput';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { getSalonProfile } from '@/service/salonProfileService';
import { uploadProfilePhoto } from '@/service/uploadService';
import {
  changePassword,
  updateProfilePhoto,
  updateUser,
} from '@/service/userService';

function formatPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function formatCPF(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function getApiErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (Array.isArray(data) && typeof data[0] === 'string') return data[0];
    if (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof (data as { message?: unknown }).message === 'string'
    ) {
      return (data as { message: string }).message;
    }
    if (typeof data === 'string') return data;
  }
  return null;
}

function getStoredSlug(): string {
  try {
    const stored = localStorage.getItem('salon');
    if (!stored) return '';
    const parsed = JSON.parse(stored) as { slug?: string };
    return parsed.slug ?? '';
  } catch {
    return '';
  }
}

export function ProfessionalSettingsPage() {
  const { user, updateUser: updateAuthUser } = useAuth();

  // Foto de perfil
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(user?.photoUrl ?? '');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Informações pessoais
  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ? formatPhone(user.phone) : '',
    cpf: user?.cpf ? formatCPF(user.cpf) : '',
    birthDate: user?.birthDate ?? user?.birth_date ?? '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Link de cadastro
  const [salonSlug, setSalonSlug] = useState(getStoredSlug);
  const [copied, setCopied] = useState(false);
  const registrationLink = useMemo(() => {
    if (!salonSlug) return '';
    return `${window.location.origin}/register/${salonSlug}`;
  }, [salonSlug]);

  // Alterar senha
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (salonSlug) return;
    getSalonProfile()
      .then((profile) => { if (profile.slug) setSalonSlug(profile.slug); })
      .catch(() => {});
  }, [salonSlug]);

  async function handlePhotoUpload(file: File) {
    if (!user?.id) return;
    setIsUploadingPhoto(true);
    try {
      const image = await uploadProfilePhoto(file);
      const updated = await updateProfilePhoto(user.id, image.secure_url, image.public_id);
      updateAuthUser({ ...user, ...updated, photoUrl: updated.photoUrl ?? '' });
      setProfilePhotoUrl(updated.photoUrl ?? '');
      toast.success('Foto de perfil atualizada.');
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Erro ao atualizar foto.');
    } finally {
      setIsUploadingPhoto(false);
      if (photoFileInputRef.current) photoFileInputRef.current.value = '';
    }
  }

  function handlePhotoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handlePhotoUpload(file);
  }

  async function handleRemovePhoto() {
    if (!user?.id || isUploadingPhoto) return;
    setIsUploadingPhoto(true);
    try {
      const updated = await updateProfilePhoto(user.id, null, null);
      updateAuthUser({ ...user, ...updated, photoUrl: '' });
      setProfilePhotoUrl('');
      toast.success('Foto removida.');
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Erro ao remover foto.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleSaveProfile() {
    if (!user?.id) return;
    setIsSavingProfile(true);
    try {
      const updated = await updateUser(user.id, {
        name: profileForm.name.trim() || undefined,
        email: profileForm.email.trim() || undefined,
        phone: profileForm.phone.replace(/\D/g, '') || null,
        cpf: profileForm.cpf.replace(/\D/g, '') || null,
        birthDate: profileForm.birthDate || null,
      });
      updateAuthUser({ ...user, ...updated });
      toast.success('Informações salvas com sucesso.');
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Erro ao salvar informações.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleCopyLink() {
    if (!registrationLink) return;
    navigator.clipboard.writeText(registrationLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleChangePassword() {
    const current = passwordForm.currentPassword.trim();
    const next = passwordForm.newPassword.trim();
    const confirm = passwordForm.confirmPassword.trim();

    if (!current || !next || !confirm) {
      toast.error('Preencha todos os campos de senha.');
      return;
    }
    if (next !== confirm) {
      toast.error('A nova senha e a confirmação não coincidem.');
      return;
    }
    if (next.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!user?.id) return;

    setIsChangingPassword(true);
    try {
      await changePassword(user.id, { currentPassword: current, newPassword: next });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Senha alterada com sucesso.');
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Erro ao alterar senha.');
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Foto de Perfil */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-medium text-foreground mb-4">Foto de perfil</h3>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-border bg-secondary shrink-0">
            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt="Foto de perfil"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <CircleUserRound size={36} className="text-primary" />
              </div>
            )}
            {isUploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Spinner />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <input
              ref={photoFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoFileChange}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => photoFileInputRef.current?.click()}
                disabled={isUploadingPhoto}
              >
                {isUploadingPhoto ? <Spinner /> : <Upload size={14} />}
                {profilePhotoUrl ? 'Substituir foto' : 'Enviar foto'}
              </Button>
              {profilePhotoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleRemovePhoto}
                  disabled={isUploadingPhoto}
                >
                  <X size={14} />
                  Remover
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Sua foto aparece no perfil, no cabeçalho e na agenda dos clientes.
            </p>
          </div>
        </div>
      </div>

      {/* Informações Pessoais */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-medium text-foreground mb-4">Informações pessoais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nome completo</label>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Telefone</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))
              }
              placeholder="(00) 00000-0000"
              className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">CPF</label>
            <input
              type="text"
              value={profileForm.cpf}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, cpf: formatCPF(e.target.value) }))
              }
              placeholder="000.000.000-00"
              className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Data de nascimento</label>
            <input
              type="date"
              value={profileForm.birthDate}
              onChange={(e) => setProfileForm((f) => ({ ...f, birthDate: e.target.value }))}
              className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
            className="gap-2"
          >
            {isSavingProfile && <Spinner />}
            <Save size={14} />
            {isSavingProfile ? 'Salvando...' : 'Salvar informações'}
          </Button>
        </div>
      </div>

      {/* Link de Cadastro da Salão */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Link2 size={18} />
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground">Link de cadastro</h3>
            <p className="text-sm text-muted-foreground">
              Compartilhe este link para que novos clientes se cadastrem diretamente nesta salão.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={registrationLink || 'Link indisponível'}
            readOnly
            className="h-10 flex-1 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none"
          />
          <Button
            type="button"
            onClick={handleCopyLink}
            disabled={!registrationLink}
            className="gap-2"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar link'}
          </Button>
        </div>
      </div>

      {/* Alterar Senha */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-medium text-foreground mb-4">Alterar senha</h3>
        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Senha atual</label>
            <PasswordInput
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))
              }
              disabled={isChangingPassword}
              placeholder="Digite sua senha atual"
              className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nova senha</label>
            <PasswordInput
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
              }
              disabled={isChangingPassword}
              placeholder="Digite sua nova senha"
              className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Confirmar nova senha</label>
            <PasswordInput
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))
              }
              disabled={isChangingPassword}
              placeholder="Confirme sua nova senha"
              className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button
            type="button"
            onClick={handleChangePassword}
            disabled={isChangingPassword}
            className="gap-2"
          >
            {isChangingPassword && <Spinner />}
            {isChangingPassword ? 'Alterando...' : 'Alterar senha'}
          </Button>
        </div>
      </div>
    </div>
  );
}
