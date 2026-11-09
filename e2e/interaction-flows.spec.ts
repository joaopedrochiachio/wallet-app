import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { buildFixture } from "./helpers/buildFixture";

let fixture: Awaited<ReturnType<typeof buildFixture>>;
test.beforeAll(async () => {
  test.setTimeout(60000);
  const file = (name: string) => JSON.stringify(path.join(process.cwd(), name).replaceAll("\\", "/"));
  fixture = await buildFixture("wallet-interaction-flows", `
    import React,{useState} from "react";
    import {createRoot} from "react-dom/client";
    import {FixtureProvider,useWallet} from "@/context/WalletContext";
    import {AddTransactionSheet} from ${file("components/ui/AddTransactionSheet.tsx")};
    import {QuickCaptureModal} from ${file("components/companion/QuickCaptureModal.tsx")};
    import TransactionsPage from ${file("app/transactions/page.tsx")};
    import CardsPage from ${file("app/cards/page.tsx")};
    function Page(){
      const [open,setOpen]=useState(false),[quick,setQuick]=useState(false);const wallet=useWallet();
      if(location.pathname==="/transactions")return <TransactionsPage/>;
      if(location.pathname==="/cards")return <CardsPage/>;
      return <main className="p-3"><button onClick={()=>setOpen(true)}>Novo gasto</button><button onClick={()=>setQuick(true)}>Gasto rápido</button><button onClick={()=>wallet.selectCard("inter")}>Selecionar Inter</button><AddTransactionSheet isOpen={open} onClose={()=>setOpen(false)} accounts={wallet.accountOptions} initialAccount={wallet.activeCard.name}/><QuickCaptureModal isOpen={quick} onClose={()=>setQuick(false)}/></main>;
    }
    createRoot(document.getElementById("root")).render(<FixtureProvider><Page/></FixtureProvider>);
  `, {
    "next/link": `import React from "react";export default function Link({children,href,...props}){return <a href={href} {...props}>{children}</a>}`,
    "@/components/import/StatementImportModal": `export function StatementImportModal(){return null}`,
    "@/context/WalletContext": `
      import React,{createContext,useContext,useState} from "react";
      const Context=createContext(null);export const useWallet=()=>useContext(Context);
      export function FixtureProvider({children}){
        const [active,setActive]=useState("nu");
        const date=new Date();const colorScheme={gradient:"",border:"",accent:"#111",badgeText:"",chipGradient:""};
        const account={id:"account",name:"Conta Principal",type:"checking",brand:"",openingBalance:1000,balance:1000,limit:0,spent:0,colorScheme};
        const cards=[account,{...account,id:"nu",name:"Nubank",brand:"Visa",type:"credit",limit:5000,closingDay:28,dueDay:5},{...account,id:"inter",name:"Inter",brand:"Visa",type:"credit",limit:5000,closingDay:28,dueDay:5}];
        const [transactions,setTransactions]=useState(()=>[
          {id:"expense",title:"Almoço inicial",amount:35,type:"despesa",category:"Alimentação & Delivery",account:"Nubank",cardId:"nu",kind:"regular",date:date.toISOString(),occurredAt:date.toISOString()},
          {id:"goal",title:"Aporte: Reserva",amount:100,type:"despesa",category:"Investimentos & Metas",account:"Conta Principal",cardId:"account",kind:"regular",groupId:"goal-request",date:date.toISOString(),occurredAt:date.toISOString()}
        ]);
        const record=async(kind,payload)=>{
          window.__attempts=(window.__attempts||0)+1;
          if(window.__failNext){window.__failNext=false;throw new Error("Falha simulada. Tente novamente.");}
          window.__calls=[...(window.__calls||[]),{kind,...JSON.parse(JSON.stringify(payload))}];
        };
        const wallet={cards,activeCard:cards.find(c=>c.id===active),selectCard:setActive,accountOptions:cards.map(c=>c.name),transactions,recurringItems:[],goals:[],isDataLoaded:true,mainBalance:1000,userProfile:{name:"Pessoa teste",persona:"guardian",categoryBudgets:[]},
          getMonthlyProjection:()=>({cardInstallments:0,recurringCreditTotal:0}),
          addTransaction:async tx=>record("add",{transaction:tx}),
          updateTransaction:async(id,updates)=>{await record("update",{id,updates});setTransactions(items=>items.map(tx=>tx.id===id?{...tx,...updates}:tx));},
          deleteTransaction:async id=>record("delete",{id}),
          payInvoice:async(id,amount,periodKey)=>{await record("invoice",{id,amount,periodKey});setTransactions(items=>[...items,{id:"payment",title:"Pagamento",amount,type:"despesa",kind:"invoice_payment",account:account.name,cardId:account.id,periodKey,occurredAt:date.toISOString()},{id:"settlement",title:"Baixa",amount,type:"receita",kind:"invoice_settlement",account:"Nubank",cardId:id,periodKey,occurredAt:date.toISOString()}]);},
          unpayInvoice:async(id,periodKey)=>{await record("undo",{id,periodKey});setTransactions(items=>items.filter(tx=>tx.id!=="payment"&&tx.id!=="settlement"));}
        };
        return <Context.Provider value={wallet}>{children}</Context.Provider>;
      }
    `,
  });
});

async function open(page: Page, route = "/", width = 390) {
  await page.setViewportSize({ width, height: 844 });
  await page.clock.setFixedTime(new Date("2026-11-09T12:00:00-03:00"));
  await page.route("https://wallet-interactions.test/**", request => request.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' }));
  await page.goto(`https://wallet-interactions.test${route}`);
  await page.addStyleTag({ content: fixture.css });
  await page.addScriptTag({ content: fixture.bundle });
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { __calls?: Array<Record<string, unknown>> }).__calls || []);

