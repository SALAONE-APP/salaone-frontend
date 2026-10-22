import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";

import loginProfessional from "../assets/image/salaone-login-professional.png";
import salaOneLogo from "../assets/image/logo-icone-salaone.jpeg";
import { useAuth } from "../hooks/useAuth";
import { getDefaultRouteForRole } from "../config/profileConfig";
import { Button } from "../components/ui/button";
import { listPublicSalons, type PublicSalon } from "../service/registerService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

type ApiErrorResponse = {
  message?: string;
  response?: {
    data?: {
      message?: string;
      error?: string;
      code?: string;
    };
  };
};

function getErrorMessage(error: unknown) {
  const apiError = error as ApiErrorResponse;
  return (
    apiError.response?.data?.message ||
    apiError.response?.data?.error ||
    apiError.message ||
    "E-mail ou senha inválidos."
  );
}

function GoogleLoginButton({ disabled, onAccessToken, onError }: {
  disabled: boolean;
  onAccessToken: (accessToken: string) => void;
  onError: () => void;
}) {
  const startGoogleLogin = useGoogleLogin({
    flow: "implicit",
    onSuccess: ({ access_token }) => onAccessToken(access_token),
    onError,
  });

  return (
    <button
      type="button"
      onClick={() => startGoogleLogin()}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#E5DDE5] bg-white font-semibold text-[#1A1A1A] transition hover:bg-[#F8F1F7] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.57 10.57 0 0 0 12 1 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z" />
      </svg>
      Entrar com Google
    </button>
  );
}

