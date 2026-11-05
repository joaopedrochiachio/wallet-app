import type { MarketBriefing, MarketNewsItem, MarketQuote } from "@/types/market";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 300;

const REQUEST_TIMEOUT_MS = 5_000;

async function fetchWithTimeout(url: string, revalidateSeconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "WalletPlus/1.0 market-briefing" },
      signal: controller.signal,
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) throw new Error(`Fonte respondeu ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function getDollarQuote(): Promise<MarketQuote> {
  const response = await fetchWithTimeout(
    "https://economia.awesomeapi.com.br/last/USD-BRL",
    300
  );
  const payload = (await response.json()) as {
    USDBRL?: { bid?: string; pctChange?: string; create_date?: string };
  };
  const value = toFiniteNumber(payload.USDBRL?.bid);
  if (value === null) throw new Error("Cotação do dólar ausente");
  return {
    symbol: "USD/BRL",
    label: "Dólar comercial",
    value,
    changePercent: toFiniteNumber(payload.USDBRL?.pctChange) ?? 0,
    updatedAt: payload.USDBRL?.create_date,
    source: "AwesomeAPI",
  };
}

async function getIbovespaQuote(): Promise<MarketQuote> {
  const response = await fetchWithTimeout(
    "https://brapi.dev/api/quote/%5EBVSP?fundamental=false",
    300
  );
  const payload = (await response.json()) as {
    results?: Array<{
      regularMarketPrice?: number;
      regularMarketChangePercent?: number;
      regularMarketTime?: string;
    }>;
  };
  const quote = payload.results?.[0];
  const value = toFiniteNumber(quote?.regularMarketPrice);
  if (value === null) throw new Error("Cotação do Ibovespa ausente");
  return {
    symbol: "IBOV",
    label: "Ibovespa",
    value,
    changePercent: toFiniteNumber(quote?.regularMarketChangePercent) ?? 0,
    updatedAt: quote?.regularMarketTime,
    source: "brapi.dev",
  };
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getXmlTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

function parseNewsRss(xml: string): MarketNewsItem[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items.slice(0, 6).map((item, index) => {
    const rawTitle = getXmlTag(item, "title");
    const source = getXmlTag(item, "source") || rawTitle.split(" - ").at(-1) || "Mercado";
    const title = rawTitle.endsWith(` - ${source}`)
      ? rawTitle.slice(0, -(source.length + 3))
      : rawTitle;
    const url = getXmlTag(item, "link");
    const publishedAt = getXmlTag(item, "pubDate");
    return {
      id: `${index}-${title}`,
      title,
      url,
      source,
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
    };
  }).filter((item) => item.title && item.url);
}

async function getMarketNews(): Promise<MarketNewsItem[]> {
  const query = encodeURIComponent("Ibovespa OR bolsa de valores OR economia brasileira when:1d");
  const response = await fetchWithTimeout(
    `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
    900
  );
  return parseNewsRss(await response.text());
}

export async function GET() {
  const [currencyResult, indexResult, newsResult] = await Promise.allSettled([
    getDollarQuote(),
    getIbovespaQuote(),
    getMarketNews(),
  ]);

  const currency = currencyResult.status === "fulfilled" ? currencyResult.value : null;
  const index = indexResult.status === "fulfilled" ? indexResult.value : null;
  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const data: MarketBriefing = {
    currency,
    index,
    news,
    fetchedAt: new Date().toISOString(),
    isPartial: !currency || !index || news.length === 0,
  };

  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
