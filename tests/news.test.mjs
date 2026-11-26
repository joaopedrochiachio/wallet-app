import assert from "node:assert/strict";
import test from "node:test";
import { classifyTopics, cleanSummary, mergeArticles, parseRssFeed } from "../lib/services/newsFeed.ts";
import { buildTopicImpacts } from "../lib/services/newsImpact.ts";

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Copom mantém Selic em 15% ao ano]]></title><link>https://g1.globo.com/a</link>
<pubDate>Wed, 25 Nov 2026 20:00:00 -0300</pubDate><description><![CDATA[<img src="x.jpg"/><p>O Banco Central manteve a taxa b&aacute;sica &amp; sinalizou cortes.</p>]]></description></item>
<item><title>Resultado da Mega-Sena concurso 2900</title><link>https://g1.globo.com/b</link></item>
<item><title>Morre guitarrista de banda inglesa</title><link>https://g1.globo.com/c</link></item>
</channel></rss>`;

test("RSS: lê título, link, data, resumo limpo e tira sorteio", () => {
  const economy = parseRssFeed(RSS, { id: "g1", name: "g1", url: "", economyOnly: true });
  assert.equal(economy.length, 2, "sorteio fica fora mesmo em fonte de economia");
  assert.equal(economy[0].title, "Copom mantém Selic em 15% ao ano");
  assert.deepEqual(economy[0].topics, ["juros"]);
  assert.equal(economy[0].publishedAt, "2026-11-25T23:00:00.000Z");
  assert.ok(!economy[0].summary.includes("<"));
  const general = parseRssFeed(RSS, { id: "valor", name: "Valor", url: "", economyOnly: false });
  assert.deepEqual(general.map((a) => a.title), ["Copom mantém Selic em 15% ao ano"], "fonte geral só entra com tema");
});

test("temas: Bolsa Família não é bolsa de valores; 'ir' verbo não é imposto", () => {
  assert.deepEqual(classifyTopics("Bolsa Família terá reajuste em 2027"), ["emprego"]);
  assert.deepEqual(classifyTopics("Ibovespa sobe com alta do dólar"), ["dolar", "bolsa"]);
  assert.deepEqual(classifyTopics("Governo vai ir além nas negociações"), []);
  assert.deepEqual(classifyTopics("CMN aperta regras do cartão de crédito e do rotativo"), ["credito"]);
});

test("junta fontes, tira repetida e limita por fonte", () => {
  const WORDS = ["petrobras", "selic", "dolar", "ibovespa", "inflacao", "salario", "imposto", "credito", "aluguel", "energia", "bitcoin", "emprego", "gasolina", "tesouro", "fundos", "varejo", "industria", "exportacao", "safra", "turismo"];
  const make = (source, n, title = (i) => source === "g1"
    ? `governo prepara pacote ${WORDS[i]} ${i}`
    : `${WORDS[i % 20]} ${WORDS[(i * 7 + 3) % 20]} ${i} mercado`) =>
    Array.from({ length: n }, (_, i) => ({ id: `${source}${i}`, title: title(i), summary: "", url: `https://${source}/${i}`, sourceId: source, sourceName: source, publishedAt: new Date(2026, 10, 25, 23, 59 - i).toISOString(), topics: [] }));
  const merged = mergeArticles([make("valor", 40), make("g1", 5)], 80, 10);
  assert.equal(merged.filter((a) => a.sourceId === "valor").length, 10);
  assert.equal(merged.filter((a) => a.sourceId === "g1").length, 5);
  const dup = mergeArticles([make("a", 1, () => "Petrobras reduz preço da gasolina nas refinarias"), make("b", 1, () => "Petrobras reduz preço da gasolina nas refinarias hoje")]);
  assert.equal(dup.length, 1);
});

test("resumo não repete o título", () => {
  assert.equal(cleanSummary("<p>Copom mantém Selic</p>", "Copom mantém Selic"), "");
});

const colorScheme = { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" };
const cards = [
  { id: "conta", name: "Conta", type: "checking", brand: "", limit: 0, spent: 0, colorScheme },
  { id: "nu", name: "Nubank", type: "credit", brand: "", limit: 800, spent: 0, closingDay: 1, dueDay: 10, colorScheme },
];
const base = { type: "expense", recurrenceType: "fixed_day", startYear: 2026, startMonth: 0, active: true, category: "Outros" };

test("impacto pessoal usa os números do usuário e cala quando não tem relação", () => {
  const today = new Date(2026, 10, 25);
  const impacts = buildTopicImpacts({
    today, cards, usedLimitByCard: { nu: 545.24 },
    goals: [{ id: "g", title: "IPVA", category: "", current: 150, target: 1500 }],
    recurringItems: [
      { ...base, id: "claude", title: "Claude Code", amount: 110, account: "Nubank", cardId: "nu", dueDay: 14 },
      { ...base, id: "icloud", title: "iCloud", amount: 5.9, account: "Nubank", cardId: "nu", dueDay: 9 },
      { ...base, id: "aluguel", title: "Aluguel", amount: 900, account: "Conta", cardId: "conta", dueDay: 5 },
    ],
    transactions: [
      { title: "Gasolina", amount: 50, type: "despesa", occurredAt: new Date(2026, 10, 15) },
      { title: "Auto Posto", amount: 40, type: "despesa", occurredAt: new Date(2026, 10, 25) },
      { title: "Gasolina antiga", amount: 99, type: "despesa", occurredAt: new Date(2026, 8, 1) },
    ],
  });
  assert.match(impacts.get("dolar").text, /2 assinaturas suas acompanham o dólar: R\$\s?115,90/);
  assert.match(impacts.get("combustivel").text, /R\$\s?90,00 com combustível/);
  assert.match(impacts.get("credito").text, /68% do limite/);
  assert.match(impacts.get("juros").text, /R\$\s?150,00 guardados/);
  assert.match(impacts.get("imoveis").text, /Aluguel/);
  assert.equal(impacts.has("energia"), false, "sem conta de luz cadastrada, nada de frase genérica");
  assert.equal(impacts.has("cripto"), false);
});
