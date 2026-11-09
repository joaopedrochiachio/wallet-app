import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { buildFixture } from "./helpers/buildFixture";

let fixture: Awaited<ReturnType<typeof buildFixture>>;
test.beforeAll(async () => {
  test.setTimeout(60000);
  const importFile = (file: string) => JSON.stringify(path.join(process.cwd(), file).replaceAll("\\", "/"));
  fixture = await buildFixture("wallet-financial-features", `
    import React,{useState} from "react";
    import {createRoot} from "react-dom/client";
    import {FixtureProvider,useWallet} from "@/context/WalletContext";
    import {CategoryBudgets} from ${importFile("components/planning/CategoryBudgets.tsx")};
    import {PendingConfirmations} from ${importFile("components/planning/PendingConfirmations.tsx")};
    import {AddTransactionSheet} from ${importFile("components/ui/AddTransactionSheet.tsx")};
    import GoalsPage from ${importFile("app/goals/page.tsx")};
    function Page(){const [open,setOpen]=useState(false);const wallet=useWallet();return location.pathname==="/goals"?<GoalsPage/>:<main className="mx-auto max-w-3xl space-y-5 p-3"><p data-testid="balances">{wallet.mainBalance}</p><PendingConfirmations/><CategoryBudgets/><button onClick={()=>setOpen(true)}>Novo gasto</button><AddTransactionSheet isOpen={open} onClose={()=>setOpen(false)} accounts={wallet.cards.map(c=>c.name)}/></main>}
    createRoot(document.getElementById("root")).render(<FixtureProvider><Page/></FixtureProvider>);
  `, { "@/context/WalletContext": `
    import React,{createContext,useContext,useRef,useState} from "react";
    import {commitGoalOperation} from ${importFile("lib/utils/goalOperations.ts")};
    import {calculateCheckingBalance} from ${importFile("lib/utils/ledger.ts")};
    const Context=createContext(null);export const useWallet=()=>useContext(Context);
    export function FixtureProvider({children}){
      const [,refresh]=useState(0);const store=useRef(null);
      if(!store.current){
        const date=new Date();const colorScheme={gradient:"",border:"",accent:"#111",badgeText:"",chipGradient:""};
        const account={id:"checking",name:"Conta",type:"checking",brand:"",openingBalance:1000,limit:0,spent:0,colorScheme};
        const card={...account,id:"credit",name:"Cartão",type:"credit",limit:5000,spent:420};
        store.current={data:new Map([["cards/checking",account],["cards/credit",card],["goals/reserve",{id:"reserve",title:"Reserva teste",category:"Segurança",current:100,target:5000}]]),run:async function(work){const staged=new Map();const result=await work({get:async key=>structuredClone(this.data.get(key)),set:(key,value)=>staged.set(key,structuredClone(value))});for(const [key,value]of staged)this.data.set(key,value);return result;},profile:{name:"Pessoa teste",categoryBudgets:[{id:"food",category:"Alimentação & Delivery",amount:500,alertPercent:80}]},recurring:[{id:"rent",title:"Aluguel teste",amount:500,type:"expense",category:"Moradia & Contas",account:"Conta",cardId:"checking",dueDay:1,startYear:date.getFullYear(),startMonth:date.getMonth(),active:true}],baseTransactions:[{id:"food",title:"Compras",amount:420,type:"despesa",account:"Cartão",cardId:"credit",category:"Alimentação & Delivery",occurredAt:date.toISOString(),date:date.toISOString()}]};
      }
      const state=store.current;const publish=()=>refresh(value=>value+1);
      const entries=()=>[...state.data.entries()].filter(([key])=>key.startsWith("transactions/")).map(([id,value])=>({...value,id,title:value.description,account:value.paymentMethod,type:value.type==="out"?"despesa":"receita"}));
      const move=async(action,goalId,amount,source,operationId)=>{
        window.__goalRequestIds=[...(window.__goalRequestIds||[]),operationId];
        if(window.__failGoalMovement){window.__failGoalMovement=false;throw new Error("Falha simulada. Tente novamente.");}
        await commitGoalOperation(state,{action,goalId,amount,operationId,accountId:source.type==="account"?"checking":undefined,occurredAt:new Date().toISOString()});publish();
      };
      const wallet={userProfile:state.profile,cards:[state.data.get("cards/checking"),state.data.get("cards/credit")],transactions:[...state.baseTransactions,...entries()],recurringItems:state.recurring,goals:[...state.data.entries()].filter(([key])=>key.startsWith("goals/")&&key.split("/").length===2).map(([,value])=>value),mainBalance:calculateCheckingBalance(state.data.get("cards/checking"),entries()),saveCategoryBudgets:async budgets=>{state.profile={...state.profile,categoryBudgets:budgets};publish();},realizeRecurringItemNow:async(item,year,month,amount)=>{const period=year+"-"+String(month+1).padStart(2,"0");const id="transactions/rec-"+item.id+period;if(!state.data.has(id))state.data.set(id,{amount,type:item.type==="income"?"in":"out",description:item.title,paymentMethod:item.account,cardId:item.cardId,recurringItemId:item.id,periodKey:period,occurredAt:new Date().toISOString()});state.recurring=state.recurring.map(raw=>raw.id===item.id?{...raw,realizedPeriods:[period]}:raw);publish();},contributeToGoal:(id,amount,source,op)=>move("contribute",id,amount,source,op),withdrawFromGoal:(id,amount,source,op)=>move("withdraw",id,amount,source,op),updateGoal:async(id,updates)=>{state.data.set("goals/"+id,{...state.data.get("goals/"+id),...updates});publish();},deleteGoal:()=>{},addGoal:async()=>{},addTransaction:async()=>{}};
      return <Context.Provider value={wallet}>{children}</Context.Provider>;
    }
  ` });
});

