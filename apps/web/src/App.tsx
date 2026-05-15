import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dibaoVersion } from "@dibao/shared";
import {
  dibaoApi,
  userMessageForError,
  type ArticleDetail,
  type ArticleListItem,
  type Feed
} from "./api.js";
import styles from "./design-system/AppShell/AppShell.module.css";
import { useI18n, type NavigationItemKey } from "./i18n.js";

const navigationItems: NavigationItemKey[] = [
  "latest",
  "recommended",
  "saved",
  "readLater",
  "search",
  "feeds",
  "settings"
];

type Notice =
  | { type: "feedAddedAndRefreshed"; feedTitle: string }
  | { type: "feedRefreshed"; feedTitle: string };

export function App() {
  const { t } = useI18n();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [articleDetail, setArticleDetail] = useState<ArticleDetail | null>(null);
  const [feedUrl, setFeedUrl] = useState("");
  const [isFeedsLoading, setIsFeedsLoading] = useState(true);
  const [isArticlesLoading, setIsArticlesLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [refreshingFeedId, setRefreshingFeedId] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [articleError, setArticleError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const selectedFeed = useMemo(
    () => feeds.find((feed) => feed.id === selectedFeedId) ?? null,
    [feeds, selectedFeedId]
  );

  const loadFeeds = useCallback(async () => {
    setIsFeedsLoading(true);
    setFeedError(null);

    try {
      const nextFeeds = await dibaoApi.listFeeds();
      setFeeds(nextFeeds);
      setSelectedFeedId((current) =>
        current && nextFeeds.some((feed) => feed.id === current) ? current : null
      );
    } catch (error) {
      setFeedError(userMessageForError(error, t.errors.api));
    } finally {
      setIsFeedsLoading(false);
    }
  }, [t.errors.api]);

  const loadArticles = useCallback(async (feedId: string | null) => {
    setIsArticlesLoading(true);
    setArticleError(null);

    try {
      const response = await dibaoApi.listArticles({ feedId, limit: 50 });
      setArticles(response.data);
      setSelectedArticleId((current) =>
        current && response.data.some((article) => article.id === current)
          ? current
          : response.data[0]?.id ?? null
      );
    } catch (error) {
      setArticleError(userMessageForError(error, t.errors.api));
      setArticles([]);
      setSelectedArticleId(null);
    } finally {
      setIsArticlesLoading(false);
    }
  }, [t.errors.api]);

  useEffect(() => {
    void loadFeeds();
  }, [loadFeeds]);

  useEffect(() => {
    void loadArticles(selectedFeedId);
  }, [loadArticles, selectedFeedId]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail(articleId: string) {
      setIsDetailLoading(true);
      setDetailError(null);

      try {
        const detail = await dibaoApi.getArticle(articleId);
        if (!cancelled) {
          setArticleDetail(detail);
        }
      } catch (error) {
        if (!cancelled) {
          setArticleDetail(null);
          setDetailError(userMessageForError(error, t.errors.api));
        }
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    }

    if (!selectedArticleId) {
      setArticleDetail(null);
      setIsDetailLoading(false);
      setDetailError(null);
      return;
    }

    void loadDetail(selectedArticleId);

    return () => {
      cancelled = true;
    };
  }, [selectedArticleId, t.errors.api]);

  async function handleAddFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFeedUrl = feedUrl.trim();

    if (!nextFeedUrl) {
      setFeedError(t.feeds.feedUrlRequired);
      return;
    }

    setIsAddingFeed(true);
    setFeedError(null);
    setNotice(null);

    try {
      const result = await dibaoApi.createFeed(nextFeedUrl);
      setFeedUrl("");
      setNotice({ type: "feedAddedAndRefreshed", feedTitle: result.feed.title });
      await loadFeeds();
      setSelectedFeedId(result.feed.id);
    } catch (error) {
      setFeedError(userMessageForError(error, t.errors.api));
    } finally {
      setIsAddingFeed(false);
    }
  }

  async function handleRefreshFeed(feed: Feed) {
    setRefreshingFeedId(feed.id);
    setFeedError(null);
    setArticleError(null);
    setNotice(null);

    try {
      await dibaoApi.refreshFeed(feed.id);
      setNotice({ type: "feedRefreshed", feedTitle: feed.title });
      await Promise.all([loadFeeds(), loadArticles(selectedFeedId)]);
    } catch (error) {
      setFeedError(userMessageForError(error, t.errors.api));
    } finally {
      setRefreshingFeedId(null);
    }
  }

  const noticeText = notice ? t.notices[notice.type](notice.feedTitle) : null;

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label={t.navigation.ariaLabel}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>{t.common.brandMark}</span>
          <span>
            <strong>{t.common.brandName}</strong>
            <small>{t.common.brandSubtitle}</small>
          </span>
        </div>
        <nav className={styles.nav}>
          {navigationItems.map((item) => (
            <a
              className={item === "latest" ? styles.navItemActive : styles.navItem}
              href="#"
              key={item}
            >
              {t.navigation.items[item]}
            </a>
          ))}
        </nav>
      </aside>

      <section className={styles.content} aria-labelledby="page-title">
        <header className={styles.topbar}>
          <div>
            <p className={styles.kicker}>{t.shell.kicker}</p>
            <h1 id="page-title">{t.shell.pageTitle}</h1>
          </div>
          <div className={styles.topbarMeta}>
            <span className={styles.statusText} aria-live="polite">
              {noticeText ?? (isArticlesLoading ? t.shell.loadingArticles : t.shell.latestView)}
            </span>
            <span className={styles.version}>{t.common.version(dibaoVersion)}</span>
          </div>
        </header>

        <div className={styles.workspace}>
          <FeedPanel
            feedError={feedError}
            feeds={feeds}
            feedUrl={feedUrl}
            isAddingFeed={isAddingFeed}
            isFeedsLoading={isFeedsLoading}
            onAddFeed={handleAddFeed}
            onRefreshFeed={handleRefreshFeed}
            onSelectFeed={setSelectedFeedId}
            onUpdateFeedUrl={setFeedUrl}
            refreshingFeedId={refreshingFeedId}
            selectedFeedId={selectedFeedId}
          />

          <ArticleListPanel
            articleError={articleError}
            articles={articles}
            feedCount={feeds.length}
            isArticlesLoading={isArticlesLoading}
            onSelectArticle={setSelectedArticleId}
            selectedArticleId={selectedArticleId}
            selectedFeed={selectedFeed}
          />

          <ArticleDetailPanel
            article={articleDetail}
            detailError={detailError}
            isDetailLoading={isDetailLoading}
          />
        </div>
      </section>
    </main>
  );
}

