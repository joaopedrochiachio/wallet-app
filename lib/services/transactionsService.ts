import { db } from "@/lib/firebase";
import { RecurringItem, Transaction } from "@/types";
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const TRANSACTIONS_COLLECTION = "transactions";

function getTransactionsCollectionRef(userId: string) {
  if (!userId) {
    throw new Error("userId é obrigatório para acessar a coleção de lançamentos.");
  }
  return collection(db, "users", userId, TRANSACTIONS_COLLECTION);
}

function transactionPayload(data: Omit<Transaction, "id">, userId: string) {
  if (!userId) {
    throw new Error("userId é obrigatório para construir o payload de lançamento.");
  }
  return {
    amount: Number(data.amount),
    type: data.type,
    category: data.category,
    description: data.description,
    paymentMethod: data.paymentMethod,
    cardId: data.cardId ?? null,
    kind: data.kind ?? "regular",
    relatedCardId: data.relatedCardId ?? null,
    groupId: data.groupId ?? null,
    recurringItemId: data.recurringItemId ?? null,
    periodKey: data.periodKey ?? null,
    date: typeof data.date === "string" ? data.date : data.date.toISOString(),
    occurredAt: data.occurredAt || Timestamp.now(),
    createdAt: serverTimestamp(),
    userId,
  };
}

/** Grava o lançamento e a eventual atualização do planejamento no mesmo batch. */
export async function addTransaction(
  data: Omit<Transaction, "id">,
  userId: string,
  recurringItem?: RecurringItem
): Promise<string> {
  if (!userId) {
    throw new Error("Usuário não autenticado para criar lançamento.");
  }
  const transactionsCol = getTransactionsCollectionRef(userId);
  const transactionRef = doc(transactionsCol);

  if (!recurringItem) {
    await setDoc(transactionRef, transactionPayload(data, userId));
    return transactionRef.id;
  }

  const batch = writeBatch(db);
  batch.set(transactionRef, transactionPayload(data, userId));
  batch.set(
    doc(db, "users", userId, "recurring", recurringItem.id),
    JSON.parse(JSON.stringify(recurringItem)) as RecurringItem,
    { merge: true }
  );
  await batch.commit();
  return transactionRef.id;
}

/** Cria as duas pernas do pagamento: saída da conta e baixa da fatura. */
export async function payCreditCardInvoice(
  userId: string,
  input: {
    amount: number;
    checkingCardId: string;
    checkingAccountName: string;
    creditCardId: string;
    creditCardName: string;
    date: string;
    occurredAt: Date;
  }
): Promise<void> {
  const transactionsCol = getTransactionsCollectionRef(userId);
  const checkingEntryRef = doc(transactionsCol);
  const settlementEntryRef = doc(transactionsCol);
  const groupId = `invoice-${input.creditCardId}-${checkingEntryRef.id}`;
  const batch = writeBatch(db);

  batch.set(
    checkingEntryRef,
    transactionPayload(
      {
        amount: input.amount,
        type: "out",
        category: "Pagamento de Fatura",
        description: `Pagamento Fatura ${input.creditCardName}`,
        paymentMethod: input.checkingAccountName,
        cardId: input.checkingCardId,
        relatedCardId: input.creditCardId,
        groupId,
        kind: "invoice_payment",
        date: input.date,
        occurredAt: input.occurredAt,
      },
      userId
    )
  );

  batch.set(
    settlementEntryRef,
    transactionPayload(
      {
        amount: input.amount,
        type: "in",
        category: "Baixa de Fatura",
        description: `Baixa Fatura ${input.creditCardName}`,
        paymentMethod: input.creditCardName,
        cardId: input.creditCardId,
        relatedCardId: input.checkingCardId,
        groupId,
        kind: "invoice_settlement",
        date: input.date,
        occurredAt: input.occurredAt,
      },
      userId
    )
  );

  await batch.commit();
}

/** Associa um lançamento já existente à previsão equivalente, sem duplicá-lo. */
export async function linkTransactionToRecurring(
  userId: string,
  transactionId: string,
  recurringItemId: string,
  periodKey: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", userId, TRANSACTIONS_COLLECTION, transactionId), {
    recurringItemId,
    periodKey,
  });
  batch.set(
    doc(db, "users", userId, "recurring", recurringItemId),
    { realizedPeriods: arrayUnion(periodKey) },
    { merge: true }
  );
  await batch.commit();
}

/**
 * Efetiva imediatamente uma ocorrência planejada (pagamento ou recebimento adiantado).
 * Cria a transação real e marca a competência como realizada de forma atômica e idempotente.
 */