export function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [accessBlocked, setAccessBlocked] = useState<"SALON_BLOCKED" | "TRIAL_EXPIRED" | null>(null);
  const [googleToken, setGoogleToken] = useState("");
  const [showGoogleRegistration, setShowGoogleRegistration] = useState(false);
  const [salons, setSalons] = useState<PublicSalon[]>([]);
  const [selectedSalon, setSelectedSalon] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");

  useEffect(() => {
    if (showGoogleRegistration) void listPublicSalons().then(setSalons).catch(() => setErrorMessage("Nao foi possivel carregar os saloes."));
  }, [showGoogleRegistration]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Informe o e-mail e a senha.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setAccessBlocked(null);
      const loggedUser = await login(email.trim(), password);
      if (loggedUser.accessStatus === "TRIAL_EXPIRED") {
        navigate("/trial-expired", { replace: true });
        return;
      }
      navigate(getDefaultRouteForRole(loggedUser.role), { replace: true });
    } catch (error) {
      const apiError = error as ApiErrorResponse;
      const code = apiError.response?.data?.code;
      if (code === "SALON_BLOCKED" || code === "TRIAL_EXPIRED") setAccessBlocked(code);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin(accessToken: string) {
    try {
      setGoogleLoading(true);
      setErrorMessage("");
      setAccessBlocked(null);
      const response = await loginWithGoogle(accessToken);
      if (response.requiresProfileCompletion) {
        setGoogleToken(accessToken);
        setShowGoogleRegistration(true);
        return;
      }
      if (response.accessStatus === "TRIAL_EXPIRED") {
        navigate("/trial-expired", { replace: true });
        return;
      }
      navigate(getDefaultRouteForRole(response.user.role), { replace: true });
    } catch (error) {
      const apiError = error as ApiErrorResponse;
      const code = apiError.response?.data?.code;
      if (code === "SALON_BLOCKED" || code === "TRIAL_EXPIRED") setAccessBlocked(code);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function completeGoogleRegistration() {
    if (!selectedSalon || !phone.trim() || !birthDate) { setErrorMessage("Selecione o salao e informe telefone e data de nascimento."); return; }
    try {
      setGoogleLoading(true);
      const response = await loginWithGoogle(googleToken, { slug: selectedSalon, profileData: { phone, birthDate } });
      if (response.requiresProfileCompletion) throw new Error("Nao foi possivel concluir o cadastro.");
      setShowGoogleRegistration(false);
      navigate(getDefaultRouteForRole(response.user.role), { replace: true });
    } catch (error) { setErrorMessage(getErrorMessage(error)); } finally { setGoogleLoading(false); }
  }

  const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  return (
    <div className="grid min-h-screen bg-[#F8F1F7] lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#1A1A1A] lg:block" aria-label="Profissional SalaOne">
        <img
          src={loginProfessional}
          alt="Profissional de beleza em um salão moderno"
          className="absolute inset-0 h-full w-full scale-[1.035] object-cover object-[center_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#7B2CBF]/20 via-transparent to-[#E91E63]/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(26,26,26,0.35)_100%)]" />
      </aside>

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#E91E63]/10 blur-3xl" />

        <form
          onSubmit={handleSubmit}
          className="relative z-10 w-full max-w-[500px] rounded-[20px] border border-white/80 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(70,25,92,0.14)] sm:px-10 sm:py-10"
        >
          <div className="mb-7 text-center">
            <img
              src={salaOneLogo}
              alt="SalaOne"
              className="mx-auto mb-4 h-24 w-24 rounded-full object-cover"
              draggable={false}
            />
            <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A] sm:text-[28px]">Bem-vindo de volta!</h1>
            <p className="mt-2 text-sm text-[#6E6E6E]">Entre para continuar gerenciando seu salão</p>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1A1A1A]">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#6E6E6E]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="h-12 w-full rounded-lg border border-[#E5DDE5] bg-white pl-11 pr-4 text-[#1A1A1A] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  required
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-[#1A1A1A]">Senha</label>
                <Link to="/forgot-password" className="text-sm font-medium text-primary hover:text-[#E91E63]">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#6E6E6E]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-lg border border-[#E5DDE5] bg-white pl-11 pr-11 text-[#1A1A1A] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6E6E] hover:text-[#1A1A1A]"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {googleEnabled && (
            <>
              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-[#E5DDE5]" />
                <span className="text-sm text-[#6E6E6E]">ou</span>
                <div className="h-px flex-1 bg-[#E5DDE5]" />
              </div>
              <GoogleLoginButton
                disabled={loading || googleLoading}
                onAccessToken={handleGoogleLogin}
                onError={() => setErrorMessage("NÃ£o foi possÃ­vel autenticar com o Google. Tente novamente.")}
              />
            </>
          )}

          <p className="mt-7 text-center text-sm text-muted-foreground">
            Ainda não possui uma conta?{" "}
            <Link to="/register" className="font-semibold text-primary transition hover:text-[#E91E63]">
              Cadastre-se
            </Link>
          </p>
        </form>
      </main>
      <Dialog open={accessBlocked !== null} onOpenChange={(open) => !open && setAccessBlocked(null)}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{accessBlocked === "SALON_BLOCKED" ? "Acesso suspenso" : "Periodo de teste encerrado"}</DialogTitle>
            <DialogDescription className="hidden">
              O pagamento deste salão está em atraso há mais de 5 dias. O acesso foi bloqueado até que a assinatura seja regularizada.
            </DialogDescription>
            <DialogDescription>
              {accessBlocked === "SALON_BLOCKED"
                ? "Seu acesso esta suspenso. Entre em contato com a administracao da SalaOne para regularizar."
                : "Seu periodo de teste terminou. Para continuar usando a SalaOne, escolha um plano."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={() => setAccessBlocked(null)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showGoogleRegistration} onOpenChange={(open) => !googleLoading && setShowGoogleRegistration(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Complete seu cadastro</DialogTitle><DialogDescription>Selecione o salao onde deseja ser atendido para concluir seu acesso com Google.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <select value={selectedSalon} onChange={(event) => setSelectedSalon(event.target.value)} className="h-11 w-full rounded-lg border border-border bg-background px-3"><option value="">Selecione o salao</option>{salons.map((salon) => <option key={salon.id} value={salon.slug}>{salon.name}</option>)}</select>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telefone" className="h-11 w-full rounded-lg border border-border bg-background px-3" />
            <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="h-11 w-full rounded-lg border border-border bg-background px-3" />
          </div>
          <DialogFooter><Button onClick={completeGoogleRegistration} disabled={googleLoading}>{googleLoading ? "Salvando..." : "Continuar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
