import { db } from "@/lib/firebase";
import { Transaction } from "@/types";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const TRANSACTIONS_COLLECTION = "transactions";

/**
 * Retorna a referência da coleção de transações (seja no escopo do usuário ou global)
 */
function getTransactionsCollectionRef(userId?: string) {
  if (userId) {
    return collection(db, "users", userId, TRANSACTIONS_COLLECTION);
  }
  return collection(db, TRANSACTIONS_COLLECTION);
}

/**
 * Adiciona uma nova transação no Cloud Firestore (isolada por usuário quando fornecido)
 */
export async function addTransaction(
  data: Omit<Transaction, "id">,
  userId?: string
): Promise<string> {
  const transactionsCol = getTransactionsCollectionRef(userId || data.userId);

  const docRef = await addDoc(transactionsCol, {
    amount: Number(data.amount),
    type: data.type,
    category: data.category,
    description: data.description,
    paymentMethod: data.paymentMethod,
    date: typeof data.date === "string" ? data.date : data.date.toISOString(),
    createdAt: serverTimestamp(),
    userId: userId || data.userId || null,
  });

  return docRef.id;
}

/**
 * Listener em tempo real para sincronização de transações ordenadas pela data mais recente
 */
export function subscribeToTransactions(
  callback: (transactions: Transaction[]) => void,
  userId?: string,
  onError?: (error: Error) => void
): () => void {
  const transactionsCol = getTransactionsCollectionRef(userId);
  const q = query(transactionsCol, orderBy("createdAt", "desc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: Transaction[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          amount: Number(d.amount) || 0,
          type: d.type as "in" | "out",
          category: d.category || "Outros",
          date: d.date || new Date().toLocaleDateString("pt-BR"),
          description: d.description || "Lançamento",
          paymentMethod: d.paymentMethod || "Débito/Pix",
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt,
          userId: d.userId,
        };
      });
      callback(items);
    },
    (error) => {
      console.error("Erro no listener do Firestore (subscribeToTransactions):", error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}
