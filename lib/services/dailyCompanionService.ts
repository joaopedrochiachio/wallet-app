/**
 * Daily Financial Companion Service (Wallet Companion & Personal CFO)
 * 
 * Transforma o Wallet App de uma planilha de "o que entra e sai"
 * para um assistente proativo de suporte financeiro no dia a dia.
 * 
 * Funcionalidades centrais:
 * 1. Cálculo de Margem Diária Segura de Gastos ("Safe-to-Spend" diário)
 * 2. Próximos Vencimentos e Avisos de Contas/Faturas (janela de 7 dias)
 * 3. Parser de Linguagem Natural para Captura Rápida ("Almoço 35", "Uber 22 no nubank")
 * 4. Motor de Decisão de Compra Instantâneo ("Devo Comprar?")
 * 5. Check-in Diário de Disciplina Financeira e Streaks de Controle
 * 6. Inteligência do Melhor Cartão para Comprar Hoje
 * 7. Ritmo e Velocidade Semanal de Consumo (Weekly Burn Rate)
 * 8. Nudges e Dicas Contextuais do Agente Guardião
 */

import {
  isRecurringActiveInMonth,
  getEffectiveDueDay,
  getEffectiveRecurringItemForPeriod,
  getPeriodKey,
} from "../utils/dateUtils.ts";

export interface DailySpendMetric {
  safeDailyAllowance: number;
  remainingDaysInMonth: number;
  projectedFreeBalance: number;
  targetEndMonthBalance: number;
  safeMarginTotal: number;
  status: "comfortable" | "balanced" | "tight" | "overdrawn";
}

export interface UpcomingFinancialEvent {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  dueDay?: number;
  daysRemaining: number;
  type: "credit_invoice" | "recurring_bill" | "planned_income";
  accountOrCard?: string;
  isUrgent: boolean; // vence hoje ou amanhã
}

export interface QuickExpenseParseResult {
  title: string;
  amount: number;
  category: string;
  account: string;
  cardId?: string | null;
  confidence: number;
}

export interface PurchaseSimulationVerdict {
  verdict: "approved" | "warning" | "danger";
  headline: string;
  explanation: string;
  newSafeDailyAllowance: number;
  dailyReduction: number;
  impactOnMonthlyTarget: number;
  monthlyInvoiceLoad: number;
  recommendation: string;
}

export interface DailyCheckInRecord {
  date: string; // YYYY-MM-DD
  mood: "in_control" | "unexpected_spend" | "tight_savings";
  note?: string;
  timestamp: number;
}

export interface CompanionAdvice {
  agentName: string;
  agentTitle: string;
  avatarState: "idle" | "thinking" | "celebrating" | "warning" | "alert";
  headline: string;
  advice: string;
  actionText?: string;
  actionHref?: string;
  priority: "high" | "normal" | "positive";
}

/**
 * 1. CALCULA O TETO DIÁRIO SEGURO DE GASTOS
 * Permite saber com exatidão: "Quanto posso gastar hoje sem comprometer minha meta do mês?"
 */
export function calculateDailySafeSpend(params: {
  projectedFreeBalance: number;
  targetEndMonthBalance: number;
  currentDate?: Date;
}): DailySpendMetric {
  const now = params.currentDate ? new Date(params.currentDate) : new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Total de dias no mês
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  // Dias restantes incluindo o dia de hoje
  const remainingDaysInMonth = Math.max(1, totalDaysInMonth - currentDay + 1);

  const safeMarginTotal = params.projectedFreeBalance - params.targetEndMonthBalance;

  let safeDailyAllowance = 0;
  let status: DailySpendMetric["status"] = "balanced";

  if (safeMarginTotal > 0) {
    safeDailyAllowance = Math.floor((safeMarginTotal / remainingDaysInMonth) * 100) / 100;
    if (safeDailyAllowance >= 150) {
      status = "comfortable";
    } else if (safeDailyAllowance >= 40) {
      status = "balanced";
    } else {
      status = "tight";
    }
  } else if (safeMarginTotal === 0) {
    safeDailyAllowance = 0;
    status = "tight";
  } else {
    // Saldo projetado abaixo da meta
    safeDailyAllowance = 0;
    status = "overdrawn";
  }

  return {
    safeDailyAllowance,
    remainingDaysInMonth,
    projectedFreeBalance: params.projectedFreeBalance,
    targetEndMonthBalance: params.targetEndMonthBalance,
    safeMarginTotal,
    status,
  };
}

