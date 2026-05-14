import Fastify from "fastify";
import { dibaoVersion } from "@dibao/shared";

export function buildServer() {
  const app = Fastify({
    logger: true
  });

  app.get("/api/system/health", async () => ({
    data: {
      ok: true,
      database: "not_configured",
      fts: "not_configured",
      vectorStore: "not_configured",
      version: dibaoVersion
    }
  }));

  return app;
}

