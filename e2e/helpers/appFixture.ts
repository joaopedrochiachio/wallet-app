import path from "node:path";
import { buildFixture } from "./buildFixture";

/**
 * Renderiza qualquer tela do app dentro do AppShell real, com dados de estresse
 * (títulos longos, valores altos, vários cartões) e sem Firebase/rede.
 * A rota é lida de location.pathname.
 */
export async function buildAppFixture() {
  const root = process.cwd();
  const file = (name: string) => JSON.stringify(path.join(root, name).replaceAll("\\", "/"));
  const pages: Record<string, string> = {
    "/": "app/page.tsx",
    "/login": "app/login/page.tsx",
    "/onboarding": "app/onboarding/page.tsx",
    "/dashboard": "app/dashboard/page.tsx",
    "/transactions": "app/transactions/page.tsx",
    "/planning": "app/planning/page.tsx",
    "/cards": "app/cards/page.tsx",
    "/goals": "app/goals/page.tsx",
    "/profile": "app/profile/page.tsx",
    "/ai": "app/ai/page.tsx",
  };
  const imports = Object.entries(pages)
    .map(([, page], i) => `import Page${i} from ${file(page)};`)
    .join("\n");
  const routes = Object.keys(pages)
    .map((route, i) => `${JSON.stringify(route)}: Page${i}`)
    .join(",");

  return buildFixture(
    "wallet-app-fixture",
    `
    import React from "react";
    import {createRoot} from "react-dom/client";
    import {AppShell} from ${file("components/layout/AppShell.tsx")};
    ${imports}
    const routes = {${routes}};
    const Page = routes[location.pathname] || routes["/dashboard"];
    createRoot(document.getElementById("root")).render(<AppShell><Page /></AppShell>);
  `,
    {
      "next/link": `import React from "react"; export default function Link({children,href,prefetch,...props}){return <a href={typeof href==="string"?href:"#"} {...props}>{children}</a>}`,
      "next/navigation": `
        export const usePathname = () => location.pathname;
        export const useRouter = () => ({ push(){}, replace(){}, back(){}, prefetch(){}, refresh(){} });
        export const useSearchParams = () => new URLSearchParams(location.search);
        export const redirect = () => {};
      `,
      "@/lib/firebase": `export const auth = { currentUser: { uid: "user-1", getIdToken: async () => "token" }, onAuthStateChanged: () => () => {} }; export const db = {}; export const app = {}; export default {};`,
      "@/context/AuthContext": `
        import React from "react";
        const user = { uid: "user-1", email: "pessoa.teste@example.com", displayName: "Pessoa Teste com Nome Bem Comprido", getIdToken: async () => "token" };
        const value = { user, loading: false, authError: null, clearAuthError(){}, signIn: async () => user, signUp: async () => user, signInWithGoogle: async () => user, signOut: async () => {}, resetPassword: async () => {}, deleteAccount: async () => {} };
        export function AuthProvider({children}){ return children; }
        export function useAuth(){ return value; }
      `,
      "@/lib/services/aiChatService": `
        export const loadChatSessions = async () => [];
        export const saveChatSessions = async () => {};
        export const createChatSession = (title = "Nova Consulta") => ({ id: "session-" + Math.random().toString(36).slice(2), title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] });
        export const loadPersistentDiagnosis = async () => null;
        export const savePersistentDiagnosis = async () => {};
        export const loadInitialDiagnosisSync = () => null;
        export const loadDismissedPatterns = () => [];
        export const dismissPattern = () => [];
        export const loadCachedBriefing = () => null;
        export const saveCachedBriefing = () => {};
      `,
      "@/context/WalletContext": `
        import React from "react";
        const now = new Date();
        const iso = (d) => new Date(now.getFullYear(), now.getMonth(), d, 12).toISOString();
        const scheme = (g) => ({ gradient: g, border: "border-white/10", accent: "#111", badgeText: "Pass", chipGradient: "from-zinc-300 to-zinc-500" });
        const cards = [
          { id: "checking", name: "Conta Principal Itaú Personnalité", brand: "Itaú", type: "checking", openingBalance: 128450.37, balance: 128450.37, limit: 0, spent: 0, colorScheme: scheme("from-zinc-800 to-zinc-900") },
          { id: "nubank", name: "Nubank Ultravioleta Black", brand: "Mastercard", type: "credit", limit: 45000, spent: 18320.9, closingDay: 28, dueDay: 5, colorScheme: scheme("from-violet-700 to-indigo-900") },
          { id: "inter", name: "Inter Black", brand: "Mastercard", type: "credit", limit: 25000, spent: 2310.45, closingDay: 10, dueDay: 17, colorScheme: scheme("from-orange-500 to-amber-700") },
          { id: "xp", name: "XP Visa Infinite", brand: "Visa", type: "credit", limit: 60000, spent: 9876.54, closingDay: 2, dueDay: 9, colorScheme: scheme("from-slate-700 to-slate-950") },
        ];
        const longTitle = "Assinatura anual do serviço de streaming premium com nome extremamente longo";
        const transactions = Array.from({ length: 18 }, (_, i) => ({
          id: "tx-" + i,
          title: i % 3 === 0 ? longTitle : ["Supermercado Pão de Açúcar", "Uber", "Farmácia", "Salário"][i % 4],
          amount: i % 4 === 3 ? 18750.5 : 129.9 + i * 37,
          type: i % 4 === 3 ? "receita" : "despesa",
          category: ["Alimentação & Delivery", "Transporte & Combustível", "Saúde & Bem-estar", "Salário / Extra"][i % 4],
          account: i % 2 ? "Nubank Ultravioleta Black" : "Conta Principal Itaú Personnalité",
          cardId: i % 2 ? "nubank" : "checking",
          kind: "regular",
          date: iso(1 + (i % 14)),
          occurredAt: iso(1 + (i % 14)),
        }));
        const recurringItems = [
          { id: "rent", title: "Aluguel do apartamento com condomínio incluso", amount: 4850, type: "expense", account: "Conta Principal Itaú Personnalité", cardId: "checking", category: "Moradia & Contas", dueDay: 10, active: true, startYear: now.getFullYear(), startMonth: now.getMonth() },
          { id: "salary", title: "Salário", amount: 18750.5, type: "income", account: "Conta Principal Itaú Personnalité", cardId: "checking", category: "Salário / Extra", dueDay: 5, recurrenceType: "business_day_5", active: true, startYear: now.getFullYear(), startMonth: now.getMonth() },
          { id: "phone", title: "iPhone 17 Pro Max 1TB", amount: 1249.9, type: "expense", account: "Nubank Ultravioleta Black", cardId: "nubank", category: "Tecnologia", dueDay: 5, installmentsCount: 12, active: true, startYear: now.getFullYear(), startMonth: now.getMonth() },
        ];
        const goals = [
          { id: "g1", title: "Reserva de emergência para doze meses de custo de vida", category: "Segurança", current: 48250.75, target: 120000 },
          { id: "g2", title: "Viagem", category: "Lazer", current: 3200, target: 15000, deadline: iso(28) },
        ];
        const userProfile = { name: "Pessoa Teste com Nome Bem Comprido", email: "pessoa.teste@example.com", role: "", avatarInitials: "PT", monthlyIncomeBase: 18750.5, currency: "BRL", persona: "optimizer", riskTolerance: "moderate", aiTone: "direct", maxCommitmentAlertPercent: 60, primaryFocus: "Reserva", targetMonthEndBalance: 5000, isOnboarded: true, categoryBudgets: [{ id: "b1", category: "Alimentação & Delivery", amount: 1500, alertPercent: 80 }] };
        const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
        function getMonthlyProjection(index = 0) {
          const d = new Date(now.getFullYear(), now.getMonth() + index, 1);
          return { monthName: monthNames[d.getMonth()], year: d.getFullYear(), baseIncome: 18750.5, plannedIncomesTotal: 18750.5, projectedIncome: 18750.5, recurringDebitTotal: 4850, recurringCreditTotal: 1249.9, cardInstallments: 1249.9, totalCommitted: 6099.9, actualIncomeTotal: 18750.5, actualOutflowTotal: 9800, balanceReconciliationTotal: 0, pendingCommitted: 4850, projectedFreeBalance: 123600.47, openingBalance: 128450.37, actualClosingBalance: 137400.87, cardInvoices: cards.filter(c => c.type === "credit").map(c => ({ cardId: c.id, cardName: c.name, dueDay: c.dueDay, closingDay: c.closingDay, installmentsAmount: 1249.9, recurringAmount: 0, totalInvoice: c.spent, paidAmount: 0, pendingInvoice: c.spent, isPaid: false, recurringItems: [], transactions: transactions.filter(t => t.cardId === c.id), invoicePeriodKey: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), invoiceDueMonthName: monthNames[d.getMonth()] })), totalInvoicesScheduled: 30508, totalInvoicesPending: 30508, totalInvoicesPaid: 0, monthNetSurplus: 8950.5 };
        }
        const noop = async () => {};
        const wallet = {
          userProfile, cards, activeCardId: "nubank", activeCard: cards[1], transactions, recurringItems, goals, isDataLoaded: true,
          mainBalance: 128450.37, totalInvoices: 30508, monthIncome: 18750.5, monthExpense: 9800,
          accountOptions: cards.map(c => c.name),
          selectCard(){}, updateCardLimit(){}, updateCardBillingCycle: noop, addCard: (c) => ({ ...c, id: "new", spent: 0 }), deleteCard(){},
          updateUserProfile(){}, saveCategoryBudgets: noop, addTransaction: noop, reconcileCheckingBalance: async () => 0,
          updateTransaction: noop, payInvoice: noop, unpayInvoice: noop, deleteTransaction: noop, addRecurringItem: noop,
          updateRecurringItem: noop, updateRecurringItemOccurrence: noop, deleteRecurringItemOccurrence: noop, toggleRecurringItem: noop,
          deleteRecurringItem: noop, realizeRecurringItemNow: noop, unrealizeRecurringItem: noop, getMonthlyProjection,
          addGoal: async (g) => ({ ...g, id: "new-goal" }), contributeToGoal: noop, withdrawFromGoal: noop, updateGoal: noop, deleteGoal(){},
        };
        export function WalletProvider({children}){ return children; }
        export function useWallet(){ return wallet; }
      `,
    }
  );
}
