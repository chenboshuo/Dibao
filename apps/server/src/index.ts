import { buildServer } from "./app.js";

const host = process.env.DIBAO_HOST ?? "0.0.0.0";
const port = Number(process.env.DIBAO_PORT ?? 8080);

const server = buildServer();

try {
  await server.listen({ host, port });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}

