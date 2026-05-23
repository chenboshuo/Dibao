import { describe, expect, it } from "vitest";
import { FullContentExtractionService } from "./full-content-extraction-service.js";

describe("FullContentExtractionService", () => {
  it("extracts readable safe HTML and removes chrome/scripts", async () => {
    const service = new FullContentExtractionService({
      minTextLength: 20,
      fetcher: async () =>
        new Response(
          `<!doctype html>
          <html>
            <head><title>Fixture Title</title><script>bad()</script><style>p{}</style></head>
            <body>
              <nav>navigation noise</nav>
              <article>
                <h1>Article Heading</h1>
                <p>First useful paragraph for the article body.</p>
                <p>Second useful paragraph with enough text.</p>
              </article>
              <footer>footer noise</footer>
            </body>
          </html>`,
          { headers: { "content-type": "text/html" } }
        )
    });

    const result = await service.extract("https://example.com/article");

    expect(result.status).toBe("success");
    expect(result.title).toBe("Fixture Title");
    expect(result.contentText).toContain("First useful paragraph");
    expect(result.contentHtml).toContain("<p>First useful paragraph");
    expect(result.contentHtml).not.toContain("script");
    expect(result.contentHtml).not.toContain("navigation noise");
  });

  it("fails or skips invalid, non-html, short, and 500 responses", async () => {
    const service = new FullContentExtractionService({
      minTextLength: 200,
      fetcher: async (url) => {
        if (String(url).includes("json")) {
          return new Response("{}", { headers: { "content-type": "application/json" } });
        }
        if (String(url).includes("short")) {
          return new Response("<article><p>short</p></article>", {
            headers: { "content-type": "text/html" }
          });
        }
        return new Response("nope", { status: 500, headers: { "content-type": "text/html" } });
      }
    });

    await expect(service.extract("ftp://example.com/article")).resolves.toMatchObject({
      status: "failed"
    });
    await expect(service.extract("https://example.com/json")).resolves.toMatchObject({
      status: "skipped"
    });
    await expect(service.extract("https://example.com/short")).resolves.toMatchObject({
      status: "skipped"
    });
    await expect(service.extract("https://example.com/500")).resolves.toMatchObject({
      status: "failed"
    });
  });
});
