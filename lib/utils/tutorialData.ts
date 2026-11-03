export interface PageTutorialStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface PageTutorialConfig {
  route: string;
  sectionName: string;
  headline: string;
  summary: string;
  steps: PageTutorialStep[];
}

export interface TutorialCompletionInput {
  userName?: string;
  monthlyIncomeBase?: number;
  cardsCount: number;
  recurringCount: number;
  transactionsCount: number;
  manuallyCompleted?: boolean;
}

/**
 * Calcula o status de cada passo do tutorial inicial e informa se o passo a passo
 * da tela inicial (Dashboard) já foi cumprido e deve sumir (`shouldHideFromHome`).
 */
export function evaluateGettingStartedTutorial(input: TutorialCompletionInput) {
  const hasNameAndIncome = Boolean(
    input.userName &&
      input.userName.trim() !== "" &&
      input.userName !== "Seu Nome" &&
      (input.monthlyIncomeBase || 0) > 0
  );
  const hasAccountsOrCards = input.cardsCount > 0;
  const hasRecurring = input.recurringCount > 0;
  const hasTransactions = input.transactionsCount > 0;
  const hasPdfOrFullSetup = hasAccountsOrCards && hasRecurring && hasTransactions;

  const stepsStatus = {
    profile: hasNameAndIncome,
    pdfImport: hasPdfOrFullSetup,
    cards: hasAccountsOrCards,
    recurring: hasRecurring,
    transactions: hasTransactions && hasAccountsOrCards,
  };

  const completedCount = Object.values(stepsStatus).filter(Boolean).length;
  const totalCount = 5;
  const allStepsCompleted = completedCount === totalCount;

  return {
    stepsStatus,
    completedCount,
    totalCount,
    allStepsCompleted,
    shouldHideFromHome: Boolean(input.manuallyCompleted || allStepsCompleted),
  };
}

export const ONBOARDING_DIRECT_STEPS = [
  {
    step: 1,
    shortLabel: "1. Seu Nome e Renda",
    title: "Coloque seu nome e quanto você ganha por mês",
    description:
      "Digite como quer ser chamado e sua renda mensal para o app calcular quanto você pode gastar por dia com segurança.",
  },
  {
    step: 2,
    shortLabel: "2. Extrato em PDF",
    title: "Exporte aqui o PDF do extrato do seu banco",
    description:
      "Baixe o PDF do extrato no app do seu banco e envie aqui. O Wallet identifica suas contas, cartões, contas fixas e gastos e pede sua confirmação antes de salvar.",
  },
  {
    step: 3,
    shortLabel: "3. Seu Perfil",
    title: "Escolha seu estilo financeiro e pronto",
    description:
      "Selecione se você prefere juntar reserva, focar em milhas/cartão, investir ou manter tudo enxuto.",
  },
];

