# Requirement

## 1. Page Format

Controls how the fetched content is presented:

| Format | Description | Use case |
|--------|-------------|----------|
| `formatted_html` (default) | Current behavior: extract content blocks, preserve basic HTML (paragraphs, headings, lists) | Default reading |
| `plain_text` | Strip all HTML tags and links, return plain text only | AI summarization, offline storage |
| `source_html` | Preserve as much original HTML as possible (only remove script/style), keep images and links | Deep reading, custom styling |

## 2. Fetch Scope

Controls which part of the page is extracted:

| Scope | Description |
|-------|-------------|
| `auto` (default) | Auto-detect the content region (current behavior) |
| `article_only` | Extract only the `<article>` region |
| `main_content` | Extract the `<main>` or `role="main"` region |
| `full_page` | Extract the entire `<body>` visible text (strip header/footer/nav/aside) |

## 3. Layered Settings

- **Global defaults**: Add a `fullContent` section in `AppSettings` with `defaultFormat` and `defaultScope`
- **Per-feed override**: Add `fullContentFormat` and `fullContentScope` fields in `FeedRow` to override the global defaults
- **Priority**: Per-feed setting > global default > code built-in default

## 4. Fetch Quality Feedback

- Show the current format and scope settings in the full content preview (existing `/api/feeds/:id/full-content/preview`)
- Return content statistics: text length, image count, link count
