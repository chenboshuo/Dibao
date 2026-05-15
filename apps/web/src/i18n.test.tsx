import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App, ArticleActionControls, RankExplanationPanel } from "./App.js";
import {
  DibaoI18nProvider,
  createI18n,
  defaultLocale,
  dictionaries,
  supportedLocales
} from "./i18n.js";

describe("web i18n", () => {
  it("keeps dictionary key structure aligned across locales", () => {
    const [baseLocale, ...otherLocales] = supportedLocales;
    const baseShape = dictionaryShape(dictionaries[baseLocale]);

    for (const locale of otherLocales) {
      expect(dictionaryShape(dictionaries[locale])).toEqual(baseShape);
    }
  });

  it("uses zh-CN defaults for copy and date formatting", () => {
    const i18n = createI18n();

    expect(i18n.locale).toBe(defaultLocale);
    expect(i18n.t.errors.api.requestFailed).toBe("请求失败，请稍后重试。");
    expect(i18n.formatDate("2026-05-14T08:00:00.000Z")).not.toBe("2026-05-14T08:00:00.000Z");
  });

  it("renders App with dictionary copy for a non-default locale", () => {
    const html = renderToStaticMarkup(
      <DibaoI18nProvider locale="en-US">
        <App />
      </DibaoI18nProvider>
    );

    expect(html).toContain("Latest Articles");
    expect(html).toContain("Primary navigation");
    expect(html).toContain("Add");
    expect(html).not.toContain("最新文章");
  });

  it("renders article action buttons from dictionary copy", () => {
    const html = renderToStaticMarkup(
      <DibaoI18nProvider>
        <ArticleActionControls
          actionError={null}
          article={{
            id: "article_fixture",
            state: {
              read: false,
              favorited: false,
              readLater: false,
              hidden: false,
              notInterested: false,
              readingProgress: 0
            }
          }}
          onAction={() => undefined}
          pendingAction={null}
        />
      </DibaoI18nProvider>
    );

    expect(html).toContain("收藏");
    expect(html).toContain("稍后读");
    expect(html).toContain("标记已读");
    expect(html).toContain("不感兴趣");
  });

  it("renders rank explanation copy from the dictionary", () => {
    const html = renderToStaticMarkup(
      <DibaoI18nProvider>
        <RankExplanationPanel
          error={null}
          explanation={{
            articleId: "article_fixture",
            generatedAt: "2026-05-14T08:10:00.000Z",
            reasons: [
              {
                type: "freshness",
                label: "Recent article",
                impact: "positive"
              },
              {
                type: "source",
                label: "Fixture Feed",
                impact: "positive"
              }
            ]
          }}
          isLoading={false}
        />
      </DibaoI18nProvider>
    );

    expect(html).toContain("为什么推荐");
    expect(html).toContain("新鲜度");
    expect(html).toContain("文章较新");
    expect(html).toContain("来源 Fixture Feed");
  });
});

function dictionaryShape(value: unknown, path = "$"): string[] {
  if (typeof value === "function") {
    return [`${path}:function:${value.length}`];
  }

  if (typeof value !== "object" || value === null) {
    return [`${path}:${typeof value}`];
  }

  return Object.entries(value).flatMap(([key, child]) => dictionaryShape(child, `${path}.${key}`));
}
