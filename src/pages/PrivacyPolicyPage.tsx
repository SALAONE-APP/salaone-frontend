import { Link } from "react-router-dom";
import salaOneLogo from "@/assets/image/salaone-logo.svg";

export function PrivacyPolicyPage() {
  return <main className="min-h-screen bg-black px-4 py-10 text-neutral-300">
    <article className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950 p-6 sm:p-10">
      <Link to="/" aria-label="Voltar para a página inicial"><img src={salaOneLogo} alt="SalaOne" className="mb-8 h-20 w-auto" /></Link>
      <h1 className="text-3xl font-bold text-white">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-neutral-500">Última atualização: 10 de julho de 2026</p>
      <div className="mt-8 space-y-6 leading-relaxed">
        <section><h2 className="text-lg font-semibold text-white">Dados coletados</h2><p className="mt-2">Ao solicitar contato comercial, podemos coletar nome, e-mail, telefone e CNPJ informado voluntariamente.</p></section>
        <section><h2 className="text-lg font-semibold text-white">Finalidade</h2><p className="mt-2">Usamos esses dados para responder à solicitação, apresentar as soluções SalaOne e acompanhar o atendimento comercial.</p></section>
        <section><h2 className="text-lg font-semibold text-white">Proteção e retenção</h2><p className="mt-2">Aplicamos medidas técnicas e administrativas para proteger os dados e os mantemos somente pelo período necessário às finalidades informadas e obrigações legais.</p></section>
        <section><h2 className="text-lg font-semibold text-white">Seus direitos</h2><p className="mt-2">Você pode solicitar confirmação, acesso, correção ou exclusão dos seus dados pelos canais oficiais da AD Tech Solution Ltda.</p></section>
      </div>
      <Link to="/" className="mt-10 inline-block text-brand-pink hover:text-brand-pink">Voltar para o SalaOne</Link>
    </article>
  </main>;
}
