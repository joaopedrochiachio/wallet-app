import { getAdminFirestore } from "../firebaseAdmin.ts";
import { checkRateLimit } from "../utils/rateLimiter.ts";

/**
 * Serviço de Controle de Quotas, Reservas Atômicas e Observabilidade de Custo
 * Implementa limites persistentes e transacionais (Firebase Admin SDK Firestore)
 * com proteção estrita de concorrência e fail-closed por segurança orçamentária.
 * 
 * Fuso horário de referência para virada de dia e mês: America/Sao_Paulo.
 */

export type AIRouteName = "chat" | "analyze" | "patterns";

export interface AIQuotaConfig {
  daily: {
    chat: number;
    analyze: number;
    patterns: number;
  };
  monthly: {
    chat: number;
    analyze: number;
    patterns: number;
  };
  userMonthlyCostCeilingUsd: number;
  globalMonthlyCostCeilingUsd: number;
  perMinuteRateLimit: {
    chat: number;
    analyze: number;
    patterns: number;
  };
}

export const DEFAULT_AI_QUOTAS: AIQuotaConfig = {
  daily: {
    chat: 15,
    analyze: 2,
    patterns: 4,
  },
  monthly: {
    chat: 150,
    analyze: 10,
    patterns: 20,
  },
  userMonthlyCostCeilingUsd: 0.75, // US$ 0,75 por usuário por mês
  globalMonthlyCostCeilingUsd: 4.50, // US$ 4,50 compartilhado globalmente entre todos os usuários
  perMinuteRateLimit: {
    chat: 15,
    analyze: 5,
    patterns: 10,
  },
};

/**
 * Obtém a data e o mês correspondentes no fuso horário America/Sao_Paulo.
 */
export function getSaoPauloDateKeys(date: Date = new Date()): { dayKey: string; monthKey: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayKey = formatter.format(date); // "YYYY-MM-DD"
  const monthKey = dayKey.slice(0, 7); // "YYYY-MM"
  return { dayKey, monthKey };
}

/**
 * Custo padrão estimado reservado provisoriamente por requisição antes da resposta da API.
 */
const RESERVED_COST_ESTIMATE_PER_REQUEST: Record<AIRouteName, number> = {
  chat: 0.001, // ~US$ 0,0010
  analyze: 0.0025, // ~US$ 0,0025
  patterns: 0.0015, // ~US$ 0,0015
};

// Tempo de expiração de reservas pendentes abandonadas (5 minutos)
const ABANDONED_RESERVATION_TIMEOUT_MS = 5 * 60 * 1000;

export interface QuotaReservation {
  reservationId: string;
  uid: string;
  route: AIRouteName;
  dayKey: string;
  monthKey: string;
  reservedCostUsd: number;
  timestamp: number;
}

export interface ReservationResult {
  allowed: boolean;
  reservation?: QuotaReservation;
  error?: string;
  errorCode?: string;
  retryAfterSec?: number;
  limits?: {
    dailyRemaining: number;
    monthlyRemaining: number;
    userCostRemainingUsd: number;
    globalCostRemainingUsd: number;
  };
}

export interface PendingReservationRecord {
  route: AIRouteName;
  reservedCostUsd: number;
  timestamp: number;
}

export interface ReconciledReservationRecord {
  reconciledAt: string;
  success: boolean;
  actualCostUsd?: number;
}

export interface UserUsageData {
  days: Record<
    string,
    {
      chatCount: number;
      analyzeCount: number;
      patternsCount: number;
    }
  >;
  monthly: {
    chatCount: number;
    analyzeCount: number;
    patternsCount: number;
    estimatedCostUsd: number;
  };
  pendingReservations: Record<string, PendingReservationRecord>;
  reconciledReservations?: Record<string, ReconciledReservationRecord>;
  updatedAt: string;
}

export interface GlobalUsageData {
  estimatedCostUsd: number;
  pendingReservedCostUsd: number;
  totalRequests: number;
  updatedAt: string;
}

