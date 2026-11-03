"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import {
  HelpCircle,
  CheckCircle2,
  Circle,
  FileText,
  CreditCard,
  CalendarDays,
  ArrowLeftRight,
  Target,
  Sparkles,
  User,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  X,
  BookOpen,
  Plus,
} from "lucide-react";

import {
  PAGE_TUTORIALS,
  ONBOARDING_DIRECT_STEPS,
  evaluateGettingStartedTutorial,
  type PageTutorialStep,
  type PageTutorialConfig,
} from "@/lib/utils/tutorialData";

export {
  PAGE_TUTORIALS,
  ONBOARDING_DIRECT_STEPS,
  evaluateGettingStartedTutorial,
  type PageTutorialStep,
  type PageTutorialConfig,
};

const TUTORIAL_COMPLETED_KEY = "wallet_tutorial_completed_v1";
const TUTORIAL_COLLAPSED_KEY = "wallet_getting_started_collapsed_v1";
const TUTORIAL_COMPLETED_EVENT = "wallet:tutorial-completed";

export function markTutorialCompletedInStorage() {
  try {
    window.localStorage.setItem(TUTORIAL_COMPLETED_KEY, "true");
    window.dispatchEvent(new Event(TUTORIAL_COMPLETED_EVENT));
  } catch {
    // ignore
  }
}

/**
 * 1. CARD "PASSO A PASSO PARA COMEÇAR" NO DASHBOARD
 * Mostra de forma super direta o que o usuário precisa fazer assim que entra no app.
 * Assim que todos os passos forem cumpridos (ou o usuário concluir/dispensar o tutorial),
 * o card some completamente da tela inicial (`return null`).
 */
