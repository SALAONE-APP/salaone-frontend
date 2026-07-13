import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import salaOneLogo from "../assets/image/salaone-logo.svg";
import { PasswordInput } from "../components/PasswordInput";
import { resetPassword } from "../service/authService";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      toast.error("Token de recuperação ausente ou inválido.");
      return;
    }

    if (!password.trim()) {
      toast.error("Informe a nova senha.");
      return;
    }

    if (password.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword(password, token);
      toast.success(response.message || "Senha redefinida com sucesso!");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.[0] || err?.message || "Erro ao redefinir senha.";
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

      <div className="relative z-10 w-full max-w-[480px] rounded-2xl border border-border bg-card px-8 py-10 shadow-2xl sm:px-12">
        <div className="flex justify-center mb-6">
          <img
            src={salaOneLogo}
            alt="SalaOne"
            className="block h-auto w-full max-w-[180px] object-contain"
            draggable={false}
          />
        </div>

        {!token ? (
          <div className="text-center">
            <div className="flex justify-center mb-4 text-destructive">
              <AlertCircle size={48} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Link inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O link de redefinição de senha está incompleto ou inválido. Por favor, solicite a recuperação novamente.
            </p>
            <div className="mt-6">
              <Link
                to="/forgot-password"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft size={16} />
                Solicitar nova recuperação
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Redefinir senha</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Insira sua nova senha nos campos abaixo para atualizar o acesso à sua conta.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Nova Senha</label>
                <PasswordInput
                  icon={<Lock className="h-5 w-5" />}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="h-12 w-full rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Confirmar Nova Senha</label>
                <PasswordInput
                  icon={<Lock className="h-5 w-5" />}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirme a nova senha"
                  className="h-12 w-full rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  "Confirmar nova senha"
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
        )}
      </div>
    </div>
  );
}
