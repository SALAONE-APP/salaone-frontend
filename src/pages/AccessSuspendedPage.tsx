import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AccessSuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldOff size={28} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-foreground">Acesso suspenso</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Seu acesso esta suspenso. Entre em contato com a administracao da SalaOne para regularizar.
        </p>
        <Button asChild className="mt-6"><Link to="/login">Voltar ao login</Link></Button>
      </section>
    </main>
  );
}