export interface AICallLogEntry {
  requestId: string;
  uid: string;
  route: AIRouteName;
  model: string;
  timestamp: string;
  durationMs: number;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: number;
  isCostEstimated: boolean;
  errorCode?: string;
}

// Controle de modo de teste para injeção explícita
let useMemoryStoreForTesting = false;

export function setUseMemoryStoreForTesting(enabled: boolean): void {
  useMemoryStoreForTesting = enabled;
}

export function isUsingMemoryStoreForTesting(): boolean {
  return useMemoryStoreForTesting;
}

// Armazém em memória exclusivo para testes unitários com injeção explícita
const memoryStore = {
  userUsage: new Map<string, UserUsageData>(),
  globalUsage: new Map<string, GlobalUsageData>(),
  logs: [] as AICallLogEntry[],
};

export function clearMemoryUsageStore(): void {
  memoryStore.userUsage.clear();
  memoryStore.globalUsage.clear();
  memoryStore.logs = [];
}

/**
 * Remove reservas pendentes antigas que foram abandonadas (ex: timeout de rede ou crash de processo)
 * e devolve o montante ao teto global pendente.
 */
function cleanupExpiredReservations(
  userData: UserUsageData,
  globalData: GlobalUsageData,
  now: number
): void {
  if (!userData.pendingReservations) return;

  let expiredCostTotal = 0;
  for (const [resId, res] of Object.entries(userData.pendingReservations)) {
    if (res.timestamp && now - res.timestamp > ABANDONED_RESERVATION_TIMEOUT_MS) {
      expiredCostTotal += res.reservedCostUsd || 0;
      delete userData.pendingReservations[resId];
    }
  }

  if (expiredCostTotal > 0) {
    globalData.pendingReservedCostUsd = Math.max(
      0,
      Number(((globalData.pendingReservedCostUsd || 0) - expiredCostTotal).toFixed(6))
    );
  }
}

/**
 * Limita o histórico de reservas reconciliadas para evitar crescimento indefinido do documento.
 */
function pruneReconciledReservations(userData: UserUsageData, maxKeep = 100): void {
  if (!userData.reconciledReservations) return;
  const entries = Object.entries(userData.reconciledReservations);
  if (entries.length > maxKeep) {
    // Mantém as mais recentes
    const pruned = Object.fromEntries(entries.slice(entries.length - maxKeep));
    userData.reconciledReservations = pruned;
  }
}

/**
 * Reserva atômica de cota antes de enviar a requisição à OpenAI.
 * Bloqueia se atingir o limite diário, mensal, teto do usuário ou teto global.
 * 
 * Regra de Segurança: Falha de forma FECHADA em produção. Se o Firestore Admin SDK
 * não puder concluir a transação, a chamada à OpenAI é imediatamente bloqueada.
 */