async function open(page: Page, route = "/", width = 390) {
  page.on("pageerror", (error) => console.error(error.message));
  await page.setViewportSize({ width, height: 844 });
  await page.route("https://wallet-features.test/**", (request) => request.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div></body></html>' }));
  await page.goto(`https://wallet-features.test${route}`);
  await page.addStyleTag({ content: fixture.css });
  await page.addScriptTag({ content: fixture.bundle });
}

for (const width of [320, 390, 1280]) {
  test(`orçamento mostra alerta, permite editar e adicionar categorias em ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    await open(page, "/", width);
    const budgets = page.getByTestId("category-budgets");
    await expect(budgets.getByText("Perto do limite", { exact: true })).toBeVisible();
    await expect(budgets.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "84");
    await budgets.getByRole("button", { name: "Editar limite de Alimentação & Delivery", exact: true }).click();
    await budgets.getByRole("textbox", { name: "Limite mensal em reais" }).fill("600,00");
    await budgets.getByRole("button", { name: "Salvar limite", exact: true }).click();
    await expect(budgets.getByText("Dentro do limite", { exact: true })).toBeVisible();
    await budgets.getByRole("button", { name: "Definir limite" }).click();
    await budgets.getByRole("combobox", { name: "Categoria do orçamento" }).selectOption("Transporte & Combustível");
    await budgets.getByRole("textbox", { name: "Limite mensal em reais" }).fill("300,00");
    await budgets.getByRole("button", { name: "Salvar limite", exact: true }).click();
    await expect(budgets.getByRole("progressbar")).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: path.join(fixture.directory, "budgets-mobile.png"), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("conta vencida só altera o saldo quando o usuário confirma", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("balances")).toHaveText("1000");
  await page.getByTestId("pending-confirmations").getByRole("button", { name: "Paguei", exact: true }).click();
  await expect(page.getByTestId("balances")).toHaveText("500");
  await expect(page.getByTestId("pending-confirmations").getByRole("button", { name: "Paguei", exact: true })).toHaveCount(0);
});

test("novo gasto avisa quando ultrapassaria o orçamento", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Novo gasto", exact: true }).click();
  await page.getByPlaceholder("0,00", { exact: true }).fill("100,00");
  await expect(page.getByText(/Com este lançamento.*104%/)).toBeVisible();
});

test("falha no aporte mantém o formulário e a repetição usa a mesma solicitação", async ({ page }) => {
  await open(page, "/goals");
  await page.getByRole("button", { name: "Aportar", exact: true }).click();
  await page.getByPlaceholder("100,00", { exact: true }).fill("50,00");
  await page.evaluate(() => Object.assign(window, { __failGoalMovement: true }));
  const confirm = page.getByRole("button", { name: /Tirar do Débito e Guardar/ });
  await confirm.click();
  await expect(page.getByText("Falha simulada. Tente novamente.", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("100,00", { exact: true })).toHaveValue("50,00");
  await confirm.click();
  await expect(page.getByPlaceholder("100,00", { exact: true })).toHaveCount(0);
  const requests = await page.evaluate(() => (window as unknown as { __goalRequestIds: string[] }).__goalRequestIds);
  expect(requests).toHaveLength(2); expect(requests[0]).toBe(requests[1]);
});
