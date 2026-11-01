import { auth, db } from "@/lib/firebase";
import { UserProfile } from "@/types";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";

function sanitizeData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Salva ou atualiza os dados do perfil do usuário no Cloud Firestore
 */
export async function saveUserProfile(
  userId: string,
  profile: Partial<UserProfile>
): Promise<void> {
  const userDocRef = doc(db, "users", userId);
  const cleanProfile = sanitizeData(profile);
  await setDoc(userDocRef, cleanProfile, { merge: true });
}

/**
 * Obtém o perfil de um usuário pelo seu UID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userDocRef = doc(db, "users", userId);
  const snapshot = await getDoc(userDocRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as UserProfile;
}

/**
 * Listener em tempo real para o perfil do usuário
 */
export function subscribeToUserProfile(
  userId: string,
  callback: (profile: UserProfile | null) => void
): () => void {
  const userDocRef = doc(db, "users", userId);
  return onSnapshot(
    userDocRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
      } else {
        callback(snapshot.data() as UserProfile);
      }
    },
    (err) => {
      console.error("Erro ao escutar perfil do usuário:", err);
    }
  );
}

/**
 * Registra formalmente o aceite dos Termos de Uso e Política de Privacidade (LGPD)
 */
export async function recordLgpdConsent(
  userId: string,
  options?: { version?: string; documentTitle?: string }
): Promise<void> {
  if (!userId) return;
  const userDocRef = doc(db, "users", userId);
  const consentRecord = {
    accepted: true,
    acceptedAt: new Date().toISOString(),
    version: options?.version || "1.0",
    documentTitle:
      options?.documentTitle ||
      "Termos de Uso e Política de Privacidade e Proteção de Dados (LGPD)",
  };
  await setDoc(userDocRef, { lgpdConsent: consentRecord }, { merge: true });
}

/**
 * Solicita ao servidor a exportação completa, inclusive das subcoleções que o
 * SDK web não pode ler diretamente (ai_usage e ai_logs).
 */
export async function exportUserDataJson(userId: string): Promise<Record<string, unknown>> {
  if (!userId) throw new Error("Usuário não identificado para exportação de dados.");
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) {
    throw new Error("Sessão inválida para exportação de dados.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch("/api/account", {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: Record<string, unknown>; error?: string }
    | null;

  if (!response.ok || !result?.success || !result.data) {
    throw new Error(result?.error || "Não foi possível exportar todos os dados da conta.");
  }
  return result.data;
}