function FeedPanel(props: {
  feedError: string | null;
  feeds: Feed[];
  feedUrl: string;
  isAddingFeed: boolean;
  isFeedsLoading: boolean;
  onAddFeed: (event: FormEvent<HTMLFormElement>) => void;
  onRefreshFeed: (feed: Feed) => void;
  onSelectFeed: (feedId: string | null) => void;
  onUpdateFeedUrl: (value: string) => void;
  refreshingFeedId: string | null;
  selectedFeedId: string | null;
}) {
  const { t, formatDate } = useI18n();

  return (
    <section className={styles.feedPanel} aria-labelledby="feeds-title">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>{t.feeds.kicker}</p>
          <h2 id="feeds-title">{t.feeds.title}</h2>
        </div>
        <span className={styles.count}>{props.feeds.length}</span>
      </div>

      <form className={styles.addFeedForm} onSubmit={props.onAddFeed}>
        <label htmlFor="feed-url">{t.feeds.inputLabel}</label>
        <div className={styles.addFeedRow}>
          <input
            id="feed-url"
            inputMode="url"
            onChange={(event) => props.onUpdateFeedUrl(event.target.value)}
            placeholder={t.feeds.inputPlaceholder}
            type="url"
            value={props.feedUrl}
          />
          <button className={styles.primaryButton} disabled={props.isAddingFeed} type="submit">
            {props.isAddingFeed ? t.feeds.adding : t.feeds.add}
          </button>
        </div>
      </form>

      {props.feedError ? <p className={styles.errorText}>{props.feedError}</p> : null}

      <div className={styles.feedList}>
        <button
          className={props.selectedFeedId === null ? styles.feedItemActive : styles.feedItem}
          onClick={() => props.onSelectFeed(null)}
          type="button"
        >
          <span>{t.feeds.allFeeds}</span>
          <small>{t.feeds.sourceCount(props.feeds.length)}</small>
        </button>

        {props.isFeedsLoading ? <SkeletonRows count={5} /> : null}

        {!props.isFeedsLoading &&
          props.feeds.map((feed) => (
            <div className={styles.feedRow} key={feed.id}>
              <button
                className={
                  props.selectedFeedId === feed.id ? styles.feedItemActive : styles.feedItem
                }
                onClick={() => props.onSelectFeed(feed.id)}
                type="button"
              >
                <span>{feed.title}</span>
                <small>
                  {feed.lastSuccessAt
                    ? t.feeds.successAt(formatDate(feed.lastSuccessAt))
                    : feed.feedUrl}
                </small>
              </button>
              <button
                className={styles.iconButton}
                disabled={props.refreshingFeedId === feed.id}
                onClick={() => props.onRefreshFeed(feed)}
                title={t.feeds.refreshTitle(feed.title)}
                type="button"
              >
                {props.refreshingFeedId === feed.id ? t.feeds.refreshing : t.feeds.refresh}
              </button>
            </div>
          ))}
      </div>
    </section>
  );
}

