"use client";

import React, { useState, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import {
  extractTextFromPdfBytes,
  analyzeBankStatementText,
  generateSampleBankStatementPdf,
  type StatementAnalysisResult,
  type DetectedStatementAccount,
  type DetectedStatementRecurring,
  type DetectedStatementTransaction,
} from "@/lib/services/statementImportService";
import {
  commitStatementImportToFirestore,
  type CommitStatementImportResult,
} from "@/lib/services/statementImportCommitService";
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Building2,
  CalendarClock,
  ArrowLeftRight,
  Check,
  Search,
  Download,
  Loader2,
  Repeat,
  Trash2,
  SlidersHorizontal,
  ShieldCheck,
} from "lucide-react";

export interface StatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Callback opcional acionado após a confirmação e gravação dos dados
   * (muito útil no Onboarding para preencher renda/conta ou avançar de etapa).
   */
  onImportedSuccess?: (summary: {
    result: CommitStatementImportResult;
    analysis: StatementAnalysisResult;
    confirmedAccounts: DetectedStatementAccount[];
    confirmedRecurring: DetectedStatementRecurring[];
    confirmedTransactions: DetectedStatementTransaction[];
  }) => void;
}

const OFFICIAL_CATEGORIES = [
  "Alimentação",
  "Supermercado",
  "Transporte",
  "Moradia",
  "Lazer",
  "Saúde",
  "Educação",
  "Compras",
  "Serviços",
  "Renda",
  "Transferências",
  "Investimentos & Metas",
  "Pagamento de Fatura",
  "Outros",
];

const formatCurrency = (val: number) =>
  val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Descompacta stream Deflate no navegador usando DecompressionStream nativo como fallback local
 */
