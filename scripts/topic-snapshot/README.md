# Corpus Topic Snapshot BERTopic Runner

This is an optional runner for `topic_snapshot_rebuild`. The main Dibao server
does not import Python or BERTopic, and starts normally when this runner is not
installed or not configured.

Install manually in a separate Python environment:

```bash
python3 -m venv .tmp/topic-snapshot-venv
. .tmp/topic-snapshot-venv/bin/activate
pip install -r scripts/topic-snapshot/requirements.txt
```

Run manually:

```bash
python scripts/topic-snapshot/bertopic_snapshot.py \
  --db /data/dibao.sqlite \
  --embedding-index-id <active-index-id> \
  --max-articles 3000 \
  --scope-days 60 \
  --min-topic-size 15 \
  --output /tmp/dibao-topic-snapshot.json
```

To let the server enqueue and run this through the job system, set:

```bash
DIBAO_TOPIC_SNAPSHOT_COMMAND="python scripts/topic-snapshot/bertopic_snapshot.py"
```

Safety constraints:

- Reads only existing `article_embeddings.vector_blob` rows for the active index.
- Requires `article_embeddings.content_hash` to match the current article hash.
- Uses `numpy.frombuffer(blob, dtype=numpy.float32)`.
- Runs BERTopic with precomputed embeddings and `embedding_model=None`.
- Does not import `SentenceTransformer`.
- Does not download a model.
- Does not call OpenAI, Ollama, Cohere, Voyage, Jina, or any other embedding API.
- Writes JSON output only; TypeScript imports the JSON into SQLite.
