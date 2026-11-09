import type { CardItem, GoalItem, Transaction } from "../../types/index.ts";

export interface GoalOperation {
  operationId: string;
  goalId: string;
  action: "create" | "contribute" | "withdraw";
  amount: number;
  accountId?: string;
  initialGoal?: GoalItem;
  occurredAt: string;
}

export interface AtomicGoalStore {
  run<T>(work: (transaction: {
    get<T>(path: string): Promise<T | undefined>;
    set(path: string, value: object): void;
  }) => Promise<T>): Promise<T>;
}

interface GoalReceipt { requestKey: string; goal: GoalItem; }

/** A mesma intenção gera sempre o mesmo recibo e lançamento, inclusive após uma falha de rede. */
export async function commitGoalOperation(store: AtomicGoalStore, input: GoalOperation): Promise<GoalItem> {
  if (![input.goalId, input.operationId].every((id) => /^[a-zA-Z0-9_-]{1,120}$/.test(id))) {
    throw new Error("Identificador da movimentação inválido.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 100_000_000 ||
    (input.action !== "create" && input.amount <= 0) || Number.isNaN(new Date(input.occurredAt).getTime())) {
    throw new Error("Informe um valor válido para a movimentação.");
  }
  const cents = Math.round(input.amount * 100);
  if (input.action !== "create" && cents < 1) throw new Error("O valor mínimo é R$ 0,01.");
  const goalPath = `goals/${input.goalId}`;
  const receiptPath = `${goalPath}/movements/${input.operationId}`;
  const requestKey = JSON.stringify([input.action, input.goalId, cents, input.accountId ?? null, input.initialGoal ?? null]);

  return store.run(async (transaction) => {
    const receipt = await transaction.get<GoalReceipt>(receiptPath);
    if (receipt) {
      if (receipt.requestKey !== requestKey) throw new Error("Esta solicitação já foi usada em outra movimentação.");
      return receipt.goal;
    }
    const existingGoal = await transaction.get<GoalItem>(goalPath);
    if (input.action === "create" ? Boolean(existingGoal) : !existingGoal) {
      throw new Error(input.action === "create" ? "A meta já existe. Atualize a página antes de tentar novamente." : "Meta não encontrada.");
    }
    const goal = input.action === "create" ? input.initialGoal : existingGoal;
    if (!goal || !goal.title?.trim() || !Number.isFinite(goal.target) || goal.target <= 0 ||
      !Number.isFinite(goal.current) || goal.current < 0) throw new Error("Dados da meta inválidos.");

    const account = input.accountId ? await transaction.get<CardItem>(`cards/${input.accountId}`) : undefined;
    if (input.accountId && (!account || account.type !== "checking")) {
      throw new Error("Selecione uma conta corrente válida para esta movimentação.");
    }
    if (account && await transaction.get(`transactions/goal-${input.operationId}`)) {
      throw new Error("Esta solicitação já foi usada em outra movimentação.");
    }
    const currentCents = Math.round(goal.current * 100);
    if (input.action === "withdraw" && cents > currentCents) throw new Error("O saldo da meta mudou. Confira o valor disponível antes de resgatar.");
    const nextCents = input.action === "create" ? cents : currentCents + (input.action === "withdraw" ? -cents : cents);
    const updated = { ...goal, id: input.goalId, current: nextCents / 100 };

    // Todas as leituras terminam antes de qualquer escrita, como exige o Firestore.
    transaction.set(goalPath, updated);
    if (account && cents > 0) {
      const entry: Transaction = {
        amount: cents / 100,
        type: input.action === "withdraw" ? "in" : "out",
        category: "Investimentos & Metas",
        description: `${input.action === "withdraw" ? "Resgate" : input.action === "create" ? "Aporte inicial" : "Aporte"}: ${goal.title}`,
        paymentMethod: account.name,
        cardId: input.accountId,
        kind: "regular",
        groupId: `goal-${input.operationId}`,
        date: input.occurredAt,
        occurredAt: input.occurredAt,
      };
      transaction.set(`transactions/goal-${input.operationId}`, entry);
    }
    transaction.set(receiptPath, { requestKey, goal: updated, occurredAt: input.occurredAt });
    return updated;
  });
}
