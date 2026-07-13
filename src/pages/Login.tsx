import { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2, AlertTriangle, X, Phone, CreditCard, Calendar, KeyRound, Scissors, ChevronDown, Eye, EyeOff } from "lucide-react";
import api from "../service/api";

import loginProfessional from "../assets/image/salaone-login-professional.png";
import { useAuth } from "../hooks/useAuth";
import { TrialExpiredError } from "../service/authService";
import type { AuthResponse } from "../service/authService";
import { getDefaultRouteForRole } from "../config/profileConfig";

interface BarbershopOption {
  id: string;
  name: string;
  slug: string;
}

type ApiErrorResponse = {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
  request?: unknown;
};

function getErrorMessage(error: unknown): string {
  const apiError = error as ApiErrorResponse;

  const message =
    apiError?.response?.data?.message ||
    apiError?.response?.data?.error ||
    apiError?.message;

  if (typeof message === "string") {
    return message;
  }

  return "E-mail ou senha inválidos.";
}

export function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, logout, updateUser } = useAuth();

  const whatsappUrl =
    "https://wa.me/5585992175631?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20acessar%20o%20SalaOne";

  // login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [trialExpired, setTrialExpired] = useState<{
    message: string;
    barbershopName: string;
    trialExpiredAt: string;
  } | null>(null);

  // pre-registration modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [pendingGoogleToken] = useState<string | null>(null);
  const [pendingGoogleData] = useState<AuthResponse | null>(null);
  const [googleUserData] = useState<AuthResponse["user"] | null>(null);
  const [modalPhone, setModalPhone] = useState("");
  const [modalCpf, setModalCpf] = useState("");
  const [modalBirthDate, setModalBirthDate] = useState("");
  const [modalPassword, setModalPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalBarbershopSlug, setModalBarbershopSlug] = useState("");
  const [barbershopSearch, setBarbershopSearch] = useState("");
  const [allBarbershops, setAllBarbershops] = useState<BarbershopOption[]>([]);
  const [showBarbershopDropdown, setShowBarbershopDropdown] = useState(false);
  const barbershopDropdownRef = useRef<HTMLDivElement>(null);

  const hasBarbershopAlready = !!(pendingGoogleData?.barbershop || pendingGoogleData?.currentBarbershop);

  const filteredBarbershops = barbershopSearch.trim().length >= 1
    ? allBarbershops.filter(s =>
        s.name.toLowerCase().includes(barbershopSearch.toLowerCase()) ||
        s.slug.toLowerCase().includes(barbershopSearch.toLowerCase())
      )
    : allBarbershops;

  useEffect(() => {
    if (!showCompleteModal || hasBarbershopAlready) return;
    api.get<BarbershopOption[]>("/barbershops/public").then(r => setAllBarbershops(r.data)).catch(() => {});
  }, [showCompleteModal, hasBarbershopAlready]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (barbershopDropdownRef.current && !barbershopDropdownRef.current.contains(e.target as Node)) {
        setShowBarbershopDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleCompleteProfile(event: FormEvent) {
    event.preventDefault();
    if (!pendingGoogleToken || !googleUserData) return;

    setModalLoading(true);
    setModalError("");

    if (!hasBarbershopAlready && !modalBarbershopSlug) {
      setModalError("Selecione a barbearia para continuar.");
      setModalLoading(false);
      return;
    }

    try {
      const data = await loginWithGoogle(
        pendingGoogleToken,
        {
          phone: modalPhone.replace(/\D/g, "") || undefined,
          cpf: modalCpf.replace(/\D/g, "") || undefined,
          birthDate: modalBirthDate || undefined,
          password: modalPassword || undefined,
        },
        modalBarbershopSlug || undefined
      );

      setShowCompleteModal(false);

      const hasBarbershop = !!(data.barbershop || data.currentBarbershop);
      if (!hasBarbershop) {
        logout();
        setErrorMessage("Seu perfil foi salvo, mas sua conta não está vinculada a nenhuma barbearia. Entre em contato com o administrador.");
        return;
      }

      updateUser(data.user);
      navigate(getDefaultRouteForRole(data.user.role), { replace: true });
    } catch (err: unknown) {
      setModalError(getErrorMessage(err));
    } finally {
      setModalLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Informe o e-mail e a senha.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      if (err instanceof TrialExpiredError) {
        setTrialExpired({
          message: err.message,
          barbershopName: err.barbershopName,
          trialExpiredAt: err.trialExpiredAt,
        });
        return;
      }
      setErrorMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F1F7] lg:grid lg:grid-cols-2">

      {/* ── Trial Expired Modal ── */}
      {trialExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
            <button
              onClick={() => setTrialExpired(null)}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
            >
              <X size={18} />
            </button>

            <div className="mb-5 flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle size={28} className="text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Acesso suspenso</h2>
              <p className="text-sm text-muted-foreground">
                O período de teste da barbearia{" "}
                <span className="font-semibold text-foreground">{trialExpired.barbershopName}</span>{" "}
                expirou. Para continuar usando a plataforma, assine um plano.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => navigate("/", { state: { scrollTo: "planos" } })}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
              >
                Ver planos e assinar
              </button>
              <button
                onClick={() => setTrialExpired(null)}
                className="h-11 w-full rounded-lg border border-border text-sm text-muted-foreground transition hover:bg-muted"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Google Pre-registration Modal ── */}
      {showCompleteModal && googleUserData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowCompleteModal(false)}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
            >
              <X size={18} />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <svg viewBox="0 0 24 24" className="h-6 w-6">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                  <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.57 10.57 0 0 0 12 1 11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-foreground">Complete seu cadastro</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Olá, <span className="font-medium text-foreground">{googleUserData.name}</span>! Preencha os dados abaixo para continuar.
              </p>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCompleteProfile} className="space-y-4">

              {/* Barbearia — só aparece para usuários sem barbearia vinculada */}
              {!hasBarbershopAlready && (
                <div ref={barbershopDropdownRef}>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Barbearia <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Scissors className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                    <input
                      type="text"
                      value={barbershopSearch}
                      onChange={(e) => {
                        setBarbershopSearch(e.target.value);
                        setModalBarbershopSlug("");
                        setShowBarbershopDropdown(true);
                      }}
                      onFocus={() => setShowBarbershopDropdown(true)}
                      placeholder="Digite o nome da barbearia..."
                      autoComplete="off"
                      className="h-12 w-full rounded-lg border border-border bg-background pl-11 pr-10 text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                    <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    {modalBarbershopSlug && (
                      <span className="absolute right-9 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                    )}
                    {showBarbershopDropdown && filteredBarbershops.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-xl max-h-48 overflow-y-auto">
                        {filteredBarbershops.map(shop => (
                          <button
                            key={shop.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setModalBarbershopSlug(shop.slug);
                              setBarbershopSearch(shop.name);
                              setShowBarbershopDropdown(false);
                            }}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-muted ${
                              modalBarbershopSlug === shop.slug ? "bg-primary/10 font-semibold text-primary" : "text-foreground"
                            }`}
                          >
                            <Scissors className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span>{shop.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showBarbershopDropdown && barbershopSearch.trim().length > 0 && filteredBarbershops.length === 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-xl px-4 py-3 text-sm text-muted-foreground">
                        Nenhuma barbearia encontrada
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Telefone <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    value={modalPhone}
                    onChange={(e) => setModalPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    required
                    className="h-12 w-full rounded-lg border border-border bg-background pl-11 pr-4 text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  CPF <span className="text-muted-foreground text-xs">(opcional)</span>
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={modalCpf}
                    onChange={(e) => setModalCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="h-12 w-full rounded-lg border border-border bg-background pl-11 pr-4 text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Data de nascimento <span className="text-muted-foreground text-xs">(opcional)</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="date"
                    value={modalBirthDate}
                    onChange={(e) => setModalBirthDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="h-12 w-full rounded-lg border border-border bg-background pl-11 pr-4 text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Criar senha <span className="text-muted-foreground text-xs">(opcional, para login por e-mail)</span>
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showModalPassword ? "text" : "password"}
                    value={modalPassword}
                    onChange={(e) => setModalPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    minLength={4}
                    className="h-12 w-full rounded-lg border border-border bg-background pl-11 pr-10 text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(!showModalPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                    tabIndex={-1}
                  >
                    {showModalPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {modalLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                {modalLoading ? "Salvando..." : "Concluir cadastro"}
              </button>

            </form>
          </div>
        </div>
      )}

      <aside className="relative hidden min-h-screen overflow-hidden bg-[#1A1A1A] lg:block" aria-label="Profissional SalaOne">
        <img
          src={loginProfessional}
          alt="Profissional de beleza em um salão moderno"
          className="absolute inset-0 h-full w-full scale-[1.035] object-cover object-[center_35%] drop-shadow-2xl transition-transform duration-1000 ease-out"
        />

        {/* Profundidade e iluminação da composição */}
        <div className="absolute -left-24 top-[12%] h-80 w-80 rounded-full bg-[#7B2CBF]/25 blur-[95px]" />
        <div className="absolute -right-20 top-[45%] h-72 w-72 rounded-full bg-[#E91E63]/20 blur-[100px]" />
        <div className="absolute bottom-[8%] left-[18%] h-64 w-64 rounded-full bg-[#7B2CBF]/15 blur-[90px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.20)_0%,rgba(255,255,255,0.05)_27%,transparent_53%)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#7B2CBF]/20 via-transparent to-[#E91E63]/18 mix-blend-soft-light" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(26,26,26,0.32)_100%)]" />

        {/* Bokeh e brilhos discretos */}
        <div className="absolute left-[12%] top-[20%] h-3 w-3 rounded-full bg-white/45 blur-[1px] shadow-[0_0_18px_rgba(255,255,255,0.65)]" />
        <div className="absolute right-[16%] top-[28%] h-5 w-5 rounded-full bg-[#F8F1F7]/30 blur-[2px] shadow-[0_0_24px_rgba(233,30,99,0.35)]" />
        <div className="absolute left-[18%] top-[56%] h-2 w-2 rounded-full bg-white/40 shadow-[0_0_14px_rgba(255,255,255,0.55)]" />
        <div className="absolute right-[11%] top-[64%] h-3 w-3 rounded-full bg-[#E91E63]/35 blur-[1px] shadow-[0_0_20px_rgba(233,30,99,0.45)]" />
        <div className="absolute right-[28%] top-[15%] h-px w-12 rotate-45 bg-gradient-to-r from-transparent via-white/55 to-transparent shadow-[0_0_9px_rgba(255,255,255,0.5)]" />

        {/* Vidros decorativos sem conteúdo */}
        <div className="absolute -left-10 bottom-[19%] h-32 w-32 rotate-12 rounded-[32px] border border-white/15 bg-white/[0.035] shadow-[0_16px_40px_rgba(26,26,26,0.12)] backdrop-blur-[2px]" />
        <div className="absolute -right-8 top-[13%] h-24 w-24 -rotate-12 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-[3px]" />

        {/* Faixa curva de transição inferior */}
        <div className="absolute -bottom-20 -left-[10%] h-40 w-[120%] -rotate-2 rounded-[50%_50%_0_0/100%_100%_0_0] bg-gradient-to-r from-[#7B2CBF]/75 via-[#9D2DB4]/65 to-[#E91E63]/75 blur-[0.2px]" />
        <div className="absolute bottom-0 left-0 h-16 w-full bg-gradient-to-t from-[#1A1A1A]/22 to-transparent" />
      </aside>

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#E91E63]/10 blur-3xl" />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-[500px] rounded-[20px] border border-white/80 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(70,25,92,0.14)] sm:px-10 sm:py-10"
      >
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A] sm:text-[28px]">Bem-vindo de volta!</h1>
          <p className="mt-2 text-sm text-[#6E6E6E]">Entre para continuar gerenciando seu salão</p>
        </div>

        {Boolean(errorMessage) && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {String(errorMessage)}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#1A1A1A]">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#6E6E6E]" />
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" autoComplete="email" className="h-12 w-full rounded-lg border border-[#E5DDE5] bg-white pl-11 pr-4 text-[#1A1A1A] placeholder:text-[#6E6E6E]/70 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" required />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Senha</label>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                className="h-12 w-full rounded-lg border border-[#E5DDE5] bg-white pl-12 pr-10 text-[#1A1A1A] placeholder:text-[#6E6E6E]/70 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-[#6E6E6E]">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 rounded border-[#D8CDD8] accent-[#7B2CBF]" />
            Lembrar de mim
          </label>
          <Link to="/forgot-password" className="font-medium text-primary transition hover:text-[#E91E63]">Esqueci minha senha</Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#7B2CBF] to-[#E91E63] font-semibold text-white shadow-[0_10px_24px_rgba(123,44,191,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(233,30,99,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          aria-disabled="true"
          className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#E5DDE5] bg-white text-sm font-medium text-[#1A1A1A] shadow-sm transition hover:border-primary/35 hover:bg-[#F8F1F7] focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-border">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.57 10.57 0 0 0 12 1 11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z" />
              </svg>
          </span>
          Continuar com Google
        </button>

        <p className="mt-7 text-center text-sm text-muted-foreground">
          Ainda não possui uma conta?{" "}
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary transition hover:text-[#E91E63]">
            Fale com nossa equipe
          </a>
        </p>
      </form>
      </main>

      <a
        href={whatsappUrl}
        aria-label="Falar no WhatsApp"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-black/20 transition hover:bg-brand-purple-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-current">
          <path d="M16.04 3C9.43 3 4.05 8.35 4.05 14.93c0 2.1.56 4.16 1.62 5.97L4 27l6.27-1.64a12.06 12.06 0 0 0 5.77 1.47C22.65 26.83 28 21.48 28 14.9 28 8.35 22.65 3 16.04 3Zm0 21.8c-1.86 0-3.68-.5-5.27-1.47l-.38-.23-3.72.97.99-3.61-.25-.38a9.81 9.81 0 0 1-1.34-4.95c0-5.47 4.48-9.91 9.98-9.91 5.49 0 9.95 4.44 9.95 9.9 0 5.45-4.46 9.88-9.96 9.88Zm5.46-7.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.78-1.68-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
        </svg>
      </a>
    </div>
  );
}
