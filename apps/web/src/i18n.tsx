import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";

export const defaultLocale = "zh-CN";
export const supportedLocales = ["zh-CN", "en-US"] as const;

export type Locale = (typeof supportedLocales)[number];

export const zhCN = {
  common: {
    brandMark: "邸",
    brandName: "邸报",
    brandSubtitle: "Dibao",
    version: (version: string) => `v${version}`
  },
  navigation: {
    ariaLabel: "主导航",
    items: {
      latest: "最新",
      recommended: "推荐",
      saved: "收藏",
      readLater: "稍后读",
      search: "搜索",
      feeds: "订阅源",
      settings: "设置"
    }
  },
  shell: {
    kicker: "RSS Ingestion",
    pageTitle: "最新文章",
    loadingArticles: "正在加载文章",
    latestView: "最新视图"
  },
  feeds: {
    kicker: "订阅源",
    title: "Feeds",
    inputLabel: "RSS / Atom URL",
    inputPlaceholder: "https://example.com/feed.xml",
    add: "添加",
    adding: "添加中",
    allFeeds: "全部订阅源",
    sourceCount: (count: number) => `${count} 个来源`,
    feedUrlRequired: "请输入 RSS / Atom 地址。",
    successAt: (date: string) => `成功：${date}`,
    refresh: "刷新",
    refreshing: "…",
    refreshTitle: (feedTitle: string) => `刷新 ${feedTitle}`
  },
  articles: {
    allSources: "全部来源",
    title: "Latest",
    emptyNoFeedsTitle: "还没有订阅源",
    emptyNoFeedsBody: "添加一个 RSS / Atom 源后，文章会出现在这里。",
    emptyNoArticlesTitle: "暂时没有文章",
    emptyNoArticlesBody: "可以刷新订阅源，或切换到全部来源查看。",
    itemMeta: (date: string, feedTitle: string) => `${date} · ${feedTitle}`
  },
  reader: {
    originalLink: "原文",
    selectArticleTitle: "选择一篇文章",
    selectArticleBody: "文章详情会在这里打开。",
    feedOnlyNotice: "当前仅有订阅源摘要。",
    noContent: "这篇文章暂无正文内容。",
    meta: (feedTitle: string, date?: string, author?: string | null) =>
      [feedTitle, date, author].filter(Boolean).join(" · ")
  },
  notices: {
    feedAddedAndRefreshed: (feedTitle: string) => `已添加并刷新：${feedTitle}`,
    feedRefreshed: (feedTitle: string) => `已刷新：${feedTitle}`
  },
  errors: {
    api: {
      requestFailed: "请求失败，请稍后重试。",
      httpError: (status: number) => `请求失败（HTTP ${status}）。`
    }
  }
} as const;

type WidenDictionary<T> = T extends (...args: infer Args) => infer Return
  ? (...args: Args) => Return
  : T extends string
    ? string
    : T extends object
      ? { readonly [Key in keyof T]: WidenDictionary<T[Key]> }
      : T;

export type Dictionary = WidenDictionary<typeof zhCN>;
export type NavigationItemKey = keyof Dictionary["navigation"]["items"];

export const enUS = {
  common: {
    brandMark: "D",
    brandName: "Dibao",
    brandSubtitle: "Reader",
    version: (version: string) => `v${version}`
  },
  navigation: {
    ariaLabel: "Primary navigation",
    items: {
      latest: "Latest",
      recommended: "Recommended",
      saved: "Saved",
      readLater: "Read Later",
      search: "Search",
      feeds: "Feeds",
      settings: "Settings"
    }
  },
  shell: {
    kicker: "RSS Ingestion",
    pageTitle: "Latest Articles",
    loadingArticles: "Loading articles",
    latestView: "Latest view"
  },
  feeds: {
    kicker: "Feeds",
    title: "Feeds",
    inputLabel: "RSS / Atom URL",
    inputPlaceholder: "https://example.com/feed.xml",
    add: "Add",
    adding: "Adding",
    allFeeds: "All feeds",
    sourceCount: (count: number) => `${count} ${count === 1 ? "source" : "sources"}`,
    feedUrlRequired: "Enter an RSS / Atom URL.",
    successAt: (date: string) => `Success: ${date}`,
    refresh: "Refresh",
    refreshing: "…",
    refreshTitle: (feedTitle: string) => `Refresh ${feedTitle}`
  },
  articles: {
    allSources: "All sources",
    title: "Latest",
    emptyNoFeedsTitle: "No feeds yet",
    emptyNoFeedsBody: "Add an RSS / Atom feed and articles will appear here.",
    emptyNoArticlesTitle: "No articles yet",
    emptyNoArticlesBody: "Refresh a feed or switch back to all sources.",
    itemMeta: (date: string, feedTitle: string) => `${date} · ${feedTitle}`
  },
  reader: {
    originalLink: "Original",
    selectArticleTitle: "Select an article",
    selectArticleBody: "Article details will open here.",
    feedOnlyNotice: "Only the feed summary is available.",
    noContent: "This article has no body content yet.",
    meta: (feedTitle: string, date?: string, author?: string | null) =>
      [feedTitle, date, author].filter(Boolean).join(" · ")
  },
  notices: {
    feedAddedAndRefreshed: (feedTitle: string) => `Added and refreshed: ${feedTitle}`,
    feedRefreshed: (feedTitle: string) => `Refreshed: ${feedTitle}`
  },
  errors: {
    api: {
      requestFailed: "Request failed. Please try again.",
      httpError: (status: number) => `Request failed (HTTP ${status}).`
    }
  }
} as const satisfies Dictionary;

export const dictionaries = {
  "zh-CN": zhCN,
  "en-US": enUS
} as const satisfies Record<Locale, Dictionary>;

export type I18nValue = {
  locale: Locale;
  t: Dictionary;
  formatDate: (value: string | Date) => string;
};

export type DibaoI18nProviderProps = {
  children: ReactNode;
  locale?: Locale;
};

const defaultI18n = createI18n(defaultLocale);
const I18nContext = createContext<I18nValue>(defaultI18n);

export function DibaoI18nProvider(props: DibaoI18nProviderProps) {
  const locale = props.locale ?? defaultLocale;
  const value = useMemo(() => createI18n(locale), [locale]);

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function createI18n(
  locale: Locale = defaultLocale,
  options: { timeZone?: string } = {}
): I18nValue {
  const formatter = createDateFormatter(locale, options);

  return {
    locale,
    t: dictionaries[locale],
    formatDate(value) {
      return formatter.format(new Date(value));
    }
  };
}

export function createDateFormatter(
  locale: Locale = defaultLocale,
  options: { timeZone?: string } = {}
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(options.timeZone ? { timeZone: options.timeZone } : {})
  });
}
