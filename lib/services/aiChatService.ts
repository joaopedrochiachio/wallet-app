import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import type { PurchaseSimulationResult } from "./financialContextService";

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  modelUsed?: string;
  simulationResult?: PurchaseSimulationResult | null;
}

const LOCAL_STORAGE_PREFIX = "wallet_ai_chat_history_";
const DIAGNOSIS_KEY = "wallet_ai_diagnosis";
const DIAGNOSIS_TIMESTAMP_KEY = "wallet_ai_diagnosis_timestamp";
const DIAGNOSIS_MODEL_KEY = "wallet_ai_model";

function getStorageKey(userId?: string | null): string {
  return `${LOCAL_STORAGE_PREFIX}${userId || "guest"}`;
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
 * Salva o diagnóstico financeiro persistente no storage local e Firestore
 */
export async function savePersistentDiagnosis(
  diagnosis: unknown,
  meta: { timestamp: string; modelUsed?: string },
  userId?: string | null
): Promise<void> {
  try {
    window.localStorage.setItem(DIAGNOSIS_KEY, JSON.stringify(diagnosis));
    window.localStorage.setItem(DIAGNOSIS_TIMESTAMP_KEY, meta.timestamp);
    if (meta.modelUsed) {
      window.localStorage.setItem(DIAGNOSIS_MODEL_KEY, meta.modelUsed);
    }
  } catch (err) {
    console.warn("Falha ao salvar diagnóstico localmente:", err);
  }

  if (userId) {
    try {
      const diagDocRef = doc(db, "users", userId, "ai_diagnosis", "latest");
      await setDoc(diagDocRef, {
        diagnosis,
        timestamp: meta.timestamp,
        modelUsed: meta.modelUsed || "gemini-3.6-flash",
      });
    } catch (err) {
      console.warn("Falha ao persistir diagnóstico no Firestore:", err);
    }
  }
}

/**
 * Carrega o diagnóstico financeiro salvo
 */
export async function loadPersistentDiagnosis(
  userId?: string | null
): Promise<{ diagnosis: unknown; timestamp: string | null; modelUsed?: string } | null> {
  // 1. Tenta carregar do Firestore se logado
  if (userId) {
    try {
      const diagDocRef = doc(db, "users", userId, "ai_diagnosis", "latest");
      const snap = await getDoc(diagDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data?.diagnosis) {
          // Atualiza cache local
          try {
            window.localStorage.setItem(DIAGNOSIS_KEY, JSON.stringify(data.diagnosis));
            if (data.timestamp) window.localStorage.setItem(DIAGNOSIS_TIMESTAMP_KEY, data.timestamp);
            if (data.modelUsed) window.localStorage.setItem(DIAGNOSIS_MODEL_KEY, data.modelUsed);
          } catch {
            // Silencioso
          }
          return {
            diagnosis: data.diagnosis,
            timestamp: data.timestamp || null,
            modelUsed: data.modelUsed || undefined,
          };
        }
      }
    } catch (err) {
      console.warn("Falha ao obter diagnóstico do Firestore:", err);
    }
  }

  // 2. Fallback para localStorage
  try {
    const raw = window.localStorage.getItem(DIAGNOSIS_KEY);
    const timestamp = window.localStorage.getItem(DIAGNOSIS_TIMESTAMP_KEY);
    const modelUsed = window.localStorage.getItem(DIAGNOSIS_MODEL_KEY) || undefined;

    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        diagnosis: parsed,
        timestamp: timestamp || null,
        modelUsed,
      };
    }
  } catch (err) {
    console.warn("Falha ao ler diagnóstico local:", err);
  }

  return null;
}
