# Ollama Recommendation Testing

Real Ollama tests are optional. CI and normal local tests do not require a local Ollama daemon.

## Local bge-m3 Probe

Recommended local setup for this machine:

```bash
ollama pull bge-m3
DIBAO_RUN_OLLAMA_TESTS=true npm run test:ollama:optional
```

Defaults used by the probe:

- Base URL: `http://127.0.0.1:11434`
- Model: `bge-m3`
- Expected dimension: `1024`

The probe calls `/api/embed` first and prints the actual returned dimension. If Ollama or the model returns a dimension other than `1024`, use the actual dimension in Dibao provider settings and record it in the test report.

## Docker Access To Host Ollama

When Dibao runs inside Docker and Ollama runs on the host:

- Docker Desktop: use `http://host.docker.internal:11434`
- Linux: use the host LAN IP, or add a Compose `extra_hosts` entry for `host.docker.internal:host-gateway`
- If Ollama runs as another Compose service, use that service name and port inside the same network

## Common Errors

- `Ollama request failed`: Ollama is not running, the URL is unreachable from the Dibao process, or the model has not been pulled.
- `Ollama returned dimension ... expected ...`: update the provider dimension to the actual probe result.
- `Ollama response must include embeddings array`: the Base URL likely points to the wrong endpoint or an incompatible Ollama version.

Mock Ollama and mock OpenAI-compatible tests remain part of the normal automated suite.
