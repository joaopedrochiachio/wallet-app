import { db } from "@/lib/firebase";
import { CardItem, RecurringItem, Transaction } from "@/types";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  runTransaction,
  arrayUnion,
} from "firebase/firestore";
import {
  DueOccurrence,
  getAutomaticDueOccurrences,
} from "@/lib/utils/timeProgression";

export interface ProcessDueResult {
  processedCount: number;
  processedOccurrences: DueOccurrence[];
}

export interface PreloadedDueCheckData {
  recurringItems?: RecurringItem[];
  cards?: CardItem[];
  transactions?: Pick<Transaction, "id" | "recurringItemId" | "periodKey">[];
}

/**
 * Busca os dados de cartões, transações e planejamentos do usuário no Firestore (ou usa cache pré-carregado),
 * identifica ocorrências que já venceram e as materializa de forma atômica e idempotente.
 */
export async function processDueOccurrencesForUser(
  userId: string,
  asOfDate: Date = new Date(),
  preloaded?: PreloadedDueCheckData
): Promise<ProcessDueResult> {
  if (!userId) {
    return { processedCount: 0, processedOccurrences: [] };
  }

  try {
    // 1. Carregar itens recorrentes do usuário (ou reaproveitar do estado em memória)
    let recurringItems = preloaded?.recurringItems;
    if (!recurringItems) {
      const recurringCol = collection(db, "users", userId, "recurring");
      const recurringSnap = await getDocs(recurringCol);
      recurringItems = recurringSnap.docs.map((d) => ({
        ...(d.data() as RecurringItem),
        id: d.id,
      }));
    }

    if (recurringItems.length === 0) {
      return { processedCount: 0, processedOccurrences: [] };
    }

    // 2. Carregar cartões para identificar contas correntes vs cartões de crédito
    let cards = preloaded?.cards;
    if (!cards) {
      const cardsCol = collection(db, "users", userId, "cards");
      const cardsSnap = await getDocs(cardsCol);
      cards = cardsSnap.docs.map((d) => ({
        ...(d.data() as CardItem),
        id: d.id,
      }));
    }

    // 3. Carregar transações existentes para verificação de duplicidade
    let existingTransactions = preloaded?.transactions;
    if (!existingTransactions) {
      const transactionsCol = collection(db, "users", userId, "transactions");
      const transactionsSnap = await getDocs(transactionsCol);
      existingTransactions = transactionsSnap.docs.map((d) => {
        const data = d.data() as Transaction;
        return {
          id: d.id,
          recurringItemId: data.recurringItemId ?? null,
          periodKey: data.periodKey ?? null,
        };
      });
    }

    // 4. Calcular ocorrências vencidas de forma pura e idempotente
    const dueOccurrences = getAutomaticDueOccurrences(
      recurringItems,
      cards,
      existingTransactions,
      asOfDate
    );

    if (dueOccurrences.length === 0) {
      return { processedCount: 0, processedOccurrences: [] };
    }

    // Revalida cada ocorrência com o estado persistido para não sobrescrever uma confirmação manual.
    const processedOccurrences: DueOccurrence[] = [];

    for (const occ of dueOccurrences) {
      const txRef = doc(db, "users", userId, "transactions", occ.occurrenceId);
      const recurringRef = doc(db, "users", userId, "recurring", occ.recurringItemId);
      const processed = await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(txRef);
        const recurringSnapshot = await transaction.get(recurringRef);
        if (existing.exists() || !recurringSnapshot.exists()) return null;
        const item = { ...recurringSnapshot.data(), id: occ.recurringItemId } as RecurringItem;
        const current = getAutomaticDueOccurrences([item], cards, [], asOfDate).find((candidate) => candidate.occurrenceId === occ.occurrenceId);
        if (!current) return null;

        transaction.set(
          txRef,
          {
            amount: current.amount,
            type: current.type,
            category: current.category,
            description: current.description,
            paymentMethod: current.paymentMethod,
            cardId: current.cardId ?? null,
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

        transaction.set(
          recurringRef,
          {
            realizedPeriods: arrayUnion(occ.periodKey),
          },
          { merge: true }
        );
        return current;
      });
      if (processed) processedOccurrences.push(processed);
    }

    return {
      processedCount: processedOccurrences.length,
      processedOccurrences,
    };
  } catch (error) {
    console.error("Erro ao processar ocorrências vencidas:", error);
    throw error;
  }
}