export async function reserveAIQuota(params: {
  uid: string;
  route: AIRouteName;
  date?: Date;
  config?: AIQuotaConfig;
}): Promise<ReservationResult> {
  const { uid, route } = params;
  const config = params.config ?? DEFAULT_AI_QUOTAS;
  const { dayKey, monthKey } = getSaoPauloDateKeys(params.date);

  // 1. Verificação de limite por minuto (anti-abuso / DoS deslizante)
  const minuteLimit = config.perMinuteRateLimit[route] || 10;
  const rateLimitResult = checkRateLimit(`ai-quota-minute:${route}:${uid}`, minuteLimit, 60000);
  if (!rateLimitResult.allowed) {
    return {
      allowed: false,
      errorCode: "RATE_LIMIT_EXCEEDED",
      error: `Muitas solicitações em sequência. Aguarde ${rateLimitResult.retryAfterSec} segundos antes de tentar novamente.`,
      retryAfterSec: rateLimitResult.retryAfterSec,
    };
  }

  const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const reservedCost = RESERVED_COST_ESTIMATE_PER_REQUEST[route];
  const now = Date.now();

  // 2. Transação Persistente via Firebase Admin SDK no servidor (Produção padrão)
  if (!useMemoryStoreForTesting) {
    try {
      const adminFirestore = getAdminFirestore();
      const userDocRef = adminFirestore.collection("users").doc(uid).collection("ai_usage").doc(monthKey);
      const globalDocRef = adminFirestore.collection("app_limits").doc(`ai_global_monthly_${monthKey}`);

      return await adminFirestore.runTransaction(async (tx) => {
        const userSnap = await tx.get(userDocRef);
        const globalSnap = await tx.get(globalDocRef);

        const userData: UserUsageData = (userSnap.data() as UserUsageData) || {
          days: {},
          monthly: { chatCount: 0, analyzeCount: 0, patternsCount: 0, estimatedCostUsd: 0 },
          pendingReservations: {},
          reconciledReservations: {},
          updatedAt: new Date().toISOString(),
        };

        const globalData: GlobalUsageData = (globalSnap.data() as GlobalUsageData) || {
          estimatedCostUsd: 0,
          pendingReservedCostUsd: 0,
          totalRequests: 0,
          updatedAt: new Date().toISOString(),
        };

        // Recupera reservas abandonadas por timeout antes de calcular cotas
        cleanupExpiredReservations(userData, globalData, now);

        // Calcula pendências atuais do usuário
        let userPendingChat = 0;
        let userPendingAnalyze = 0;
        let userPendingPatterns = 0;
        let userPendingCost = 0;

        for (const res of Object.values(userData.pendingReservations || {})) {
          if (res.route === "chat") userPendingChat += 1;
          if (res.route === "analyze") userPendingAnalyze += 1;
          if (res.route === "patterns") userPendingPatterns += 1;
          userPendingCost += res.reservedCostUsd || 0;
        }

        const dayRecord = userData.days[dayKey] || { chatCount: 0, analyzeCount: 0, patternsCount: 0 };

        // Verifica Limite Diário
        const dailyCurrent =
          (dayRecord[`${route}Count` as keyof typeof dayRecord] || 0) +
          (route === "chat" ? userPendingChat : route === "analyze" ? userPendingAnalyze : userPendingPatterns);
        const dailyLimit = config.daily[route];

        if (dailyCurrent >= dailyLimit) {
          return {
            allowed: false,
            errorCode: "DAILY_LIMIT_EXCEEDED",
            error: `Limite diário atingido para ${route === "chat" ? "mensagens" : route === "analyze" ? "diagnósticos" : "padrões"} (${dailyLimit}/dia). As cotas renovam à meia-noite (horário de Brasília).`,
          };
        }

        // Verifica Limite Mensal do Usuário
        const monthlyCurrent =
          (userData.monthly[`${route}Count` as keyof typeof userData.monthly] || 0) +
          (route === "chat" ? userPendingChat : route === "analyze" ? userPendingAnalyze : userPendingPatterns);
        const monthlyLimit = config.monthly[route];

        if (monthlyCurrent >= monthlyLimit) {
          return {
            allowed: false,
            errorCode: "MONTHLY_LIMIT_EXCEEDED",
            error: `Limite mensal de ${route === "chat" ? "mensagens" : route === "analyze" ? "diagnósticos" : "padrões"} atingido para sua conta (${monthlyLimit}/mês).`,
          };
        }

        // Verifica Teto de Custo Mensal do Usuário
        const userEstimatedCost = userData.monthly.estimatedCostUsd + userPendingCost;
        if (userEstimatedCost + reservedCost > config.userMonthlyCostCeilingUsd) {
          return {
            allowed: false,
            errorCode: "USER_COST_CEILING_EXCEEDED",
            error: `Teto estimado de uso individual de IA atingido neste mês (máximo de US$ ${config.userMonthlyCostCeilingUsd.toFixed(2)}).`,
          };
        }

        // Verifica Teto de Custo Mensal Global do Aplicativo
        const globalEstimatedCost = globalData.estimatedCostUsd + (globalData.pendingReservedCostUsd || 0);
        if (globalEstimatedCost + reservedCost > config.globalMonthlyCostCeilingUsd) {
          return {
            allowed: false,
            errorCode: "GLOBAL_APP_LIMIT_EXCEEDED",
            error: "O limite global de consumo de IA do aplicativo para este mês foi alcançado. Novas consultas com IA estão temporariamente suspensas.",
          };
        }

        // Realiza a Reserva Atômica
        if (!userData.pendingReservations) userData.pendingReservations = {};
        userData.pendingReservations[reservationId] = {
          route,
          reservedCostUsd: reservedCost,
          timestamp: now,
        };
        userData.updatedAt = new Date().toISOString();

        globalData.pendingReservedCostUsd = Number(((globalData.pendingReservedCostUsd || 0) + reservedCost).toFixed(6));
        globalData.updatedAt = new Date().toISOString();

        tx.set(userDocRef, userData, { merge: true });
        tx.set(globalDocRef, globalData, { merge: true });

        return {
          allowed: true,
          reservation: {
            reservationId,
            uid,
            route,
            dayKey,
            monthKey,
            reservedCostUsd: reservedCost,
            timestamp: now,
          },
          limits: {
            dailyRemaining: Math.max(0, dailyLimit - dailyCurrent - 1),
            monthlyRemaining: Math.max(0, monthlyLimit - monthlyCurrent - 1),
            userCostRemainingUsd: Math.max(0, config.userMonthlyCostCeilingUsd - userEstimatedCost - reservedCost),
            globalCostRemainingUsd: Math.max(0, config.globalMonthlyCostCeilingUsd - globalEstimatedCost - reservedCost),
          },
        };
      });
    } catch (err: unknown) {
      console.error("[FIRESTORE_ADMIN_QUOTA_TRANSACTION_FAILED] Bloqueando requisição por falha fechada:", err);
      // FAIL-CLOSED: NUNCA cai silenciosamente para memória em produção!
      return {
        allowed: false,
        errorCode: "QUOTA_SERVICE_UNAVAILABLE",
        error: "Serviço de controle de cotas temporariamente indisponível. Acesso bloqueado por segurança orçamentária.",
      };
    }
  }

  // 3. Motor Atômico em Memória (EXCLUSIVO para testes automatizados com injeção explícita)
  const userKey = `${uid}:${monthKey}`;
  let userData = memoryStore.userUsage.get(userKey);
  if (!userData) {
    userData = {
      days: {},
      monthly: { chatCount: 0, analyzeCount: 0, patternsCount: 0, estimatedCostUsd: 0 },
      pendingReservations: {},
      reconciledReservations: {},
      updatedAt: new Date().toISOString(),
    };
    memoryStore.userUsage.set(userKey, userData);
  }

  let globalData = memoryStore.globalUsage.get(monthKey);
  if (!globalData) {
    globalData = {
      estimatedCostUsd: 0,
      pendingReservedCostUsd: 0,
      totalRequests: 0,
      updatedAt: new Date().toISOString(),
    };
    memoryStore.globalUsage.set(monthKey, globalData);
  }

  cleanupExpiredReservations(userData, globalData, now);

  let userPendingChat = 0;
  let userPendingAnalyze = 0;
  let userPendingPatterns = 0;
  let userPendingCost = 0;

  for (const res of Object.values(userData.pendingReservations || {})) {
    if (res.route === "chat") userPendingChat += 1;
    if (res.route === "analyze") userPendingAnalyze += 1;
    if (res.route === "patterns") userPendingPatterns += 1;
    userPendingCost += res.reservedCostUsd || 0;
  }

  const dayRecord = userData.days[dayKey] || { chatCount: 0, analyzeCount: 0, patternsCount: 0 };
  const dailyCurrent =
    (dayRecord[`${route}Count` as keyof typeof dayRecord] || 0) +
    (route === "chat" ? userPendingChat : route === "analyze" ? userPendingAnalyze : userPendingPatterns);
  const dailyLimit = config.daily[route];

  if (dailyCurrent >= dailyLimit) {
    return {
      allowed: false,
      errorCode: "DAILY_LIMIT_EXCEEDED",
      error: `Limite diário atingido para ${route === "chat" ? "mensagens" : route === "analyze" ? "diagnósticos" : "padrões"} (${dailyLimit}/dia). As cotas renovam à meia-noite (horário de Brasília).`,
    };
  }

  const monthlyCurrent =
    (userData.monthly[`${route}Count` as keyof typeof userData.monthly] || 0) +
    (route === "chat" ? userPendingChat : route === "analyze" ? userPendingAnalyze : userPendingPatterns);
  const monthlyLimit = config.monthly[route];

  if (monthlyCurrent >= monthlyLimit) {
    return {
      allowed: false,
      errorCode: "MONTHLY_LIMIT_EXCEEDED",
      error: `Limite mensal de ${route === "chat" ? "mensagens" : route === "analyze" ? "diagnósticos" : "padrões"} atingido para sua conta (${monthlyLimit}/mês).`,
    };
  }

  const userEstimatedCost = userData.monthly.estimatedCostUsd + userPendingCost;
  if (userEstimatedCost + reservedCost > config.userMonthlyCostCeilingUsd) {
    return {
      allowed: false,
      errorCode: "USER_COST_CEILING_EXCEEDED",
      error: `Teto estimado de uso individual de IA atingido neste mês (máximo de US$ ${config.userMonthlyCostCeilingUsd.toFixed(2)}).`,
    };
  }

  const globalEstimatedCost = globalData.estimatedCostUsd + (globalData.pendingReservedCostUsd || 0);
  if (globalEstimatedCost + reservedCost > config.globalMonthlyCostCeilingUsd) {
    return {
      allowed: false,
      errorCode: "GLOBAL_APP_LIMIT_EXCEEDED",
      error: "O limite global de consumo de IA do aplicativo para este mês foi alcançado. Novas consultas com IA estão temporariamente suspensas.",
    };
  }

  if (!userData.pendingReservations) userData.pendingReservations = {};
  userData.pendingReservations[reservationId] = {
    route,
    reservedCostUsd: reservedCost,
    timestamp: now,
  };
  userData.updatedAt = new Date().toISOString();

  globalData.pendingReservedCostUsd = Number(((globalData.pendingReservedCostUsd || 0) + reservedCost).toFixed(6));
  globalData.updatedAt = new Date().toISOString();

  return {
    allowed: true,
    reservation: {
      reservationId,
      uid,
      route,
      dayKey,
      monthKey,
      reservedCostUsd: reservedCost,
      timestamp: now,
    },
    limits: {
      dailyRemaining: Math.max(0, dailyLimit - dailyCurrent - 1),
      monthlyRemaining: Math.max(0, monthlyLimit - monthlyCurrent - 1),
      userCostRemainingUsd: Math.max(0, config.userMonthlyCostCeilingUsd - userEstimatedCost - reservedCost),
      globalCostRemainingUsd: Math.max(0, config.globalMonthlyCostCeilingUsd - globalEstimatedCost - reservedCost),
    },
  };
}