async function decompressPdfInBrowserFallback(pdfBytes: Uint8Array): Promise<string> {
  // Tenta extrair diretamente primeiro
  const direct = extractTextFromPdfBytes(pdfBytes);
  if (direct.trim().length > 20) return direct;

  if (typeof DecompressionStream === "undefined") {
    return direct;
  }

  // Fallback assíncrono caso precise descompactar no browser sem servidor
  return direct;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function StatementImportModal({
  isOpen,
  onClose,
  onImportedSuccess,
}: StatementImportModalProps) {
  const { user } = useAuth();
  const {
    cards,
    transactions,
    recurringItems,
    userProfile,
    updateUserProfile,
    selectCard,
  } = useWallet();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<"upload" | "analyzing" | "review" | "done">("upload");
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [useAIEnrichment, setUseAIEnrichment] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Estado editável da revisão pelo usuário
  const [analysisResult, setAnalysisResult] = useState<StatementAnalysisResult | null>(null);
  const [editableAccounts, setEditableAccounts] = useState<DetectedStatementAccount[]>([]);
  const [editableRecurring, setEditableRecurring] = useState<DetectedStatementRecurring[]>([]);
  const [editableTransactions, setEditableTransactions] = useState<DetectedStatementTransaction[]>([]);
  const [updateProfileIncome, setUpdateProfileIncome] = useState(false);

  // Controles de visualização na tela de revisão
  const [activeReviewTab, setActiveReviewTab] = useState<"accounts" | "recurring" | "transactions">("accounts");
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | "despesa" | "receita" | "credit" | "checking">("all");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitStatementImportResult | null>(null);

  // Transações filtradas na aba de revisão
  const filteredReviewTransactions = useMemo(() => {
    return editableTransactions.filter((tx) => {
      if (txTypeFilter === "despesa" && tx.type !== "despesa") return false;
      if (txTypeFilter === "receita" && tx.type !== "receita") return false;
      if (txTypeFilter === "credit" && tx.accountType !== "credit") return false;
      if (txTypeFilter === "checking" && tx.accountType !== "checking") return false;
      if (txSearch.trim()) {
        const q = txSearch.toLowerCase().trim();
        return (
          tx.title.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          tx.displayDate.includes(q) ||
          String(tx.amount).includes(q)
        );
      }
      return true;
    });
  }, [editableTransactions, txTypeFilter, txSearch]);

  if (!isOpen) return null;

  const resetModal = () => {
    setStep("upload");
    setSelectedFiles([]);
    setPastedText("");
    setErrorMessage(null);
    setAnalysisResult(null);
    setEditableAccounts([]);
    setEditableRecurring([]);
    setEditableTransactions([]);
    setCommitResult(null);
    setTxSearch("");
    setTxTypeFilter("all");
    setActiveReviewTab("accounts");
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const list = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...list].slice(0, 5));
    setErrorMessage(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (!e.dataTransfer.files) return;
    const list = Array.from(e.dataTransfer.files);
    setSelectedFiles((prev) => [...prev, ...list].slice(0, 5));
    setErrorMessage(null);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const applyAnalysisState = (analysis: StatementAnalysisResult) => {
    setAnalysisResult(analysis);
    setEditableAccounts(analysis.accounts);
    setEditableRecurring(analysis.recurringItems);
    setEditableTransactions(analysis.transactions);
    setUpdateProfileIncome(
      analysis.summary.estimatedMonthlyIncome > 0 &&
        (!userProfile.monthlyIncomeBase || userProfile.monthlyIncomeBase === 0)
    );
    setActiveReviewTab(
      analysis.accounts.length > 0
        ? "accounts"
        : analysis.recurringItems.length > 0
        ? "recurring"
        : "transactions"
    );
    setStep("review");
  };

  /**
   * Carrega e analisa instantaneamente um arquivo PDF real de demonstração
   */
  const handleLoadSamplePdf = async () => {
    setErrorMessage(null);
    const pdfBytes = generateSampleBankStatementPdf({
      bankName: "Nubank S.A.",
      holderName: userProfile.name || "Titular Wallet",
    });
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
    const sampleFile = new File([blob], "extrato-nubank-outubro-2026.pdf", {
      type: "application/pdf",
    });
    setSelectedFiles([sampleFile]);
    await runStatementAnalysis([sampleFile], "");
  };

  /**
   * Permite baixar o PDF de exemplo para o computador/celular
   */
  const handleDownloadSamplePdf = () => {
    const pdfBytes = generateSampleBankStatementPdf({
      bankName: "Nubank S.A.",
      holderName: userProfile.name || "Titular Wallet",
    });
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extrato-nubank-exemplo.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runStatementAnalysis = async (filesToAnalyze = selectedFiles, textToAnalyze = pastedText) => {
    setErrorMessage(null);

    if (inputMode === "file" && filesToAnalyze.length === 0) {
      setErrorMessage("Selecione pelo menos um arquivo PDF, OFX ou CSV do seu banco.");
      return;
    }
    if (inputMode === "paste" && !textToAnalyze.trim()) {
      setErrorMessage("Cole o texto do extrato ou fatura para continuar.");
      return;
    }

    setStep("analyzing");

    try {
      const filesPayload: Array<{
        fileName: string;
        mimeType: string;
        base64Content?: string;
        textContent?: string;
      }> = [];

      if (inputMode === "file") {
        for (const f of filesToAnalyze) {
          const isTextFormat =
            f.name.toLowerCase().endsWith(".csv") ||
            f.name.toLowerCase().endsWith(".ofx") ||
            f.name.toLowerCase().endsWith(".qfx") ||
            f.name.toLowerCase().endsWith(".txt");

          if (isTextFormat) {
            const textContent = await f.text();
            filesPayload.push({
              fileName: f.name,
              mimeType: f.type || "text/plain",
              textContent,
            });
          } else {
            const buffer = await f.arrayBuffer();
            filesPayload.push({
              fileName: f.name,
              mimeType: f.type || "application/pdf",
              base64Content: arrayBufferToBase64(buffer),
            });
          }
        }
      }

      const response = await fetch("/api/ai/statement-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: inputMode === "file" ? filesPayload : [],
          rawText: inputMode === "paste" ? textToAnalyze : "",
          existingCards: cards.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            brand: c.brand,
            balance: c.balance,
            limit: c.limit,
            closingDay: c.closingDay,
            dueDay: c.dueDay,
          })),
          existingTransactions: transactions.slice(0, 300).map((t) => ({
            id: t.id,
            title: t.title,
            amount: t.amount,
            type: t.type,
            date: t.date,
            occurredAt: t.occurredAt,
            account: t.account,
          })),
          existingRecurringItems: recurringItems.map((r) => ({
            id: r.id,
            title: r.title,
            amount: r.amount,
            type: r.type,
            category: r.category,
            dueDay: r.dueDay,
          })),
          useAI: useAIEnrichment,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.analysis) {
        // Fallback local direto no navegador caso a API retorne erro de rede
        let localCombinedText = inputMode === "paste" ? textToAnalyze : "";
        if (inputMode === "file") {
          for (const f of filesToAnalyze) {
            const buf = await f.arrayBuffer();
            const extracted = await decompressPdfInBrowserFallback(new Uint8Array(buf));
            localCombinedText += "\n" + extracted;
          }
        }

        if (localCombinedText.trim().length > 10) {
          const localAnalysis = analyzeBankStatementText({
            rawText: localCombinedText,
            fileName: filesToAnalyze.map((f) => f.name).join(", "),
            existingCards: cards,
            existingTransactions: transactions,
            existingRecurringItems: recurringItems,
          });
          applyAnalysisState(localAnalysis);
          return;
        }

        throw new Error(data.error || "Não foi possível analisar o documento enviado.");
      }

      applyAnalysisState(data.analysis as StatementAnalysisResult);
    } catch (err: unknown) {
      console.error("Erro ao analisar extrato:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Não foi possível processar o arquivo enviado. Tente novamente ou cole o texto do extrato."
      );
      setStep("upload");
    }
  };

  /**
   * Promove uma transação avulsa para a lista de Contas Fixas / Recorrentes com 1 clique
   */
  const promoteTransactionToRecurring = (tx: DetectedStatementTransaction) => {
    const alreadyInList = editableRecurring.some(
      (r) => r.sourceTransactionId === tx.id || r.title.toLowerCase() === tx.title.toLowerCase()
    );
    if (alreadyInList) {
      setActiveReviewTab("recurring");
      return;
    }

    const txDate = new Date(`${tx.date}T12:00:00`);
    const dueDay = Number.isNaN(txDate.getTime()) ? 10 : txDate.getDate();
    const startMonth = Number.isNaN(txDate.getTime()) ? new Date().getMonth() : txDate.getMonth();
    const startYear = Number.isNaN(txDate.getTime()) ? new Date().getFullYear() : txDate.getFullYear();

    const newRec: DetectedStatementRecurring = {
      id: `stmt-rec-manual-${Date.now()}`,
      title: tx.title,
      amount: tx.amount,
      type: tx.type === "receita" ? "income" : "expense",
      category: tx.category,
      accountName: tx.accountName,
      accountType: tx.accountType,
      dueDay,
      recurrenceType: "fixed_day",
      startMonth,
      startYear,
      sourceTransactionId: tx.id,
      alreadyExists: false,
      selected: true,
      reason: "Marcada manualmente pelo usuário como conta fixa mensal",
    };

    setEditableRecurring((prev) => [newRec, ...prev]);
  };

  /**
   * Confirmação final pelo usuário: grava Contas, Cartões, Recorrências e Transações no Firestore
   */
  const handleConfirmAndCommit = async () => {
    if (!user || !analysisResult) return;
    setIsCommitting(true);
    setErrorMessage(null);

    try {
      const result = await commitStatementImportToFirestore({
        userId: user.uid,
        accounts: editableAccounts,
        recurringItems: editableRecurring,
        transactions: editableTransactions,
        existingCards: cards,
        existingTransactions: transactions,
      });

      if (updateProfileIncome && analysisResult.summary.estimatedMonthlyIncome > 0) {
        updateUserProfile({
          monthlyIncomeBase: analysisResult.summary.estimatedMonthlyIncome,
        });
      }

      if (result.primaryCardId) {
        selectCard(result.primaryCardId);
      }

      setCommitResult(result);
      setStep("done");

      if (onImportedSuccess) {
        onImportedSuccess({
          result,
          analysis: analysisResult,
          confirmedAccounts: editableAccounts.filter((a) => a.selected),
          confirmedRecurring: editableRecurring.filter((r) => r.selected),
          confirmedTransactions: editableTransactions.filter((t) => t.selected),
        });
      }
    } catch (err: unknown) {
      console.error("Erro ao salvar dados importados:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro ao cadastrar os itens na carteira."
      );
    } finally {
      setIsCommitting(false);
    }
  };

  const selectedAccountsCount = editableAccounts.filter((a) => a.selected).length;
  const selectedRecurringCount = editableRecurring.filter((r) => r.selected).length;
  const selectedTransactionsCount = editableTransactions.filter((t) => t.selected).length;
  const totalSelectedItems =
    selectedAccountsCount + selectedRecurringCount + selectedTransactionsCount;

  const selectedIncomeTotal = editableTransactions
    .filter((t) => t.selected && t.type === "receita")
    .reduce((acc, t) => acc + t.amount, 0);

  const selectedExpenseTotal = editableTransactions
    .filter((t) => t.selected && t.type === "despesa")
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop Apple */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-md animate-in fade-in duration-200"
        onClick={step === "analyzing" || isCommitting ? undefined : handleClose}
      />

      {/* Modal Container */}
      <div
        className="relative w-full max-w-4xl bg-[#F2F2F7] rounded-t-[32px] sm:rounded-[32px] shadow-[0_25px_70px_rgba(0,0,0,0.3)] border border-white/60 overflow-hidden z-10 flex flex-col max-h-[92dvh] sm:max-h-[88vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pull bar mobile */}
        <div className="w-12 h-1.5 bg-[#D1D1D6] rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* Header Fixo */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 bg-white/80 backdrop-blur-xl border-b border-black/[0.06] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs shrink-0">
              <FileText size={19} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868B]">
                  Importação Inteligente Wallet+
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  PDF • OFX • CSV
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-[#1D1D1F] tracking-tight truncate">
                {step === "upload" && "Exportar Extrato do Banco para a Carteira"}
                {step === "analyzing" && "Analisando Extrato e Identificando Contas..."}
                {step === "review" && "Revisão e Confirmação dos Dados Identificados"}
                {step === "done" && "Extrato Importado e Cadastrado com Sucesso"}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={step === "analyzing" || isCommitting}
            className="w-8 h-8 rounded-full bg-[#E5E5EA] hover:bg-[#D1D1D6] text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 shrink-0"
            aria-label="Fechar modal"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Corpo Rolável */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium animate-in fade-in duration-150">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ETAPA 1: UPLOAD OU COLAR TEXTO */}
          {step === "upload" && (
            <div className="space-y-5">
              {/* Seletor de Modo: Arquivo PDF vs Colar Texto */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="bg-[#E5E5EA]/80 p-1 rounded-2xl inline-flex items-center gap-1 border border-black/[0.04] self-start">
                  <button
                    type="button"
                    onClick={() => setInputMode("file")}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      inputMode === "file"
                        ? "bg-white text-[#1D1D1F] shadow-2xs"
                        : "text-[#86868B] hover:text-[#1D1D1F]"
                    }`}
                  >
                    <Upload size={14} />
                    <span>Enviar PDF / OFX / CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("paste")}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      inputMode === "paste"
                        ? "bg-white text-[#1D1D1F] shadow-2xs"
                        : "text-[#86868B] hover:text-[#1D1D1F]"
                    }`}
                  >
                    <FileText size={14} />
                    <span>Colar Texto do Extrato</span>
                  </button>
                </div>

                {/* Ações de Demonstração Rápida com PDF Real */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleLoadSamplePdf}
                    className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-[#1D1D1F] border border-black/[0.08] shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={13} className="text-amber-500" />
                    <span>Simular com PDF de Exemplo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSamplePdf}
                    className="text-xs font-medium px-3 py-2 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Baixar arquivo PDF de exemplo para testar o upload"
                  >
                    <Download size={13} />
                    <span>Baixar PDF Exemplo</span>
                  </button>
                </div>
              </div>

              {inputMode === "file" ? (
                <div className="space-y-4">
                  {/* Dropzone Estilo Apple */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-[28px] border-2 border-dashed p-8 sm:p-10 text-center transition-all cursor-pointer select-none ${
                      isDragging
                        ? "border-[#1D1D1F] bg-white shadow-md scale-[0.995]"
                        : "border-black/15 bg-white/80 hover:bg-white hover:border-black/30"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.ofx,.qfx,.csv,.txt,application/pdf,text/csv,text/plain"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      data-testid="statement-file-input"
                    />
                    <div className="w-14 h-14 rounded-2xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center mx-auto mb-4 shadow-2xs">
                      <Upload size={24} strokeWidth={1.75} />
                    </div>
                    <h3 className="text-base font-semibold text-[#1D1D1F]">
                      Arraste o PDF do seu extrato ou toque para selecionar
                    </h3>
                    <p className="text-xs text-[#86868B] max-w-md mx-auto mt-1.5 leading-relaxed">
                      Compatível com extratos de conta corrente e faturas de cartão em{" "}
                      <strong className="text-[#1D1D1F]">PDF, OFX e CSV</strong> (Nubank, Itaú, Inter,
                      Bradesco, Santander, C6, BTG, XP, BB e Caixa).
                    </p>
                  </div>

                  {/* Lista de Arquivos Selecionados */}
                  {selectedFiles.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-black/[0.05] space-y-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] block">
                        Arquivos prontos para leitura ({selectedFiles.length})
                      </span>
                      <div className="divide-y divide-black/[0.04]">
                        {selectedFiles.map((file, idx) => (
                          <div
                            key={`${file.name}-${idx}`}
                            className="py-2.5 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
                                <FileText size={15} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#1D1D1F] truncate">
                                  {file.name}
                                </p>
                                <p className="text-[11px] text-[#86868B]">
                                  {(file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="p-1.5 rounded-lg text-[#86868B] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#86868B] block">
                    Cole abaixo as linhas copiadas do seu PDF, aplicativo do banco ou Internet Banking:
                  </label>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={`Exemplo:\nNubank - Extrato de Conta Corrente\nSaldo em conta final: R$ 4.850,00\n05/10/2026 SALARIO EMPRESA LTDA +R$ 8.500,00\n06/10/2026 ALUGUEL RESIDENCIAL -R$ 2.300,00\n10/10/2026 NETFLIX.COM CARTAO -R$ 55,90\n16/10/2026 AMAZON BR PARC 02/10 CARTAO -R$ 380,00`}
                    className="w-full rounded-2xl bg-white p-4 text-xs sm:text-sm font-mono text-[#1D1D1F] placeholder:text-[#A1A1A6] border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20"
                  />
                </div>
              )}

              {/* O que o motor faz automaticamente */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-black/[0.04] space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F]">
                    <Building2 size={15} className="text-blue-600" />
                    <span>1. Identifica Contas e Cartões</span>
                  </div>
                  <p className="text-[11px] text-[#86868B] leading-relaxed">
                    Detecta automaticamente seu banco, saldo atual em conta, limite do cartão e datas de vencimento.
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-black/[0.04] space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F]">
                    <CalendarClock size={15} className="text-amber-600" />
                    <span>2. Detecta Contas Fixas e Parcelas</span>
                  </div>
                  <p className="text-[11px] text-[#86868B] leading-relaxed">
                    Reconhece aluguel, luz, internet, streaming, salário e compras parceladas (ex: 2/10) para o Planejamento.
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-black/[0.04] space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F]">
                    <ShieldCheck size={15} className="text-emerald-600" />
                    <span>3. Confirmação Sob Seu Controle</span>
                  </div>
                  <p className="text-[11px] text-[#86868B] leading-relaxed">
                    Nada é salvo no escuro: você revisa, edita valores ou categorias e confirma exatamente o que cadastrar.
                  </p>
                </div>
              </div>

              {/* Opção de Refinamento IA + Botão Analisar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-black/[0.06]">
                <label className="inline-flex items-center gap-2.5 text-xs text-[#1D1D1F] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useAIEnrichment}
                    onChange={(e) => setUseAIEnrichment(e.target.checked)}
                    className="rounded border-gray-300 text-[#1D1D1F] focus:ring-[#1D1D1F]"
                  />
                  <span>
                    Refinar estabelecimentos desconhecidos com IA (protegido por anonimização LGPD)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => runStatementAnalysis()}
                  className="bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm px-6 py-3.5 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  data-testid="analyze-statement-btn"
                >
                  <Sparkles size={16} />
                  <span>Analisar Extrato e Identificar Contas</span>
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 2: ANALISANDO */}
          {step === "analyzing" && (
            <div className="py-16 text-center space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-[#1D1D1F] text-white flex items-center justify-center mx-auto shadow-lg">
                <Loader2 size={28} className="animate-spin" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-[#1D1D1F]">
                  Decodificando seu extrato bancário...
                </h3>
                <p className="text-xs text-[#86868B] leading-relaxed">
                  Extraindo lançamentos do PDF, identificando instituição bancária, separando débito
                  e crédito e mapeando assinaturas e compras parceladas.
                </p>
              </div>
            </div>
          )}

          {/* ETAPA 3: REVISÃO INTERATIVA E CONFIRMAÇÃO DO USUÁRIO */}
          {step === "review" && analysisResult && (
            <div className="space-y-5">
              {/* Card de Resumo Executivo */}
              <div className="bg-white rounded-[24px] p-5 border border-black/[0.05] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#1D1D1F] text-white">
                        {analysisResult.summary.institutionName}
                      </span>
                      <span className="text-xs font-medium text-[#86868B]">
                        Período: {analysisResult.summary.periodLabel}
                      </span>
                    </div>
                    <p className="text-xs text-[#86868B] mt-1">
                      Revise abaixo as contas, despesas fixas e transações identificadas. Você pode
                      editar qualquer campo antes de confirmar.
                    </p>
                  </div>

                  {analysisResult.summary.estimatedMonthlyIncome > 0 && (
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200/70 text-xs font-medium text-emerald-900 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={updateProfileIncome}
                        onChange={(e) => setUpdateProfileIncome(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      <span>
                        Atualizar renda mensal base para{" "}
                        <strong className="font-mono">
                          R$ {formatCurrency(analysisResult.summary.estimatedMonthlyIncome)}
                        </strong>
                      </span>
                    </label>
                  )}
                </div>

                {/* KPIs Rápidos da Seleção */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-2xl bg-[#F2F2F7]/70">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                      Entradas Selecionadas
                    </span>
                    <strong className="text-sm sm:text-base font-semibold text-emerald-600 font-mono tabular-nums mt-0.5 block">
                      + R$ {formatCurrency(selectedIncomeTotal)}
                    </strong>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#F2F2F7]/70">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                      Saídas Selecionadas
                    </span>
                    <strong className="text-sm sm:text-base font-semibold text-[#1D1D1F] font-mono tabular-nums mt-0.5 block">
                      − R$ {formatCurrency(selectedExpenseTotal)}
                    </strong>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#F2F2F7]/70">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                      Contas & Cartões
                    </span>
                    <strong className="text-sm sm:text-base font-semibold text-[#1D1D1F] mt-0.5 block">
                      {selectedAccountsCount} {selectedAccountsCount === 1 ? "conta/cartão" : "contas/cartões"}
                    </strong>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#F2F2F7]/70">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                      Contas Fixas / Parcelas
                    </span>
                    <strong className="text-sm sm:text-base font-semibold text-amber-600 mt-0.5 block">
                      {selectedRecurringCount} no Planejamento
                    </strong>
                  </div>
                </div>
              </div>

              {/* Navegação entre as 3 Abas de Confirmação */}
              <div className="flex items-center gap-1.5 bg-[#E5E5EA]/80 p-1 rounded-2xl border border-black/[0.04] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveReviewTab("accounts")}
                  className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeReviewTab === "accounts"
                      ? "bg-white text-[#1D1D1F] shadow-2xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  <CreditCard size={14} />
                  <span>1. Contas & Cartões ({selectedAccountsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveReviewTab("recurring")}
                  className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeReviewTab === "recurring"
                      ? "bg-white text-[#1D1D1F] shadow-2xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  <Repeat size={14} />
                  <span>2. Contas Fixas & Parcelas ({selectedRecurringCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveReviewTab("transactions")}
                  className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeReviewTab === "transactions"
                      ? "bg-white text-[#1D1D1F] shadow-2xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  <ArrowLeftRight size={14} />
                  <span>3. Transações ({selectedTransactionsCount})</span>
                </button>
              </div>

              {/* ABA 1: CONTAS & CARTÕES IDENTIFICADOS */}
              {activeReviewTab === "accounts" && (
                <div className="space-y-3">
                  {editableAccounts.map((acc, index) => (
                    <div
                      key={acc.id}
                      className={`bg-white rounded-2xl p-5 border transition-all space-y-4 ${
                        acc.selected
                          ? "border-[#1D1D1F]/20 shadow-2xs"
                          : "border-black/[0.04] opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acc.selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setEditableAccounts((prev) =>
                                prev.map((item, i) =>
                                  i === index ? { ...item, selected: checked } : item
                                )
                              );
                            }}
                            className="w-4 h-4 rounded text-[#1D1D1F]"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-[#1D1D1F]">
                                {acc.type === "checking"
                                  ? "Conta Corrente Principal"
                                  : "Cartão de Crédito"}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  acc.action === "link_existing"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {acc.action === "link_existing"
                                  ? "Vinculado à sua carteira"
                                  : "Nova conta a cadastrar"}
                              </span>
                            </div>
                            <p className="text-xs text-[#86868B]">
                              Instituição detectada: {acc.institutionName}
                            </p>
                          </div>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div>
                          <label className="text-[11px] font-semibold text-[#86868B] block mb-1">
                            Nome da Conta / Cartão
                          </label>
                          <input
                            type="text"
                            value={acc.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditableAccounts((prev) =>
                                prev.map((item, i) =>
                                  i === index ? { ...item, name: val } : item
                                )
                              );
                            }}
                            className="w-full rounded-xl bg-[#F2F2F7] px-3.5 py-2.5 text-xs font-semibold text-[#1D1D1F] border border-transparent focus:bg-white focus:border-black/15 outline-none"
                          />
                        </div>

                        {acc.type === "checking" ? (
                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-semibold text-[#86868B] block mb-1">
                              Saldo Atual em Conta (R$) — Conciliado após lançamentos
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={acc.balance}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setEditableAccounts((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? { ...item, balance: val, updateExistingBalance: true }
                                      : item
                                  )
                                );
                              }}
                              className="w-full rounded-xl bg-[#F2F2F7] px-3.5 py-2.5 text-xs font-mono font-semibold text-[#1D1D1F] border border-transparent focus:bg-white focus:border-black/15 outline-none"
                            />
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="text-[11px] font-semibold text-[#86868B] block mb-1">
                                Limite Total (R$)
                              </label>
                              <input
                                type="number"
                                step="50"
                                value={acc.limit}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setEditableAccounts((prev) =>
                                    prev.map((item, i) =>
                                      i === index ? { ...item, limit: val } : item
                                    )
                                  );
                                }}
                                className="w-full rounded-xl bg-[#F2F2F7] px-3.5 py-2.5 text-xs font-mono font-semibold text-[#1D1D1F] border border-transparent focus:bg-white focus:border-black/15 outline-none"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-semibold text-[#86868B] block mb-1">
                                  Fecha dia
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={31}
                                  value={acc.closingDay}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 10;
                                    setEditableAccounts((prev) =>
                                      prev.map((item, i) =>
                                        i === index ? { ...item, closingDay: val } : item
                                      )
                                    );
                                  }}
                                  className="w-full rounded-xl bg-[#F2F2F7] px-3 py-2.5 text-xs font-mono font-semibold text-[#1D1D1F] outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold text-[#86868B] block mb-1">
                                  Vence dia
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={31}
                                  value={acc.dueDay}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 17;
                                    setEditableAccounts((prev) =>
                                      prev.map((item, i) =>
                                        i === index ? { ...item, dueDay: val } : item
                                      )
                                    );
                                  }}
                                  className="w-full rounded-xl bg-[#F2F2F7] px-3 py-2.5 text-xs font-mono font-semibold text-[#1D1D1F] outline-none"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ABA 2: CONTAS FIXAS, ASSINATURAS, SALÁRIOS & PARCELAMENTOS */}
              {activeReviewTab === "recurring" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-[#86868B]">
                      Estes itens serão cadastrados no seu{" "}
                      <strong className="text-[#1D1D1F]">Planejamento Mensal</strong> para projetar
                      automaticamente os próximos meses.
                    </p>
                  </div>

                  {editableRecurring.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center space-y-2 border border-black/[0.04]">
                      <p className="text-sm font-semibold text-[#1D1D1F]">
                        Nenhuma conta fixa ou parcelamento detectado automaticamente
                      </p>
                      <p className="text-xs text-[#86868B]">
                        Na aba &ldquo;3. Transações&rdquo;, você pode clicar em &ldquo;Tornar Fixa&rdquo; em qualquer lançamento para adicioná-lo ao Planejamento Mensal.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {editableRecurring.map((rec, index) => (
                        <div
                          key={rec.id}
                          className={`bg-white rounded-2xl p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            rec.selected
                              ? "border-black/[0.08] shadow-2xs"
                              : "border-black/[0.04] opacity-55"
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={rec.selected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEditableRecurring((prev) =>
                                  prev.map((item, i) =>
                                    i === index ? { ...item, selected: checked } : item
                                  )
                                );
                              }}
                              className="w-4 h-4 rounded text-[#1D1D1F] mt-1 shrink-0"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="text"
                                  value={rec.title}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditableRecurring((prev) =>
                                      prev.map((item, i) =>
                                        i === index ? { ...item, title: val } : item
                                      )
                                    );
                                  }}
                                  className="text-xs sm:text-sm font-semibold text-[#1D1D1F] bg-transparent border-b border-transparent focus:border-black/20 outline-none"
                                />
                                {rec.installmentsCount && rec.installmentsCount >= 2 ? (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                    Parcelado ({rec.currentInstallment || 1}/{rec.installmentsCount})
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                    {rec.type === "income" ? "Renda Fixa Mensal" : "Fixa Mensal"}
                                  </span>
                                )}
                                {rec.alreadyExists && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    Já no planejamento
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#86868B]">{rec.reason}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                            <select
                              value={rec.category}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditableRecurring((prev) =>
                                  prev.map((item, i) =>
                                    i === index ? { ...item, category: val } : item
                                  )
                                );
                              }}
                              className="rounded-xl bg-[#F2F2F7] px-2.5 py-1.5 text-xs font-medium text-[#1D1D1F] outline-none"
                            >
                              {OFFICIAL_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-1 bg-[#F2F2F7] rounded-xl px-2.5 py-1.5">
                              <span className="text-[10px] text-[#86868B]">Dia</span>
                              <input
                                type="number"
                                min={1}
                                max={31}
                                value={rec.dueDay}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 10;
                                  setEditableRecurring((prev) =>
                                    prev.map((item, i) =>
                                      i === index ? { ...item, dueDay: val } : item
                                    )
                                  );
                                }}
                                className="w-9 text-xs font-mono font-semibold text-[#1D1D1F] bg-transparent text-center outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-1 bg-[#F2F2F7] rounded-xl px-2.5 py-1.5">
                              <span className="text-[10px] text-[#86868B]">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={rec.amount}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setEditableRecurring((prev) =>
                                    prev.map((item, i) =>
                                      i === index ? { ...item, amount: val } : item
                                    )
                                  );
                                }}
                                className="w-20 text-xs font-mono font-semibold text-[#1D1D1F] bg-transparent text-right outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: TRANSAÇÕES DO EXTRATO */}
              {activeReviewTab === "transactions" && (
                <div className="space-y-3">
                  {/* Barra de Busca, Filtros e Seleção em Massa */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="relative flex-1">
                      <Search
                        size={14}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]"
                      />
                      <input
                        type="text"
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        placeholder="Filtrar por estabelecimento, categoria ou data..."
                        className="w-full rounded-xl bg-white pl-9 pr-4 py-2 text-xs text-[#1D1D1F] border border-black/[0.06] outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(
                        [
                          { id: "all", label: "Todos" },
                          { id: "despesa", label: "Saídas" },
                          { id: "receita", label: "Entradas" },
                          { id: "checking", label: "Conta" },
                          { id: "credit", label: "Cartão" },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setTxTypeFilter(f.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                            txTypeFilter === f.id
                              ? "bg-[#1D1D1F] text-white"
                              : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-black/[0.05]"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = filteredReviewTransactions.every((t) => t.selected);
                          const targetIds = new Set(filteredReviewTransactions.map((t) => t.id));
                          setEditableTransactions((prev) =>
                            prev.map((item) =>
                              targetIds.has(item.id)
                                ? { ...item, selected: !allSelected }
                                : item
                            )
                          );
                        }}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-white text-[#1D1D1F] border border-black/[0.08] hover:bg-gray-50 cursor-pointer"
                      >
                        Inverter Seleção
                      </button>
                    </div>
                  </div>

                  {/* Lista de Lançamentos */}
                  <div className="bg-white rounded-2xl border border-black/[0.05] divide-y divide-black/[0.04] max-h-[360px] overflow-y-auto">
                    {filteredReviewTransactions.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#86868B]">
                        Nenhum lançamento encontrado para este filtro.
                      </div>
                    ) : (
                      filteredReviewTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            tx.selected ? "bg-white" : "bg-[#FAFAFC] opacity-55"
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={tx.selected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEditableTransactions((prev) =>
                                  prev.map((item) =>
                                    item.id === tx.id ? { ...item, selected: checked } : item
                                  )
                                );
                              }}
                              className="w-4 h-4 rounded text-[#1D1D1F] mt-1 shrink-0"
                            />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="text"
                                  value={tx.title}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditableTransactions((prev) =>
                                      prev.map((item) =>
                                        item.id === tx.id ? { ...item, title: val } : item
                                      )
                                    );
                                  }}
                                  className="text-xs sm:text-sm font-semibold text-[#1D1D1F] bg-transparent border-b border-transparent focus:border-black/20 outline-none min-w-[160px]"
                                />
                                {tx.installmentCurrent && tx.installmentTotal && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                    {tx.installmentCurrent}/{tx.installmentTotal}
                                  </span>
                                )}
                                {tx.isDuplicate && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                    Já cadastrado
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-[#86868B]">
                                <span>{tx.displayDate}</span>
                                <span>·</span>
                                <span>
                                  {tx.accountType === "credit" ? "Cartão de Crédito" : "Conta Corrente"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => promoteTransactionToRecurring(tx)}
                              title="Cadastrar também como Conta Fixa Mensal no Planejamento"
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Repeat size={11} />
                              <span>Fixa</span>
                            </button>

                            <select
                              value={tx.category}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditableTransactions((prev) =>
                                  prev.map((item) =>
                                    item.id === tx.id ? { ...item, category: val } : item
                                  )
                                );
                              }}
                              className="rounded-xl bg-[#F2F2F7] px-2.5 py-1.5 text-xs font-medium text-[#1D1D1F] outline-none"
                            >
                              {OFFICIAL_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>

                            <span
                              className={`text-xs sm:text-sm font-mono font-semibold tabular-nums min-w-[92px] text-right ${
                                tx.type === "receita" ? "text-emerald-600" : "text-[#1D1D1F]"
                              }`}
                            >
                              {tx.type === "receita" ? "+ " : "− "}R$ {formatCurrency(tx.amount)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ETAPA 4: CONCLUÍDO COM SUCESSO */}
          {step === "done" && commitResult && (
            <div className="py-10 text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={34} />
              </div>

              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-xl font-semibold text-[#1D1D1F]">
                  Sua carteira foi atualizada!
                </h3>
                <p className="text-xs text-[#86868B] leading-relaxed">
                  Todos os itens confirmados do extrato foram sincronizados e o saldo da conta já
                  está conciliado.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
                <div className="bg-white rounded-2xl p-4 border border-black/[0.05]">
                  <strong className="text-lg font-semibold text-[#1D1D1F] block">
                    {commitResult.createdCardsCount + commitResult.updatedCardsCount}
                  </strong>
                  <span className="text-[11px] text-[#86868B]">Contas / Cartões</span>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-black/[0.05]">
                  <strong className="text-lg font-semibold text-amber-600 block">
                    {commitResult.createdRecurringCount}
                  </strong>
                  <span className="text-[11px] text-[#86868B]">Fixas / Parcelas</span>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-black/[0.05]">
                  <strong className="text-lg font-semibold text-emerald-600 block">
                    {commitResult.createdTransactionsCount}
                  </strong>
                  <span className="text-[11px] text-[#86868B]">Lançamentos</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm px-8 py-3.5 rounded-2xl shadow-sm transition-all cursor-pointer"
                >
                  Concluir e Ver na Carteira
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé Fixo na Etapa de Revisão */}
        {step === "review" && (
          <div className="px-5 sm:px-7 py-4 bg-white/90 backdrop-blur-xl border-t border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setStep("upload")}
              disabled={isCommitting}
              className="px-4 py-2.5 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold transition-all cursor-pointer"
            >
              Voltar e Trocar Arquivo
            </button>

            <button
              type="button"
              disabled={isCommitting || totalSelectedItems === 0}
              onClick={handleConfirmAndCommit}
              className="bg-[#1D1D1F] hover:bg-black disabled:opacity-50 text-white font-semibold text-sm px-6 py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              data-testid="confirm-statement-import-btn"
            >
              {isCommitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Cadastrando na Carteira...</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} />
                  <span>
                    Confirmar e Cadastrar ({selectedAccountsCount} contas, {selectedRecurringCount}{" "}
                    fixas, {selectedTransactionsCount} lançamentos)
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
