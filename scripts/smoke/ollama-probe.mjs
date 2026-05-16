const shouldRun = process.env.DIBAO_RUN_OLLAMA_TESTS === "true";

if (!shouldRun) {
  console.log("Skipping real Ollama probe. Set DIBAO_RUN_OLLAMA_TESTS=true to run it.");
  process.exit(0);
}

const baseUrl = process.env.DIBAO_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const model = process.env.DIBAO_OLLAMA_MODEL ?? "bge-m3";
const endpoint = `${baseUrl.replace(/\/+$/u, "")}/api/embed`;

const startedAt = Date.now();
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify({
    model,
    input: ["Dibao Ollama dimension probe"]
  })
});
const text = await response.text();
const payload = text ? JSON.parse(text) : {};

if (!response.ok) {
  throw new Error(`Ollama probe failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
}

if (!Array.isArray(payload.embeddings) || !Array.isArray(payload.embeddings[0])) {
  throw new Error("Ollama probe response did not include embeddings[0]");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      model,
      dimension: payload.embeddings[0].length,
      latencyMs: Date.now() - startedAt
    },
    null,
    2
  )
);
