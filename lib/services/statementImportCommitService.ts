import { db } from "@/lib/firebase";
import {
  collection,
   deleteField,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import type { CardItem, RecurringItem } from "@/types";
import { CURRENT_LEDGER_BALANCE_VERSION, calculateCheckingBalance } from "@/lib/utils/ledger";
import { getPeriodKey } from "@/lib/utils/dateUtils";
import type {
  DetectedStatementAccount,
  DetectedStatementRecurring,
  DetectedStatementTransaction,
} from "./statementImportService";
import type { TransactionItem } from "@/context/WalletContext";

export interface CommitStatementImportParams {
  userId: string;
  accounts: DetectedStatementAccount[];
  recurringItems: DetectedStatementRecurring[];
  transactions: DetectedStatementTransaction[];
  existingCards: CardItem[];
  existingTransactions: TransactionItem[];
}

export interface CommitStatementImportResult {
  createdCardsCount: number;
  updatedCardsCount: number;
  createdRecurringCount: number;
  createdTransactionsCount: number;
  primaryCardId?: string;
}

/**
 * Persiste no Firestore (em lotes atômicos de até 400 operações) todas as contas,
 * cartões, itens recorrentes e transações confirmadas pelo usuário após a análise do extrato.
 *
 * Garante conciliação contábil exata:
 * - O `openingBalance` da conta corrente é ajustado em função do fluxo líquido importado
 *   para que `calculateCheckingBalance` reflita exatamente o saldo atual confirmado pelo usuário.
 * - As recorrências cujos lançamentos já constam no extrato importado recebem `realizedPeriods`
 *   na competência correspondente, evitando cobrança duplicada no mês corrente.
 */
export async function commitStatementImportToFirestore(
  params: CommitStatementImportParams
): Promise<CommitStatementImportResult> {
  const {
    userId,
    accounts,
    recurringItems,
    transactions,
    existingCards,
    existingTransactions,
  } = params;

  if (!userId) {
    throw new Error("Usuário não autenticado para importar o extrato.");
  }

  const selectedAccounts = accounts.filter((a) => a.selected);
  const selectedRecurring = recurringItems.filter((r) => r.selected);
  const selectedTransactions = transactions.filter((t) => t.selected);

  type BatchOp = (batch: ReturnType<typeof writeBatch>) => void;
  const operations: BatchOp[] = [];

  let createdCardsCount = 0;
  let updatedCardsCount = 0;
  let createdRecurringCount = 0;
  let createdTransactionsCount = 0;
  let primaryCardId: string | undefined = undefined;

  // Mapeia tipo de conta ("checking" | "credit") para { cardId, cardName }
  const resolvedAccountByType: Record<
    "checking" | "credit",
    { cardId: string; cardName: string } | undefined
  > = {
    checking: undefined,
    credit: undefined,
  };

  // Preenche fallback inicial com cartões já existentes do usuário
  const existingChecking = existingCards.find((c) => c.type === "checking");
  if (existingChecking) {
    resolvedAccountByType.checking = {
      cardId: existingChecking.id,
      cardName: existingChecking.name,
    };
  }
  const existingCredit = existingCards.find((c) => c.type === "credit");
  if (existingCredit) {
    resolvedAccountByType.credit = {
      cardId: existingCredit.id,
      cardName: existingCredit.name,
    };
  }

  // Fluxo líquido das transações selecionadas de conta corrente
  const importedCheckingNetFlow = selectedTransactions
    .filter((t) => t.accountType === "checking")
    .reduce((sum, t) => sum + (t.type === "receita" ? t.amount : -t.amount), 0);

  // 1. Processar Contas & Cartões Confirmados
  for (let idx = 0; idx < selectedAccounts.length; idx++) {
    const acc = selectedAccounts[idx];
    const matchedExisting = acc.existingCardId
      ? existingCards.find((c) => c.id === acc.existingCardId)
      : undefined;

    if (acc.action === "link_existing" && matchedExisting) {
      resolvedAccountByType[acc.type] = {
        cardId: matchedExisting.id,
        cardName: matchedExisting.name,
      };
      if (!primaryCardId) primaryCardId = matchedExisting.id;

      // Se o usuário optou por conciliar o saldo atual da conta existente com o saldo final do extrato
      if (acc.type === "checking" && acc.updateExistingBalance) {
        const currentCalculated = calculateCheckingBalance(matchedExisting, existingTransactions);
        const projectedAfterImport = currentCalculated + importedCheckingNetFlow;
        const diff = Math.round((acc.balance - projectedAfterImport) * 100) / 100;

        if (Math.abs(diff) >= 0.01) {
          const currentOpening = matchedExisting.openingBalance ?? matchedExisting.balance ?? 0;
          const nextOpening = Math.round((currentOpening + diff) * 100) / 100;
          const cardRef = doc(db, "users", userId, "cards", matchedExisting.id);
          operations.push((batch) => {
            batch.set(
              cardRef,
              {
                openingBalance: nextOpening,
                balance: acc.balance,
                ledgerBalanceVersion: CURRENT_LEDGER_BALANCE_VERSION,
              },
              { merge: true }
            );
          });
          updatedCardsCount++;
        }
      } else if (acc.type === "credit") {
        const cardRef = doc(db, "users", userId, "cards", matchedExisting.id);
        operations.push((batch) => {
          batch.set(
            cardRef,
            {
              limit: acc.limit > 0 ? acc.limit : matchedExisting.limit,
              closingDay: acc.closingDay || matchedExisting.closingDay || 10,
              dueDay: acc.dueDay || matchedExisting.dueDay || 17,
            },
            { merge: true }
          );
        });
        updatedCardsCount++;
      }
    } else {
      // Criar novo Cartão / Conta
      const newCardId = `card-${Date.now()}-${idx + 1}`;
      const openingBalance =
        acc.type === "checking"
          ? Math.round((acc.balance - importedCheckingNetFlow) * 100) / 100
          : 0;

      const newCard: CardItem = {
        id: newCardId,
        name: acc.name.trim() || (acc.type === "checking" ? "Conta Principal" : "Cartão de Crédito"),
        brand: acc.brand || (acc.type === "checking" ? "Conta" : "Mastercard"),
        type: acc.type,
        balance: acc.type === "checking" ? acc.balance : 0,
        openingBalance,
        ledgerBalanceVersion:
          acc.type === "checking" ? CURRENT_LEDGER_BALANCE_VERSION : undefined,
        limit: acc.type === "credit" ? Math.max(100, acc.limit) : 0,
        spent: 0,
        invoiceAmount: 0,
        closingDay: acc.closingDay || 10,
        dueDay: acc.dueDay || 17,
        colorScheme: acc.colorScheme,
      };

      const cleanCard = JSON.parse(JSON.stringify(newCard));
      const cardRef = doc(db, "users", userId, "cards", newCardId);
      operations.push((batch) => {
        batch.set(cardRef, cleanCard, { merge: true });
      });

      resolvedAccountByType[acc.type] = {
        cardId: newCardId,
        cardName: newCard.name,
      };
      if (!primaryCardId) primaryCardId = newCardId;
      createdCardsCount++;
    }
  }

  // 2. Processar Contas Fixas, Assinaturas, Salários e Parcelamentos (Planejamento Mensal)
  // Mapeia sourceTransactionId -> { recurringId, periodKey } para vincular a transação real
  const txToRecurringLink = new Map<string, { recurringId: string; periodKey: string }>();

  for (let idx = 0; idx < selectedRecurring.length; idx++) {
    const rec = selectedRecurring[idx];
    const resolvedTarget = resolvedAccountByType[rec.accountType] || resolvedAccountByType.checking;
    const targetCardId = resolvedTarget?.cardId || null;
    const targetAccountName =
      resolvedTarget?.cardName ||
      rec.accountName ||
      (rec.accountType === "checking" ? "Débito/Pix" : "Cartão de Crédito");

    const newRecId = `rec-${Date.now()}-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`;

    // Verifica se a transação de origem também está sendo importada para marcar a competência como já realizada
    const realizedPeriods: string[] = [];
    const matchingTx = selectedTransactions.find(
      (t) =>
        t.id === rec.sourceTransactionId ||
        (t.title.toLowerCase() === rec.title.toLowerCase() && Math.abs(t.amount - rec.amount) < 0.01)
    );

    if (matchingTx) {
      const [yStr, mStr] = matchingTx.date.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      if (!Number.isNaN(y) && !Number.isNaN(m)) {
        const periodKey = getPeriodKey(y, m);
        realizedPeriods.push(periodKey);
        txToRecurringLink.set(matchingTx.id, { recurringId: newRecId, periodKey });
      }
    }

    const recurringDoc: RecurringItem = {
      id: newRecId,
      title: rec.title.trim(),
      amount: Math.round(rec.amount * 100) / 100,
      type: rec.type,
      account: targetAccountName,
      cardId: targetCardId,
      category: rec.category,
      dueDay: Math.min(31, Math.max(1, rec.dueDay || 10)),
      recurrenceType: rec.recurrenceType || "fixed_day",
      installmentsCount: rec.installmentsCount,
      startMonth: rec.startMonth,
      startYear: rec.startYear,
      realizedPeriods,
      active: true,
    };

    const cleanRecurring: Record<string, unknown> = JSON.parse(JSON.stringify(recurringDoc));
    if (recurringDoc.installmentsCount === undefined) {
      cleanRecurring.installmentsCount = deleteField();
    }

    const recRef = doc(db, "users", userId, "recurring", newRecId);
    operations.push((batch) => {
      batch.set(recRef, cleanRecurring, { merge: true });
    });
    createdRecurringCount++;
  }

  // 3. Processar Transações Realizadas do Extrato
  const transactionsCol = collection(db, "users", userId, "transactions");

  for (const tx of selectedTransactions) {
    const resolvedTarget = resolvedAccountByType[tx.accountType] || resolvedAccountByType.checking;
    const targetCardId = resolvedTarget?.cardId || null;
    const targetAccountName =
      resolvedTarget?.cardName ||
      tx.accountName ||
      (tx.accountType === "checking" ? "Débito/Pix" : "Cartão de Crédito");

    const [yStr, mStr, dStr] = tx.date.split("-");
    const year = parseInt(yStr, 10) || new Date().getFullYear();
    const month = (parseInt(mStr, 10) || 1) - 1;
    const day = parseInt(dStr, 10) || 1;
    const occurredAtDate = new Date(year, month, day, 12, 0, 0);
    const periodKey = getPeriodKey(year, month);

    const linkedRec = txToRecurringLink.get(tx.id);
    const txRef = doc(transactionsCol);

    operations.push((batch) => {
      batch.set(txRef, {
        amount: Math.round(tx.amount * 100) / 100,
        type: tx.type === "receita" ? "in" : "out",
        category: tx.category || "Outros",
        description: tx.title.trim(),
        paymentMethod: targetAccountName,
        cardId: targetCardId,
        kind: "regular",
        relatedCardId: null,
        groupId: null,
        recurringItemId: linkedRec?.recurringId ?? null,
        periodKey: linkedRec?.periodKey ?? periodKey,
        date: tx.date,
        occurredAt: Timestamp.fromDate(occurredAtDate),
        createdAt: serverTimestamp(),
        userId,
      });
    });
    createdTransactionsCount++;
  }

  // 4. Executa commits em lotes seguros de até 400 operações por writeBatch
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      op(batch);
    }
    await batch.commit();
  }

  return {
    createdCardsCount,
    updatedCardsCount,
    createdRecurringCount,
    createdTransactionsCount,
    primaryCardId,
  };
}

