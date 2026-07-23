# Problem: Full content enhancement — configurable page format and fetch scope

Today's `fullContentMode` is a binary per-feed toggle: `"feed_only"` or `"fetch_full_content"`. Once enabled, the actual fetch behavior is entirely controlled by the hardcoded heuristic in `full-content-extraction-service.ts`:

1. **No output format choice**: Everything is stored as HTML, but the extractor aggressively strips tags (script, style, nav, footer) and only picks up limited block elements (h1–h3, p, blockquote, pre, ul, ol). Users cannot choose plain text, preserve the original formatting, or keep images/links.
2. **No scope control**: The extraction chain is hardcoded — `<article>` → `role="main"` → `<main>` → content-classed div → `<body>`. Users cannot specify whether to extract only the article body, include metadata (author, date), or grab the full page's visible text.
3. **No global defaults**: Format and scope policies can only be changed at the code level; there is no UI for users to configure their own preferences.
