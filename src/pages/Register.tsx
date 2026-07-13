import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";

import salaOneLogo from "../assets/image/logo-icone-salaone.jpeg";
import { AppCalendar } from "../components/AppCalendar";
import { useAuth } from "../hooks/useAuth";
import {
  listPublicSalons,
  registerClient,
} from "../service/registerService";

type PublicSalon = {
  id: string;
  name: string;
  slug: string;
};

type ApiErrorResponse = {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
};

function getErrorMessage(error: unknown) {
  const apiError = error as ApiErrorResponse;

  return (
    apiError?.response?.data?.message ||
    apiError?.response?.data?.error ||
    "Não foi possível criar sua conta."
  );
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function Register() {
  const navigate = useNavigate();
  const { slug: slugFromUrl } = useParams<{ slug?: string }>();
  const { updateUser } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState<Date>();
  const [selectedSlug, setSelectedSlug] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [salons, setSalons] = useState<PublicSalon[]>([]);
  const [loadingSalons, setLoadingSalons] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const shouldShowSalonSelect = !slugFromUrl;

  useEffect(() => {
    if (!shouldShowSalonSelect) {
      setSalons([]);
      setSelectedSlug("");
      return;
    }

    let ignore = false;

    async function loadSalons() {
      try {
        setLoadingSalons(true);
        const data = await listPublicSalons();

        if (!ignore) {
          setSalons(data);
        }
      } catch {
        if (!ignore) {
          setError("Não foi possível carregar os salões.");
        }
      } finally {
        if (!ignore) {
          setLoadingSalons(false);
        }
      }
    }

    loadSalons();

    return () => {
      ignore = true;
    };
  }, [shouldShowSalonSelect]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!isValidEmail(normalizedEmail)) {
      setError("Informe um e-mail valido.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    if (password.length < 4) {
      setError("A senha precisa ter no mínimo 4 caracteres.");
      return;
    }

    if (!birthDate) {
      setError("Informe sua data de nascimento.");
      return;
    }

    const finalSlug = slugFromUrl ?? selectedSlug;

    if (!finalSlug) {
      setError("Selecione um salão.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await registerClient({
        slug: finalSlug,
        name: name.trim(),
        email: normalizedEmail,
        cpf: cpf.trim(),
        phone: phone.trim(),
        birthDate: formatDateForApi(birthDate),
        password,
      });

      updateUser(res.user);

      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div className="absolute right-[-120px] top-[-140px] h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-[-160px] left-[-120px] h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <img
        src={salaOneLogo}
        alt="SalaOne"
        className="absolute left-6 top-6 z-20 h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24"
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-[560px] rounded-2xl border border-border bg-card px-8 py-9 shadow-2xl"
      >
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">Criar Conta</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre-se para agendar seu próximo corte.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Nome Completo
            </label>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Digite seu nome completo"
              className="h-11 w-full rounded-lg border border-border bg-background px-4 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              E-mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@exemplo.com"
              className="h-11 w-full rounded-lg border border-border bg-background px-4 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                CPF
              </label>

              <input
                value={cpf}
                onChange={(event) => setCpf(formatCpf(event.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
                className="h-11 w-full rounded-lg border border-border bg-background px-4 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Telefone/WhatsApp
              </label>

              <input
                value={phone}
                onChange={(event) => setPhone(formatPhone(event.target.value))}
                placeholder="(85) 99999-9999"
                inputMode="tel"
                maxLength={15}
                className="h-11 w-full rounded-lg border border-border bg-background px-4 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Data de Nascimento
              </label>

              <AppCalendar
                value={birthDate}
                onChange={setBirthDate}
                placeholder="Selecione sua data"
                fromYear={1900}
                toYear={new Date().getFullYear()}
                disableFuture
              />
            </div>

            {shouldShowSalonSelect && (
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Salão
                </label>

                <select
                  value={selectedSlug}
                  onChange={(event) => setSelectedSlug(event.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-background px-4 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  disabled={loadingSalons}
                  required
                >
                  <option value="">
                    {loadingSalons
                      ? "Carregando salões..."
                      : "Selecione um salão"}
                  </option>

                  {salons.map((salon) => (
                    <option key={salon.id} value={salon.slug}>
                      {salon.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Senha
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="h-11 w-full rounded-lg border border-border bg-background pl-4 pr-10 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Confirmar senha
              </label>

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Digite a senha novamente"
                  className="h-11 w-full rounded-lg border border-border bg-background pl-4 pr-10 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {loading ? "Cadastrando..." : "Cadastrar"}
        </button>

        <p className="mt-7 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
