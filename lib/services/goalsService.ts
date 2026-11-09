import { db } from "@/lib/firebase";
import { GoalItem } from "@/types";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  Timestamp,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { commitGoalOperation, type GoalOperation } from "@/lib/utils/goalOperations";

export async function saveGoalOperation(userId: string, input: GoalOperation): Promise<GoalItem> {
  if (!userId) throw new Error("Entre na sua conta para movimentar uma meta.");
  return commitGoalOperation({
    run: (work) => runTransaction(db, async (firestoreTransaction) => work({
      get: async <T>(path: string) => {
        const snapshot = await firestoreTransaction.get(doc(db, "users", userId, ...path.split("/")));
        return snapshot.exists() ? snapshot.data() as T : undefined;
      },
      set: (path, value) => {
        const payload = sanitizeData(value) as Record<string, unknown>;
        if (path.startsWith("transactions/")) {
          payload.occurredAt = Timestamp.fromDate(new Date(input.occurredAt));
          payload.createdAt = serverTimestamp();
          payload.userId = userId;
        }
        firestoreTransaction.set(doc(db, "users", userId, ...path.split("/")), payload);
      },
    })),
  }, input);
}

export async function updateGoalDetails(userId: string, goalId: string, updates: Partial<GoalItem>): Promise<void> {
  if (!userId) throw new Error("Entre na sua conta para editar uma meta.");
  if (updates.current !== undefined) throw new Error("Ajuste o saldo da meta usando aporte ou resgate.");
  const details = Object.fromEntries(Object.entries(updates).filter(([key, value]) => ["title", "category", "target", "deadline", "icon"].includes(key) && value !== undefined));
  await updateDoc(doc(db, "users", userId, "goals", goalId), details);
}

function sanitizeData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Salva ou atualiza uma meta na subcoleção users/{userId}/goals
 */
export async function saveGoalToFirestore(
  userId: string,
  goal: GoalItem
): Promise<void> {
  const goalDocRef = doc(db, "users", userId, "goals", goal.id);
  const cleanGoal = sanitizeData(goal);
  await setDoc(goalDocRef, cleanGoal, { merge: true });
}

/**
 * Exclui uma meta do Firestore
 */
export async function deleteGoalFromFirestore(
  userId: string,
  goalId: string
): Promise<void> {
  const goalDocRef = doc(db, "users", userId, "goals", goalId);
  await deleteDoc(goalDocRef);
}

/**
 * Escuta em tempo real as metas do usuário
 */
export function subscribeToGoals(
  userId: string,
  callback: (goals: GoalItem[]) => void
): () => void {
  const goalsCol = collection(db, "users", userId, "goals");
  return onSnapshot(
    goalsCol,
    (snapshot) => {
      const goals: GoalItem[] = snapshot.docs.map((doc) => doc.data() as GoalItem);
      callback(goals);
    },
    (err) => {
      console.error("Erro ao sincronizar metas do Firestore:", err);
    }
  );
}
