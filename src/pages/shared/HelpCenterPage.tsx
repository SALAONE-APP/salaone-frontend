import { useState } from 'react';
import {
  Search,
  Book,
  MessageCircle,
  FileText,
  Phone,
  Mail,
  ChevronRight,
  Play,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const faqs = [
  {
    question: 'Como criar um novo agendamento?',
    answer: 'Para criar um novo agendamento, acesse a página de Agendamentos e clique no botão "Novo Agendamento". Preencha os dados do cliente, selecione o serviço, o funcionário e a data/horário desejados.',
    category: 'Agendamentos'
  },
  {
    question: 'Como adicionar um novo funcionário?',
    answer: 'Acesse a página de Funcionários e clique em "Adicionar Funcionário". Preencha as informações necessárias, incluindo nome, contato e cargo. O novo funcionário receberá as credenciais de acesso por e-mail.',
    category: 'Funcionários'
  },
  {
    question: 'Como processar um reembolso?',
    answer: 'Acesse a página de Pagamentos, localize a transação que deseja reembolsar, clique no menu de três pontos e selecione "Processar Reembolso". Informe o valor e o motivo do reembolso.',
    category: 'Pagamentos'
  },
  {
    question: 'Como criar uma promoção?',
    answer: 'Acesse a página de Promoções e clique em "Adicionar Promoção". Defina o nome, o percentual de desconto, as datas de validade e gere um código exclusivo para os clientes utilizarem.',
    category: 'Promoções'
  },
  {
    question: 'Como visualizar relatórios?',
    answer: 'Clique em "Gerar Relatórios" no cabeçalho ou acesse a página de Visão Geral. Você pode filtrar os relatórios por período, funcionário ou tipo de serviço.',
    category: 'Relatórios'
  },
  {
    question: 'Como gerenciar permissões de usuários?',
    answer: 'Acesse Configurações > Usuários e Perfis. Selecione um perfil e ative ou desative as permissões desejadas para aquele perfil.',
    category: 'Configurações'
  },
];

const guides = [
  { title: 'Guia de Introdução', description: 'Aprenda o básico do SalaOne', icon: Book, color: 'bg-blue-500/10 text-blue-500' },
  { title: 'Gestão de Funcionários', description: 'Como gerenciar sua equipe de forma eficiente', icon: MessageCircle, color: 'bg-emerald-500/10 text-emerald-500' },
  { title: 'Sistema de Agendamentos', description: 'Domine o fluxo de agendamentos', icon: FileText, color: 'bg-purple-500/10 text-purple-500' },
  { title: 'Processamento de Pagamentos', description: 'Gerencie pagamentos e reembolsos', icon: FileText, color: 'bg-amber-500/10 text-amber-500' },
];

const videos = [
  { title: 'Painel de Controle', duration: '5:30', thumbnail: 'P' },
  { title: 'Criando seu Primeiro Agendamento', duration: '3:45', thumbnail: 'A' },
  { title: 'Gerenciando Escalas de Funcionários', duration: '7:15', thumbnail: 'E' },
  { title: 'Configurando Promoções', duration: '4:20', thumbnail: 'C' },
];

export function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Seção de Destaque */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl p-8 border border-primary/20 text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Como podemos te ajudar?</h2>
        <p className="text-muted-foreground mb-6">Pesquise em nossa base de conhecimento ou navegue pelas categorias abaixo</p>
        <div className="max-w-lg mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Buscar ajuda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card text-foreground placeholder:text-muted-foreground rounded-xl pl-12 pr-4 py-3 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Guias Rápidos */}
      <div>
        <h3 className="text-lg font-medium text-foreground mb-4">Guias Rápidos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {guides.map((guide, idx) => (
            <div
              key={idx}
              className="bg-card rounded-xl p-5 border border-border hover:border-primary/50 transition-colors cursor-pointer group"
            >
              <div className={`w-12 h-12 rounded-lg ${guide.color} flex items-center justify-center mb-4`}>
                <guide.icon size={24} />
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1 group-hover:text-primary transition-colors">
                {guide.title}
              </h4>
              <p className="text-xs text-muted-foreground">{guide.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tutoriais em Vídeo */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-foreground">Tutoriais em Vídeo</h3>
          <Button variant="ghost" size="sm" className="gap-1 text-primary">
            Ver Todos <ChevronRight size={14} />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {videos.map((video, idx) => (
            <div
              key={idx}
              className="bg-card rounded-xl border border-border overflow-hidden group cursor-pointer"
            >
              <div className="aspect-video bg-secondary flex items-center justify-center relative">
                <span className="text-4xl font-bold text-muted-foreground">{video.thumbnail}</span>
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                    <Play size={20} className="text-primary-foreground ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs text-white">
                  {video.duration}
                </div>
              </div>
              <div className="p-3">
                <h4 className="text-sm font-medium text-foreground">{video.title}</h4>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Perguntas Frequentes */}
      <div>
        <h3 className="text-lg font-medium text-foreground mb-4">Perguntas Frequentes</h3>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {filteredFaqs.map((faq, idx) => (
            <div
              key={idx}
              className="border-b border-border last:border-b-0"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">{faq.category}</Badge>
                  <span className="text-sm font-medium text-foreground">{faq.question}</span>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-muted-foreground transition-transform ${expandedFaq === idx ? 'rotate-90' : ''}`}
                />
              </button>
              {expandedFaq === idx && (
                <div className="px-4 pb-4 pl-24">
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Suporte */}
      <div>
        <h3 className="text-lg font-medium text-foreground mb-4">Ainda precisa de ajuda?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl p-5 border border-border flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Mail size={24} className="text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Suporte por E-mail</h4>
              <p className="text-xs text-muted-foreground">support@salaone.com.br</p>
            </div>
          </div>
          <div className="bg-card rounded-xl p-5 border border-border flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Phone size={24} className="text-emerald-500" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Suporte por Telefone</h4>
              <p className="text-xs text-muted-foreground">(11) 98765-9999</p>
            </div>
          </div>
          <div className="bg-card rounded-xl p-5 border border-border flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <MessageCircle size={24} className="text-purple-500" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Chat ao Vivo</h4>
              <p className="text-xs text-muted-foreground">Disponível das 9h às 18h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Link para Documentação */}
      <div className="bg-card rounded-xl p-6 border border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <FileText size={24} className="text-blue-500" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">Documentação Completa</h4>
            <p className="text-xs text-muted-foreground">Guia completo de todos os recursos e APIs</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2">
          Ver Documentação <ExternalLink size={14} />
        </Button>
      </div>
    </div>
  );
}
