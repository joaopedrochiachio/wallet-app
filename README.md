# Wallet AI

Aplicativo de finanças pessoais com um analista financeiro de IA, o **Cofi**. Ele organiza cartões, faturas, gastos recorrentes e metas, e explica o mês da pessoa em linguagem simples, sempre mostrando os números que usou para chegar a cada conclusão.

Interface inspirada na Apple Wallet, pensada primeiro para o celular e instalável como PWA.

![Next.js](https://img.shields.io/badge/Next.js_16-000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_4-06B6D4?logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-DD2C00?logo=firebase&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)

## Funcionalidades

**Finanças**
- Carteira de cartões com faturas, ciclo de fechamento, compras parceladas e pagamento de fatura
- Transações, gastos recorrentes e metas de economia
- Planejamento do mês com projeção de saldo dia a dia e calendário financeiro
- Importação de extratos e faturas em **PDF, OFX, CSV e TXT**, com leitura nativa de PDF e detecção de parcelas e cobranças recorrentes

**Cofi, o analista de IA**
- Chat com raciocínio visível: o Cofi mostra o que entendeu, quais dados consultou e por que chegou à resposta
- Informativo do mês gerado a partir de uma ficha de fatos calculada em TypeScript, para a IA não inventar números
- Diagnóstico financeiro com auditoria contábil local e determinística antes de qualquer chamada ao modelo
- Detecção de padrões de gasto, com memória do que a pessoa já respondeu sobre cada um
- Orientação de gasto em formatos que dá para seguir no dia a dia, e não "R$ 1,41 por dia"

## Arquitetura

```
app/               Páginas (App Router) e rotas de API
  api/ai/*         Chat, informativo, diagnóstico, padrões, importação e cotas
components/        UI por domínio (wallet, ai, planning, import, ui/macos…)
lib/services/      Regras de negócio: matemática financeira, análise do mês,
                   integração com a OpenAI, cotas e privacidade
lib/auth/          Verificação de tokens do Firebase no servidor
firestore.rules    Isolamento dos dados por usuário
middleware.ts      Bloqueio de varreduras e caminhos suspeitos
tests/             Testes unitários (node:test)
e2e/               Testes de interface (Playwright)
evals/ai/          Avaliação da qualidade das respostas da IA
```

**Princípio central:** todo número é calculado em código. O modelo de linguagem só interpreta e explica fatos que já vêm prontos e numerados, e cada achado aponta para a evidência de onde saiu.

## Segurança e privacidade

- Chaves de API ficam só no servidor; o navegador nunca fala direto com a OpenAI
- Tokens do Firebase verificados no servidor (assinatura RS256 com certificados x509)
- Regras do Firestore isolam os dados de cada usuário; cotas e logs de IA só podem ser escritos pelo servidor
- Cotas de uso por usuário e teto global de gasto com IA, com reserva atômica e bloqueio em caso de falha (fail-closed)
- Exclusão de conta e dados em conformidade com a LGPD

## Como rodar

Requer **Node.js 24** ou superior.

```bash
git clone https://github.com/joaopedrochiachio/wallet-app.git
cd wallet-app
npm install
cp .env.example .env.local   # preencha as chaves do Firebase e da OpenAI
npm run dev
```

Abra http://localhost:3000.

As variáveis estão documentadas em [`.env.example`](.env.example). As regras do Firestore são publicadas com `firebase deploy --only firestore:rules`.

## Testes

```bash
npm test                     # testes unitários
npm run test:financial:ui    # interface: funcionalidades financeiras
npm run test:ai-chat:ui      # interface: chat da IA
npm run test:responsive:ui   # interface: responsividade
npm run eval:ai              # avaliação das respostas da IA
npm run lint
```

## Licença

[MIT](LICENSE) © João Pedro Chiachio de Paiva
