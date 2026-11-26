/**
 * Notícias de economia e investimentos: leitura de RSS, limpeza e temas.
 * Puro (sem rede), para ser testado e usado pela rota /api/news.
 */

export type NewsTopicId =
  | "juros" | "inflacao" | "dolar" | "bolsa" | "cripto" | "combustivel"
  | "impostos" | "credito" | "emprego" | "imoveis" | "energia";

export interface NewsTopic {
  id: NewsTopicId;
  label: string;
  /** Palavras (sem acento, minúsculas) que marcam o tema no título/resumo. */
  keywords: RegExp;
}

export const NEWS_TOPICS: NewsTopic[] = [
  { id: "juros", label: "Juros e Selic", keywords: /\b(selic|copom|juros?|taxa basica|cdi|tesouro direto|renda fixa|cdb)\b/ },
  { id: "inflacao", label: "Inflação", keywords: /\b(inflacao|ipca|igp-?m|inpc|precos? (sobe|sobem|caem|cai)|custo de vida|cesta basica)\b/ },
  { id: "dolar", label: "Dólar", keywords: /\b(dolar|cambio|real se (valoriza|desvaloriza)|moeda americana|euro)\b/ },
  { id: "bolsa", label: "Bolsa", keywords: /\b(ibovespa|bolsa|b3|acoes|acionistas?|dividendos?|fii|fundos? imobiliarios?|wall street|nasdaq|s&p)\b/ },
  { id: "cripto", label: "Cripto", keywords: /\b(bitcoin|cripto\w*|ethereum|blockchain|stablecoin)\b/ },
  { id: "combustivel", label: "Combustível", keywords: /\b(gasolina|diesel|etanol|combustive(l|is)|petrobras|petroleo|postos?)\b/ },
  { id: "impostos", label: "Impostos", keywords: /\b(impostos?|irpf|imposto de renda|receita federal|tributa\w*|iof|icms|reforma tributaria|isencao)\b/ },
  { id: "credito", label: "Crédito e dívidas", keywords: /\b(endividamento|dividas?|inadimplencia|credito|cartao de credito|rotativo|emprestimos?|consignado|financiamento|cmn|serasa|desenrola)\b/ },
  { id: "emprego", label: "Emprego e renda", keywords: /\b(emprego|desemprego|salario minimo|salarios?|caged|pnad|13o|decimo terceiro|fgts|inss|aposentadoria|bolsa familia)\b/ },
  { id: "imoveis", label: "Imóveis e aluguel", keywords: /\b(aluguel|imoveis?|imobiliari\w*|minha casa|habitacao|condominio)\b/ },
  { id: "energia", label: "Energia", keywords: /\b(conta de luz|energia eletrica|bandeira tarifaria|aneel|tarifa de energia)\b/ },
];

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  /** Fonte só de economia: tudo entra. Fonte geral: só entra o que tiver tema. */
  economyOnly: boolean;
}

export const NEWS_SOURCES: NewsSource[] = [
  { id: "g1", name: "g1 Economia", url: "https://g1.globo.com/rss/g1/economia/", economyOnly: true },
  { id: "valor", name: "Valor Econômico", url: "https://pox.globo.com/rss/valor/", economyOnly: false },
  { id: "agenciabrasil", name: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/rss/economia/feed.xml", economyOnly: true },
  { id: "infomoney", name: "InfoMoney", url: "https://www.infomoney.com.br/feed/", economyOnly: false },
  { id: "exame", name: "Exame", url: "https://exame.com/feed/", economyOnly: false },
];

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string | null;
  topics: NewsTopicId[];
}

/** Sorteios e entretenimento que aparecem em feeds gerais. */
const NOISE = /\b(mega-?sena|lotofacil|quina|dia de sorte|timemania|lotomania|dupla sena|super sete|resultado do concurso|bbb|big brother|horoscopo|novela)\b/;

const plain = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

/** Resumo em texto puro: sem HTML, sem "Leia mais", até ~240 caracteres. */
export function cleanSummary(html: string, title: string): string {
  const text = decodeEntities(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(leia mais|continue lendo|the post .* appeared first on .*)$/i, "")
    .trim();
  if (!text || plain(text) === plain(title)) return "";
  if (text.length <= 240) return text;
  const cut = text.slice(0, 240);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function classifyTopics(text: string): NewsTopicId[] {
  const normalized = plain(text);
  // "Bolsa Família" é programa social, não bolsa de valores.
  const forMarket = normalized.replace(/bolsa familia/g, "");
  return NEWS_TOPICS
    .filter((topic) => (topic.id === "bolsa" ? topic.keywords.test(forMarket) : topic.keywords.test(normalized)))
    .map((topic) => topic.id);
}

export function parseRssFeed(xml: string, source: NewsSource): NewsArticle[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  const articles: NewsArticle[] = [];
  for (const item of items) {
    const title = tag(item, "title").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const url = tag(item, "link") || (item.match(/<guid[^>]*>(https?:[^<]+)<\/guid>/i)?.[1] ?? "");
    if (!title || !/^https?:\/\//.test(url)) continue;
    const summary = cleanSummary(tag(item, "description"), title);
    if (NOISE.test(plain(`${title} ${summary}`))) continue;
    const topics = classifyTopics(`${title} ${summary}`);
    if (!source.economyOnly && topics.length === 0) continue;
    const published = tag(item, "pubDate") || tag(item, "dc:date");
    const date = published ? new Date(published) : null;
    articles.push({
      id: `${source.id}:${url}`,
      title,
      summary,
      url,
      sourceId: source.id,
      sourceName: source.name,
      publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
      topics,
    });
  }
  return articles;
}

/** Junta as fontes, tira repetidas (mesma notícia em dois sites) e ordena da mais nova. */
export function mergeArticles(lists: NewsArticle[][], limit = 80, perSource = 25): NewsArticle[] {
  const seen = new Set<string>();
  const kept: Set<string>[] = [];
  // Palavras que importam; números contam ("Selic a 15%" ≠ "Selic a 14%").
  const words = (title: string) =>
    new Set(plain(title).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 3 || /\d/.test(word)));
  // Mesma notícia em dois sites: 70% das palavras em comum.
  const isRepeat = (set: Set<string>) => kept.some((other) => {
    const common = [...set].filter((word) => other.has(word)).length;
    return common / Math.max(1, Math.min(set.size, other.size)) >= 0.7 && common >= 3;
  });
  // Cada fonte entra com as mais novas dela, para uma não esconder as outras.
  const byNewest = (a: NewsArticle, b: NewsArticle) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  const all = lists.flatMap((list) => [...list].sort(byNewest).slice(0, perSource)).sort(byNewest);
  const result: NewsArticle[] = [];
  for (const article of all) {
    const set = words(article.title);
    if (seen.has(article.url) || isRepeat(set)) continue;
    seen.add(article.url);
    kept.push(set);
    result.push(article);
    if (result.length >= limit) break;
  }
  return result;
}