export async function realizePlannedOccurrence(
  userId: string,
  item: RecurringItem,
  periodKey: string,
  options?: { customDate?: Date; customAmount?: number }
): Promise<string> {
  if (!userId) {
    throw new Error("userId é obrigatório para efetivar a previsão.");
  }
  const transactionsCol = getTransactionsCollectionRef(userId);
  const txId = `rec-tx-${item.id}-${periodKey}`;
  const txRef = doc(transactionsCol, txId);
  const recurringRef = doc(db, "users", userId, "recurring", item.id);

  const occurredAt = options?.customDate ?? new Date();
  const amount = options?.customAmount !== undefined ? options.customAmount : item.amount;
  const formattedDate = `${occurredAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${occurredAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  const batch = writeBatch(db);
  batch.set(
    txRef,
    transactionPayload(
      {
        amount,
        type: item.type === "income" ? "in" : "out",
        category: item.category,
        description: item.title,
        paymentMethod: item.account,
        cardId: item.cardId ?? null,
        kind: "regular",
        relatedCardId: null,
        groupId: null,
        recurringItemId: item.id,
        periodKey,
        date: formattedDate,
        occurredAt,
      },
      userId
    ),
    { merge: true }
  );

  batch.set(
    recurringRef,
    {
      realizedPeriods: arrayUnion(periodKey),
    },
    { merge: true }
  );

  await batch.commit();
  return txId;
}

/**
 * Desfaz a efetivação de uma competência planejada, removendo a transação criada
 * e restaurando a competência como pendente no planejamento.
 */
export async function unrealizePlannedOccurrence(
  userId: string,
  recurringItemId: string,
  periodKey: string
): Promise<void> {
  if (!userId) {
    throw new Error("userId é obrigatório para desfazer a efetivação.");
  }
  const txId = `rec-tx-${recurringItemId}-${periodKey}`;
  const batch = writeBatch(db);

  batch.delete(doc(db, "users", userId, TRANSACTIONS_COLLECTION, txId));

  const q = query(
    getTransactionsCollectionRef(userId),
    where("recurringItemId", "==", recurringItemId),
    where("periodKey", "==", periodKey)
  );
  const snap = await getDocs(q);
  snap.docs.forEach((d) => {
    batch.delete(d.ref);
  });

  const recurringRef = doc(db, "users", userId, "recurring", recurringItemId);
  const recurringSnapshot = await getDoc(recurringRef);
  if (recurringSnapshot.exists()) {
    batch.update(recurringRef, {
      realizedPeriods: arrayRemove(periodKey),
    });
  }

  await batch.commit();
}

/** Exclui também a outra perna de uma fatura e reabre o planejamento realizado. */
export async function deleteTransactionFromFirestore(
  userId: string,
  transaction: Pick<Transaction, "id" | "groupId" | "recurringItemId" | "periodKey">
): Promise<void> {
  if (!transaction.id) return;

  const batch = writeBatch(db);
  batch.delete(doc(db, "users", userId, TRANSACTIONS_COLLECTION, transaction.id));

  if (transaction.groupId) {
    const relatedQuery = query(
      getTransactionsCollectionRef(userId),
      where("groupId", "==", transaction.groupId)
    );
    const relatedSnapshot = await getDocs(relatedQuery);
    relatedSnapshot.docs.forEach((item) => batch.delete(item.ref));
  }

  if (transaction.recurringItemId && transaction.periodKey) {
    const recurringRef = doc(db, "users", userId, "recurring", transaction.recurringItemId);
    const recurringSnapshot = await getDoc(recurringRef);
    if (recurringSnapshot.exists()) {
      batch.update(recurringRef, { realizedPeriods: arrayRemove(transaction.periodKey) });
    }
  }

  await batch.commit();
}

export async function deleteTransactionById(userId: string, txId: string): Promise<void> {
  await deleteDoc(doc(db, "users", userId, TRANSACTIONS_COLLECTION, txId));
}

export interface TransactionUpdateInput {
  title: string;
  amount: number;
  type: "despesa" | "receita";
  category: string;
  account: string;
  cardId?: string | null;
  date: string;
  occurredAt: Date;
}

/** Atualiza somente os campos editáveis de um lançamento existente. */
export async function updateTransactionInFirestore(
  userId: string,
  transactionId: string,
  input: TransactionUpdateInput
): Promise<void> {
  await updateDoc(doc(db, "users", userId, TRANSACTIONS_COLLECTION, transactionId), {
    amount: Number(input.amount),
    type: input.type === "receita" ? "in" : "out",
    category: input.category,
    description: input.title,
    paymentMethod: input.account,
    cardId: input.cardId ?? null,
    date: input.date,
    occurredAt: input.occurredAt,
  });
}

export function subscribeToTransactions(
  callback: (transactions: Transaction[]) => void,
  userId: string,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const transactionsQuery = query(
    getTransactionsCollectionRef(userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    transactionsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data();
          return {
            id: snapshotDoc.id,
            amount: Number(data.amount) || 0,
            type: data.type as "in" | "out",
            category: data.category || "Outros",
            date: data.date || new Date().toLocaleDateString("pt-BR"),
            description: data.description || "Lançamento",
            paymentMethod: data.paymentMethod || "Débito/Pix",
            cardId: data.cardId || null,
            kind: data.kind || "regular",
            relatedCardId: data.relatedCardId || null,
            groupId: data.groupId || null,
            recurringItemId: data.recurringItemId || null,
            periodKey: data.periodKey || null,
            occurredAt: data.occurredAt?.toDate
              ? data.occurredAt.toDate()
              : data.occurredAt || null,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            userId: data.userId || userId,
          };
        })
      );
    },
    (error) => {
      console.error("Erro no listener do Firestore (subscribeToTransactions):", error);
      onError?.(error);
    }
  );
}
