import { db } from "@/lib/firebase";
import { RecurringItem, Transaction } from "@/types";
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
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
  runTransaction,
} from "firebase/firestore";
import { getEffectiveRecurringItemForPeriod } from "@/lib/utils/dateUtils";

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
    occurredAt:
      data.occurredAt instanceof Date
        ? Timestamp.fromDate(data.occurredAt)
        : typeof data.occurredAt === "string" || typeof data.occurredAt === "number"
          ? Timestamp.fromDate(new Date(data.occurredAt))
          : (data.occurredAt || Timestamp.now()),
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
  const recurringPayload: Record<string, unknown> = JSON.parse(JSON.stringify(recurringItem));
  if (recurringItem.installmentsCount === undefined) {
    recurringPayload.installmentsCount = deleteField();
  }
  batch.set(
    doc(db, "users", userId, "recurring", recurringItem.id),
    recurringPayload,
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
    periodKey?: string | null;
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
        periodKey: input.periodKey ?? null,
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
        periodKey: input.periodKey ?? null,
        date: input.date,
        occurredAt: input.occurredAt,
      },
      userId
    )
  );

  await batch.commit();
}

/**
 * Desfaz o pagamento de uma fatura de cartão para a competência informada (`periodKey`),
 * removendo tanto a saída da conta corrente quanto a baixa da fatura.
 */
export async function unpayCreditCardInvoice(
  userId: string,
  creditCardId: string,
  periodKey: string
): Promise<void> {
  if (!userId || !creditCardId || !periodKey) return;
  const transactionsCol = getTransactionsCollectionRef(userId);
  const snap = await getDocs(transactionsCol);
  const batch = writeBatch(db);
  const groupIdsToDelete = new Set<string>();
  const docRefsToDelete = new Map<string, ReturnType<typeof doc>>();

  snap.docs.forEach((d) => {
    const data = d.data();
    const kind = data.kind;
    if (kind !== "invoice_payment" && kind !== "invoice_settlement") return;
    const matchesCard = data.cardId === creditCardId || data.relatedCardId === creditCardId;
    if (!matchesCard) return;

    let entryPeriodKey: string | null = data.periodKey || null;
    if (!entryPeriodKey && data.occurredAt) {
      const dt = data.occurredAt?.toDate ? data.occurredAt.toDate() : new Date(data.occurredAt);
      if (!Number.isNaN(dt.getTime())) {
        entryPeriodKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      }
    }

    if (entryPeriodKey === periodKey) {
      docRefsToDelete.set(d.id, d.ref);
      if (data.groupId) {
        groupIdsToDelete.add(String(data.groupId));
      }
    }
  });

  if (groupIdsToDelete.size > 0) {
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.groupId && groupIdsToDelete.has(String(data.groupId))) {
        docRefsToDelete.set(d.id, d.ref);
      }
    });
  }

  if (docRefsToDelete.size === 0) return;
  docRefsToDelete.forEach((ref) => batch.delete(ref));
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
  const formattedDate = `${occurredAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${occurredAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey) || Number.isNaN(occurredAt.getTime())) {
    throw new Error("Confira o valor e a data antes de confirmar.");
  }
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(txRef);
    const recurringSnapshot = await transaction.get(recurringRef);
    if (!recurringSnapshot.exists()) throw new Error("Este planejamento não está mais disponível.");
    const recurring = recurringSnapshot.data() as RecurringItem;
    if (existing.exists() || recurring.realizedPeriods?.includes(periodKey)) return;
    if (recurring.excludedPeriods?.includes(periodKey) || recurring.overrides?.[periodKey]?.isDeleted) throw new Error("Esta ocorrência foi removida do planejamento.");
    const effective = getEffectiveRecurringItemForPeriod(recurring, periodKey);
    const amount = options?.customAmount ?? effective.amount;
    if (!Number.isFinite(amount) || amount < 0.01) throw new Error("Confira o valor antes de confirmar.");
    transaction.set(
      txRef,
      transactionPayload(
        {
          amount,
          type: effective.type === "income" ? "in" : "out",
          category: effective.category,
          description: effective.title,
          paymentMethod: effective.account,
          cardId: effective.cardId ?? null,
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

    transaction.set(
      recurringRef,
      {
        realizedPeriods: arrayUnion(periodKey),
        manualConfirmationPeriods: arrayRemove(periodKey),
      },
      { merge: true }
    );

  });
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
      manualConfirmationPeriods: arrayUnion(periodKey),
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
  if (transaction.groupId?.startsWith("goal-")) throw new Error("Para ajustar uma movimentação de meta, registre um aporte ou resgate na tela de Metas.");

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

  if (transaction.recurringItemId) {
    const recurringRef = doc(db, "users", userId, "recurring", transaction.recurringItemId);
    const recurringSnapshot = await getDoc(recurringRef);
    if (recurringSnapshot.exists()) {
      const recData = recurringSnapshot.data() as RecurringItem;
      const isInstallmentOrLimited = Boolean(
        recData.installmentsCount && recData.installmentsCount >= 1
      );
      const realizedCount = recData.realizedPeriods?.length ?? 0;

      // Se for compra parcelada/limitada com apenas essa ocorrência ou sem outras realizações,
      // exclui a série inteira para não ficar órfã nem recriar transações indesejadas
      if (isInstallmentOrLimited && realizedCount <= 1) {
        batch.delete(recurringRef);
      } else {
        // Marca o período como excluído pontualmente para que o timeProgressionService
        // JAMAIS recrie a transação automaticamente pelo catch-up!
        const updates: Record<string, unknown> = {};
        if (transaction.periodKey) {
          updates.realizedPeriods = arrayRemove(transaction.periodKey);
          updates.excludedPeriods = arrayUnion(transaction.periodKey);
        }
        batch.update(recurringRef, updates);
      }
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
  const existing = await getDoc(doc(db, "users", userId, TRANSACTIONS_COLLECTION, transactionId));
  if (existing.data()?.groupId?.startsWith("goal-")) throw new Error("Para ajustar uma movimentação de meta, registre um aporte ou resgate na tela de Metas.");
  await updateDoc(doc(db, "users", userId, TRANSACTIONS_COLLECTION, transactionId), {
    amount: Number(input.amount),
    type: input.type === "receita" ? "in" : "out",
    category: input.category,
    description: input.title,
    paymentMethod: input.account,
    cardId: input.cardId ?? null,
    date: input.date,
    occurredAt:
      input.occurredAt instanceof Date
        ? Timestamp.fromDate(input.occurredAt)
        : Timestamp.fromDate(new Date(input.occurredAt)),
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