/**
 * Reconciliação atômica e IDEMPOTENTE da cota após o retorno da resposta da OpenAI.
 * Libera a reserva e efetiva o consumo com base nos tokens reais apurados.
 * Uma segunda chamada com a mesma reserva NÃO incrementa contadores nem subtrai a reserva novamente.
 */
export async function reconcileAIQuota(params: {
  reservation: QuotaReservation;
  success: boolean;
  actualCostUsd?: number;
}): Promise<void> {
  const { reservation, success, actualCostUsd = 0 } = params;
  const { uid, route, dayKey, monthKey, reservationId, reservedCostUsd } = reservation;

  if (!useMemoryStoreForTesting) {
    try {
      const adminFirestore = getAdminFirestore();
      const userDocRef = adminFirestore.collection("users").doc(uid).collection("ai_usage").doc(monthKey);
      const globalDocRef = adminFirestore.collection("app_limits").doc(`ai_global_monthly_${monthKey}`);

      await adminFirestore.runTransaction(async (tx) => {
        const userSnap = await tx.get(userDocRef);
        const globalSnap = await tx.get(globalDocRef);

        const userData: UserUsageData = (userSnap.data() as UserUsageData) || {
          days: {},
          monthly: { chatCount: 0, analyzeCount: 0, patternsCount: 0, estimatedCostUsd: 0 },
          pendingReservations: {},
          reconciledReservations: {},
          updatedAt: new Date().toISOString(),
        };

        const globalData: GlobalUsageData = (globalSnap.data() as GlobalUsageData) || {
          estimatedCostUsd: 0,
          pendingReservedCostUsd: 0,
          totalRequests: 0,
          updatedAt: new Date().toISOString(),
        };

        // 1. IDEMPOTÊNCIA: Se a reserva já foi reconciliada anteriormente, encerra sem alterações
        if (userData.reconciledReservations && userData.reconciledReservations[reservationId]) {
          return;
        }

        // 2. Libera a reserva pendente
        const wasPending = userData.pendingReservations && userData.pendingReservations[reservationId];
        if (wasPending) {
          delete userData.pendingReservations[reservationId];
        }

        globalData.pendingReservedCostUsd = Math.max(
          0,
          Number(((globalData.pendingReservedCostUsd || 0) - reservedCostUsd).toFixed(6))
        );

        // 3. Marca a reserva como reconciliada
        if (!userData.reconciledReservations) userData.reconciledReservations = {};
        userData.reconciledReservations[reservationId] = {
          reconciledAt: new Date().toISOString(),
          success,
          actualCostUsd,
        };
        pruneReconciledReservations(userData);

        // 4. Se a chamada foi bem sucedida, incrementa contadores definitivos
        if (success) {
          if (!userData.days[dayKey]) {
            userData.days[dayKey] = { chatCount: 0, analyzeCount: 0, patternsCount: 0 };
          }
          userData.days[dayKey][`${route}Count`] += 1;
          userData.monthly[`${route}Count`] += 1;
          userData.monthly.estimatedCostUsd = Number(
            (userData.monthly.estimatedCostUsd + actualCostUsd).toFixed(6)
          );

          globalData.estimatedCostUsd = Number(
            (globalData.estimatedCostUsd + actualCostUsd).toFixed(6)
          );
          globalData.totalRequests += 1;
        }

        userData.updatedAt = new Date().toISOString();
        globalData.updatedAt = new Date().toISOString();

        tx.set(userDocRef, userData, { merge: true });
        tx.set(globalDocRef, globalData, { merge: true });
      });

      return;
    } catch (err: unknown) {
      console.error("[FIRESTORE_ADMIN_RECONCILIATION_FAILED]", err);
      return;
    }
  }

  // Reconciliação no motor em memória (testes)
  const userKey = `${uid}:${monthKey}`;
  const userData = memoryStore.userUsage.get(userKey);
  const globalData = memoryStore.globalUsage.get(monthKey);

  if (!userData || !globalData) return;

  // Idempotência
  if (userData.reconciledReservations && userData.reconciledReservations[reservationId]) {
    return;
  }

  if (userData.pendingReservations && userData.pendingReservations[reservationId]) {
    delete userData.pendingReservations[reservationId];
  }

  globalData.pendingReservedCostUsd = Math.max(
    0,
    Number(((globalData.pendingReservedCostUsd || 0) - reservedCostUsd).toFixed(6))
  );

  if (!userData.reconciledReservations) userData.reconciledReservations = {};
  userData.reconciledReservations[reservationId] = {
    reconciledAt: new Date().toISOString(),
    success,
    actualCostUsd,
  };
  pruneReconciledReservations(userData);

  if (success) {
    if (!userData.days[dayKey]) {
      userData.days[dayKey] = { chatCount: 0, analyzeCount: 0, patternsCount: 0 };
    }
    userData.days[dayKey][`${route}Count`] += 1;
    userData.monthly[`${route}Count`] += 1;
    userData.monthly.estimatedCostUsd = Number(
      (userData.monthly.estimatedCostUsd + actualCostUsd).toFixed(6)
    );

    globalData.estimatedCostUsd = Number(
      (globalData.estimatedCostUsd + actualCostUsd).toFixed(6)
    );
    globalData.totalRequests += 1;
  }
}

