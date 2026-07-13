import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import loginProfessional from "../assets/image/salaone-login-professional.png";
import salaOneLogo from "../assets/image/logo-icone-salaone.jpeg";
import { useAuth } from "../hooks/useAuth";

type ApiErrorResponse = {
  message?: string;
  response?: {
    data?: {
      message?: string;
      error?: string;
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

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

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
            disabled={loading}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <p className="mt-7 text-center text-sm text-muted-foreground">
            Ainda não possui uma conta?{" "}
            <Link to="/register" className="font-semibold text-primary transition hover:text-[#E91E63]">
              Cadastre-se
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