for (const width of [320, 390]) {
  test(`captura rápida salva milhares e parcelas corretamente em ${width}px`, async ({ page }) => {
    await open(page, "/", width);
    await page.getByRole("button", { name: "Gasto rápido", exact: true }).click();
    await page.getByRole("textbox", { name: "Descreva o gasto" }).fill("Celular R$ 1.234,56 Nubank em 10x");
    await expect(page.getByRole("button", { name: /Salvar gasto.*1.234,56/ })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: path.join(fixture.directory, "quick-capture-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: /Salvar gasto/ }).click();
    await expect.poll(() => calls(page)).toHaveLength(1);
    expect((await calls(page))[0]).toMatchObject({ kind: "add", transaction: { amount: 1234.56, cardId: "nu", installmentsCount: 10 } });
  });
}

test("captura rápida mostra a conta correta, preserva entrada em falha e permite tentar de novo", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Gasto rápido", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Descreva o gasto" });
  await input.fill("Almoço 35 no Pix");
  await expect(page.getByRole("dialog").getByText("Conta Principal", { exact: true })).toBeVisible();
  await page.evaluate(() => Object.assign(window, { __failNext: true }));
  await page.getByRole("button", { name: /Salvar gasto/ }).click();
  await expect(page.getByRole("alert")).toHaveText("Falha simulada. Tente novamente.");
  await expect(input).toHaveValue("Almoço 35 no Pix");
  await page.getByRole("button", { name: /Salvar gasto/ }).click();
  expect((await calls(page))[0]).toMatchObject({ transaction: { amount: 35, cardId: "account", category: "Alimentação & Delivery" } });
});

test("lançamento acompanha o cartão selecionado e Hoje muda na virada do dia", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Novo gasto", exact: true }).click();
  await page.getByPlaceholder("0,00", { exact: true }).fill("50,00");
  await expect(page.getByRole("button", { name: "Parcelado", exact: true })).not.toBeVisible();
  await page.clock.setFixedTime(new Date("2026-11-10T12:00:00-03:00"));
  await page.getByRole("button", { name: "Salvar gasto", exact: true }).click();
  expect((await calls(page))[0]).toMatchObject({ transaction: { cardId: "nu", occurredAt: "2026-11-10T15:00:00.000Z" } });
  await page.getByRole("button", { name: "Selecionar Inter", exact: true }).click();
  await page.getByRole("button", { name: "Novo gasto", exact: true }).click();
  await page.getByPlaceholder("0,00", { exact: true }).fill("20,00");
  await page.getByRole("button", { name: "Salvar gasto", exact: true }).click();
  expect((await calls(page))[1]).toMatchObject({ transaction: { cardId: "inter" } });
});

test("data retroativa e parcelamento continuam disponíveis nas opções", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Novo gasto", exact: true }).click();
  await page.getByPlaceholder("0,00", { exact: true }).fill("300,00");
  await page.getByText("À vista · Parcelar ou repetir", { exact: true }).click();
  await page.getByRole("button", { name: "Parcelado", exact: true }).click();
  await expect(page.getByText("Parcelas já pagas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Outra data...", exact: true }).click();
  await page.locator('input[type="date"]').fill("2026-03-15");
  await page.getByRole("button", { name: "Salvar gasto", exact: true }).click();
  expect((await calls(page))[0]).toMatchObject({ transaction: { installmentsCount: 3, occurredAt: "2026-03-15T15:00:00.000Z" } });
});

test("edição salva com um toque e mantém formulário aberto se falhar", async ({ page }) => {
  await open(page, "/transactions");
  await page.getByRole("button", { name: "Opções para Almoço inicial", exact: true }).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByPlaceholder("Ex: Carregador · Casas Bahia").fill("Almoço corrigido");
  await page.evaluate(() => Object.assign(window, { __failNext: true }));
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByText("Falha simulada. Tente novamente.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Lançamento atualizado.");
  expect(await calls(page)).toHaveLength(1);
  expect((await calls(page))[0]).toMatchObject({ kind: "update", id: "expense", updates: { title: "Almoço corrigido" } });
});

test("movimentação de meta oferece destino útil em vez de edição ou exclusão bloqueada", async ({ page }) => {
  await open(page, "/transactions");
  await page.getByRole("button", { name: "Opções para Aporte: Reserva", exact: true }).click();
  await expect(page.getByRole("link", { name: "Abrir Metas", exact: true })).toHaveAttribute("href", "/goals");
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Excluir", exact: true })).toHaveCount(0);
});

test("fatura informa conta e valor ao registrar pagamento e mantém opção de desfazer", async ({ page }) => {
  await open(page, "/cards", 320);
  for (const name of ["Nova Compra", "Novo Cartão"]) {
    const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  await page.getByRole("button", { name: "Marcar como paga", exact: true }).click();
  await expect(page.getByText(/Será registrada uma saída de R\$ 35,00 na conta Conta Principal/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pagar com W Pay", exact: true })).toHaveCount(0);
  await page.screenshot({ path: path.join(fixture.directory, "invoice-confirmation-mobile.png"), fullPage: true, animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Marcar como paga", exact: true }).last().click();
  await expect.poll(() => calls(page)).toHaveLength(1);
  expect((await calls(page))[0]).toMatchObject({ kind: "invoice", id: "nu", amount: 35 });
  await expect(page.getByRole("button", { name: "Desfazer pagamento", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Desfazer pagamento", exact: true }).click();
  expect((await calls(page))[1]).toMatchObject({ kind: "undo", id: "nu" });
});
