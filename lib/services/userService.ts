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
 * Exclui definitivamente todos os dados do usuário no Firestore (LGPD / Apple Guideline)
 */
export async function deleteUserDataFromFirestore(userId: string): Promise<void> {
  if (!userId) return;

  const subcollections = ["cards", "transactions", "recurring", "goals"];
  for (const subcol of subcollections) {
    const colRef = collection(db, "users", userId, subcol);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  const userDocRef = doc(db, "users", userId);
  await deleteDoc(userDocRef);
}
