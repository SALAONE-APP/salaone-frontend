import { Link } from "react-router-dom";
import salaOneLogo from "@/assets/image/logo-icone-salaone.jpeg";

const sections = [
  {
    title: "1. Aceitação dos termos",
    content: "Ao criar uma conta, contratar um plano ou utilizar a plataforma SalaOne, você declara que leu, compreendeu e concorda com estes Termos de Serviço e com a Política de Privacidade. Caso não concorde, não utilize a plataforma.",
  },
  {
    title: "2. Sobre a plataforma",
    content: "O SalaOne é uma plataforma de gestão para salões e profissionais de beleza, com recursos como agenda, cadastro de clientes, serviços, comandas, pagamentos, assinaturas, relatórios e relacionamento.",
  },
  {
    title: "3. Cadastro e segurança da conta",
    content: "Você deve fornecer informações verdadeiras, completas e atualizadas. As credenciais de acesso são pessoais e intransferíveis; você é responsável por manter sua senha em sigilo e por todas as atividades realizadas em sua conta.",
  },
  {
    title: "4. Planos, cobrança e cancelamento",
    content: "Os recursos disponíveis dependem do plano contratado. Valores, condições de cobrança, recorrência, vencimentos e eventuais períodos de teste serão apresentados antes da contratação. O cancelamento não elimina valores já vencidos ou obrigações assumidas até a data da solicitação.",
  },
  {
    title: "5. Uso permitido",
    content: "A plataforma deve ser utilizada apenas para fins legítimos e em conformidade com a legislação aplicável. É proibido tentar acessar contas de terceiros, interferir no funcionamento do serviço, inserir conteúdo ilícito ou utilizar o SalaOne para práticas fraudulentas.",
  },
  {
    title: "6. Dados e responsabilidade do estabelecimento",
    content: "O estabelecimento é responsável pelos dados que cadastra, pelos contatos realizados com clientes e por obter as autorizações necessárias para o tratamento de dados pessoais. O SalaOne trata dados conforme sua Política de Privacidade e a legislação aplicável, incluindo a LGPD.",
  },
  {
    title: "7. Disponibilidade e suporte",
    content: "Buscamos manter o serviço disponível e seguro, mas poderão ocorrer indisponibilidades temporárias por manutenção, atualizações, falhas de terceiros ou eventos fora de nosso controle. Sempre que possível, manutenções programadas serão comunicadas previamente.",
  },
  {
    title: "8. Propriedade intelectual",
    content: "A marca SalaOne, a plataforma, seus códigos, interfaces, conteúdos e materiais são protegidos por direitos de propriedade intelectual. A contratação concede somente uma licença limitada, não exclusiva e intransferível para uso da plataforma durante a vigência da assinatura.",
  },
  {
    title: "9. Limitação de responsabilidade",
    content: "O SalaOne não se responsabiliza por informações inseridas pelos usuários, decisões comerciais tomadas a partir da plataforma, falhas de conexão do usuário ou serviços de terceiros. Nada nestes termos limita direitos que não possam ser limitados pela legislação aplicável.",
  },
  {
    title: "10. Alterações destes termos",
    content: "Estes termos podem ser atualizados para refletir mudanças legais, técnicas ou comerciais. A versão vigente estará sempre disponível nesta página. O uso continuado da plataforma após a publicação das alterações representa a aceitação da versão atualizada.",
  },
  {
    title: "11. Contato",
    content: "Para dúvidas sobre estes termos ou sobre a plataforma, entre em contato pelos canais oficiais da AD Tech Solution Ltda.",
  },
];

export function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-neutral-300">
      <article className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950 p-6 sm:p-10">
        <Link to="/" aria-label="Voltar para a página inicial">
          <img src={salaOneLogo} alt="SalaOne" className="mb-8 h-20 w-20 rounded-full object-cover" />
        </Link>
        <h1 className="text-3xl font-bold text-white">Termos de Serviço</h1>
        <p className="mt-2 text-sm text-neutral-500">Última atualização: 22 de outubro de 2026</p>
        <div className="mt-8 space-y-6 leading-relaxed">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-white">{section.title}</h2>
              <p className="mt-2">{section.content}</p>
            </section>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-5">
          <Link to="/" className="text-brand-pink hover:underline">Voltar para o SalaOne</Link>
          <Link to="/privacy" className="text-neutral-400 hover:text-white hover:underline">Política de Privacidade</Link>
        </div>
      </article>
    </main>
  );
}
