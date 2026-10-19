import { useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";

import { PlatformSubscriptionTab } from "@/components/PlatformSubscriptionTab";
import { isAuthenticated } from "@/service/authService";
import salaOneLogo from "@/assets/image/logo-icone-salaone.jpeg";

export function TrialExpiredPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const redirectBackToLanding = () => navigate("/", { replace: true });
    window.addEventListener("popstate", redirectBackToLanding);
    return () => window.removeEventListener("popstate", redirectBackToLanding);
  }, [navigate]);

  if (!isAuthenticated()) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-5xl">
        <Link to="/" className="mb-8 inline-flex items-center gap-3 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary">
          <img src={salaOneLogo} alt="SalaOne" className="h-11 w-11 rounded-full object-cover" />
          <span className="text-xl font-semibold tracking-tight text-foreground">SalaOne</span>
        </Link>
        <header className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <CreditCard className="mb-3" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Seu periodo de teste terminou</h1>
          <p className="mt-2 text-sm">Para continuar usando a SalaOne, escolha um plano e conclua a assinatura.</p>
        </header>
        <div className="rounded-2xl border bg-card p-4 sm:p-6"><PlatformSubscriptionTab /></div>
      </section>
    </main>
  );
}
