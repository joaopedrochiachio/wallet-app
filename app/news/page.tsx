"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, Bitcoin, Briefcase, ChartCandlestick, ChevronDown, CreditCard, DollarSign,
  Fuel, Home, Percent, Receipt, RefreshCw, TrendingUp, Zap,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useCalendarDay } from "@/lib/hooks/useCalendarDay";
import { NEWS_TOPICS, type NewsArticle, type NewsTopicId } from "@/lib/services/newsFeed";
import { buildTopicImpacts, type TopicImpact } from "@/lib/services/newsImpact";
import { Delta, Panel, brl } from "@/components/charts/finance";
import type { MarketBriefing } from "@/types/market";

interface NewsPayload {
  articles: NewsArticle[];
  sources: { id: string; name: string; ok: boolean }[];
  fetchedAt: string;
}

const TOPIC_ICON: Record<NewsTopicId, typeof Percent> = {
  juros: Percent, inflacao: TrendingUp, dolar: DollarSign, bolsa: ChartCandlestick, cripto: Bitcoin,
  combustivel: Fuel, impostos: Receipt, credito: CreditCard, emprego: Briefcase, imoveis: Home, energia: Zap,
};
const TOPIC_LABEL = Object.fromEntries(NEWS_TOPICS.map((topic) => [topic.id, topic.label])) as Record<NewsTopicId, string>;

