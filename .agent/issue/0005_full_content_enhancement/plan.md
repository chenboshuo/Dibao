# Plan: Implementation path

## Phase 1: Data Layer

1. DB migration: add `full_content_format VARCHAR(32) NOT NULL DEFAULT 'formatted_html'` and `full_content_scope VARCHAR(32) NOT NULL DEFAULT 'auto'` to the `feeds` table
2. `types.ts`: add `FullContentFormat = "formatted_html" | "plain_text" | "source_html"` and `FullContentScope = "auto" | "article_only" | "main_content" | "full_page"`
3. `FeedRow` gains `fullContentFormat` and `fullContentScope`; `UpsertFeedInput` and `UpdateFeedInput` gain the corresponding fields
4. `AppSettings` adds `fullContent: { defaultFormat: FullContentFormat; defaultScope: FullContentScope }`
5. `SettingsService` adds `FULL_CONTENT_SETTINGS_KEY` read/write and patch logic

## Phase 2: Service Layer

1. `FullContentExtractionService`:
   - `extract()` and `preview()` accept `format` and `scope` params
   - Implement `plain_text` mode: strip all HTML tags, return plain text
   - Implement `source_html` mode: only remove script/style, keep `<img>`, `<a>`, `<figure>`, etc.
   - Implement DOM selection strategies for `full_page`/`article_only`/`main_content` scopes
   - Return extra metadata: `imageCount`, `linkCount`, `wordCount`
2. `FeedFullContentService`: in `previewFeedFullContent()` and `backfillCurrentFeedFullContent()`, read format/scope from feed settings or global defaults and pass to extractor
3. `FeedRefreshService.writeParsedFeed()`: also pass format/scope when extracting full article content

## Phase 3: API Layer

1. `GET/PATCH /api/settings` accept a `fullContent` section
2. `POST /api/feeds/:id/full-content/preview` optionally accepts `format` and `scope` params for preview
3. `GET /api/feeds/:id` and `PATCH /api/feeds/:id` support `fullContentFormat` and `fullContentScope` fields

## Phase 4: Frontend

1. Feed editor adds "full content format" and "full content scope" dropdowns
2. Settings page adds a "full content defaults" section
3. Full content preview shows the current format/scope settings and fetch statistics (text length, image count)
4. i18n updates for zh-CN, en-US, and ja-JP