export function GettingStartedChecklist({
  onOpenStatementImport,
  onOpenNewCard,
  onOpenNewTransaction,
}: {
  onOpenStatementImport: () => void;
  onOpenNewCard: () => void;
  onOpenNewTransaction: () => void;
}) {
  const router = useRouter();
  const { userProfile, cards, recurringItems, transactions, isDataLoaded } = useWallet();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [manuallyCompleted, setManuallyCompleted] = useState(false);
  const [isStorageChecked, setIsStorageChecked] = useState(false);
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);

  useEffect(() => {
    try {
      const completed = window.localStorage.getItem(TUTORIAL_COMPLETED_KEY) === "true";
      const collapsed = window.localStorage.getItem(TUTORIAL_COLLAPSED_KEY) === "true";
      setManuallyCompleted(completed);
      setIsCollapsed(collapsed);
    } catch {
      // ignore
    } finally {
      setIsStorageChecked(true);
    }

    const handleCompletedEvent = () => setManuallyCompleted(true);
    window.addEventListener(TUTORIAL_COMPLETED_EVENT, handleCompletedEvent);
    return () => window.removeEventListener(TUTORIAL_COMPLETED_EVENT, handleCompletedEvent);
  }, []);

  const evaluation = evaluateGettingStartedTutorial({
    userName: userProfile.name,
    monthlyIncomeBase: userProfile.monthlyIncomeBase,
    cardsCount: cards.length,
    recurringCount: recurringItems.length,
    transactionsCount: transactions.length,
    manuallyCompleted,
  });

  // Se o usuário acabou de completar todos os passos, grava como concluído para sumir em definitivo
  useEffect(() => {
    if (isDataLoaded && evaluation.allStepsCompleted && !manuallyCompleted) {
      markTutorialCompletedInStorage();
    }
  }, [isDataLoaded, evaluation.allStepsCompleted, manuallyCompleted]);

  // Não exibe antes de carregar dados ou se o tutorial já foi cumprido
  if (!isStorageChecked || !isDataLoaded || evaluation.shouldHideFromHome) {
    return null;
  }

  const hasCreditCard = cards.some((c) => c.type === "credit");

  const checklistItems = [
    {
      id: "profile",
      step: "Passo 1",
      title: "Coloque seu nome e sua renda mensal",
      description:
        "Defina seu nome e quanto você recebe por mês para o app calcular seu limite seguro de gastos.",
      done: evaluation.stepsStatus.profile,
      buttonLabel: evaluation.stepsStatus.profile ? "Revisar Perfil" : "Preencher Nome e Renda",
      onAction: () => router.push("/profile"),
    },
    {
      id: "pdf-import",
      step: "Passo 2 • Recomendado",
      title: "Exporte aqui o PDF do extrato do seu banco",
      description:
        "Baixe o extrato ou fatura em PDF no app do seu banco e envie aqui. O app já identifica suas contas, gastos e contas fixas automaticamente para você confirmar.",
      done: evaluation.stepsStatus.pdfImport,
      highlight: true,
      buttonLabel: "Enviar PDF do Extrato",
      onAction: onOpenStatementImport,
    },
    {
      id: "cards",
      step: "Passo 3",
      title: "Cadastre suas contas e cartões de crédito",
      description:
        "Adicione os cartões que você usa informando o limite, o dia que a fatura fecha e o dia que vence.",
      done: evaluation.stepsStatus.cards,
      buttonLabel: hasCreditCard ? "Adicionar Outro Cartão" : "Cadastrar Cartão",
      onAction: onOpenNewCard,
    },
    {
      id: "recurring",
      step: "Passo 4",
      title: "Confira suas contas fixas (Aluguel, Luz, Assinaturas)",
      description:
        "No Planejamento Mensal ficam as contas que vencem todo mês e as compras parceladas.",
      done: evaluation.stepsStatus.recurring,
      buttonLabel: evaluation.stepsStatus.recurring ? "Ver Planejamento" : "Cadastrar Contas Fixas",
      onAction: () => router.push("/planning"),
    },
    {
      id: "transactions",
      step: "Passo 5",
      title: "Anote gastos avulsos do dia a dia",
      description:
        "Fez um Pix ou comprou algo hoje? Clique em '+ Nova Transação' ou use a Captura Rápida.",
      done: evaluation.stepsStatus.transactions,
      buttonLabel: "Lançar Gasto Agora",
      onAction: onOpenNewTransaction,
    },
  ];

  const completedCount = evaluation.completedCount;

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      window.localStorage.setItem(TUTORIAL_COLLAPSED_KEY, next ? "true" : "false");
    } catch {
      // ignore
    }
  };

  const handleDismissTutorial = () => {
    setManuallyCompleted(true);
    markTutorialCompletedInStorage();
  };

  return (
    <>
      <section
        className="w-full rounded-[24px] bg-white border border-black/[0.06] shadow-[0_2px_14px_rgba(0,0,0,0.035)] overflow-hidden transition-all"
        data-testid="getting-started-tutorial-card"
      >
        {/* Barra Superior do Guia */}
        <div className="px-5 py-4 bg-[#1D1D1F] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <BookOpen size={17} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                  Guia Rápido de Uso ({completedCount}/{checklistItems.length} concluídos)
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                Passo a passo: Como deixar sua carteira pronta em 1 minuto
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setIsTourModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle size={13} />
              <span>Ver Tutorial de Cada Tela</span>
            </button>

            <button
              type="button"
              onClick={toggleCollapse}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              {isCollapsed ? (
                <>
                  <span>Mostrar Passos</span>
                  <ChevronDown size={14} />
                </>
              ) : (
                <>
                  <span>Recolher</span>
                  <ChevronUp size={14} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDismissTutorial}
              title="Já concluí / Ocultar passo a passo da tela inicial"
              className="px-2.5 py-1.5 rounded-xl text-white/75 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X size={14} />
              <span className="hidden md:inline">Concluir</span>
            </button>
          </div>
        </div>

        {/* Lista Direta de Passos */}
        {!isCollapsed && (
          <div className="p-4 sm:p-5 divide-y divide-black/[0.05]">
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className={`py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.highlight && !item.done
                    ? "bg-amber-50/50 -mx-2 px-3 rounded-2xl border border-amber-200/60 my-1"
                    : ""
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {item.done ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : (
                      <Circle
                        size={18}
                        className={item.highlight ? "text-amber-600" : "text-[#86868B]"}
                      />
                    )}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          item.highlight
                            ? "bg-amber-100 text-amber-800"
                            : "bg-[#F2F2F7] text-[#86868B]"
                        }`}
                      >
                        {item.step}
                      </span>
                      <h3
                        className={`text-xs sm:text-sm font-semibold ${
                          item.done ? "text-[#86868B] line-through" : "text-[#1D1D1F]"
                        }`}
                      >
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-xs text-[#86868B] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={item.onAction}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 self-start sm:self-center cursor-pointer ${
                    item.highlight && !item.done
                      ? "bg-[#1D1D1F] hover:bg-black text-white shadow-xs"
                      : item.done
                      ? "bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F]"
                      : "bg-[#F2F2F7] hover:bg-[#1D1D1F] text-[#1D1D1F] hover:text-white"
                  }`}
                >
                  <span>{item.buttonLabel}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <InteractiveAppTourModal
        isOpen={isTourModalOpen}
        onClose={() => setIsTourModalOpen(false)}
      />
    </>
  );
}

/**
 * 2. BARRA DIDÁTICA CONTEXTUAL POR TELA ("Como funciona esta tela")
 * Aparece de forma discreta no topo das telas internas (Transações, Planejamento, Cartões, Metas, IA, Perfil)
 * explicando em 3 passos diretos como fazer as coisas naquela página.
 */
export function ContextualPageTutorialBar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  // No Dashboard já exibimos o GettingStartedChecklist completo
  if (!pathname || pathname === "/dashboard") return null;

  const config = PAGE_TUTORIALS[pathname];
  if (!config) return null;

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 pt-3">
        <div className="rounded-2xl bg-white/90 backdrop-blur-md border border-black/[0.06] shadow-2xs overflow-hidden">
          <div className="px-4 py-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="flex items-center gap-2 text-left text-xs font-semibold text-[#1D1D1F] hover:text-black cursor-pointer min-w-0"
            >
              <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <HelpCircle size={13} />
              </span>
              <span className="truncate">
                Como usar: <strong>{config.sectionName}</strong> — {config.summary}
              </span>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[11px] font-semibold text-[#1D1D1F] flex items-center gap-1 cursor-pointer"
              >
                <span>{isOpen ? "Fechar dicas" : "Ver passo a passo"}</span>
                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              <button
                type="button"
                onClick={() => setIsTourOpen(true)}
                className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-[#1D1D1F] hover:bg-black text-[11px] font-semibold text-white cursor-pointer"
              >
                Guia Completo do App
              </button>
            </div>
          </div>

          {isOpen && (
            <div className="px-4 pb-4 pt-2 border-t border-black/[0.04] grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
              {config.steps.map((step) => (
                <div
                  key={step.stepNumber}
                  className="p-3 rounded-xl bg-[#F2F2F7]/70 border border-black/[0.03] space-y-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#1D1D1F] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {step.stepNumber}
                    </span>
                    <h4 className="text-xs font-semibold text-[#1D1D1F]">
                      {step.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-[#636366] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <InteractiveAppTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </>
  );
}

/**
 * 3. MODAL INTERATIVO DE TUTORIAL POR CADA PARTE DO APP
 * Permite navegar parte por parte do app e ver de forma direta como cadastrar e usar cada função.
 */
export function InteractiveAppTourModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const tourPages = Object.values(PAGE_TUTORIALS);
  const initialIdx = Math.max(
    0,
    tourPages.findIndex((p) => p.route === pathname)
  );
  const [activeIndex, setActiveIndex] = useState(initialIdx);

  if (!isOpen) return null;

  const currentTutorial = tourPages[activeIndex] || tourPages[0];

  const getIconForRoute = (route: string) => {
    switch (route) {
      case "/dashboard":
        return <FileText size={16} />;
      case "/transactions":
        return <ArrowLeftRight size={16} />;
      case "/planning":
        return <CalendarDays size={16} />;
      case "/cards":
        return <CreditCard size={16} />;
      case "/goals":
        return <Target size={16} />;
      case "/ai":
        return <Sparkles size={16} />;
      default:
        return <User size={16} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-md animate-in fade-in duration-150"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-2xl bg-[#F2F2F7] rounded-t-[32px] sm:rounded-[32px] shadow-[0_25px_70px_rgba(0,0,0,0.3)] border border-white/60 overflow-hidden z-10 flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-black/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center">
              <BookOpen size={17} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] block">
                Tutorial Prático do App ({activeIndex + 1} de {tourPages.length})
              </span>
              <h2 className="text-base font-semibold text-[#1D1D1F]">
                Como usar cada parte do Wallet
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E5E5EA] hover:bg-[#D1D1D6] text-[#1D1D1F] flex items-center justify-center cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Seletor de Partes do App */}
        <div className="px-6 py-3 bg-white/60 border-b border-black/[0.05] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tourPages.map((p, idx) => (
            <button
              key={p.route}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                idx === activeIndex
                  ? "bg-[#1D1D1F] text-white shadow-2xs"
                  : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-black/[0.05]"
              }`}
            >
              {getIconForRoute(p.route)}
              <span>{p.sectionName.split(" (")[0]}</span>
            </button>
          ))}
        </div>

        {/* Conteúdo da Parte Selecionada */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-black/[0.05] space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
              {currentTutorial.sectionName}
            </span>
            <h3 className="text-lg font-semibold text-[#1D1D1F]">
              {currentTutorial.headline}
            </h3>
            <p className="text-xs text-[#86868B] leading-relaxed">
              {currentTutorial.summary}
            </p>
          </div>

          <div className="space-y-3">
            {currentTutorial.steps.map((step) => (
              <div
                key={step.stepNumber}
                className="bg-white rounded-2xl p-4 border border-black/[0.05] flex items-start gap-3.5"
              >
                <div className="w-7 h-7 rounded-xl bg-[#1D1D1F] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step.stepNumber}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-[#1D1D1F]">
                    {step.title}
                  </h4>
                  <p className="text-xs text-[#636366] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer de Navegação entre as Telas */}
        <div className="px-6 py-4 bg-white border-t border-black/[0.06] flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
            className="px-3.5 py-2 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] disabled:opacity-40 text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Anterior</span>
          </button>

          <div className="flex items-center gap-2">
            {pathname !== currentTutorial.route && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(currentTutorial.route);
                }}
                className="px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold cursor-pointer"
              >
                Ir para {currentTutorial.sectionName.split(" (")[0]}
              </button>
            )}

            {activeIndex < tourPages.length - 1 ? (
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => Math.min(tourPages.length - 1, prev + 1))}
                className="px-4 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span>Próxima Parte</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  markTutorialCompletedInStorage();
                  onClose();
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Entendi, começar a usar!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
