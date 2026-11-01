export interface MarketQuote {
  symbol: string;
  label: string;
  value: number;
  changePercent: number;
  updatedAt?: string;
  source: string;
}

export interface MarketNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
}

export interface MarketBriefing {
  currency: MarketQuote | null;
  index: MarketQuote | null;
  news: MarketNewsItem[];
  fetchedAt: string;
  isPartial: boolean;
}