/**
 * 2. PARSER DE LINGUAGEM NATURAL PARA CAPTURA RÁPIDA (Estilo Atalho Rápido Wallet)
 * Interpreta frases como:
 * - "Almoço 35 nubank"
 * - "Uber 24,90"
 * - "Farmácia 80 no crédito"
 * - "Gasolina R$ 150"
 */
export function parseQuickExpenseText(
  rawText: string,
  availableCards: Array<{ id: string; name: string }> = [],
  defaultAccount = "Débito/Pix"
): QuickExpenseParseResult {
  const cleaned = (rawText || "").trim();
  if (!cleaned) {
    return {
      title: "Despesa rápida",
      amount: 0,
      category: "Outros",
      account: defaultAccount,
      confidence: 0,
    };
  }

  // Regex para capturar valores monetários: "R$ 45", "45,90", "45.90", "45"
  const amountMatch = cleaned.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  let amount = 0;
  if (amountMatch) {
    const rawVal = amountMatch[1].replace(",", ".");
    amount = parseFloat(rawVal) || 0;
  }

  // Remove o trecho numérico para obter as palavras-chave
  let textWithoutAmount = cleaned;
  if (amountMatch) {
    textWithoutAmount = cleaned.replace(amountMatch[0], "").trim();
  }

  // Detecta menção a cartão/conta
  let chosenAccount = defaultAccount;
  let chosenCardId: string | null = null;
  const lowerWithoutAmount = textWithoutAmount.toLowerCase();

  for (const card of availableCards) {
    if (lowerWithoutAmount.includes(card.name.toLowerCase())) {
      chosenAccount = card.name;
      chosenCardId = card.id;
      // remove o nome do cartão da descrição para ficar limpo
      const cardRegex = new RegExp(`\\b(no\\s+|no\\s+cartão\\s+|cartão\\s+)?${card.name}\\b`, "i");
      textWithoutAmount = textWithoutAmount.replace(cardRegex, "").trim();
      break;
    }
  }

  // Se mencionou "crédito" mas sem nome específico e há cartões
  if (!chosenCardId && (lowerWithoutAmount.includes("crédito") || lowerWithoutAmount.includes("cartão"))) {
    if (availableCards.length > 0) {
      chosenAccount = availableCards[0].name;
      chosenCardId = availableCards[0].id;
    }
    textWithoutAmount = textWithoutAmount.replace(/\b(no\s+)?(crédito|cartão)\b/i, "").trim();
  }

  // Se mencionou "pix" ou "débito"
  if (lowerWithoutAmount.includes("pix") || lowerWithoutAmount.includes("débito")) {
    chosenAccount = "Débito/Pix";
    chosenCardId = null;
    textWithoutAmount = textWithoutAmount.replace(/\b(no\s+)?(pix|débito)\b/i, "").trim();
  }

  // Limpeza de preposições sobrando: "em", "no", "na", "de"
  let title = textWithoutAmount
    .replace(/^(\s*de|\s*no|\s*na|\s*em|\s*para)+\s+/i, "")
    .replace(/\s+(\s*de|\s*no|\s*na|\s*em|\s*para)+\s*$/i, "")
    .trim();

  if (!title) {
    title = "Gasto rápido";
  } else {
    // Capitaliza primeira letra
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  // Inferência de Categoria inteligente
  const lowerTitle = title.toLowerCase();
  let category = "Outros";

  if (
    lowerTitle.includes("almoço") ||
    lowerTitle.includes("jantar") ||
    lowerTitle.includes("comida") ||
    lowerTitle.includes("lanche") ||
    lowerTitle.includes("restaurante") ||
    lowerTitle.includes("ifood") ||
    lowerTitle.includes("café") ||
    lowerTitle.includes("padaria") ||
    lowerTitle.includes("mercado") ||
    lowerTitle.includes("supermercado")
  ) {
    category = "Alimentação";
  } else if (
    lowerTitle.includes("uber") ||
    lowerTitle.includes("99") ||
    lowerTitle.includes("táxi") ||
    lowerTitle.includes("gasolina") ||
    lowerTitle.includes("combustível") ||
    lowerTitle.includes("estacionamento") ||
    lowerTitle.includes("pedágio") ||
    lowerTitle.includes("metrô") ||
    lowerTitle.includes("ônibus")
  ) {
    category = "Transporte";
  } else if (
    lowerTitle.includes("farmácia") ||
    lowerTitle.includes("remédio") ||
    lowerTitle.includes("médico") ||
    lowerTitle.includes("dentista") ||
    lowerTitle.includes("consulta") ||
    lowerTitle.includes("exame")
  ) {
    category = "Saúde";
  } else if (
    lowerTitle.includes("cinema") ||
    lowerTitle.includes("filme") ||
    lowerTitle.includes("show") ||
    lowerTitle.includes("jogo") ||
    lowerTitle.includes("bar") ||
    lowerTitle.includes("cerveja") ||
    lowerTitle.includes("festa") ||
    lowerTitle.includes("livro") ||
    lowerTitle.includes("steam")
  ) {
    category = "Lazer";
  } else if (
    lowerTitle.includes("roupa") ||
    lowerTitle.includes("tênis") ||
    lowerTitle.includes("sapato") ||
    lowerTitle.includes("shopee") ||
    lowerTitle.includes("amazon") ||
    lowerTitle.includes("mercado livre") ||
    lowerTitle.includes("loja")
  ) {
    category = "Compras";
  } else if (
    lowerTitle.includes("luz") ||
    lowerTitle.includes("água") ||
    lowerTitle.includes("internet") ||
    lowerTitle.includes("aluguel") ||
    lowerTitle.includes("condomínio") ||
    lowerTitle.includes("gás")
  ) {
    category = "Moradia";
  }

  const confidence = amount > 0 && title !== "Gasto rápido" ? 0.95 : 0.6;

  return {
    title,
    amount,
    category,
    account: chosenAccount,
    cardId: chosenCardId,
    confidence,
  };
}

/**
 * 3. MOTOR DE DECISÃO DE COMPRA INTERATIVO ("Devo comprar isto agora?")
 * Analisa a compra contra o saldo projetado, limite do cartão e margem diária.
 */
export function simulatePurchaseDecision(params: {
  amount: number;
  installments: number; // 1 = à vista
  isCredit: boolean;
  projectedFreeBalance: number;
  targetEndMonthBalance: number;
  cardLimitAvailable?: number;
  currentDate?: Date;
}): PurchaseSimulationVerdict {
  const {
    amount,
    installments = 1,
    isCredit,
    projectedFreeBalance,
    targetEndMonthBalance,
    cardLimitAvailable = Infinity,
  } = params;

  const currentSafeMetric = calculateDailySafeSpend({
    projectedFreeBalance,
    targetEndMonthBalance,
    currentDate: params.currentDate,
  });

  const installmentAmount = amount / Math.max(1, installments);
  const currentMonthImpact = isCredit ? (installments === 1 ? amount : installmentAmount) : amount;
  const newProjectedFree = projectedFreeBalance - currentMonthImpact;

  const newSafeMetric = calculateDailySafeSpend({
    projectedFreeBalance: newProjectedFree,
    targetEndMonthBalance,
    currentDate: params.currentDate,
  });

  const dailyReduction = Math.max(0, currentSafeMetric.safeDailyAllowance - newSafeMetric.safeDailyAllowance);
  const impactOnMonthlyTarget = newProjectedFree - targetEndMonthBalance;

  // Verificação de limite
  if (isCredit && amount > cardLimitAvailable) {
    return {
      verdict: "danger",
      headline: "Limite Insuficiente no Cartão",
      explanation: `O valor total de R$ ${amount.toFixed(2)} excede o limite disponível de R$ ${cardLimitAvailable.toFixed(2)}.`,
      newSafeDailyAllowance: currentSafeMetric.safeDailyAllowance,
      dailyReduction: 0,
      impactOnMonthlyTarget,
      monthlyInvoiceLoad: installmentAmount,
      recommendation: "Não tente passar essa compra sem antes liberar limite ou usar outro meio de pagamento.",
    };
  }

  // Caso 1: Compra deixa o saldo abaixo da meta estipulada
  if (impactOnMonthlyTarget < 0) {
    const gap = Math.abs(impactOnMonthlyTarget);
    return {
      verdict: "danger",
      headline: "Risco Alto: Compromete sua Meta",
      explanation: `Esta compra de R$ ${amount.toFixed(2)} deixará seu fechamento R$ ${gap.toFixed(2)} abaixo da sua meta de segurança de R$ ${targetEndMonthBalance.toFixed(2)}.`,
      newSafeDailyAllowance: newSafeMetric.safeDailyAllowance,
      dailyReduction,
      impactOnMonthlyTarget,
      monthlyInvoiceLoad: isCredit ? installmentAmount : 0,
      recommendation: installments > 1 
        ? `Se realmente precisar, considere adiar para o próximo mês ou buscar uma alternativa até R$ ${(currentSafeMetric.safeMarginTotal).toFixed(2)}.`
        : "Recomendamos esperar o próximo ciclo ou economizar primeiro a quantia antes de realizar esta despesa.",
    };
  }

  // Caso 2: Compra consome mais de 50% da margem livre restante
  if (currentSafeMetric.safeMarginTotal > 0 && currentMonthImpact > currentSafeMetric.safeMarginTotal * 0.5) {
    return {
      verdict: "warning",
      headline: "Atenção: Margem Diária Ficará Apertada",
      explanation: `A compra cabe no orçamento, mas reduzirá seu gasto diário seguro de R$ ${currentSafeMetric.safeDailyAllowance.toFixed(2)} para R$ ${newSafeMetric.safeDailyAllowance.toFixed(2)} (-R$ ${dailyReduction.toFixed(2)}/dia).`,
      newSafeDailyAllowance: newSafeMetric.safeDailyAllowance,
      dailyReduction,
      impactOnMonthlyTarget,
      monthlyInvoiceLoad: isCredit ? installmentAmount : 0,
      recommendation: installments > 1
        ? `As parcelas de R$ ${installmentAmount.toFixed(2)} se estenderão pelos próximos ${installments} meses. Certifique-se de que não haverá outros grandes imprevistos.`
        : "Compre apenas se for algo prioritário, pois sua folga diária ficará sensível até a virada do mês.",
    };
  }

  // Caso 3: Compra segura com folga
  return {
    verdict: "approved",
    headline: "Liberado com Folga Saudável",
    explanation: `Pode comprar com tranquilidade! Mesmo após essa despesa, você ainda terá R$ ${newSafeMetric.safeDailyAllowance.toFixed(2)}/dia livres e fechará o mês com folga de R$ ${impactOnMonthlyTarget.toFixed(2)} acima da meta.`,
    newSafeDailyAllowance: newSafeMetric.safeDailyAllowance,
    dailyReduction,
    impactOnMonthlyTarget,
    monthlyInvoiceLoad: isCredit ? installmentAmount : 0,
    recommendation: installments > 1
      ? `Parcelamento em ${installments}x de R$ ${installmentAmount.toFixed(2)} encaixa perfeitamente no seu fluxo de caixa.`
      : "Se tiver desconto à vista via Pix, aproveite para economizar ainda mais!",
  };
}

/**
 * 4. EVENTOS FINANCEIROS DOS PRÓXIMOS DIAS (Janela de 7 dias)
 * Alerta ativamente sobre contas que vencem hoje, amanhã ou na semana.
 */
export function getUpcomingFinancialEvents(params: {
  cards: Array<{
    id: string;
    name: string;
    type?: "checking" | "credit" | string;
    dueDay?: number;
    closingDay?: number;
    spent?: number;
    balance?: number;
  }>;
  recurringItems: Array<{
    id: string;
    title: string;
    amount: number;
    dueDay?: number;
    type?: "expense" | "income" | "receita" | "despesa" | string;
    active?: boolean;
    realizedPeriods?: string[];
  }>;
  transactions?: Array<{
    id?: string;
    title?: string;
    kind?: string;
    relatedCardId?: string | null;
    cardId?: string | null;
    recurringItemId?: string | null;
    periodKey?: string | null;
    amount?: number;
    date?: string;
  }>;
  cardInvoiceProjections?: Array<{
    cardId: string;
    isPaid: boolean;
    pendingInvoice: number;
    totalInvoice: number;
  }>;
  currentDate?: Date;
  onlyExpenses?: boolean;
  filterType?: "all" | "expenses" | "incomes";
}): UpcomingFinancialEvent[] {
  const now = params.currentDate ? new Date(params.currentDate) : new Date();
  const currentDay = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentPeriodKey = getPeriodKey(year, month);

  const events: UpcomingFinancialEvent[] = [];
  const filterType = params.filterType || (params.onlyExpenses ? "expenses" : "all");

  // 1. FATURAS DE CARTÃO (Apenas se a fatura do mês atual ainda NÃO foi paga e vence de hoje em diante)
  if (filterType !== "incomes") {
    for (const card of params.cards) {
      if (card.type && card.type !== "credit") continue;
      if (typeof card.dueDay !== "number" || card.dueDay <= 0) continue;

      // Verifica se a fatura já está paga
      const invoicePaid =
        (params.cardInvoiceProjections &&
          params.cardInvoiceProjections.some(
            (inv) => inv.cardId === card.id && (inv.isPaid || inv.pendingInvoice <= 0)
          )) ||
        (params.transactions &&
          params.transactions.some(
            (tx) =>
              tx.kind === "invoice_payment" &&
              (tx.relatedCardId === card.id || (tx as any).cardId === card.id) &&
              (tx.periodKey === currentPeriodKey || (tx.date && tx.date.includes(currentPeriodKey)))
          ));

      if (invoicePaid) continue; // Fatura já quitada! Não colocar nas pendências

      // Considera apenas faturas de hoje em diante no mês atual
      const diff = card.dueDay - currentDay;
      if (diff >= 0 && diff <= 7) {
        let estimatedAmount = card.spent ?? card.balance ?? 0;
        if (params.cardInvoiceProjections) {
          const inv = params.cardInvoiceProjections.find((i) => i.cardId === card.id);
          if (inv && inv.pendingInvoice > 0) {
            estimatedAmount = inv.pendingInvoice;
          }
        }

        if (estimatedAmount > 0) {
          events.push({
            id: `card_due_${card.id}`,
            title: `Fatura ${card.name}`,
            amount: estimatedAmount,
            dueDate: `Dia ${card.dueDay}`,
            dueDay: card.dueDay,
            daysRemaining: diff,
            type: "credit_invoice",
            accountOrCard: card.name,
            isUrgent: diff <= 1,
          });
        }
      }
    }
  }

  // 2. RECORRÊNCIAS / CONTAS PLANEJADAS
  for (const rawItem of params.recurringItems) {
    if (!rawItem) continue;

    // A. Verifica se o item está ativo para esta competência (respeita startMonth, installmentsCount, exclusões)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!isRecurringActiveInMonth(rawItem as any, year, month)) {
      continue;
    }

    // B. Obtém versão efetiva com overrides do período (ex: mudança de valor ou dia específico deste mês)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = getEffectiveRecurringItemForPeriod(rawItem as any, currentPeriodKey);

    const isIncome = item.type === "receita" || item.type === "income";

    // Filtro por tipo
    if (filterType === "expenses" && isIncome) continue;
    if (filterType === "incomes" && !isIncome) continue;

    // C. Verifica se a ocorrência do mês corrente já foi realizada / paga / recebida
    const isRealized = Boolean(
      item.realizedPeriods?.includes(currentPeriodKey) ||
        (params.transactions &&
          params.transactions.some(
            (tx) =>
              (tx.recurringItemId === item.id ||
                (tx.title &&
                  tx.title.toLowerCase().trim() === item.title.toLowerCase().trim() &&
                  typeof tx.amount === "number" &&
                  Math.abs(tx.amount - item.amount) < 0.01)) &&
              (tx.periodKey === currentPeriodKey || (tx.date && tx.date.includes(currentPeriodKey)))
          ))
    );

    if (isRealized) continue; // Já pago / realizado no mês atual! Exclui de pendências

    // D. Calcula dia de vencimento efetivo (suporta 5º dia útil e dia fixo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const effectiveDay = getEffectiveDueDay(item as any, year, month);
    if (!effectiveDay || effectiveDay <= 0) continue;

    // E. Considera APENAS lançamentos que vencem de hoje em diante (não itens do passado deste mês)
    const diff = effectiveDay - currentDay;
    if (diff >= 0 && diff <= 7) {
      events.push({
        id: `recurring_${item.id}`,
        title: item.title,
        amount: item.amount,
        dueDate: `Dia ${effectiveDay}`,
        dueDay: effectiveDay,
        daysRemaining: diff,
        type: isIncome ? "planned_income" : "recurring_bill",
        isUrgent: diff <= 1,
      });
    }
  }

  // Ordena pelos dias restantes (mais urgentes primeiro)
  return events.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * 5. PERSISTÊNCIA DO CHECK-IN DIÁRIO E STREAK (Armazenamento Local Seguro)
 */
const CHECKIN_STORAGE_KEY = "wallet_daily_checkins_v1";

export function getDailyCheckIns(): DailyCheckInRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHECKIN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDailyCheckIn(mood: DailyCheckInRecord["mood"], note?: string): DailyCheckInRecord {
  const today = new Date().toISOString().split("T")[0];
  const existing = getDailyCheckIns().filter((c) => c.date !== today);
  const newRecord: DailyCheckInRecord = {
    date: today,
    mood,
    note: note ? note.trim().slice(0, 140) : undefined,
    timestamp: Date.now(),
  };

  const updated = [newRecord, ...existing].slice(0, 60); // guarda últimos 60 dias
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // storage quota safe
    }
  }
  return newRecord;
}

