import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import salaOneLogo from "../assets/image/logo-icone-salaone.jpeg";
import { forgotPassword } from "../service/authService";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail.");
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPassword(email.trim());
      toast.success(response.message || "E-mail de recuperação enviado!");
      setEmail("");
    } catch (err: any) {
      const msg = err?.response?.data?.[0] || err?.message || "Erro ao solicitar recuperação.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 overflow-hidden">
      {/* Background Blurs */}
      <div className="absolute right-[-120px] top-[-140px] h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-[-160px] left-[-120px] h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-[480px] rounded-2xl border border-border bg-card px-8 py-10 shadow-2xl sm:px-12"
      >
        <div className="flex justify-center mb-6">
          <img
            src={salaOneLogo}
            alt="SalaOne"
            className="block h-24 w-24 rounded-full object-cover"
            draggable={false}
          />
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Digite seu e-mail para receber as instruções de recuperação de senha.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                className="h-12 w-full rounded-lg border border-border bg-background pl-12 pr-4 text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar e-mail de recuperação"
            )}
          </button>

          <div className="mt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft size={16} />
              Voltar para o login
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
