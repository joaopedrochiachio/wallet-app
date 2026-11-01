import { db } from "../firebase.ts";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import type { PurchaseSimulationResult } from "./financialContextService.ts";

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  modelUsed?: string;
  simulationResult?: PurchaseSimulationResult | null;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
}

const LOCAL_STORAGE_PREFIX = "wallet_ai_chat_history_";
const CHAT_SESSIONS_PREFIX = "wallet_ai_chat_sessions_";
const DIAGNOSIS_KEY = "wallet_ai_diagnosis";
const DIAGNOSIS_TIMESTAMP_KEY = "wallet_ai_diagnosis_timestamp";
const DIAGNOSIS_MODEL_KEY = "wallet_ai_model";

interface CachedDiagnosis {
  diagnosis: unknown;
  timestamp: string | null;
  modelUsed?: string;
  persona?: string;
  aiTone?: string;
}

// Conteúdo financeiro sensível permanece apenas em memória no navegador.
// A persistência durável de usuários autenticados acontece exclusivamente no Firestore.
const memoryChatHistory = new Map<string, StoredChatMessage[]>();
const memoryChatSessions = new Map<string, ChatSession[]>();
const memoryDiagnoses = new Map<string, CachedDiagnosis>();

function getMemoryKey(userId?: string | null): string {
  return userId || "guest";
}

function getStorageKey(userId?: string | null): string {
  return `${LOCAL_STORAGE_PREFIX}${userId || "guest"}`;
}

function getSessionsStorageKey(userId?: string | null): string {
  return `${CHAT_SESSIONS_PREFIX}${userId || "guest"}`;
}

function purgeLegacySensitiveStorage(userId?: string | null): void {
  if (typeof window === "undefined") return;
  const diagnosisKey = getDiagnosisStorageKey(userId);
  const keys = [
    getStorageKey(userId),
    getSessionsStorageKey(userId),
    diagnosisKey,
    `${diagnosisKey}_timestamp`,
    `${diagnosisKey}_model`,
    `${diagnosisKey}_persona`,
    `${diagnosisKey}_aiTone`,
    DIAGNOSIS_KEY,
    DIAGNOSIS_TIMESTAMP_KEY,
    DIAGNOSIS_MODEL_KEY,
    "wallet_ai_diagnosis_persona",
    "wallet_ai_diagnosis_aiTone",
  ];
  try {
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // A remoção é uma migração defensiva; o armazenamento pode estar indisponível.
  }
}

/**
 * Carrega o histórico do Firestore com fallback apenas para memória da aba.
 */
export async function loadChatHistory(userId?: string | null): Promise<StoredChatMessage[]> {
  const memoryKey = getMemoryKey(userId);
  purgeLegacySensitiveStorage(userId);

  // 1. Tenta carregar do Firestore se usuário estiver logado
  if (userId) {
    try {
      const historyDocRef = doc(db, "users", userId, "ai_chat", "history");
      const snapshot = await getDoc(historyDocRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data?.messages)) {
          const messages = data.messages as StoredChatMessage[];
          memoryChatHistory.set(memoryKey, messages);
          return messages;
        }
      }
    } catch (err) {
      console.warn("Aviso ao carregar histórico do chat do Firestore, recorrendo à memória:", err);
    }
  }

  return memoryChatHistory.get(memoryKey) ?? [];
}

/**
 * Salva a lista completa de mensagens do chat
 */
