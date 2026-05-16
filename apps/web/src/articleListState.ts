import type {
  ArticleInteractionStatus,
  ArticleListItem,
  ArticleState
} from "./api.js";

export function articleInteractionStatusForState(
  state: ArticleState
): ArticleInteractionStatus {
  if (state.interactionStatus) {
    return state.interactionStatus;
  }
  if (state.read || state.readingProgress >= 0.9) {
    return "read";
  }
  if (state.readingProgress >= 0.25) {
    return "reading";
  }
  return "unseen";
}

export function articlesVisibleForUnreadFilter(
  articles: ArticleListItem[],
  unreadOnly: boolean
): ArticleListItem[] {
  return unreadOnly
    ? articles.filter((article) => isVisibleForUnreadFilter(article.state, true))
    : articles;
}

export function articleListAfterStateUpdate(
  articles: ArticleListItem[],
  articleId: string,
  state: ArticleState,
  unreadOnly: boolean
): ArticleListItem[] {
  return articles
    .map((article) => (article.id === articleId ? { ...article, state } : article))
    .filter((article) =>
      article.id === articleId
        ? !state.hidden && !state.notInterested && isVisibleForUnreadFilter(state, unreadOnly)
        : true
    );
}

function isVisibleForUnreadFilter(state: ArticleState, unreadOnly: boolean): boolean {
  return !unreadOnly || articleInteractionStatusForState(state) === "unseen";
}