function relativeTime(iso: string | null, now: number): string {
  if (!iso) return "";
  const date = new Date(iso);
  const minutes = Math.max(0, Math.round((now - date.getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

export default function NewsPage() {
  const { recurringItems, cards, goals, transactions, cardStatements } = useWallet();
  const todayTime = useCalendarDay().getTime();
  const [news, setNews] = useState<NewsPayload | null>(null);
  const [market, setMarket] = useState<MarketBriefing | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [topic, setTopic] = useState<NewsTopicId | null>(null);
  const [openImpact, setOpenImpact] = useState<NewsTopicId | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showAllPocket, setShowAllPocket] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [newsResponse, marketResponse] = await Promise.allSettled([
        fetch("/api/news").then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status))))),
        fetch("/api/market/briefing").then((response) => (response.ok ? response.json() : null)),
      ]);
      if (newsResponse.status !== "fulfilled" || !Array.isArray(newsResponse.value?.articles)) throw new Error("sem notícias");
      setNews(newsResponse.value as NewsPayload);
      setMarket(marketResponse.status === "fulfilled" ? (marketResponse.value as MarketBriefing | null) : null);
      setNow(Date.now());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // Busca inicial dos dados públicos (não é IA: sem custo de API).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const impacts = useMemo(() => buildTopicImpacts({
    recurringItems, cards, goals,
    transactions: transactions as Parameters<typeof buildTopicImpacts>[0]["transactions"],
    usedLimitByCard: Object.fromEntries(Object.entries(cardStatements).map(([id, statement]) => [id, statement.usedLimit])),
    today: new Date(todayTime),
  }), [recurringItems, cards, goals, transactions, cardStatements, todayTime]);

  const articles = useMemo(() => news?.articles ?? [], [news]);
  const counts = useMemo(() => {
    const result = new Map<NewsTopicId, number>();
    for (const article of articles) for (const id of article.topics) result.set(id, (result.get(id) ?? 0) + 1);
    return result;
  }, [articles]);
  // Temas do dia que mexem com o dinheiro do usuário, dos mais noticiados para os menos.
  const pocket = useMemo(
    () => [...counts.entries()].filter(([id]) => impacts.has(id)).sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ impact: impacts.get(id) as TopicImpact, count })),
    [counts, impacts]
  );
  const visible = topic ? articles.filter((article) => article.topics.includes(topic)) : articles;
  const failed = news?.sources.filter((source) => !source.ok) ?? [];
  // Destaque: a notícia mais recente que mexe com o dinheiro do usuário (senão, a mais recente).
  const featured = visible.find((article) => article.topics.some((id) => impacts.has(id))) ?? visible[0];
  const rest = visible.filter((article) => article !== featured);
  const shownPocket = showAllPocket ? pocket : pocket.slice(0, 3);

  return (
    <div className="min-h-full space-y-5 bg-[#F2F2F7] p-4 font-sans text-[#1D1D1F] animate-in fade-in duration-500 sm:p-6 md:p-10">
      <header className="mx-auto flex max-w-6xl flex-col justify-between gap-4 pt-2 sm:flex-row sm:items-end md:pt-0">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">Inteligência</span>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-[#1D1D1F]">Notícias</h1>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={state === "loading"}
          className="flex cursor-pointer items-center gap-1.5 self-start rounded-full border border-black/[0.04] bg-white px-3.5 py-2 text-xs text-[#86868B] disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw size={13} className={state === "loading" ? "animate-spin" : ""} />
          {news ? `Atualizado ${new Date(news.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Atualizar"}
        </button>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Coluna da direita vem primeiro no celular: o que importa para o usuário. */}
        <div className="min-w-0 space-y-5 lg:order-2">
          {market && (market.currency || market.index) && (
            <div className="grid grid-cols-2 gap-3">
              {[market.currency, market.index].filter(Boolean).map((quote) => (
                <div key={quote!.symbol} className="rounded-[12px] bg-[var(--fb-card)] px-4 py-3 shadow-[var(--fb-shadow)]">
                  <span className="block text-xs text-[var(--fb-text-3)]">{quote!.label}</span>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-extrabold text-[var(--fb-text)] [font-variant-numeric:tabular-nums]">
                      {quote!.symbol === "USD/BRL" ? brl(quote!.value) : quote!.value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </span>
                    <Delta value={quote!.changePercent} inverse={quote!.symbol === "USD/BRL"} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {pocket.length > 0 && (
            <Panel title="No seu bolso">
              <ul className="divide-y divide-[var(--fb-line)]">
                {shownPocket.map(({ impact, count }) => {
                  const Icon = TOPIC_ICON[impact.topic];
                  const selected = topic === impact.topic;
                  const open = openImpact === impact.topic;
                  return (
                    <li key={impact.topic} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fb-accent-bg)] text-[var(--fb-accent)]">
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[var(--fb-text)]">{TOPIC_LABEL[impact.topic]}</span>
                            <button
                              type="button"
                              onClick={() => setTopic(selected ? null : impact.topic)}
                              aria-pressed={selected}
                              className={`touch-target shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${selected ? "bg-[#1D1D1F] text-white" : "bg-[var(--fb-card-2)] text-[var(--fb-text-2)] hover:text-[var(--fb-text)]"}`}
                            >
                              {count} {count === 1 ? "notícia" : "notícias"}
                            </button>
                          </span>
                          <span className="block text-xs leading-relaxed text-[var(--fb-text-2)]">{impact.text}</span>
                          {impact.basis.length > 0 && (
                            <button type="button" onClick={() => setOpenImpact(open ? null : impact.topic)} aria-expanded={open}
                              className="touch-target inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-[var(--fb-text-3)] hover:text-[var(--fb-text)]">
                              De onde vem a conta <ChevronDown size={12} className={open ? "rotate-180" : ""} />
                            </button>
                          )}
                          {open && (
                            <span className="block space-y-0.5 rounded-[8px] bg-[var(--fb-card-2)] px-2.5 py-2">
                              {impact.basis.map((entry, index) => (
                                <span key={`${entry.label}-${index}`} className="flex justify-between gap-3 text-[11px] text-[var(--fb-text-2)]">
                                  <span className="truncate">{entry.label}</span>
                                  <span className="shrink-0 [font-variant-numeric:tabular-nums]">{brl(entry.amount)}</span>
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {pocket.length > 3 && (
                <button type="button" onClick={() => setShowAllPocket((value) => !value)} aria-expanded={showAllPocket}
                  className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1 border-t border-[var(--fb-line)] pt-3 text-xs font-semibold text-[var(--fb-accent)]">
                  {showAllPocket ? "Mostrar menos" : `Ver mais ${pocket.length - 3} ${pocket.length - 3 === 1 ? "tema" : "temas"}`}
                  <ChevronDown size={13} className={showAllPocket ? "rotate-180" : ""} />
                </button>
              )}
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-4 lg:order-1">
          <nav className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5" aria-label="Filtrar por tema">
            <TopicChip active={topic === null} onClick={() => setTopic(null)} label="Tudo" count={articles.length} />
            {NEWS_TOPICS.filter((item) => counts.has(item.id)).map((item) => (
              <TopicChip key={item.id} active={topic === item.id} onClick={() => setTopic(topic === item.id ? null : item.id)}
                label={item.label} count={counts.get(item.id) ?? 0} mine={impacts.has(item.id)} />
            ))}
          </nav>

          {state === "loading" && !news && (
            <div className="space-y-3" aria-busy="true" aria-label="Carregando notícias">
              {[0, 1, 2, 3].map((index) => <div key={index} className="h-24 animate-pulse rounded-[12px] bg-[var(--fb-card)]" />)}
            </div>
          )}

          {state === "error" && !news && (
            <div className="space-y-2 rounded-[12px] bg-[var(--fb-card)] p-6 text-center">
              <p className="text-sm font-semibold text-[var(--fb-text)]">Não consegui buscar as notícias agora</p>
              <button type="button" onClick={() => void load()} className="touch-target cursor-pointer text-xs font-semibold text-[var(--fb-accent)]">Tentar de novo</button>
            </div>
          )}

          {featured && (
            <article className="rounded-[12px] bg-[var(--fb-card)] px-5 py-5 shadow-[var(--fb-shadow)] sm:px-6">
              <SourceLine article={featured} now={now} />
              <a href={featured.url} target="_blank" rel="noopener noreferrer" className="group mt-2 block">
                <h2 className="text-xl font-semibold leading-snug text-[var(--fb-text)] group-hover:underline">{featured.title}</h2>
              </a>
              {featured.summary && <p className="mt-2 text-sm leading-relaxed text-[var(--fb-text-2)]">{featured.summary}</p>}
              <TopicTags article={featured} impacts={impacts} onPick={setTopic} />
            </article>
          )}

          {rest.length > 0 && (
            <ul className="divide-y divide-[var(--fb-line)] rounded-[12px] bg-[var(--fb-card)] px-5 shadow-[var(--fb-shadow)] sm:px-6">
              {rest.map((article) => <ArticleRow key={article.id} article={article} now={now} impacts={impacts} onPick={setTopic} />)}
            </ul>
          )}

          {state === "ready" && visible.length === 0 && (
            <p className="rounded-[12px] bg-[var(--fb-card)] p-6 text-center text-sm text-[var(--fb-text-3)]">Nenhuma notícia deste tema agora.</p>
          )}

          {news && (
            <p className="px-1 text-[11px] text-[var(--fb-text-4)]">
              Fontes: {news.sources.filter((source) => source.ok).map((source) => source.name).join(", ")}
              {failed.length > 0 && ` · sem resposta agora: ${failed.map((source) => source.name).join(", ")}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicChip({ active, onClick, label, count, mine }: { active: boolean; onClick: () => void; label: string; count: number; mine?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${active ? "bg-[#1D1D1F] text-white" : "bg-white text-[#86868B] hover:text-[#1D1D1F]"}`}
    >
      {mine && <span className="h-1.5 w-1.5 rounded-full bg-[var(--fb-accent)]" aria-label="afeta você" />}
      {label}
      <span className={active ? "text-white/60" : "text-[var(--fb-text-4)]"}>{count}</span>
    </button>
  );
}

function SourceLine({ article, now }: { article: NewsArticle; now: number }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--fb-text-3)]">
      <span className="font-semibold text-[var(--fb-text-2)]">{article.sourceName}</span>
      {article.publishedAt && <>· <time dateTime={article.publishedAt}>{relativeTime(article.publishedAt, now)}</time></>}
    </span>
  );
}

function TopicTags({ article, impacts, onPick }: { article: NewsArticle; impacts: Map<NewsTopicId, TopicImpact>; onPick: (id: NewsTopicId) => void }) {
  if (article.topics.length === 0) return null;
  return (
    <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {article.topics.map((id) => (
        <button key={id} type="button" onClick={() => onPick(id)}
          className="touch-target inline-flex cursor-pointer items-center gap-1 rounded-full bg-[var(--fb-card-2)] px-2 py-0.5 text-[11px] text-[var(--fb-text-2)] hover:text-[var(--fb-text)]">
          {impacts.has(id) && <span className="h-1.5 w-1.5 rounded-full bg-[var(--fb-accent)]" aria-hidden />}
          {TOPIC_LABEL[id]}
        </button>
      ))}
      {article.topics.some((id) => impacts.has(id)) && <span className="text-[11px] text-[var(--fb-accent)]">afeta você</span>}
    </span>
  );
}

function ArticleRow({ article, now, impacts, onPick }: { article: NewsArticle; now: number; impacts: Map<NewsTopicId, TopicImpact>; onPick: (id: NewsTopicId) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-4">
      <SourceLine article={article} now={now} />
      <div className="mt-1 flex items-start justify-between gap-3">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} disabled={!article.summary}
          className="min-w-0 cursor-pointer text-left disabled:cursor-default">
          <h3 className="text-[15px] font-semibold leading-snug text-[var(--fb-text)]">{article.title}</h3>
        </button>
        <a href={article.url} target="_blank" rel="noopener noreferrer" aria-label={`Ler no ${article.sourceName}`}
          className="touch-pad shrink-0 rounded-full p-1.5 text-[var(--fb-text-3)] hover:bg-[var(--fb-card-2)] hover:text-[var(--fb-text)]">
          <ArrowUpRight size={16} />
        </a>
      </div>
      {open && article.summary && <p className="mt-1.5 text-sm leading-relaxed text-[var(--fb-text-2)]">{article.summary}</p>}
      <TopicTags article={article} impacts={impacts} onPick={onPick} />
    </li>
  );
}