export const PAGE_TUTORIALS: Record<string, PageTutorialConfig> = {
  "/dashboard": {
    route: "/dashboard",
    sectionName: "Carteira (Tela Inicial)",
    headline: "Como configurar e usar sua Carteira",
    summary: "Veja quanto tem na conta hoje, quanto pode gastar por dia e seus cartões.",
    steps: [
      {
        stepNumber: 1,
        title: "Exporte o PDF do seu banco aqui",
        description:
          "Clique em 'Importar Extrato PDF' no topo da tela. O app lê o PDF do seu banco, identifica sua conta, seus gastos e suas contas fixas, e mostra tudo para você confirmar.",
      },
      {
        stepNumber: 2,
        title: "Cadastre seus cartões de crédito",
        description:
          "Clique em '+ Novo Cartão' no topo, digite o nome (ex: Nubank, Itaú), o limite total e o dia que fecha e vence a fatura.",
      },
      {
        stepNumber: 3,
        title: "Anote gastos rápidos do dia a dia",
        description:
          "Clique em 'Lançar gasto' ou '+ Nova Transação' sempre que fizer um Pix ou compra no cartão.",
      },
    ],
  },
  "/transactions": {
    route: "/transactions",
    sectionName: "Transações (Extrato do App)",
    headline: "Como cadastrar e editar seus gastos e entradas",
    summary: "Tudo o que já saiu ou entrou na sua conta e nos seus cartões fica listado aqui por dia.",
    steps: [
      {
        stepNumber: 1,
        title: "Importar tudo de uma vez pelo PDF do banco",
        description:
          "Clique em 'Importar Extrato PDF' no topo, escolha o arquivo PDF que você baixou no app do seu banco e confirme os lançamentos encontrados.",
      },
      {
        stepNumber: 2,
        title: "Cadastrar um gasto ou receita manualmente",
        description:
          "Clique em '+ Nova Transação', digite o nome (ex: Mercado), o valor, escolha se foi Despesa ou Receita e selecione a conta ou cartão.",
      },
      {
        stepNumber: 3,
        title: "Editar ou excluir um lançamento",
        description:
          "Clique sobre qualquer gasto da lista (ou nos três pontinhos ••• ao lado do valor) para mudar o valor, trocar a categoria ou apagar.",
      },
    ],
  },
  "/planning": {
    route: "/planning",
    sectionName: "Planejamento Mensal (Contas Fixas)",
    headline: "Como cadastrar contas fixas, salário e parcelamentos",
    summary: "Cadastre uma única vez o que se repete todo mês para o app calcular quanto vai sobrar.",
    steps: [
      {
        stepNumber: 1,
        title: "Cadastre seu Salário e Rendas Fixas",
        description:
          "Clique no botão de adicionar no topo, escolha 'Receita / Entrada', coloque o valor do seu salário e o dia que costuma cair.",
      },
      {
        stepNumber: 2,
        title: "Cadastre Aluguel, Luz, Internet e Assinaturas",
        description:
          "Adicione suas contas mensais (ou deixe que o 'Importar Extrato PDF' identifique Netflix, Spotify, Luz e Aluguel automaticamente para você).",
      },
      {
        stepNumber: 3,
        title: "Dê baixa quando pagar a conta no mês",
        description:
          "Quando pagar uma conta prevista na lista, clique em efetivar/confirmar ao lado dela para marcar como paga neste mês.",
      },
    ],
  },
  "/cards": {
    route: "/cards",
    sectionName: "Cartões & Faturas",
    headline: "Como controlar limites, faturas e parcelamentos",
    summary: "Veja quanto está acumulado na fatura de cada cartão neste mês e nos próximos.",
    steps: [
      {
        stepNumber: 1,
        title: "Adicione cada cartão que você usa",
        description:
          "Clique em '+ Novo Cartão', coloque o nome do banco, o limite e os dias de fechamento e vencimento.",
      },
      {
        stepNumber: 2,
        title: "Navegue pelos meses da fatura",
        description:
          "Use os botões de meses (Out, Nov, Dez...) para ver quanto já tem comprometido de parcelas e assinaturas nos próximos meses.",
      },
      {
        stepNumber: 3,
        title: "Dar baixa quando pagar a fatura",
        description:
          "Pagou a fatura no app do banco? Clique em 'Pagar Fatura' aqui para descontar o valor do saldo da sua conta e liberar o limite do cartão.",
      },
    ],
  },
  "/goals": {
    route: "/goals",
    sectionName: "Metas e Reservas",
    headline: "Como criar metas e guardar dinheiro",
    summary: "Separe objetivos claros como Reserva de Emergência, Viagem ou Troca de Carro.",
    steps: [
      {
        stepNumber: 1,
        title: "Crie seu objetivo",
        description:
          "Clique em '+ Nova Meta', dê um nome (ex: Reserva de Emergência), coloque o valor total que quer atingir e quanto já tem guardado hoje.",
      },
      {
        stepNumber: 2,
        title: "Registre novos aportes",
        description:
          "Sempre que separar mais dinheiro para essa meta, clique em 'Aportar / Guardar' dentro do card da meta.",
      },
      {
        stepNumber: 3,
        title: "Resgate se precisar usar",
        description:
          "Se precisar tirar parte do valor guardado, clique em 'Resgatar' para devolver o valor para sua conta principal.",
      },
    ],
  },
  "/ai": {
    route: "/ai",
    sectionName: "Wallet+ (Consultor com IA)",
    headline: "Como analisar seus gastos e tirar dúvidas",
    summary: "O analista lê seus números reais e mostra onde economizar e se você pode fazer uma compra.",
    steps: [
      {
        stepNumber: 1,
        title: "Gere seu Diagnóstico do Mês",
        description:
          "Clique em 'Atualizar Diagnóstico' para ver sua nota financeira, quanto falta para sua meta e quais gastos estão pesando mais.",
      },
      {
        stepNumber: 2,
        title: "Pergunte antes de comprar parcelado",
        description:
          "No chat, digite por exemplo: 'Posso comprar uma TV de R$ 2.500 em 10x?' e o consultor calcula se cabe na sua folga mensal.",
      },
      {
        stepNumber: 3,
        title: "Descubra padrões repetidos",
        description:
          "Veja os alertas automáticos de gastos repetidos (ex: delivery, transporte) para saber exatamente onde cortar.",
      },
    ],
  },
  "/profile": {
    route: "/profile",
    sectionName: "Perfil & Configurações",
    headline: "Como ajustar sua renda base e estilo do app",
    summary: "Configure seu nome, renda líquida mensal, meta de sobra no fim do mês e privacidade.",
    steps: [
      {
        stepNumber: 1,
        title: "Mantenha sua Renda Mensal atualizada",
        description:
          "Informe quanto você recebe por mês em 'Renda Base Mensal' e quanto quer que sobre livre no fim do mês ('Meta de Fechamento').",
      },
      {
        stepNumber: 2,
        title: "Escolha seu Arquétipo Financeiro",
        description:
          "Selecione entre Guardião, Otimizador, Escalonador ou Minimalista para ajustar os conselhos do app ao seu jeito.",
      },
      {
        stepNumber: 3,
        title: "Controle seus dados (LGPD)",
        description:
          "Você pode exportar ou redefinir seus dados a qualquer momento com segurança total.",
      },
    ],
  },
};

