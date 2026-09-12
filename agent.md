# Projeto: Wallet - AI-Powered Personal Finance

## 1. Visão Geral
O "Wallet" é um SaaS pessoal (projetado para escalabilidade futura) focado em gestão financeira avançada. Ele transcende o registro básico de fluxo de caixa, oferecendo controle detalhado de faturas de cartão de crédito, progressão de metas financeiras e um conselheiro financeiro integrado via IA (Gemini).

## 2. Identidade Visual e Design System (Wallet Pass Kit - Minimalismo Físico)
A interface deve seguir com rigor absoluto o padrão visual do **Wallet Pass Kit** (inspirado no Figma Pass Kit oficial) e a estética de sistemas operacionais premium. O design prioriza a sensação tátil e física de passes e cartões reais, com tipografia impecável e ausência de elementos genéricos de SaaS.

*   **Regra Fundamental de Branding no App:**
    *   **NUNCA** citar ou exibir o nome comercial de terceiros (como "Apple", "Apple HIG", "Apple ID" ou "Apple Wallet") nos textos e interfaces voltados ao usuário.
    *   O nome oficial do ecossistema é **"Wallet Intelligence"**, com submarcas internas como **"Wallet Pass"**, **"Wallet ID"** e **"Wallet Engine"**.

*   **Anatomia dos Passes e Cartões (Wallet Pass Kit Standard):**
    *   **Header do Pass:** Faixa superior contendo o logotipo/ícone à esquerda e métrica chave à direita (ex: `PONTOS`, `STATUS`, `SALDO`).
    *   **Thumb Scoop / Notch:** Recorte em semicírculo centralizado na borda superior dos compartimentos e passes, simulando a pegada física de retirada do cartão.
    *   **Campos Primários e Secundários:**
        *   Rótulos em caixa alta com espaçamento largo: `text-[10px] uppercase tracking-widest text-[#86868B] font-semibold`.
        *   Valores com pesos e hierarquia definidos: `text-sm font-semibold text-[#1D1D1F]` ou `text-2xl font-light text-[#1D1D1F]`.
    *   **Campos Auxiliares & Faixa de Segurança:** Divisórias perfuradas sutis (`border-dashed`), microchip EMV e faixa magnética/código de segurança.
    *   **Empilhamento de Passes (Stacked Cards):** Cartões sobrepostos com deslocamento vertical onde o cabeçalho de cada pass fica visível, deslizando para fora com física fluida ao clique ou toque.

*   **Fundo e Contraste:**
    *   Fundo global da aplicação: Cinza neutro suave `bg-[#F2F2F7]`.
    *   Texto principal: Preto grafite quase puro `text-[#1D1D1F]`.
    *   Texto secundário/descritivo: Cinza delicado `text-[#86868B]`.

*   **Spatial UI e Interatividade 3D (Hero Card & Carteira 3D):**
    *   Cartões principais possuem estética física (Titânio/Matte Black `bg-[#151515]`, Couro texturizado e gradientes metálicos profundos).
    *   Interatividade 3D com inclinação reativa ao mouse (`perspective: 1400px`, `transform-style: preserve-3d`).
    *   Sombras difusas simulando luz ambiente natural: `shadow-[0_20px_40px_rgba(0,0,0,0.08)]`.
    *   Reflexo de luz interna (glare) dinâmico via gradiente translúcido.

*   **Listas e Agrupamentos (Padrão de Ajustes do Sistema):**
    *   Agrupar itens em blocos contínuos brancos `bg-white rounded-[20px] overflow-hidden`.
    *   Divisórias (`divider`) entre itens devem ser finíssimas e não devem encostar na borda esquerda (`ml-4 border-b border-gray-100`).

*   **Componentes de Inserção (Bottom Sheets & Pills):**
    *   Modais Bottom Sheet fluídos (`rounded-t-[2.5rem]`) com overlay translúcido (`bg-black/20 backdrop-blur-sm`).
    *   Filtros e seleções em formato de "Pílulas" (`rounded-full px-4 py-2`).
    *   Inputs numéricos gigantes, centralizados e sem bordas (`text-6xl font-light`).

*   **Ícones:** Biblioteca `lucide-react` com espessura fina (`stroke-width={1.5}`), contidos em recipientes arredondados neutros.

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