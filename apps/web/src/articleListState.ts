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
  state: ArticleState
): ArticleListItem[] {
  // Keep the current queue stable while the user is moving through it. Re-fetching
  // still applies strict filters, but passive state changes should not make a row
  // disappear under the user's pointer.
  return articles
    .map((article) => (article.id === articleId ? { ...article, state } : article))
    .filter((article) =>
      article.id === articleId ? !state.hidden && !state.notInterested : true
    );
}

function isVisibleForUnreadFilter(state: ArticleState, unreadOnly: boolean): boolean {
  return !unreadOnly || articleInteractionStatusForState(state) === "unseen";
}