function ArticleListPanel(props: {
  articleError: string | null;
  articles: ArticleListItem[];
  feedCount: number;
  isArticlesLoading: boolean;
  onSelectArticle: (articleId: string) => void;
  selectedArticleId: string | null;
  selectedFeed: Feed | null;
}) {
  const { t, formatDate } = useI18n();

  return (
    <section className={styles.articlePanel} aria-labelledby="articles-title">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>{props.selectedFeed?.title ?? t.articles.allSources}</p>
          <h2 id="articles-title">{t.articles.title}</h2>
        </div>
        <span className={styles.count}>{props.articles.length}</span>
      </div>

      {props.articleError ? <p className={styles.errorText}>{props.articleError}</p> : null}

      <div className={styles.list} aria-live="polite">
        {props.isArticlesLoading ? <SkeletonRows count={10} /> : null}

        {!props.isArticlesLoading && props.articles.length === 0 ? (
          <EmptyState
            title={
              props.feedCount === 0
                ? t.articles.emptyNoFeedsTitle
                : t.articles.emptyNoArticlesTitle
            }
            body={
              props.feedCount === 0
                ? t.articles.emptyNoFeedsBody
                : t.articles.emptyNoArticlesBody
            }
          />
        ) : null}

        {!props.isArticlesLoading &&
          props.articles.map((article) => (
            <button
              className={
                props.selectedArticleId === article.id
                  ? styles.articleItemActive
                  : article.state.read
                    ? styles.articleItemRead
                    : styles.articleItem
              }
              key={article.id}
              onClick={() => props.onSelectArticle(article.id)}
              type="button"
            >
              <span className={styles.meta}>
                {t.articles.itemMeta(
                  formatDate(article.publishedAt ?? article.discoveredAt),
                  article.feedTitle
                )}
              </span>
              <strong>{article.title}</strong>
              {article.summary ? <span className={styles.summary}>{article.summary}</span> : null}
            </button>
          ))}
      </div>
    </section>
  );
}

function ArticleDetailPanel(props: {
  article: ArticleDetail | null;
  detailError: string | null;
  isDetailLoading: boolean;
}) {
  const { t, formatDate } = useI18n();
  const safeHtml = useMemo(
    () => (props.article?.contentHtml ? sanitizeArticleHtml(props.article.contentHtml) : null),
    [props.article?.contentHtml]
  );

  return (
    <section className={styles.readerPanel} aria-labelledby="reader-title">
      {props.isDetailLoading ? <ReaderSkeleton /> : null}

      {!props.isDetailLoading && props.detailError ? (
        <p className={styles.errorText}>{props.detailError}</p>
      ) : null}

      {!props.isDetailLoading && !props.detailError && !props.article ? (
        <EmptyState title={t.reader.selectArticleTitle} body={t.reader.selectArticleBody} />
      ) : null}

      {!props.isDetailLoading && !props.detailError && props.article ? (
        <article className={styles.reader} data-reader-theme="paper">
          <header className={styles.readerHeader}>
            <a href={props.article.url} rel="noreferrer" target="_blank">
              {t.reader.originalLink}
            </a>
            <h2 id="reader-title">{props.article.title}</h2>
            <p>
              {t.reader.meta(
                props.article.feedTitle,
                props.article.publishedAt ? formatDate(props.article.publishedAt) : undefined,
                props.article.author
              )}
            </p>
            {props.article.extractionStatus === "feed_only" ? (
              <span className={styles.inlineNotice}>{t.reader.feedOnlyNotice}</span>
            ) : null}
          </header>

          {safeHtml ? (
            <div
              className={styles.readerBody}
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          ) : (
            <div className={styles.readerBody}>
              <p>{props.article.contentText ?? props.article.summary ?? t.reader.noContent}</p>
            </div>
          )}
        </article>
      ) : null}
    </section>
  );
}

function EmptyState(props: { title: string; body: string }) {
  return (
    <div className={styles.emptyState}>
      <strong>{props.title}</strong>
      <p>{props.body}</p>
    </div>
  );
}

function SkeletonRows(props: { count: number }) {
  return (
    <div className={styles.skeletonStack} aria-hidden="true">
      {Array.from({ length: props.count }).map((_, index) => (
        <span className={styles.skeletonRow} key={index} />
      ))}
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className={styles.readerSkeleton} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function sanitizeArticleHtml(html: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(`<main>${html}</main>`, "text/html");
  const allowedTags = new Set([
    "A",
    "B",
    "BLOCKQUOTE",
    "BR",
    "CODE",
    "EM",
    "H2",
    "H3",
    "H4",
    "I",
    "LI",
    "OL",
    "P",
    "PRE",
    "STRONG",
    "UL"
  ]);

  function clean(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode();
    }

    if (!(node instanceof Element)) {
      return null;
    }

    if (!allowedTags.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(node.childNodes)) {
        const cleaned = clean(child);
        if (cleaned) {
          fragment.appendChild(cleaned);
        }
      }
      return fragment;
    }

    const element = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === "A") {
      const href = node.getAttribute("href");
      if (href && /^(https?:|mailto:)/i.test(href)) {
        element.setAttribute("href", href);
        element.setAttribute("rel", "noreferrer");
        element.setAttribute("target", "_blank");
      }
    }

    for (const child of Array.from(node.childNodes)) {
      const cleaned = clean(child);
      if (cleaned) {
        element.appendChild(cleaned);
      }
    }

    return element;
  }

  const output = document.createElement("main");
  for (const child of Array.from(document.body.firstElementChild?.childNodes ?? [])) {
    const cleaned = clean(child);
    if (cleaned) {
      output.appendChild(cleaned);
    }
  }

  return output.innerHTML;
}
