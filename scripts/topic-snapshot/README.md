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

Optional jieba user dictionary:

```bash
python scripts/topic-snapshot/bertopic_snapshot.py \
  --db /data/dibao.sqlite \
  --embedding-index-id <active-index-id> \
  --max-articles 3000 \
  --scope-days 60 \
  --min-topic-size 15 \
  --jieba-userdict /path/to/userdict.txt \
  --output /tmp/dibao-topic-snapshot.json
```

User dictionary format:

```text
邸报 100 nz
科技向善 100 n
大模型 100 n
本地模型 100 n
语义搜索 100 n
向量数据库 100 n
信息茧房 100 n
RSS 100 nz
sqlite-vec 100 nz
BERTopic 100 nz
```

To let the server enqueue and run this through the job system, set:

```bash
DIBAO_TOPIC_SNAPSHOT_COMMAND="python scripts/topic-snapshot/bertopic_snapshot.py"
```

Topic term extraction:

- The runner uses jieba by default for Chinese-friendly topic terms.
- Chinese text is tokenized with `jieba.cut_for_search(text, HMM=True)`.
- Common mixed technical terms such as `RSS`, `SQLite`, `sqlite-vec`, `BERTopic`, `OpenAI`, `Ollama`, `API`, and `FTRL` are preserved by a regex tokenizer.
- jieba only affects BERTopic c-TF-IDF / topic terms. It does not participate in embedding generation.
- If `--jieba-userdict` is provided and cannot be loaded, the runner writes a clear error to stderr and exits non-zero.

Safety constraints:

- Reads only existing `article_embeddings.vector_blob` rows for the active index.
- Requires `article_embeddings.content_hash` to match the current article hash.
- Uses `numpy.frombuffer(blob, dtype=numpy.float32)`.
- Runs BERTopic with precomputed embeddings and `embedding_model=None`.
- Does not import `SentenceTransformer`.
- Does not download a model.
- Does not call OpenAI, Ollama, Cohere, Voyage, Jina, or any other embedding API.
- Writes JSON output only; TypeScript imports the JSON into SQLite.

Manual tokenizer smoke check inside the optional runner environment:

```bash
python - <<'PY'
import importlib.util

path = "scripts/topic-snapshot/bertopic_snapshot.py"
spec = importlib.util.spec_from_file_location("bertopic_snapshot", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.configure_jieba(None)
print(module.mixed_zh_en_tokenizer("邸报正在用 BERTopic 改善中文 RSS 主题词，sqlite-vec 仍只复用已有向量。"))
PY
```
