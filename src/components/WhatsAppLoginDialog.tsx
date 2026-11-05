import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Loader2, MessageCircle, Phone, X } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { requestWhatsAppLoginCode } from "@/service/authService";
import type { AuthResponse } from "@/service/authService";
import type { User } from "@/context/AuthContext";
import { useAuth } from "@/hooks/useAuth";

const RESEND_SECONDS = 60;

// O backend responde erros como ["mensagem"] ou { message }.
function apiMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(data) && typeof data[0] === "string") return data[0];
  if (data && typeof data === "object") {
    const d = data as { message?: unknown; error?: unknown };
    if (typeof d.message === "string") return d.message;
    if (typeof d.error === "string") return d.error;
  }
  return fallback;
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface Props {
  onClose: () => void;
  onSuccess: (user: User & Pick<AuthResponse, "accessStatus">) => void;
}

// Login sem senha: o cliente informa o telefone e recebe um código no WhatsApp.
export function WhatsAppLoginDialog({ onClose, onSuccess }: Props) {
  const { loginWithWhatsAppCode } = useAuth();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [requestId, setRequestId] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Informe o telefone com DDD.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await requestWhatsAppLoginCode(digits);
      setRequestId(r.requestId);
      setMaskedPhone(r.phone);
      setCode("");
      setStep("code");
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(apiMessage(err, "Não foi possível enviar o código. Tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  async function verify(value: string) {
    if (value.length !== 6 || loading) return;
    setLoading(true);
    setError("");
    try {
      onSuccess(await loginWithWhatsAppCode(requestId, value));
    } catch (err) {
      setCode("");
      setError(apiMessage(err, "Código inválido ou expirado."));
    } finally {
      setLoading(false);
    }
  }

  function handlePhoneSubmit(event: FormEvent) {
    event.preventDefault();
    void sendCode();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
        >
          <X size={18} />
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <MessageCircle className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Entrar com o telefone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "phone"
              ? "Enviaremos um código de acesso para o seu WhatsApp."
              : `Digite o código de 6 dígitos enviado para ${maskedPhone}.`}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === "phone" ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Telefone (WhatsApp)</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="h-12 w-full rounded-lg border border-border bg-background pl-11 pr-4 text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                onComplete={(v: string) => void verify(v)}
                disabled={loading}
                autoFocus
                inputMode="numeric"
                pattern="^[0-9]*$"
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <button
              type="button"
              onClick={() => void verify(code)}
              disabled={loading || code.length !== 6}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setError("");
                }}
                className="flex items-center gap-1 text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft size={14} /> Trocar telefone
              </button>
              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={loading || resendIn > 0}
                className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
              >
                {resendIn > 0 ? `Reenviar em ${resendIn}s` : "Reenviar código"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