export async function saveChatHistory(
  messages: StoredChatMessage[],
  userId?: string | null
): Promise<void> {
  // Mantém no máximo as 50 mensagens mais recentes para economia de espaço
  const trimmed = messages.slice(-50);
  memoryChatHistory.set(getMemoryKey(userId), trimmed);
  purgeLegacySensitiveStorage(userId);

  // 2. Sincroniza com Firestore se autenticado
  if (userId) {
    try {
      const historyDocRef = doc(db, "users", userId, "ai_chat", "history");
      await setDoc(
        historyDocRef,
        {
          messages: trimmed,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("Aviso ao salvar histórico do chat no Firestore:", err);
    }
  }
}

/**
 * Limpa todo o histórico de mensagens do chat
 */
export async function clearChatHistory(userId?: string | null): Promise<void> {
  memoryChatHistory.delete(getMemoryKey(userId));
  purgeLegacySensitiveStorage(userId);

  if (userId) {
    try {
      const historyDocRef = doc(db, "users", userId, "ai_chat", "history");
      await deleteDoc(historyDocRef);
    } catch (err) {
      console.warn("Falha ao excluir histórico do Firestore:", err);
    }
  }
}

/**
 * Cria uma nova sessão de conversa vazia
 */
export function createChatSession(initialTitle?: string): ChatSession {
  const now = new Date().toISOString();
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: initialTitle || "Nova Conversa",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

/**
 * Carrega a lista completa de sessões de chat salvas
 * (Com migração automática se o usuário possuir histórico anterior sem sessões)
 */
export async function loadChatSessions(userId?: string | null): Promise<ChatSession[]> {
  const memoryKey = getMemoryKey(userId);
  purgeLegacySensitiveStorage(userId);

  // 1. Tenta carregar do Firestore se autenticado
  if (userId) {
    try {
      const docRef = doc(db, "users", userId, "ai_chat", "sessions");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.sessions) && data.sessions.length > 0) {
          const sessions = data.sessions as ChatSession[];
          memoryChatSessions.set(memoryKey, sessions);
          return sessions;
        }
      }
    } catch (err) {
      console.warn("Aviso ao carregar sessões de chat do Firestore:", err);
    }
  }

  const cachedSessions = memoryChatSessions.get(memoryKey);
  if (cachedSessions && cachedSessions.length > 0) return cachedSessions;

  // 3. Migração automática: se não existem sessões, mas há histórico legado único, migra para a primeira sessão
  try {
    const legacyHistory = await loadChatHistory(userId);
    if (legacyHistory.length > 0) {
      const firstUserMsg = legacyHistory.find((m) => m.role === "user");
      const derivedTitle = firstUserMsg
        ? firstUserMsg.content.length > 35
          ? firstUserMsg.content.slice(0, 32) + "..."
          : firstUserMsg.content
        : "Conversa Anterior";

      const initialSession: ChatSession = {
        id: `chat_${Date.now()}`,
        title: derivedTitle,
        createdAt: legacyHistory[0]?.timestamp || new Date().toISOString(),
        updatedAt: legacyHistory[legacyHistory.length - 1]?.timestamp || new Date().toISOString(),
        messages: legacyHistory,
      };

      const migrated = [initialSession];
      await saveChatSessions(migrated, userId);
      return migrated;
    }
  } catch {
    // Silencioso em caso de falha de migração
  }

  return [];
}

/**
 * Salva a lista de sessões de chat
 */
export async function saveChatSessions(
  sessions: ChatSession[],
  userId?: string | null
): Promise<void> {
  // Mantém no máximo 30 conversas para economizar espaço
  const trimmed = sessions.slice(0, 30);
  memoryChatSessions.set(getMemoryKey(userId), trimmed);
  purgeLegacySensitiveStorage(userId);

  // 2. Se houver mensagens na sessão ativa, sincroniza também com o histórico legado
  if (trimmed.length > 0 && trimmed[0].messages.length > 0) {
    try {
      await saveChatHistory(trimmed[0].messages, userId);
    } catch {
      // Silencioso
    }
  }

  // 3. Salva no Firestore
  if (userId) {
    try {
      const docRef = doc(db, "users", userId, "ai_chat", "sessions");
      await setDoc(
        docRef,
        {
          sessions: trimmed,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("Falha ao salvar sessões no Firestore:", err);
    }
  }
}

/**
 * Remove uma sessão de conversa por ID
 */
export async function deleteChatSession(
  sessionId: string,
  userId?: string | null
): Promise<ChatSession[]> {
  const current = await loadChatSessions(userId);
  const updated = current.filter((s) => s.id !== sessionId);
  await saveChatSessions(updated, userId);
  return updated;
}

function getDiagnosisStorageKey(userId?: string | null): string {
  return `${DIAGNOSIS_KEY}_${userId || "guest"}`;
}

/**
 * Lê apenas o diagnóstico mantido em memória durante a aba atual.
 * Nenhum conteúdo financeiro é recuperado do armazenamento persistente do navegador.
 */
export function loadInitialDiagnosisSync(
  userId?: string | null
): {
  diagnosis: unknown;
  timestamp: string | null;
  modelUsed?: string;
  persona?: string;
  aiTone?: string;
} | null {
  purgeLegacySensitiveStorage(userId);
  return memoryDiagnoses.get(getMemoryKey(userId)) ?? null;
}

/**
 * Mantém o diagnóstico em memória e persiste no Firestore quando autenticado.
 */
export async function savePersistentDiagnosis(
  diagnosis: unknown,
  meta: {
    timestamp: string;
    modelUsed?: string;
    persona?: string;
    aiTone?: string;
  },
  userId?: string | null
): Promise<void> {
  // Sanitização profunda obrigatória: remove campos undefined que causam exceção no Firestore setDoc
  let cleanDiagnosis: unknown = diagnosis;
  try {
    cleanDiagnosis = JSON.parse(JSON.stringify(diagnosis));
  } catch {
    cleanDiagnosis = diagnosis;
  }

  memoryDiagnoses.set(getMemoryKey(userId), {
    diagnosis: cleanDiagnosis,
    timestamp: meta.timestamp,
    modelUsed: meta.modelUsed,
    persona: meta.persona,
    aiTone: meta.aiTone,
  });
  purgeLegacySensitiveStorage(userId);

  // 2. Persiste na nuvem do Cloud Firestore se logado
  if (userId) {
    try {
      const diagDocRef = doc(db, "users", userId, "ai_diagnosis", "latest");
      await setDoc(diagDocRef, {
        diagnosis: cleanDiagnosis,
        timestamp: meta.timestamp,
        modelUsed: meta.modelUsed || "gpt-6-luna",
        persona: meta.persona || "optimizer",
        aiTone: meta.aiTone || "analytical",
      });
    } catch (err) {
      console.warn("Falha ao persistir diagnóstico no Firestore:", err);
    }
  }
}

/**
 * Carrega o diagnóstico do Firestore com fallback apenas para memória da aba.
 */
export async function loadPersistentDiagnosis(
  userId?: string | null
): Promise<{
  diagnosis: unknown;
  timestamp: string | null;
  modelUsed?: string;
  persona?: string;
  aiTone?: string;
} | null> {
  // 1. Tenta carregar do Firestore se logado
  if (userId) {
    try {
      const diagDocRef = doc(db, "users", userId, "ai_diagnosis", "latest");
      const snap = await getDoc(diagDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data?.diagnosis) {
          const cachedDiagnosis = {
            diagnosis: data.diagnosis,
            timestamp: data.timestamp || null,
            modelUsed: data.modelUsed || undefined,
            persona: data.persona || undefined,
            aiTone: data.aiTone || undefined,
          };
          memoryDiagnoses.set(getMemoryKey(userId), cachedDiagnosis);
          purgeLegacySensitiveStorage(userId);
          return cachedDiagnosis;
        }
      }
    } catch (err) {
      console.warn("Falha ao obter diagnóstico do Firestore:", err);
    }
  }

  // 2. Fallback para cache volátil da aba
  return loadInitialDiagnosisSync(userId);
}

const DISMISSED_PATTERNS_PREFIX = "wallet_ai_dismissed_patterns_";

function getDismissedPatternsKey(userId?: string | null): string {
  return `${DISMISSED_PATTERNS_PREFIX}${userId || "guest"}`;
}

/**
 * Carrega a lista de padrões e hábitos descartados pelo usuário
 */
export function loadDismissedPatterns(userId?: string | null): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getDismissedPatternsKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
      }
    }
  } catch {
    // Silencioso
  }
  return [];
}

