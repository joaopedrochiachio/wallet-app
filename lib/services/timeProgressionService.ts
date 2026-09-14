import { db } from "@/lib/firebase";
import { CardItem, RecurringItem, Transaction } from "@/types";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
  arrayUnion,
} from "firebase/firestore";
import {
  DueOccurrence,
  getPendingDueOccurrences,
} from "@/lib/utils/timeProgression";

export interface ProcessDueResult {
  processedCount: number;
  processedOccurrences: DueOccurrence[];
}

/**
 * Busca os dados de cartões, transações e planejamentos do usuário no Firestore,
 * identifica ocorrências que já venceram e as materializa de forma atômica e idempotente.
 */
export async function processDueOccurrencesForUser(
  userId: string,
  asOfDate: Date = new Date()
): Promise<ProcessDueResult> {
  if (!userId) {
    return { processedCount: 0, processedOccurrences: [] };
  }

  try {
    // 1. Carregar itens recorrentes do usuário
    const recurringCol = collection(db, "users", userId, "recurring");
    const recurringSnap = await getDocs(recurringCol);
    const recurringItems: RecurringItem[] = recurringSnap.docs.map((d) => ({
      ...(d.data() as RecurringItem),
      id: d.id,
    }));

    if (recurringItems.length === 0) {
      return { processedCount: 0, processedOccurrences: [] };
    }

    // 2. Carregar cartões para identificar contas correntes vs cartões de crédito
    const cardsCol = collection(db, "users", userId, "cards");
    const cardsSnap = await getDocs(cardsCol);
    const cards: CardItem[] = cardsSnap.docs.map((d) => ({
      ...(d.data() as CardItem),
      id: d.id,
    }));

    // 3. Carregar transações existentes para verificação de duplicidade
    const transactionsCol = collection(db, "users", userId, "transactions");
    const transactionsSnap = await getDocs(transactionsCol);
    const existingTransactions = transactionsSnap.docs.map((d) => {
      const data = d.data() as Transaction;
      return {
        id: d.id,
        recurringItemId: data.recurringItemId ?? null,
        periodKey: data.periodKey ?? null,
      };
    });

    // 4. Calcular ocorrências vencidas de forma pura e idempotente
    const dueOccurrences = getPendingDueOccurrences(
      recurringItems,
      cards,
      existingTransactions,
      asOfDate
    );

    if (dueOccurrences.length === 0) {
      return { processedCount: 0, processedOccurrences: [] };
    }

    // 5. Materializar ocorrências via Firestore WriteBatch
    const batch = writeBatch(db);

    for (const occ of dueOccurrences) {
      const txRef = doc(db, "users", userId, "transactions", occ.occurrenceId);
      const recurringRef = doc(db, "users", userId, "recurring", occ.recurringItemId);

      batch.set(
        txRef,
        {
          amount: occ.amount,
          type: occ.type,
          category: occ.category,
          description: occ.description,
          paymentMethod: occ.paymentMethod,
          cardId: occ.cardId ?? null,
          kind: "regular",
          relatedCardId: null,
          groupId: null,
          recurringItemId: occ.recurringItemId,
          periodKey: occ.periodKey,
          date: occ.formattedDate,
          occurredAt: Timestamp.fromDate(occ.dueDate),
          createdAt: serverTimestamp(),
          userId,
        },
        { merge: true }
      );

      batch.set(
        recurringRef,
        {
          realizedPeriods: arrayUnion(occ.periodKey),
        },
        { merge: true }
      );
    }

    await batch.commit();

    return {
      processedCount: dueOccurrences.length,
      processedOccurrences: dueOccurrences,
    };
  } catch (error) {
    console.error("Erro ao processar ocorrências vencidas:", error);
    throw error;
  }
}
