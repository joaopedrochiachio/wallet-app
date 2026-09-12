# Projeto: Wallet - AI-Powered Personal Finance

## 1. Visão Geral
O "Wallet" é um SaaS pessoal (construído para escalabilidade futura) focado em gestão financeira avançada. Ele vai além do registro de entradas e saídas, oferecendo um motor de controle de cartão de crédito (faturas), acompanhamento de metas financeiras e um conselheiro financeiro integrado via IA.

## 2. Identidade Visual e Design System (Apple HIG)
A interface deve seguir estritamente as diretrizes do **Apple Human Interface Guidelines (HIG)**: [https://developer.apple.com/design/resources/](https://developer.apple.com/design/resources/)
*   **Tipografia:** Utilizar a família de fontes San Francisco (SF Pro). Focar em legibilidade, pesos contrastantes para hierarquia (ex: Semibold para valores, Regular para descrições).
*   **Cores:** Fundo geral em tons off-white (`#F5F5F7` em light mode) para dar destaque aos cards brancos ou com gradientes escuros profundos. Cores de status suaves (verde, vermelho, amarelo pastel).
*   **Formas e Bordas:** Elementos principais e cards devem ter bordas arredondadas generosas (ex: `rounded-3xl` ou `rounded-[2rem]`), seguindo os novos padrões do iOS e macOS.
*   **Materiais (Glassmorphism):** Barras de navegação (Sidebar, Bottom Bar, Top Navigation) devem utilizar desfoque de fundo (`backdrop-blur` e `bg-white/70`) para criar profundidade e um aspecto "premium".
*   **Espaçamento:** Utilizar respiros amplos (`p-6`, `gap-4`) para evitar poluição visual.

## 3. Tech Stack Principal
*   **Front-end:** Next.js (App Router), TypeScript, React, Tailwind CSS.
*   **Back-end & BaaS (Futuro):** Firebase (Auth e Cloud Firestore para escalabilidade NoSQL).
*   **Integração IA (Futuro):** Microsserviço externo em Python/FastAPI consumindo a API do Gemini.

## 4. Diretrizes de Desenvolvimento e Arquitetura
Como o foco atual é a construção de uma interface de ponta e escalável, o código deve ser guiado por princípios de engenharia de software limpa:
*   **Componentização Estrita:** A pasta `components/ui` deve conter apenas componentes visuais burros e reutilizáveis (KISS). A lógica de negócio fica nos hooks e páginas.
*   **Clean Code:** Aplicação constante de DRY, SOLID e YAGNI. Não antecipar features complexas no código até que sejam necessárias, mas manter as interfaces (TypeScript) abertas para expansão.
*   **Mobile-First Responsivo:** O layout deve alternar perfeitamente entre uma *Bottom Bar* flutuante em dispositivos móveis e uma *Sidebar* retrátil em telas desktop. Utilizar `pb-safe` para respeitar as áreas seguras do iOS.

## 5. Módulos do Sistema
1.  **Dashboard:** Visão geral, saldo acumulado e projeção do mês.
2.  **Gestão de Transações e Tags:** Entradas, saídas e categorização dinâmica.
3.  **Motor de Cartões de Crédito:** Lançamento de faturas, controle de limites e projeção de pagamentos futuros (compras parceladas não afetam o saldo atual, apenas a fatura do mês correspondente).
4.  **Gestão de Metas:** Progressão visual de objetivos financeiros.
5.  **AI Assistant:** Interface de chat para consultoria financeira baseada no snapshot dos dados do mês.

## 6. Estado Atual
Fase 1: Estruturação base, prototipação da interface em Tailwind CSS e criação do Design System baseado no Apple HIG, sem conexões ativas com banco de dados ou APIs externas.