/**
 * Descarta um padrão pelo seu título/identificador para nunca mais ser sugerido
 */
export function dismissPattern(patternKey: string, userId?: string | null): string[] {
  if (typeof window === "undefined" || !patternKey) return [];
  const current = loadDismissedPatterns(userId);
  const normalized = patternKey.trim().toLowerCase();
  if (!current.includes(normalized)) {
    const updated = [...current, normalized];
    try {
      window.localStorage.setItem(getDismissedPatternsKey(userId), JSON.stringify(updated));
    } catch {
      // Silencioso
    }
    return updated;
  }
  return current;
}

/**
 * Remove da lista de descartados, permitindo que volte a ser analisado
 */
export function restorePattern(patternKey: string, userId?: string | null): string[] {
  if (typeof window === "undefined") return [];
  const current = loadDismissedPatterns(userId);
  const normalized = patternKey.trim().toLowerCase();
  const updated = current.filter((k) => k !== normalized);
  try {
    window.localStorage.setItem(getDismissedPatternsKey(userId), JSON.stringify(updated));
  } catch {
    // Silencioso
  }
  return updated;
}

/**
 * Limpa todos os padrões descartados
 */
export function clearDismissedPatterns(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getDismissedPatternsKey(userId));
  } catch {
    // Silencioso
  }
}

/**
 * Limpa caches voláteis e remove chaves legadas sensíveis do navegador.
 */
export function clearUserLocalCaches(userId?: string | null): void {
  const memoryKey = getMemoryKey(userId);
  memoryChatHistory.delete(memoryKey);
  memoryChatSessions.delete(memoryKey);
  memoryDiagnoses.delete(memoryKey);

  if (typeof window === "undefined") return;
  try {
    const keysToRemove = [
      DIAGNOSIS_KEY,
      DIAGNOSIS_TIMESTAMP_KEY,
      DIAGNOSIS_MODEL_KEY,
      "wallet_ai_diagnosis_persona",
      "wallet_ai_diagnosis_aiTone",
      "wallet_ai_needs_reanalysis",
      "wallet_ai_pending_persona",
    ];

    if (userId) {
      const userKey = getDiagnosisStorageKey(userId);
      keysToRemove.push(
        userKey,
        `${userKey}_timestamp`,
        `${userKey}_model`,
        `${userKey}_persona`,
        `${userKey}_aiTone`,
        getStorageKey(userId),
        getSessionsStorageKey(userId),
        getDismissedPatternsKey(userId),
        `wallet_ai_needs_reanalysis_${userId}`,
        `wallet_ai_pending_persona_${userId}`
      );
    }

    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch (err) {
    console.warn("Erro ao limpar caches locais do usuário:", err);
  }
}
