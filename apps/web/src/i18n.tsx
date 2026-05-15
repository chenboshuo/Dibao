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
    pageTitles: {
      latest: "最新文章",
      recommended: "推荐文章"
    },
    loadingArticles: "正在加载文章",
    latestView: "最新视图",
    viewStatus: {
      latest: "最新视图",
      recommended: "推荐视图"
    }
  },
  auth: {
    loading: "正在检查登录状态",
    setupTitle: "设置访问密码",
    setupBody: "这是单用户自托管实例。设置一个访问密码后即可进入阅读器。",
    loginTitle: "登录邸报",
    loginBody: "输入访问密码继续。",
    passwordLabel: "访问密码",
    passwordPlaceholder: "至少 8 个字符",
    setupSubmit: "完成设置",
    loginSubmit: "登录",
    submitting: "处理中",
    logout: "退出",
    logoutTitle: "退出登录",
    passwordRequired: "请输入访问密码。",
    errors: {
      session: "无法读取登录状态。",
      logout: "退出登录失败。"
    }
  },
  setup: {
    kicker: "首次设置",
    welcome: {
      title: "欢迎使用邸报",
      body: "一个自托管的个人 RSS 推荐阅读器。先完成几个必要步骤，再进入阅读界面。",
      start: "开始设置"
    },
    sources: {
      title: "添加订阅源",
      body: "导入 OPML 文件，或手动添加一个 RSS / Atom 源。至少需要一个订阅源才能继续。",
      importOpml: "导入 OPML 文件",
      addFeed: "添加订阅源",
      noFeedsAfterImport: "导入完成，但没有创建新的订阅源。请检查 OPML 文件或手动添加 RSS / Atom 地址。",
      noFeedsAfterAdd: "订阅源尚未创建成功，请重试。"
    },
    provider: {
      title: "推荐能力",
      body: "当前先使用基础排序。Embedding provider 会在后续设置中配置，本轮不会发送正文到外部服务。",
      currentTitle: "当前使用基础排序",
      currentBody: "你仍然可以阅读、收藏、稍后读，并让基础排序使用这些行为信号。",
      continue: "暂不配置，继续"
    }
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
  folders: {
    title: "分组",
    feedCount: (count: number) => `${count} 个订阅源`
  },
  opml: {
    import: "导入 OPML",
    importing: "导入中",
    export: "导出 OPML",
    exporting: "导出中",
    importSummary: (feedsCreated: number, feedsSkipped: number, foldersCreated: number) =>
      `已导入 ${feedsCreated} 个订阅源，跳过 ${feedsSkipped} 个，新增 ${foldersCreated} 个分组。`,
    importErrors: (count: number) => `${count} 条导入项未完成。`
  },
  articles: {
    allSources: "全部来源",
    title: "Latest",
    views: {
      latest: "最新",
      recommended: "推荐"
    },
    loadMore: "加载更多",
    loadingMore: "加载中",
    emptyNoFeedsTitle: "还没有订阅源",
    emptyNoFeedsBody: "添加一个 RSS / Atom 源后，文章会出现在这里。",
    emptyNoArticlesTitle: "暂时没有文章",
    emptyNoArticlesBody: "可以刷新订阅源，或切换到全部来源查看。",
    itemMeta: (date: string, feedTitle: string) => `${date} · ${feedTitle}`,
    state: {
      read: "已读",
      unread: "未读",
      favorited: "已收藏",
      readLater: "稍后读"
    }
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
  explanation: {
    title: "为什么推荐",
    loading: "正在生成推荐解释",
    empty: "当前没有明确的推荐信号。",
    generatedAt: (date: string) => `生成于 ${date}`,
    types: {
      source: "来源",
      freshness: "新鲜度",
      state: "状态",
      fallback: "基础排序",
      negative: "负向",
      penalty: "过滤"
    },
    reasons: {
      sourcePositive: (label: string) => `来源 ${label} 对排序有正向影响。`,
      sourceNegative: (label: string) => `来源 ${label} 当前权重偏低。`,
      freshness: "文章较新，获得新鲜度加分。",
      statePositive: "收藏、稍后读或阅读进度提高了排序。",
      stateNegative: "已读等状态降低了排序优先级。",
      fallback: "当前使用基础排序，暂时没有更强的推荐信号。",
      negative: "近期负向行为降低了排序。",
      penalty: "隐藏或不感兴趣会显著降低排序。"
    }
  },
  actions: {
    favorite: "收藏",
    unfavorite: "取消收藏",
    readLater: "稍后读",
    removeReadLater: "移出稍后读",
    markRead: "标记已读",
    markUnread: "标记未读",
    notInterested: "不感兴趣",
    notInterestedActive: "已不感兴趣",
    saving: "处理中",
    aria: {
      favorite: "收藏这篇文章",
      unfavorite: "取消收藏这篇文章",
      readLater: "稍后读这篇文章",
      removeReadLater: "移出稍后读",
      markRead: "标记这篇文章为已读",
      markUnread: "标记这篇文章为未读",
      notInterested: "不再推荐类似文章",
      notInterestedActive: "已标记不感兴趣"
    },
    errors: {
      favorite: "收藏失败。",
      readLater: "稍后读更新失败。",
      readStatus: "已读状态更新失败。",
      notInterested: "不感兴趣操作失败。",
      open: "记录打开行为失败。",
      generic: "操作失败，请重试。"
    }
  },
  notices: {
    feedAddedAndRefreshed: (feedTitle: string) => `已添加并刷新：${feedTitle}`,
    feedRefreshed: (feedTitle: string) => `已刷新：${feedTitle}`,
    opmlImported: (feedsCreated: number, feedsSkipped: number, foldersCreated: number) =>
      `OPML 导入完成：新增 ${feedsCreated} 个订阅源，跳过 ${feedsSkipped} 个，新增 ${foldersCreated} 个分组。`,
    opmlExported: "OPML 已导出。"
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
    pageTitles: {
      latest: "Latest Articles",
      recommended: "Recommended Articles"
    },
    loadingArticles: "Loading articles",
    latestView: "Latest view",
    viewStatus: {
      latest: "Latest view",
      recommended: "Recommended view"
    }
  },
  auth: {
    loading: "Checking session",
    setupTitle: "Set access password",
    setupBody: "This is a single-user self-hosted instance. Set an access password to enter the reader.",
    loginTitle: "Log in to Dibao",
    loginBody: "Enter the access password to continue.",
    passwordLabel: "Access password",
    passwordPlaceholder: "At least 8 characters",
    setupSubmit: "Finish setup",
    loginSubmit: "Log in",
    submitting: "Working",
    logout: "Log out",
    logoutTitle: "Log out",
    passwordRequired: "Enter the access password.",
    errors: {
      session: "Unable to read session state.",
      logout: "Log out failed."
    }
  },
  setup: {
    kicker: "First-run setup",
    welcome: {
      title: "Welcome to Dibao",
      body: "A self-hosted personal RSS recommendation reader. Complete the required steps before entering the reader.",
      start: "Start setup"
    },
    sources: {
      title: "Add feeds",
      body: "Import an OPML file or manually add an RSS / Atom feed. At least one feed is required to continue.",
      importOpml: "Import OPML file",
      addFeed: "Add feed",
      noFeedsAfterImport: "Import finished, but no feeds were created. Check the OPML file or add an RSS / Atom URL manually.",
      noFeedsAfterAdd: "The feed was not created. Please try again."
    },
    provider: {
      title: "Recommendation capability",
      body: "Dibao will use baseline ranking for now. Embedding providers will be configured in later settings, and this step does not send article text to external services.",
      currentTitle: "Baseline ranking is active",
      currentBody: "You can still read, favorite, save for later, and let baseline ranking use those behavior signals.",
      continue: "Skip for now and continue"
    }
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
  folders: {
    title: "Folders",
    feedCount: (count: number) => `${count} ${count === 1 ? "feed" : "feeds"}`
  },
  opml: {
    import: "Import OPML",
    importing: "Importing",
    export: "Export OPML",
    exporting: "Exporting",
    importSummary: (feedsCreated: number, feedsSkipped: number, foldersCreated: number) =>
      `Imported ${feedsCreated} ${feedsCreated === 1 ? "feed" : "feeds"}, skipped ${feedsSkipped}, added ${foldersCreated} ${foldersCreated === 1 ? "folder" : "folders"}.`,
    importErrors: (count: number) => `${count} ${count === 1 ? "item" : "items"} could not be imported.`
  },
  articles: {
    allSources: "All sources",
    title: "Latest",
    views: {
      latest: "Latest",
      recommended: "Recommended"
    },
    loadMore: "Load more",
    loadingMore: "Loading",
    emptyNoFeedsTitle: "No feeds yet",
    emptyNoFeedsBody: "Add an RSS / Atom feed and articles will appear here.",
    emptyNoArticlesTitle: "No articles yet",
    emptyNoArticlesBody: "Refresh a feed or switch back to all sources.",
    itemMeta: (date: string, feedTitle: string) => `${date} · ${feedTitle}`,
    state: {
      read: "Read",
      unread: "Unread",
      favorited: "Favorited",
      readLater: "Read later"
    }
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
  explanation: {
    title: "Why recommended",
    loading: "Generating recommendation explanation",
    empty: "No clear recommendation signal yet.",
    generatedAt: (date: string) => `Generated ${date}`,
    types: {
      source: "Source",
      freshness: "Freshness",
      state: "State",
      fallback: "Baseline",
      negative: "Negative",
      penalty: "Filter"
    },
    reasons: {
      sourcePositive: (label: string) => `Source ${label} is helping this rank higher.`,
      sourceNegative: (label: string) => `Source ${label} currently has a lower weight.`,
      freshness: "The article is recent and receives a freshness boost.",
      statePositive: "Favorite, read later, or reading progress raised the rank.",
      stateNegative: "Read state and similar signals lowered its priority.",
      fallback: "Baseline ranking is active and no stronger signal is available yet.",
      negative: "Recent negative behavior lowered the rank.",
      penalty: "Hidden or not interested state strongly lowers the rank."
    }
  },
  actions: {
    favorite: "Favorite",
    unfavorite: "Unfavorite",
    readLater: "Read later",
    removeReadLater: "Remove later",
    markRead: "Mark read",
    markUnread: "Mark unread",
    notInterested: "Not interested",
    notInterestedActive: "Not interested",
    saving: "Saving",
    aria: {
      favorite: "Favorite this article",
      unfavorite: "Unfavorite this article",
      readLater: "Save this article for later",
      removeReadLater: "Remove this article from read later",
      markRead: "Mark this article as read",
      markUnread: "Mark this article as unread",
      notInterested: "Stop recommending similar articles",
      notInterestedActive: "Already marked not interested"
    },
    errors: {
      favorite: "Favorite failed.",
      readLater: "Read later update failed.",
      readStatus: "Read status update failed.",
      notInterested: "Not interested action failed.",
      open: "Failed to record article open.",
      generic: "Action failed. Please try again."
    }
  },
  notices: {
    feedAddedAndRefreshed: (feedTitle: string) => `Added and refreshed: ${feedTitle}`,
    feedRefreshed: (feedTitle: string) => `Refreshed: ${feedTitle}`,
    opmlImported: (feedsCreated: number, feedsSkipped: number, foldersCreated: number) =>
      `OPML imported: added ${feedsCreated} ${feedsCreated === 1 ? "feed" : "feeds"}, skipped ${feedsSkipped}, added ${foldersCreated} ${foldersCreated === 1 ? "folder" : "folders"}.`,
    opmlExported: "OPML exported."
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