export function calculateCheckInStreak(records: DailyCheckInRecord[]): { streak: number; todayCheckedIn: boolean } {
  if (!records || records.length === 0) return { streak: 0, todayCheckedIn: false };
  
  const today = new Date().toISOString().split("T")[0];
  const todayCheckedIn = records.some((r) => r.date === today);

  let streak = 0;
  const cursor = new Date();

  // Se não fez hoje ainda, pode estar mantendo a sequência de ontem
  if (!todayCheckedIn) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const dateStr = cursor.toISOString().split("T")[0];
    const found = records.find((r) => r.date === dateStr);
    if (found && found.mood !== "unexpected_spend") {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return { streak, todayCheckedIn };
}

/**
 * 6. GERADOR DE DICA CONTEXTUAL INTELIGENTE (Sol & Rubi Personality Engine)
 */
export function generateDailyCompanionAdvice(params: {
  userName?: string;
  projectedFreeBalance: number;
  targetEndMonthBalance: number;
  safeDailyAllowance: number;
  upcomingEventsCount: number;
  streakCount: number;
  persona?: string;
}): CompanionAdvice {
  const firstName = (params.userName || "Investidor").split(" ")[0];
  const persona = params.persona || "guardian";

  // Identidade e Arquétipo do Assistente Wallet (Ecossistema Wallet com Personagens Originais)
  const agentProfiles: Record<string, { name: string; title: string }> = {
    "wallet-rubi": { name: "Rubi", title: "CFO & Estrategista de Capital" },
    "wallet-sol": { name: "Sol", title: "Guardiã da Reserva & Liquidez" },
    "wallet-nanquim": { name: "Nanquim", title: "Arquiteto de Crédito & Faturas" },
    "wallet-atlos": { name: "Atlos", title: "Mentor de Metas & Hábitos" },
    rubi: { name: "Rubi", title: "CFO & Estrategista de Capital" },
    sol: { name: "Sol", title: "Guardiã da Reserva & Liquidez" },
    nanquim: { name: "Nanquim", title: "Arquiteto de Crédito & Faturas" },
    atlos: { name: "Atlos", title: "Mentor de Metas & Hábitos" },
    guardian: { name: "Sol", title: "Guardiã da Reserva & Liquidez" },
    optimizer: { name: "Rubi", title: "CFO & Estrategista de Capital" },
    builder: { name: "Nanquim", title: "Arquiteto de Crédito & Faturas" },
    scaler: { name: "Atlos", title: "Mentor de Metas & Hábitos" },
  };

  const agent = agentProfiles[persona] || agentProfiles.guardian;

  // Cenário 1: Sequência de disciplina
  if (params.streakCount >= 3) {
    return {
      agentName: agent.name,
      agentTitle: agent.title,
      avatarState: "celebrating",
      headline: `Incrível, ${firstName}! ${params.streakCount} dias de foco consecutivo.`,
      advice: `Você está mantendo sua rotina blindada. Seu teto seguro hoje é de R$ ${params.safeDailyAllowance.toFixed(2)}. Continue nesse ritmo e sua meta será batida com folga!`,
      priority: "positive",
    };
  }

  // Cenário 2: Saldo apertado / abaixo da meta
  if (params.projectedFreeBalance < params.targetEndMonthBalance) {
    const gap = params.targetEndMonthBalance - params.projectedFreeBalance;
    return {
      agentName: agent.name,
      agentTitle: agent.title,
      avatarState: "alert",
      headline: `Atenção necessária, ${firstName}: estamos a R$ ${gap.toFixed(2)} da meta.`,
      advice: "Para recuperar a folga até o fechamento, evite gastos não essenciais nas próximas 48 horas e priorize apenas despesas fixas.",
      actionText: "Ver Diagnóstico",
      actionHref: "/ai",
      priority: "high",
    };
  }

  // Cenário 3: Vencimento iminente
  if (params.upcomingEventsCount > 0) {
    return {
      agentName: agent.name,
      agentTitle: agent.title,
      avatarState: "thinking",
      headline: `${params.upcomingEventsCount} compromisso${params.upcomingEventsCount > 1 ? "s" : ""} nos próximos dias`,
      advice: `Mantenha a conta corrente abastecida para a quitação automática. Seu limite diário seguro de hoje é de R$ ${params.safeDailyAllowance.toFixed(2)}.`,
      priority: "normal",
    };
  }

  // Cenário Padrão: Equilíbrio
  return {
    agentName: agent.name,
    agentTitle: agent.title,
    avatarState: "idle",
    headline: `Tudo pronto para hoje, ${firstName}.`,
    advice: `Você tem R$ ${params.safeDailyAllowance.toFixed(2)} disponível hoje para manter a projeção de fechamento no azul.`,
    priority: "normal",
  };
}

/**
 * 7. INTELIGÊNCIA DO MELHOR CARTÃO PARA COMPRAR HOJE
 * Analisa as datas de fechamento e vencimento de todos os cartões de crédito
 * e indica qual oferece o maior prazo até o pagamento (o melhor dia de compra).
 */
export interface BestCardRecommendation {
  cardId: string;
  cardName: string;
  reason: string;
  closingDay: number;
  dueDay: number;
  daysUntilClosing: number;
  availableLimit: number;
}

export function getBestCardToSpendToday(params: {
  cards: Array<{
    id: string;
    name: string;
    type?: "checking" | "credit" | string;
    dueDay?: number;
    closingDay?: number;
    limit?: number;
    spent?: number;
  }>;
  currentDate?: Date;
}): BestCardRecommendation | null {
  const now = params.currentDate ? new Date(params.currentDate) : new Date();
  const currentDay = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const creditCards = params.cards.filter(
    (c) => (c.type === "credit" || !c.type) && typeof c.closingDay === "number" && typeof c.dueDay === "number"
  );

  if (creditCards.length === 0) return null;

  let bestCard = creditCards[0];
  let maxDaysToClose = -1;
  let bestReason = "";

  for (const card of creditCards) {
    const closingDay = card.closingDay!;
    const dueDay = card.dueDay!;
    const limit = card.limit || 0;
    const spent = card.spent || 0;
    const available = Math.max(0, limit - spent);

    // Se o limite estiver esgotado (< R$ 30), pula para o próximo
    if (limit > 0 && available < 30) continue;

    let daysToClose = closingDay - currentDay;
    if (daysToClose <= 0) {
      daysToClose = daysInMonth - currentDay + closingDay;
    }

    if (daysToClose > maxDaysToClose) {
      maxDaysToClose = daysToClose;
      bestCard = card;
      const daysSinceClosing = currentDay >= closingDay 
        ? currentDay - closingDay 
        : (daysInMonth - closingDay + currentDay);

      if (daysSinceClosing <= 3) {
        bestReason = `Melhor dia de compra! Fatura fechou recentemente e a compra só vence no dia ${dueDay} do próximo ciclo.`;
      } else {
        bestReason = `Fatura fecha em ${daysToClose} dias (dia ${closingDay}). Maior prazo para pagar.`;
      }
    }
  }

  const availableLimit = Math.max(0, (bestCard.limit || 0) - (bestCard.spent || 0));

  return {
    cardId: bestCard.id,
    cardName: bestCard.name,
    reason: bestReason || `Vencimento dia ${bestCard.dueDay}`,
    closingDay: bestCard.closingDay || 1,
    dueDay: bestCard.dueDay || 10,
    daysUntilClosing: maxDaysToClose > 0 ? maxDaysToClose : 15,
    availableLimit,
  };
}

/**
 * 8. RITMO E VELOCIDADE SEMANAL DE CONSUMO (Weekly Burn Rate)
 */
export interface WeeklySpendingVelocity {
  last7DaysTotal: number;
  previous7DaysTotal: number;
  differencePercent: number;
  trend: "accelerated" | "controlled" | "reduced";
  headline: string;
}

export function calculateWeeklySpendingVelocity(params: {
  transactions: Array<{
    amount: number;
    type?: string;
    occurredAt?: string | number | Date | null;
    date?: string;
    kind?: string;
  }>;
  currentDate?: Date;
}): WeeklySpendingVelocity {
  const now = params.currentDate ? new Date(params.currentDate) : new Date();
  const msDay = 86400000;
  const startLast7 = new Date(now.getTime() - 7 * msDay);
  const startPrev7 = new Date(now.getTime() - 14 * msDay);

  let last7Total = 0;
  let prev7Total = 0;

  for (const tx of params.transactions) {
    if (tx.kind === "invoice_settlement") continue;
    if (tx.type === "receita" || tx.type === "in") continue;

    const txDate = tx.occurredAt
      ? new Date(tx.occurredAt)
      : tx.date
      ? new Date(tx.date)
      : null;

    if (!txDate || Number.isNaN(txDate.getTime())) continue;

    if (txDate >= startLast7 && txDate <= now) {
      last7Total += tx.amount || 0;
    } else if (txDate >= startPrev7 && txDate < startLast7) {
      prev7Total += tx.amount || 0;
    }
  }

  let differencePercent = 0;
  if (prev7Total > 0) {
    differencePercent = Math.round(((last7Total - prev7Total) / prev7Total) * 100);
  }

  let trend: WeeklySpendingVelocity["trend"] = "controlled";
  let headline = `Ritmo equilibrado nos últimos 7 dias (R$ ${last7Total.toFixed(2)})`;

  if (differencePercent > 20) {
    trend = "accelerated";
    headline = `Gastos aceleraram +${differencePercent}% nesta semana`;
  } else if (differencePercent < -15) {
    trend = "reduced";
    headline = `Economia de ${Math.abs(differencePercent)}% vs semana anterior!`;
  }

  return {
    last7DaysTotal: Math.round(last7Total * 100) / 100,
    previous7DaysTotal: Math.round(prev7Total * 100) / 100,
    differencePercent,
    trend,
    headline,
  };
}
