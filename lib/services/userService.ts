import { auth, db } from "@/lib/firebase";
import { UserProfile } from "@/types";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  onSnapshot,
} from "firebase/firestore";

const LOCAL_ONBOARDED_PREFIX = "wallet_onboarded_";

export function markUserOnboardedLocal(userId: string): void {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${LOCAL_ONBOARDED_PREFIX}${userId}`, "true");
  } catch {
    // Ignora falha de storage
  }
}

export function hasLocalOnboardedFlag(userId: string): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${LOCAL_ONBOARDED_PREFIX}${userId}`) === "true";
  } catch {
    return false;
  }
}

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
  const cleanProfile = sanitizeData({
    ...profile,
    isOnboarded: profile.isOnboarded ?? true,
  });
  markUserOnboardedLocal(userId);
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
 * Verifica com segurança se o usuário já concluiu o cadastro inicial (onboarding)
 * ou se a conta já existia anteriormente (evitando mandar contas existentes para /onboarding).
 * Só retorna `false` se for genuinamente o 1º login de uma conta recém-criada sem dados.
 */
export async function checkIsUserOnboarded(
  userId: string,
  authMetadata?: { creationTime?: string; lastSignInTime?: string } | null
): Promise<boolean> {
  if (!userId) return false;

  // 1. Verificação instantânea via cache local do navegador
  if (hasLocalOnboardedFlag(userId)) {
    return true;
  }

  const userDocRef = doc(db, "users", userId);

  try {
    // 2. Verifica documento de perfil no Firestore
    const snapshot = await getDoc(userDocRef);
    if (snapshot.exists()) {
      const data = snapshot.data() as Partial<UserProfile> & Record<string, unknown>;
      const hasProfileData =
        data.isOnboarded === true ||
        Boolean(data.name && data.name.trim() !== "" && data.name !== "Seu Nome") ||
        Boolean(typeof data.monthlyIncomeBase === "number" && data.monthlyIncomeBase > 0) ||
        Boolean(data.persona);

      if (hasProfileData) {
        markUserOnboardedLocal(userId);
        if (data.isOnboarded !== true) {
          void setDoc(userDocRef, { isOnboarded: true }, { merge: true }).catch(() => undefined);
        }
        return true;
      }
    }

    // 3. Verifica se o usuário já possui cartões, transações ou itens planejados salvos
    const [cardsSnap, txSnap, recSnap] = await Promise.all([
      getDocs(query(collection(db, "users", userId, "cards"), limit(1))),
      getDocs(query(collection(db, "users", userId, "transactions"), limit(1))),
      getDocs(query(collection(db, "users", userId, "recurring"), limit(1))),
    ]);

    if (!cardsSnap.empty || !txSnap.empty || !recSnap.empty) {
      markUserOnboardedLocal(userId);
      void setDoc(userDocRef, { isOnboarded: true }, { merge: true }).catch(() => undefined);
      return true;
    }
  } catch (err) {
    console.warn("[checkIsUserOnboarded] Falha ao consultar Firestore, avaliando metadados da conta:", err);
    // Se houve falha de rede/timeout e a conta não acabou de ser criada neste instante, assume já cadastrada
    if (authMetadata?.creationTime && authMetadata?.lastSignInTime) {
      const createdMs = new Date(authMetadata.creationTime).getTime();
      const lastSignInMs = new Date(authMetadata.lastSignInTime).getTime();
      if (!Number.isNaN(createdMs) && !Number.isNaN(lastSignInMs) && Math.abs(lastSignInMs - createdMs) > 60_000) {
        markUserOnboardedLocal(userId);
        return true;
      }
    }
    return true;
  }

  // 4. Se a conta no Firebase Auth foi criada em uma sessão anterior (diferença > 2 min entre criação e login atual),
  // não é o 1º login do usuário — marca como onboarded e leva direto ao Dashboard.
  if (authMetadata?.creationTime && authMetadata?.lastSignInTime) {
    const createdMs = new Date(authMetadata.creationTime).getTime();
    const lastSignInMs = new Date(authMetadata.lastSignInTime).getTime();
    if (!Number.isNaN(createdMs) && !Number.isNaN(lastSignInMs) && Math.abs(lastSignInMs - createdMs) > 120_000) {
      markUserOnboardedLocal(userId);
      void setDoc(userDocRef, { isOnboarded: true }, { merge: true }).catch(() => undefined);
      return true;
    }
  }

  return false;
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
