import type { RelationshipTourStepConfig } from "./relationshipTourTypes";

export const relationshipTourSteps: RelationshipTourStepConfig[] = [
  {
    id: "kanban-intro",
    route: "/relationship-kanban",
    selector: '[data-tour="kanban-board"]',
    content:
      "Bem-vindo ao Relacionamento! Aqui você acompanha cada cliente que precisa de atenção — de quem cancelou até quem sumiu — organizados como um quadro de tarefas.",
  },
  {
    id: "kanban-novo-card-btn",
    route: "/relationship-kanban",
    selector: '[data-tour="kanban-novo-card-btn"]',
    content:
      "Vamos criar seu primeiro card. Clique aqui sempre que quiser registrar um cliente que precisa de acompanhamento.",
  },
  {
    id: "create-dialog-cliente",
    route: "/relationship-kanban",
    selector: '[data-tour="create-dialog-cliente-btn"]',
    content: "Primeiro, escolha o cliente — busque pelo nome ou telefone.",
    onEnter: (controls) => controls?.openCreateDialog(),
  },
  {
    id: "create-dialog-motivo",
    route: "/relationship-kanban",
    selector: '[data-tour="create-dialog-motivo-select"]',
    content: "Agora escolha o motivo, como 'Cancelou o horário' ou 'Não agenda há um tempo'.",
  },
  {
    id: "create-dialog-submit",
    route: "/relationship-kanban",
    selector: '[data-tour="create-dialog-submit-btn"]',
    content: "Pronto! Clique em salvar pra criar o card.",
  },
  {
    id: "kanban-card-created",
    route: "/relationship-kanban",
    selector: '[data-tour="kanban-column-cards"]',
    content:
      "É assim que o card aparece no quadro — ele fica na primeira etapa até você fazer o próximo contato.",
    onEnter: (controls) => controls?.closeCreateDialog(),
  },
  {
    id: "card-detail-etapa",
    route: "/relationship-kanban",
    selector: '[data-tour="card-detail-etapa-select"]',
    content:
      "Aqui você muda a etapa do cliente conforme ele avança, por exemplo de 'Tentando contato' pra 'Recuperado'.",
    onEnter: (controls) => controls?.openCardDetail(),
  },
  {
    id: "card-detail-registrar-contato",
    route: "/relationship-kanban",
    selector: '[data-tour="card-detail-registrar-contato"]',
    content:
      "Toda vez que ligar ou mandar mensagem, registre aqui — escolha o canal e escreva o que aconteceu.",
  },
  {
    id: "card-detail-historico",
    route: "/relationship-kanban",
    selector: '[data-tour="card-detail-historico"]',
    content:
      "Todo contato registrado fica salvo aqui, em ordem, pra você nunca perder o histórico com esse cliente.",
  },
  {
    id: "kanban-gerenciar-pipelines-btn",
    route: "/relationship-kanban",
    selector: '[data-tour="kanban-gerenciar-pipelines-btn"]',
    content:
      "Esse ícone de engrenagem abre o gerenciador de pipelines — onde você organiza as etapas do seu funil.",
    onEnter: (controls) => controls?.closeCardDetail(),
  },
  {
    id: "pipeline-manager-list",
    route: "/relationship-kanban",
    selector: '[data-tour="pipeline-manager-list"]',
    content:
      "Aqui estão seus pipelines. A maioria dos salões usa só um, mas dá pra ter vários — por exemplo, um pra cancelamentos e outro pra aniversariantes.",
    onEnter: (controls) => controls?.openManagerDialog(),
  },
  {
    id: "pipeline-manager-novo-pipeline",
    route: "/relationship-kanban",
    selector: '[data-tour="pipeline-manager-novo-pipeline-btn"]',
    content: "Clique aqui pra criar um pipeline novo, com um modelo pronto ou do zero.",
    onExit: (controls) => controls?.closeManagerDialog(),
  },
  {
    id: "kanban-automacao-btn",
    route: "/relationship-kanban",
    selector: '[data-tour="kanban-automacao-btn"]',
    content:
      "Esse ícone de raio abre a automação: cria cards automaticamente depois de cada atendimento, sem você precisar lembrar.",
  },
  {
    id: "automation-switch",
    route: "/relationship-kanban",
    selector: '[data-tour="automation-switch"]',
    content: "Ative esse botão pra ligar a automação de pós-atendimento.",
    onEnter: (controls) => controls?.openAutomationDialog(),
  },
  {
    id: "automation-pipeline-padrao",
    route: "/relationship-kanban",
    selector: '[data-tour="automation-pipeline-padrao-select"]',
    content: "Escolha qual pipeline recebe os cards criados automaticamente, por padrão.",
  },
  {
    id: "automation-categoria-mapeamento",
    route: "/relationship-kanban",
    selector: '[data-tour="automation-categoria-mapeamento"]',
    content:
      "Se quiser, mande categorias específicas de atendimento pra pipelines diferentes. Sem isso, tudo usa o padrão.",
    onExit: (controls) => controls?.closeAutomationDialog(),
  },
  {
    id: "dashboard-funil",
    route: "/relationship-dashboard",
    selector: '[data-tour="dashboard-funil"]',
    content:
      "Agora vamos ao Dashboard. Aqui está o funil: quantos clientes em cada etapa, pra ver de relance onde focar.",
  },
  {
    id: "dashboard-motivos-tendencia",
    route: "/relationship-dashboard",
    selector: '[data-tour="dashboard-motivos-tendencia"]',
    content: "Os motivos mais comuns de cliente sumido ou cancelado, e como isso mudou nos últimos meses.",
  },
  {
    id: "dashboard-atencao",
    route: "/relationship-dashboard",
    selector: '[data-tour="dashboard-atencao"]',
    content:
      "E essa lista mostra quem precisa de atenção hoje, os casos mais urgentes primeiro. Esse é o Relacionamento! Você pode assistir de novo clicando no ícone de ajuda.",
  },
];
