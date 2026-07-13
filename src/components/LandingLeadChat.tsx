import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { createLandingLead } from "@/service/landingLeadService";
import { isValidCnpj, isValidEmail, isValidPhone, maskCnpj, maskPhone, onlyDigits } from "@/utils/leadForm";

type Form = { name: string; email: string; phone: string; cnpj: string };
type Errors = Partial<Record<keyof Form | "submit", string>>;
const initialForm: Form = { name: "", email: "", phone: "", cnpj: "" };

export function LandingLeadChat({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    nameRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !submitting) onOpenChange(false); };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!panelRef.current?.contains(target) && !target.closest("[data-lead-chat-trigger]") && !submitting) onOpenChange(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => { document.removeEventListener("keydown", closeOnEscape); document.removeEventListener("pointerdown", closeOutside); };
  }, [open, onOpenChange, submitting]);

  if (!open) return null;
  const validate = () => { const next: Errors = {}; if (form.name.trim().length < 2) next.name = "Informe seu nome."; if (!isValidEmail(form.email)) next.email = "Informe um e-mail válido."; if (!isValidPhone(form.phone)) next.phone = "Informe um telefone com DDD."; if (form.cnpj && !isValidCnpj(form.cnpj)) next.cnpj = "Informe um CNPJ válido."; return next; };
  const change = (field: keyof Form, value: string) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined, submit: undefined })); };

  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting) return;
    const next = validate(); if (Object.keys(next).length) { setErrors(next); return; }
    const commercialPhone = onlyDigits(import.meta.env.VITE_LANDING_WHATSAPP_NUMBER || "");
    if (!commercialPhone) { setErrors({ submit: "O WhatsApp comercial não está configurado. Tente novamente mais tarde." }); return; }
    setSubmitting(true);
    try {
      await createLandingLead({ name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: onlyDigits(form.phone), cnpj: form.cnpj ? onlyDigits(form.cnpj) : null });
      const message = [
        "Olá! Tenho interesse em conhecer melhor o SalaOne.",
        "",
        `Nome: ${form.name.trim()}`,
        `E-mail: ${form.email.trim()}`,
        `Telefone: ${form.phone}`,
        `CNPJ: ${form.cnpj || "Não informado"}`,
      ].join("\n");
      window.open(`https://wa.me/${commercialPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      setForm(initialForm); setErrors({}); onOpenChange(false);
    } catch (error: unknown) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ submit: apiMessage || "Não foi possível salvar seu contato. Tente novamente." });
    } finally { setSubmitting(false); }
  }

  const fields = [["name", "Nome", "Como gostaria de ser chamado?", "text"], ["email", "E-mail", "nome@minhaempresa.com.br", "email"], ["phone", "Celular ou telefone", "Número com DDD", "tel"], ["cnpj", "CNPJ (opcional)", "00.000.000/0000-00", "text"]] as const;
  return <aside ref={panelRef} role="dialog" aria-modal="false" aria-labelledby="lead-chat-title" className="fixed bottom-20 left-3 right-3 z-50 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-950 text-white shadow-2xl shadow-black/60 sm:left-auto sm:right-5 sm:w-[400px]">
    <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-neutral-800 bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 pr-12">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm"><WhatsAppIcon size={23} /></div>
      <div><h2 id="lead-chat-title" className="font-semibold leading-snug">Olá! Fale com nosso time de vendas e conheça nossas soluções</h2><p className="mt-1 text-xs text-emerald-50/80">Preencha seus dados para iniciar</p></div>
      <button type="button" onClick={() => onOpenChange(false)} disabled={submitting} aria-label="Fechar atendimento" className="absolute right-3 top-3 rounded-full p-2 hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-white/70"><X size={18} /></button>
    </header>
    <div className="bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.08),transparent_40%)] p-4">
      <div className="mb-4 max-w-[90%] rounded-2xl rounded-tl-sm border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-300">Para começar, conte rapidamente como podemos chamar você e seus dados de contato.</div>
      <form onSubmit={submit} className="space-y-3" noValidate>
        {fields.map(([field, label, placeholder, type]) => <div key={field} className="rounded-xl border border-neutral-800 bg-black/40 p-3"><label htmlFor={`lead-${field}`} className="mb-1.5 block text-xs font-medium text-neutral-300">{label}{field !== "cnpj" && <span className="text-brand-pink"> *</span>}</label><input ref={field === "name" ? nameRef : undefined} id={`lead-${field}`} type={type} value={form[field]} placeholder={placeholder} disabled={submitting} autoComplete={field === "name" ? "name" : field === "phone" ? "tel" : field === "email" ? "email" : "off"} inputMode={field === "phone" || field === "cnpj" ? "numeric" : undefined} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `lead-${field}-error` : undefined} onChange={(event) => change(field, field === "phone" ? maskPhone(event.target.value) : field === "cnpj" ? maskCnpj(event.target.value) : event.target.value)} className="w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-neutral-600 disabled:opacity-60" />{errors[field] && <p id={`lead-${field}-error`} role="alert" className="mt-1.5 text-xs text-red-400">{errors[field]}</p>}</div>)}
        {errors.submit && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{errors.submit}</p>}
        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple-dark to-primary px-4 py-3 font-semibold text-black transition hover:from-primary hover:to-brand-pink disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Salvando contato...</> : <>Iniciar conversa <ArrowRight size={18} /></>}</button>
        <p className="text-center text-[11px] leading-relaxed text-neutral-500">Ao iniciar, você concorda com nossa <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">Política de Privacidade</a>.</p>
      </form>
    </div>
  </aside>;
}