/**
 * Registra chamada de IA para observabilidade de custo e auditoria técnica.
 * NUNCA armazena conteúdo financeiro, dados do usuário ou prompts.
 */
export async function recordAICallLog(logEntry: AICallLogEntry): Promise<void> {
  if (useMemoryStoreForTesting) {
    memoryStore.logs.push(logEntry);
    return;
  }

  try {
    const adminFirestore = getAdminFirestore();
    const monthKey = logEntry.timestamp.slice(0, 7);
    const logDocRef = adminFirestore
      .collection("users")
      .doc(logEntry.uid)
      .collection("ai_logs")
      .doc(`${monthKey}_${logEntry.requestId}`);

    await logDocRef.set({ ...logEntry }, { merge: true });
  } catch (err: unknown) {
    console.warn("[RECORD_AI_LOG_WARNING] Falha ao persistir log no Firestore Admin:", err);
  }
}

/**
 * Consulta Administrativa e do Usuário sobre consumo de IA.
 * Usuário comum visualiza apenas seus dados.
 * Administrador pode consultar totais globais e de qualquer usuário.
 */
export async function getAIUsageSummary(params: {
  targetUid?: string;
  monthKey?: string;
  isAdmin?: boolean;
}): Promise<{
  monthKey: string;
  userUsage?: UserUsageData;
  globalUsage?: GlobalUsageData;
  limits: AIQuotaConfig;
}> {
  const { monthKey = getSaoPauloDateKeys().monthKey, targetUid, isAdmin = false } = params;

  let userUsage: UserUsageData | undefined = undefined;
  let globalUsage: GlobalUsageData | undefined = undefined;

  if (useMemoryStoreForTesting) {
    if (targetUid) {
      userUsage = memoryStore.userUsage.get(`${targetUid}:${monthKey}`) || {
        days: {},
        monthly: { chatCount: 0, analyzeCount: 0, patternsCount: 0, estimatedCostUsd: 0 },
        pendingReservations: {},
        updatedAt: new Date().toISOString(),
      };
    }
    if (isAdmin) {
      globalUsage = memoryStore.globalUsage.get(monthKey) || {
        estimatedCostUsd: 0,
        pendingReservedCostUsd: 0,
        totalRequests: 0,
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      monthKey,
      userUsage,
      globalUsage,
      limits: DEFAULT_AI_QUOTAS,
    };
  }

  // Modo Persistente com Firebase Admin SDK
  try {
    const adminFirestore = getAdminFirestore();

    if (targetUid) {
      const userSnap = await adminFirestore
        .collection("users")
        .doc(targetUid)
        .collection("ai_usage")
        .doc(monthKey)
        .get();

      if (userSnap.exists) {
        userUsage = userSnap.data() as UserUsageData;
      } else {
        userUsage = {
          days: {},
          monthly: { chatCount: 0, analyzeCount: 0, patternsCount: 0, estimatedCostUsd: 0 },
          pendingReservations: {},
          updatedAt: new Date().toISOString(),
        };
      }
    }

    if (isAdmin) {
      const globalSnap = await adminFirestore
        .collection("app_limits")
        .doc(`ai_global_monthly_${monthKey}`)
        .get();

      if (globalSnap.exists) {
        globalUsage = globalSnap.data() as GlobalUsageData;
      } else {
        globalUsage = {
          estimatedCostUsd: 0,
          pendingReservedCostUsd: 0,
          totalRequests: 0,
          updatedAt: new Date().toISOString(),
        };
      }
    }
  } catch (err: unknown) {
    console.error("[GET_AI_USAGE_SUMMARY_ERROR]", err);
  }

  return {
    monthKey,
    userUsage,
    globalUsage,
    limits: DEFAULT_AI_QUOTAS,
  };
}
