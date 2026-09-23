import { db } from "@/lib/firebase";
import { UserProfile } from "@/types";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  getDocs,
  deleteDoc,
  writeBatch,
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
 * Exclui definitivamente todos os dados do usuário no Firestore (LGPD Art. 18, VI / Apple Guideline)
 * Remove perfil, cartões, lançamentos, despesas fixas, metas e históricos de IA.
 */
export async function deleteUserDataFromFirestore(userId: string): Promise<void> {
  if (!userId) return;

  const subcollections = [
    "cards",
    "transactions",
    "recurring",
    "goals",
    "ai_chat",
    "ai_diagnosis",
  ];

  for (const subcol of subcollections) {
    try {
      const colRef = collection(db, "users", userId, subcol);
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn(`Aviso ao excluir subcoleção ${subcol} do usuário ${userId}:`, err);
    }
  }

  // Remove também o documento mestre do usuário
  const userDocRef = doc(db, "users", userId);
  await deleteDoc(userDocRef);

  // Limpa o cache local do dispositivo
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(`wallet_ai_chat_history_${userId}`);
      window.localStorage.removeItem(`wallet_ai_diagnosis_${userId}`);
      window.localStorage.removeItem(`wallet_ai_diagnosis_${userId}_timestamp`);
      window.localStorage.removeItem(`wallet_ai_diagnosis_${userId}_model`);
    } catch {
      // Ignora erro de limpeza local
    }
  }
}

/**
 * Exporta todos os dados do usuário em formato JSON estruturado (Portabilidade LGPD Art. 18, V)
 */
export async function exportUserDataJson(userId: string): Promise<Record<string, unknown>> {
  if (!userId) throw new Error("Usuário não identificado para exportação de dados.");

  const profile = await getUserProfile(userId);

  const subcollections = [
    "cards",
    "transactions",
    "recurring",
    "goals",
    "ai_diagnosis",
  ];

  const exportedData: Record<string, unknown> = {
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      lawReference: "LGPD - Lei 13.709/2018 (Artigo 18, V - Portabilidade de Dados)",
      platform: "Wallet App",
    },
    userProfile: profile,
  };

  for (const subcol of subcollections) {
    try {
      const colRef = collection(db, "users", userId, subcol);
      const snap = await getDocs(colRef);
      exportedData[subcol] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
    } catch (err) {
      console.warn(`Aviso ao exportar subcoleção ${subcol}:`, err);
      exportedData[subcol] = [];
    }
  }

  return exportedData;
}
