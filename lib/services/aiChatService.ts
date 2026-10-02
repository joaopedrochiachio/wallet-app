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

function getStorageKey(userId?: string | null): string {
  return `${LOCAL_STORAGE_PREFIX}${userId || "guest"}`;
}

function getSessionsStorageKey(userId?: string | null): string {
  return `${CHAT_SESSIONS_PREFIX}${userId || "guest"}`;
}

/**
 * Carrega o histórico de mensagens do chat salvo (do Firestore com fallback para localStorage)
 */
export async function loadChatHistory(userId?: string | null): Promise<StoredChatMessage[]> {
  const localKey = getStorageKey(userId);

  // 1. Tenta carregar do Firestore se usuário estiver logado
  if (userId) {
    try {
      const historyDocRef = doc(db, "users", userId, "ai_chat", "history");
      const snapshot = await getDoc(historyDocRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data?.messages)) {
          // Atualiza também o cache local
          try {
            window.localStorage.setItem(localKey, JSON.stringify(data.messages));
          } catch {
            // Silencioso em caso de quota
          }
          return data.messages as StoredChatMessage[];
        }
      }
    } catch (err) {
      console.warn("Aviso ao carregar histórico do chat do Firestore, recorrendo ao cache local:", err);
    }
  }

  // 2. Fallback para localStorage
  try {
    const raw = window.localStorage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as StoredChatMessage[];
      }
    }
  } catch (err) {
    console.warn("Falha ao recuperar histórico local do chat:", err);
  }

  return [];
}

/**
 * Salva a lista completa de mensagens do chat
 */
export async function saveChatHistory(
  messages: StoredChatMessage[],
  userId?: string | null
): Promise<void> {
  const localKey = getStorageKey(userId);

  // Mantém no máximo as 50 mensagens mais recentes para economia de espaço
  const trimmed = messages.slice(-50);

  // 1. Salva imediatamente no localStorage
  try {
    window.localStorage.setItem(localKey, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Falha ao salvar chat no localStorage:", err);
  }

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
  const localKey = getStorageKey(userId);

  try {
    window.localStorage.removeItem(localKey);
  } catch {
    // Silencioso
  }

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
  const sessionsKey = getSessionsStorageKey(userId);

  // 1. Tenta carregar do Firestore se autenticado
  if (userId) {
    try {
      const docRef = doc(db, "users", userId, "ai_chat", "sessions");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.sessions) && data.sessions.length > 0) {
          try {
            window.localStorage.setItem(sessionsKey, JSON.stringify(data.sessions));
          } catch {
            // Silencioso
          }
          return data.sessions as ChatSession[];
        }
      }
    } catch (err) {
      console.warn("Aviso ao carregar sessões de chat do Firestore:", err);
    }
  }

  // 2. Tenta carregar do localStorage
  try {
    const raw = window.localStorage.getItem(sessionsKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as ChatSession[];
      }
    }
  } catch (err) {
    console.warn("Falha ao ler sessões do localStorage:", err);
  }

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
  const sessionsKey = getSessionsStorageKey(userId);

  // Mantém no máximo 30 conversas para economizar espaço
  const trimmed = sessions.slice(0, 30);

  // 1. Salva localmente
  try {
    window.localStorage.setItem(sessionsKey, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Falha ao salvar sessões no localStorage:", err);
  }

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
 * Lê o diagnóstico salvo do localStorage de forma instantânea e síncrona
 * Usado para inicializar o estado no primeiro render sem "piscar" tela vazia
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
  if (typeof window === "undefined") return null;

  try {
    const userKey = getDiagnosisStorageKey(userId);
    let raw = window.localStorage.getItem(userKey);
    let timestamp = window.localStorage.getItem(`${userKey}_timestamp`);
    let modelUsed = window.localStorage.getItem(`${userKey}_model`) || undefined;
    let persona = window.localStorage.getItem(`${userKey}_persona`) || undefined;
    let aiTone = window.localStorage.getItem(`${userKey}_aiTone`) || undefined;

    // Fallback para chave geral caso não encontre por usuário
    if (!raw) {
      raw = window.localStorage.getItem(DIAGNOSIS_KEY);
      timestamp = window.localStorage.getItem(DIAGNOSIS_TIMESTAMP_KEY);
      modelUsed = window.localStorage.getItem(DIAGNOSIS_MODEL_KEY) || undefined;
      persona = window.localStorage.getItem("wallet_ai_diagnosis_persona") || undefined;
      aiTone = window.localStorage.getItem("wallet_ai_diagnosis_aiTone") || undefined;
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        diagnosis: parsed,
        timestamp: timestamp || null,
        modelUsed,
        persona,
        aiTone,
      };
    }
  } catch (err) {
    console.warn("Falha ao ler diagnóstico local síncrono:", err);
  }

  return null;
}

