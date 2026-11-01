import crypto from "node:crypto";
import { getAdminFirestore } from "../lib/firebaseAdmin.ts";

const TARGET_YEAR = 2026;
const TARGET_MONTH = 9; // Outubro, base zero.
const EXPECTED_OCTOBER_INCOME = 3227.95;
const EXPECTED_OCTOBER_OUTFLOW = 3617.47;

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function dateOf(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function transactionDate(transaction) {
  return dateOf(transaction.occurredAt) || dateOf(transaction.createdAt) || dateOf(transaction.date);
}

function accountName(transaction) {
  return String(transaction.paymentMethod || transaction.account || "").trim();
}

function entryType(transaction) {
  if (transaction.type === "in" || transaction.type === "receita") return "income";
  if (transaction.type === "out" || transaction.type === "despesa") return "outflow";
  return "unknown";
}

function matchesAccount(card, transaction) {
  const account = accountName(transaction).toLocaleLowerCase("pt-BR");
  return (
    transaction.cardId === card.id ||
    account === String(card.id).toLocaleLowerCase("pt-BR") ||
    account === String(card.name || "").toLocaleLowerCase("pt-BR") ||
    (card.type === "checking" && account === "débito/pix")
  );
}

function isActual(transaction, id) {
  return !String(id || "").startsWith("planned-") && Number(transaction.amount) > 0;
}

function periodKey(date) {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function hashId(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 10);
}

function sumFlow(entries) {
  return entries.reduce(
    (flow, entry) => {
      const type = entryType(entry.data);
      if (type === "income") flow.income += Number(entry.data.amount) || 0;
      if (type === "outflow") flow.outflow += Number(entry.data.amount) || 0;
      return flow;
    },
    { income: 0, outflow: 0 }
  );
}

function activeInMonth(item, year, monthIndex) {
  if (!item.active) return false;
  const startYear = Number.isInteger(item.startYear) ? item.startYear : year;
  const startMonth = Number.isInteger(item.startMonth) ? item.startMonth : monthIndex;
  const offset = (year - startYear) * 12 + (monthIndex - startMonth);
  if (offset < 0) return false;
  if (item.installmentsCount > 0 && offset >= item.installmentsCount) return false;
  const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  if (item.excludedPeriods?.includes(key)) return false;
  return true;
}

async function loadCollection(db, userId, collectionName) {
  const snapshot = await db.collection("users").doc(userId).collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

function auditUser(userId, cards, transactions, recurring) {
  const checkingCards = cards.filter((card) => card.data.type === "checking");
  if (checkingCards.length === 0) return null;

  const octoberStart = new Date(TARGET_YEAR, TARGET_MONTH, 1, 0, 0, 0, 0);
  const novemberStart = new Date(TARGET_YEAR, TARGET_MONTH + 1, 1, 0, 0, 0, 0);
  const septemberStart = new Date(TARGET_YEAR, TARGET_MONTH - 1, 1, 0, 0, 0, 0);

  const checkingEntries = transactions.filter((entry) =>
    isActual(entry.data, entry.id) && checkingCards.some((card) => matchesAccount(card.data, entry.data))
  );
  const septemberEntries = checkingEntries.filter((entry) => {
    const date = transactionDate(entry.data);
    return date && date >= septemberStart && date < octoberStart;
  });
  const octoberEntries = checkingEntries.filter((entry) => {
    const date = transactionDate(entry.data);
    return date && date >= octoberStart && date < novemberStart;
  });
  const beforeSeptemberEntries = checkingEntries.filter((entry) => {
    const date = transactionDate(entry.data);
    return date && date < septemberStart;
  });

  const septemberFlow = sumFlow(septemberEntries);
  const octoberFlow = sumFlow(octoberEntries);
  const beforeSeptemberFlow = sumFlow(beforeSeptemberEntries);
  const storedOpening = checkingCards.reduce(
    (sum, card) => sum + Number(card.data.openingBalance ?? card.data.balance ?? 0),
    0
  );
  const storedSnapshot = checkingCards.reduce(
    (sum, card) => sum + Number(card.data.balance ?? 0),
    0
  );
  const septemberOpening = storedOpening + beforeSeptemberFlow.income - beforeSeptemberFlow.outflow;
  const septemberClosing = septemberOpening + septemberFlow.income - septemberFlow.outflow;
  const octoberClosing = septemberClosing + octoberFlow.income - octoberFlow.outflow;

  const matchesScreenshot =
    Math.abs(round(octoberFlow.income) - EXPECTED_OCTOBER_INCOME) < 0.02 &&
    Math.abs(round(octoberFlow.outflow) - EXPECTED_OCTOBER_OUTFLOW) < 0.02;

  const missingDates = transactions.filter((entry) => !transactionDate(entry.data));
  const mismatchedPeriods = transactions.filter((entry) => {
    const date = transactionDate(entry.data);
    return date && entry.data.periodKey && entry.data.periodKey !== periodKey(date);
  });

  const recurringOccurrenceCounts = new Map();
  for (const entry of transactions) {
    const recurringId = entry.data.recurringItemId;
    const key = entry.data.periodKey;
    if (!recurringId || !key || !isActual(entry.data, entry.id)) continue;
    const occurrenceKey = `${recurringId}:${key}`;
    recurringOccurrenceCounts.set(
      occurrenceKey,
      (recurringOccurrenceCounts.get(occurrenceKey) || 0) + 1
    );
  }
  const duplicateOccurrences = [...recurringOccurrenceCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key: hashId(key), count }));

  const octoberKey = "2026-10";
  const activeOctoberRecurring = recurring.filter((item) =>
    activeInMonth(item.data, TARGET_YEAR, TARGET_MONTH)
  );
  const realizedWithoutTransaction = activeOctoberRecurring
    .filter((item) => item.data.realizedPeriods?.includes(octoberKey))
    .filter(
      (item) =>
        !transactions.some(
          (entry) =>
            entry.data.recurringItemId === item.id &&
            entry.data.periodKey === octoberKey &&
            isActual(entry.data, entry.id)
        )
    )
    .map((item) => ({
      item: hashId(item.id),
      amount: round(item.data.amount),
      type: item.data.type || "expense",
      account: item.data.account || null,
    }));

  const invoiceGroups = new Map();
  for (const entry of transactions) {
    if (!entry.data.groupId) continue;
    const group = invoiceGroups.get(entry.data.groupId) || [];
    group.push(entry);
    invoiceGroups.set(entry.data.groupId, group);
  }
  const malformedInvoiceGroups = [...invoiceGroups.entries()]
    .filter(([, entries]) => {
      const kinds = new Set(entries.map((entry) => entry.data.kind));
      return entries.length !== 2 || !kinds.has("invoice_payment") || !kinds.has("invoice_settlement");
    })
    .map(([groupId, entries]) => ({
      group: hashId(groupId),
      count: entries.length,
      kinds: entries.map((entry) => entry.data.kind || "regular"),
    }));

  const octoberLedger = octoberEntries
    .sort((a, b) => (transactionDate(a.data)?.getTime() || 0) - (transactionDate(b.data)?.getTime() || 0))
    .map((entry) => ({
      id: hashId(entry.id),
      date: transactionDate(entry.data)?.toISOString().slice(0, 10) || null,
      type: entryType(entry.data),
      amount: round(entry.data.amount),
      category: entry.data.category || "Outros",
      account: accountName(entry.data),
      kind: entry.data.kind || "regular",
      recurring: Boolean(entry.data.recurringItemId),
      periodKey: entry.data.periodKey || null,
    }));

  return {
    user: hashId(userId),
    matchesScreenshot,
    dataCounts: {
      checkingAccounts: checkingCards.length,
      transactions: transactions.length,
      recurring: recurring.length,
    },
    accountModel: checkingCards.map((card) => ({
      account: hashId(card.id),
      storedBalanceSnapshot: round(card.data.balance),
      openingBalance: round(card.data.openingBalance),
      ledgerBalanceVersion: card.data.ledgerBalanceVersion ?? null,
    })),
    sequence: {
      storedOpening: round(storedOpening),
      storedLegacySnapshot: round(storedSnapshot),
      september: {
        opening: round(septemberOpening),
        income: round(septemberFlow.income),
        outflow: round(septemberFlow.outflow),
        closing: round(septemberClosing),
      },
      october: {
        openingFromSeptember: round(septemberClosing),
        income: round(octoberFlow.income),
        outflow: round(octoberFlow.outflow),
        closing: round(octoberClosing),
      },
    },
    integrity: {
      missingDates: missingDates.length,
      mismatchedPeriods: mismatchedPeriods.map((entry) => ({
        id: hashId(entry.id),
        storedPeriod: entry.data.periodKey,
        datePeriod: periodKey(transactionDate(entry.data)),
        amount: round(entry.data.amount),
      })),
      duplicateOccurrences,
      realizedWithoutTransaction,
      malformedInvoiceGroups,
    },
    octoberLedger,
  };
}

const auditUserId = process.env.AUDIT_USER_ID?.trim();
if (!auditUserId) {
  throw new Error(
    "Defina AUDIT_USER_ID com o UID da conta autenticada. A auditoria não enumera usuários."
  );
}

const db = getAdminFirestore();
const [cards, transactions, recurring] = await Promise.all([
  loadCollection(db, auditUserId, "cards"),
  loadCollection(db, auditUserId, "transactions"),
  loadCollection(db, auditUserId, "recurring"),
]);
const audit = auditUser(auditUserId, cards, transactions, recurring);

console.log(JSON.stringify({ audit }, null, 2));
