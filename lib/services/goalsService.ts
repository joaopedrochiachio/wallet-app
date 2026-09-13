import { db } from "@/lib/firebase";
import { GoalItem } from "@/types";
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
