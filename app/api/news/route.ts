import { NEWS_SOURCES, mergeArticles, parseRssFeed, type NewsArticle } from "@/lib/services/newsFeed";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TIMEOUT_MS = 6_000;

export interface NewsResponse {
  articles: NewsArticle[];
  sources: { id: string; name: string; ok: boolean }[];
  fetchedAt: string;
}

async function fetchSource(source: (typeof NEWS_SOURCES)[number]): Promise<NewsArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "WalletPlus/1.0 news" },
      signal: controller.signal,
      next: { revalidate: 600 },
    });
    if (!response.ok) throw new Error(`${source.name} respondeu ${response.status}`);
    return parseRssFeed(await response.text(), source);
  } finally {
    clearTimeout(timeout);
  }
}

/** Notícias públicas de economia; só busca nas fontes fixas desta lista. */
export async function GET() {
  const results = await Promise.allSettled(NEWS_SOURCES.map(fetchSource));
  const lists = results.map((result) => (result.status === "fulfilled" ? result.value : []));
  const body: NewsResponse = {
    articles: mergeArticles(lists, 80),
    sources: NEWS_SOURCES.map((source, index) => ({
      id: source.id,
      name: source.name,
      ok: results[index].status === "fulfilled" && lists[index].length > 0,
    })),
    fetchedAt: new Date().toISOString(),
  };
  return Response.json(body, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
  });
}