/**
 * Salva o diagnóstico financeiro persistente no storage local e Firestore
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

  // 1. Salva imediatamente no localStorage (chave com escopo de usuário + chave geral de fallback)
  if (typeof window !== "undefined") {
    try {
      const userKey = getDiagnosisStorageKey(userId);
      const jsonStr = JSON.stringify(cleanDiagnosis);

      window.localStorage.setItem(userKey, jsonStr);
      window.localStorage.setItem(`${userKey}_timestamp`, meta.timestamp);
      if (meta.modelUsed) {
        window.localStorage.setItem(`${userKey}_model`, meta.modelUsed);
      }
      if (meta.persona) {
        window.localStorage.setItem(`${userKey}_persona`, meta.persona);
        window.localStorage.setItem("wallet_ai_diagnosis_persona", meta.persona);
      }
      if (meta.aiTone) {
        window.localStorage.setItem(`${userKey}_aiTone`, meta.aiTone);
        window.localStorage.setItem("wallet_ai_diagnosis_aiTone", meta.aiTone);
      }

      window.localStorage.setItem(DIAGNOSIS_KEY, jsonStr);
      window.localStorage.setItem(DIAGNOSIS_TIMESTAMP_KEY, meta.timestamp);
      if (meta.modelUsed) {
        window.localStorage.setItem(DIAGNOSIS_MODEL_KEY, meta.modelUsed);
      }
    } catch (err) {
      console.warn("Falha ao salvar diagnóstico localmente:", err);
    }
  }

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
 * Carrega o diagnóstico financeiro salvo (Firestore com fallback para localStorage)
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
          // Atualiza cache local sincronizado
          if (typeof window !== "undefined") {
            try {
              const userKey = getDiagnosisStorageKey(userId);
              const jsonStr = JSON.stringify(data.diagnosis);
              window.localStorage.setItem(userKey, jsonStr);
              if (data.timestamp) window.localStorage.setItem(`${userKey}_timestamp`, data.timestamp);
              if (data.modelUsed) window.localStorage.setItem(`${userKey}_model`, data.modelUsed);
              if (data.persona) {
                window.localStorage.setItem(`${userKey}_persona`, data.persona);
                window.localStorage.setItem("wallet_ai_diagnosis_persona", data.persona);
              }
              if (data.aiTone) {
                window.localStorage.setItem(`${userKey}_aiTone`, data.aiTone);
                window.localStorage.setItem("wallet_ai_diagnosis_aiTone", data.aiTone);
              }
              window.localStorage.setItem(DIAGNOSIS_KEY, jsonStr);
              if (data.timestamp) window.localStorage.setItem(DIAGNOSIS_TIMESTAMP_KEY, data.timestamp);
              if (data.modelUsed) window.localStorage.setItem(DIAGNOSIS_MODEL_KEY, data.modelUsed);
            } catch {
              // Silencioso
            }
          }
          return {
            diagnosis: data.diagnosis,
            timestamp: data.timestamp || null,
            modelUsed: data.modelUsed || undefined,
            persona: data.persona || undefined,
            aiTone: data.aiTone || undefined,
          };
        }
      }
    } catch (err) {
      console.warn("Falha ao obter diagnóstico do Firestore:", err);
    }
  }

  // 2. Fallback para cache local instantâneo
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

