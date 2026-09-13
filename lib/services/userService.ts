import { db } from "@/lib/firebase";
import { UserProfile } from "@/types";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

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
