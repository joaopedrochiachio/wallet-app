# Projeto: Wallet - AI-Powered Personal Finance

## 1. Visão Geral
O "Wallet" é um SaaS pessoal (projetado para escalabilidade futura) focado em gestão financeira avançada. Ele transcende o registro básico de fluxo de caixa, oferecendo controle detalhado de faturas de cartão de crédito, progressão de metas financeiras e um conselheiro financeiro integrado via IA (Gemini).

## 2. Identidade Visual e Design System (Apple HIG - Minimalismo Estrito)
A interface deve seguir **rigorosamente** as diretrizes minimalistas do **Apple Human Interface Guidelines (HIG)**: [Apple HIG](https://developer.apple.com/design/resources/). O design prioriza a elegância, tipografia impecável, e o uso de cor exclusivamente para semântica ou texturas físicas, rejeitando o estilo "SaaS Genérico" ou "Dribbble Neon".

*   **Fundo e Contraste:**
    *   Fundo global da aplicação: Cinza padrão do iOS `bg-[#F2F2F7]`.
    *   Texto principal: Preto quase puro `text-[#1D1D1F]`.
    *   Texto secundário/descritivo: Cinza delicado `text-[#86868B]`.
*   **Spatial UI e Interatividade 3D (Hero Card):**
    *   Cartões principais (ex: Saldo) devem possuir estética física (Titânio/Matte Black `bg-[#151515]`).
    *   Implementar interatividade 3D ao movimento do cursor utilizando propriedades de perspectiva do Tailwind (`perspective: 1000px`, `transform preserve-3d`) e React (mouse events) para inclinações sutis.
    *   Sombras amplas e difusas simulando luz ambiente: `shadow-[0_20px_40px_rgba(0,0,0,0.08)]`.
    *   Incluir simulação de reflexo de luz interna (glare) via gradientes dinâmicos rastreando o cursor.
*   **Listas e Agrupamentos (Estilo App Ajustes iOS):**
    *   Agrupar itens em blocos contínuos brancos `bg-white rounded-[20px] overflow-hidden`.
    *   Divisórias (`divider`) entre itens devem ser finíssimas e **não** devem encostar na borda esquerda do contêiner (`ml-4 border-b border-gray-100`).
*   **Componentes de Inserção (Bottom Sheets & Pills):**
    *   Ações de inserção utilizam modais Bottom Sheet fluídos (`rounded-t-[2rem]`) cobrindo a parte inferior da tela, com overlay translúcido (`bg-black/20 backdrop-blur-sm`).
    *   Filtros e seleções devem utilizar "Pílulas" (Pills) em `flex-wrap` (`rounded-full px-4 py-2`).
    *   Inputs numéricos gigantes, centralizados e sem bordas (ex: `text-6xl font-light`).
*   **Tipografia (SF Pro Native):**
    *   A hierarquia visual é definida pelo peso da fonte (`font-weight`).
    *   Valores monetários: `font-light` para numerais, `font-semibold` para o símbolo monetário.
*   **Ícones:** Utilizar a biblioteca `lucide-react` com espessura fina (`stroke-width={1.5}`), geralmente contidos em recipientes com cantos arredondados e fundos neutros.

## 3. Tech Stack Principal
*   **Front-end:** Next.js (App Router), React, TypeScript, Tailwind CSS.
*   **Back-end & BaaS:** Firebase (Auth e Cloud Firestore para dados NoSQL estruturados).
*   **Integração IA:** API do Gemini atuando como *Financial Advisor* processando snapshots dos dados mensais (futuramente gerido via backend intermediário/FastAPI).

## 4. Diretrizes de Arquitetura e Clean Code
O desenvolvimento deve seguir rigorosos padrões de engenharia de software:
*   **Componentização Estrita (UI vs. Business Logic):**
    *   Componentes na pasta `components/ui` são componentes visuais "burros" (Dumb Components) altamente reutilizáveis (KISS).
    *   A lógica de estado, hooks e chamadas de dados devem permanecer em `components/features` ou diretamente nos arquivos `page.tsx`.
*   **Princípios DRY, SOLID e YAGNI:** Não antecipe lógicas ou otimizações prematuras. Mantenha as interfaces TypeScript abertas para extensão, mas foque no escopo atual.
*   **Mobile-First e Safe Areas:**
    *   A navegação alterna de forma fluida entre uma *Bottom Bar* (mobile) e uma *Sidebar* (desktop).
    *   Utilizar intensamente o padding seguro do iOS (`pb-safe`) para respeitar o "home indicator".

## 5. Módulos do Sistema e Regras de Negócio
1.  **Dashboard (`/`):** Visão consolidada. Apresenta o Saldo Atual via Cartão Interativo 3D, resumo das movimentações e lançamentos recentes.
2.  **Gestão de Transações (`/transactions`):** Fluxo de caixa com categorização dinâmica baseada em "Pills". O formulário de inserção deve ser um *Bottom Sheet* nativo.
3.  **Motor de Cartões de Crédito (`/cards`):** Lançamentos em crédito não descontam do "Saldo Atual". Eles são alocados na fatura aberta do mês de vencimento. O saldo só é impactado quando a fatura é explicitamente paga.
4.  **Gestão de Metas (`/goals`):** Progressão de objetivos através de cards simulando cartões físicos horizontais com barras de progresso mínimas.
5.  **Wallet AI Assistant (`/chat`):** Chat interativo com contexto financeiro fornecido pela API do Gemini.

## 6. Prompting e Execução (Para a IA)
*   Sempre valide o contexto deste `agent.md` antes de propor código.
*   Ao gerar novos componentes de interface, aplique automaticamente as regras de **Design System Apple HIG** descritas na Seção 2.
*   Evite placeholders genéricos; utilize os hooks e estados do React para garantir animações suaves (`transition-all duration-300`, etc.).