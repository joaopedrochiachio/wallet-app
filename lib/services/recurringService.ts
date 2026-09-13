import { db } from "@/lib/firebase";
import { RecurringItem } from "@/types";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

function sanitizeData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Salva ou atualiza um item recorrente na subcoleção users/{userId}/recurring
 */
export async function saveRecurringToFirestore(
  userId: string,
  item: RecurringItem
): Promise<void> {
  const recurringDocRef = doc(db, "users", userId, "recurring", item.id);
  const cleanItem = sanitizeData(item);
  await setDoc(recurringDocRef, cleanItem, { merge: true });
}

/**
 * Exclui um item recorrente do Firestore
 */
export async function deleteRecurringFromFirestore(
  userId: string,
  itemId: string
): Promise<void> {
  const recurringDocRef = doc(db, "users", userId, "recurring", itemId);
  await deleteDoc(recurringDocRef);
}

/**
 * Escuta em tempo real os itens recorrentes do usuário
 */
export function subscribeToRecurring(
  userId: string,
  callback: (items: RecurringItem[]) => void
): () => void {
  const colRef = collection(db, "users", userId, "recurring");
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: RecurringItem[] = snapshot.docs.map((doc) => doc.data() as RecurringItem);
      callback(items);
    },
    (err) => {
      console.error("Erro ao sincronizar itens recorrentes do Firestore:", err);
    }
  );
}
