import { db } from "@/lib/firebase";
import { RecurringItem } from "@/types";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  deleteField,
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
  const cleanItem: Record<string, unknown> = {
    ...sanitizeData(item),
    ...(item.installmentsCount === undefined ? { installmentsCount: deleteField() } : {}),
  };
  await setDoc(recurringDocRef, cleanItem, { merge: true });
}

/**
 * Atualiza campos específicos de um item recorrente no Firestore.
 * Converte campos com valor `undefined` em `deleteField()` para que campos
 * removidos (como installmentsCount ao tornar contínua) sejam efetivamente deletados no Firestore.
 */
export async function updateRecurringInFirestore(
  userId: string,
  itemId: string,
  updates: Partial<RecurringItem>
): Promise<void> {
  const recurringDocRef = doc(db, "users", userId, "recurring", itemId);
  const firestoreUpdates: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined) {
      firestoreUpdates[key] = deleteField();
    } else {
      firestoreUpdates[key] = JSON.parse(JSON.stringify(val));
    }
  }

  await setDoc(recurringDocRef, firestoreUpdates, { merge: true });
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
 * Escuta em tempo real os itens recorrentes do usuário, garantindo que o `id`
 * de cada item seja sempre preservado pelo ID do documento no Firestore.
 */
export function subscribeToRecurring(
  userId: string,
  callback: (items: RecurringItem[]) => void
): () => void {
  const colRef = collection(db, "users", userId, "recurring");
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: RecurringItem[] = snapshot.docs.map((d) => ({
        ...(d.data() as RecurringItem),
        id: d.id,
      }));
      callback(items);
    },
    (err) => {
      console.error("Erro ao sincronizar itens recorrentes do Firestore:", err);
    }
  );
}
