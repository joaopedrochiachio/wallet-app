"use client";

import React from "react";
import { ShieldCheck, X, Check, Lock, Database, Sparkles, UserCheck } from "lucide-react";

export interface LgpdTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  hasAccepted?: boolean;
}

export function LgpdTermsModal({
  isOpen,
  onClose,
  onAccept,
  hasAccepted = false,
}: LgpdTermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop com Blur Suave Apple */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-apple-backdrop"
        onClick={onClose}
      />

      {/* Modal / Sheet */}
      <div className="relative w-full max-w-2xl bg-white rounded-t-[28px] sm:rounded-[28px] shadow-[0_25px_60px_rgba(0,0,0,0.25)] border border-black/[0.06] overflow-hidden z-10 flex flex-col max-h-[92dvh] sm:max-h-[85vh] animate-apple-sheet sm:animate-apple-modal">
        {/* Notch Decorativo Mobile */}
        <div className="w-12 h-1.5 bg-[#D1D1D6] rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.05] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/60 shadow-2xs">
              <ShieldCheck size={20} strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-[#1D1D1F] tracking-tight">
                  Termos de Privacidade & LGPD
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800">
                  Lei 13.709/2018
                </span>
              </div>
              <p className="text-xs text-[#86868B]">
                Versão 1.0 • Vigência e Transparência Integral
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#E5E5EA] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar termos"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Conteúdo Rolável dos Termos */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 text-xs text-[#1D1D1F] leading-relaxed touch-scroll font-sans">
          
          {/* Apresentação e Princípios */}
          <div className="p-4 rounded-2xl bg-[#F2F2F7]/70 border border-black/[0.04] space-y-2">
            <h3 className="font-semibold text-sm text-[#1D1D1F] flex items-center gap-2">
              <UserCheck size={16} className="text-emerald-600" />
              <span>1. Controlador e Compromisso com a Privacidade</span>
            </h3>
            <p className="text-[#636366] leading-relaxed">
              O <strong>Wallet App</strong> atua como Controlador dos dados pessoais coletados nesta plataforma, assegurando o estrito cumprimento da <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD)</strong>. Garantimos transparência, segurança, finalidade legítima e controle exclusivo do titular sobre todos os seus registros financeiros e cadastrais.
            </p>
          </div>

          {/* Dados Coletados */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-[#1D1D1F] flex items-center gap-2">
              <Database size={16} className="text-blue-600" />
              <span>2. Dados Coletados e Tratados</span>
            </h3>
            <p className="text-[#636366]">
              Para disponibilizar as funcionalidades de controle contábil, livro-caixa e assessoria financeira, coletamos estritamente os dados necessários:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[#636366]">
              <li><strong>Dados de Identificação e Acesso:</strong> Endereço de e-mail, nome de exibição e identificador único de usuário (UID do Firebase Auth).</li>
              <li><strong>Dados Financeiros Fornecidos Voluntariamente:</strong> Lançamentos de despesas e receitas, valores, categorias contábeis, datas, descrições, contas, nomes de cartões (sem número PAN completo e sem CVV) e metas patrimoniais.</li>
              <li><strong>Preferências de Configuração:</strong> Arquétipo financeiro selecionado (The Optimizer, The Guardian, etc.), teto percentual de comprometimento de renda e tom de resposta da IA.</li>
            </ul>
          </div>

          {/* Finalidades do Tratamento */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-[#1D1D1F] flex items-center gap-2">
              <Check size={16} className="text-emerald-600" />
              <span>3. Finalidades do Tratamento e Bases Legais</span>
            </h3>
            <p className="text-[#636366]">
              O tratamento dos seus dados fundamenta-se nas seguintes bases legais estabelecidas no Art. 7º da LGPD:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[#636366]">
              <li><strong>Execução de Contrato (Art. 7º, V):</strong> Viabilizar o registro, consolidação, cálculo de saldos e projeções financeiras contratadas pelo usuário.</li>
              <li><strong>Consentimento Expresso (Art. 7º, I):</strong> Autorização manifesta para personalização da experiência e consultoria analítica através do assistente financeiro.</li>
              <li><strong>Legítimo Interesse (Art. 7º, IX):</strong> Prevenção a fraudes, segurança da aplicação e aprimoramento da estabilidade do sistema.</li>
            </ul>
          </div>

          {/* Inteligência Artificial e Anonimização */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-500/[0.04] to-sky-500/[0.04] border border-violet-500/15 space-y-2">
            <h3 className="font-semibold text-sm text-[#1D1D1F] flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" />
              <span>4. Inteligência Artificial, Anonimização e Segurança</span>
            </h3>
            <p className="text-[#636366] leading-relaxed">
              O assistente contábil do Wallet App utiliza modelos de linguagem da família Google Gemini de maneira ética e segura:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[#636366]">
              <li><strong>Anonimização Prévia Rigorosa:</strong> Antes do envio de qualquer contexto financeiro à IA, todos os identificadores pessoais (como CPF, CNPJ, e-mail, telefone, chaves PIX aleatórias, números de cartão e contas bancárias) são sanitizados e substituídos por marcadores anônimos.</li>
              <li><strong>Pseudonimização de Cartões e Metas:</strong> Cartões e metas são convertidos em pseudônimos numéricos genéricos (ex: <em>Cartão 1</em>, <em>Meta 1</em>).</li>
              <li><strong>Sem Treinamento em Dados Privados:</strong> Os dados das suas requisições <strong>não</strong> são utilizados para treinamento ou aprimoramento de modelos públicos de inteligência artificial de terceiros.</li>
            </ul>
          </div>

          {/* Armazenamento e Criptografia */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-[#1D1D1F] flex items-center gap-2">
              <Lock size={16} className="text-amber-600" />
              <span>5. Armazenamento, Segurança e Regras de Isolamento</span>
            </h3>
            <p className="text-[#636366]">
              Seus dados são armazenados na nuvem do Google Cloud Firebase (Cloud Firestore) protegidos por regras de segurança no nível do banco de dados (<em>Security Rules</em>), garantindo que apenas a sua conta autenticada tenha permissão de leitura e escrita nos seus próprios documentos. Toda a transmissão de dados é criptografada de ponta a ponta com certificados TLS/HTTPS modernos.
            </p>
          </div>

          {/* Direitos do Titular (Art. 18 LGPD) */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/50 space-y-2">
            <h3 className="font-semibold text-sm text-emerald-900 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-700" />
              <span>6. Seus Direitos como Titular (Art. 18 da LGPD)</span>
            </h3>
            <p className="text-emerald-950/80">
              Você pode exercer integralmente e a qualquer momento todos os direitos garantidos por lei diretamente dentro do aplicativo:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-emerald-950/80">
              <li><strong>Confirmação e Acesso:</strong> Consultar todos os lançamentos e configurações registradas.</li>
              <li><strong>Correção de Dados:</strong> Retificar dados incompletos, inexatos ou desatualizados no painel de perfil.</li>
              <li><strong>Portabilidade de Dados (Art. 18, V):</strong> Exportar um relatório completo em formato aberto JSON contendo todas as suas informações para transferência a outro serviço.</li>
              <li><strong>Eliminação Definitiva dos Dados (Art. 18, VI):</strong> Excluir sua conta e apagar permanentemente todas as transações, cartões, metas, diagnósticos e conversas de IA dos nossos servidores através da opção <em>&quot;Excluir Minha Conta&quot;</em>.</li>
              <li><strong>Revogação do Consentimento:</strong> Descontinuar o uso do aplicativo e encerrar a autorização de tratamento de dados a qualquer momento.</li>
            </ul>
          </div>

          {/* DPO / Contato */}
          <div className="space-y-1.5 pt-2 border-t border-black/[0.04] text-[11px] text-[#86868B]">
            <p>
              <strong>Encarregado de Proteção de Dados (DPO):</strong> Equipe de Segurança e Privacidade do Wallet App.
            </p>
            <p>
              Em caso de dúvidas sobre este termo ou sobre o tratamento dos seus dados pessoais, você pode contatar o suporte de privacidade através das configurações do aplicativo.
            </p>
          </div>
        </div>

        {/* Rodapé com Ação */}
        <div className="px-6 py-4 bg-[#F2F2F7]/50 border-t border-black/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 pb-safe">
          <span className="text-[11px] text-[#86868B] text-center sm:text-left">
            {hasAccepted
              ? "✓ Você já aceitou estes termos de privacidade."
              : "Ao aceitar, você concorda com o tratamento ético e seguro dos seus dados."}
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-black/10 text-xs font-semibold text-[#1D1D1F] hover:bg-black/5 active:scale-[0.98] transition-all cursor-pointer"
            >
              Fechar
            </button>
            {onAccept && !hasAccepted && (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-black active:scale-[0.98] transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Li e Aceito os Termos</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
