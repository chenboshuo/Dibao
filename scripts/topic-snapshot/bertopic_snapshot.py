#!/usr/bin/env python3
import argparse
import json
import sqlite3
import sys
from importlib.metadata import version
from pathlib import Path

try:
    import numpy as np
    from bertopic import BERTopic
    from sklearn.feature_extraction.text import CountVectorizer
except Exception as exc:  # pragma: no cover - documented manual runner path
    print(f"Missing optional topic snapshot dependency: {exc}", file=sys.stderr)
    raise


DAY_MS = 24 * 60 * 60 * 1000
CONTENT_TEXT_LIMIT = 3000


def main() -> int:
    args = parse_args()
    rows = load_rows(
        db_path=args.db,
        embedding_index_id=args.embedding_index_id,
        max_articles=args.max_articles,
        scope_days=args.scope_days,
    )
    if len(rows) < max(args.min_topic_size, 2):
        write_json(
            args.output,
            {
                "algorithm": "bertopic_precomputed_embeddings",
                "algorithmVersion": algorithm_version(),
                "embeddingIndexId": args.embedding_index_id,
                "params": params(args),
                "articleCount": len(rows),
                "topics": [],
                "skipped": {
                    "missingEmbeddingCount": 0,
                    "staleEmbeddingCount": 0,
                },
            },
        )
        return 0

    article_ids = [row["article_id"] for row in rows]
    docs = [document_text(row) for row in rows]
    embeddings = np.vstack([row["vector"] for row in rows]).astype(np.float32)
    vectorizer = CountVectorizer(ngram_range=(1, 2), stop_words="english")
    model = BERTopic(
        embedding_model=None,
        min_topic_size=args.min_topic_size,
        vectorizer_model=vectorizer,
        calculate_probabilities=True,
        verbose=False,
    )
    topics, probabilities = model.fit_transform(docs, embeddings)
    topic_payloads = []

    for topic_key in sorted(set(topics), key=lambda value: (value == -1, value)):
        indexes = [index for index, topic in enumerate(topics) if topic == topic_key]
        if not indexes:
            continue
        topic_id = str(topic_key)
        top_terms = [
            {"term": str(term), "weight": float(weight)}
            for term, weight in (model.get_topic(topic_key) or [])[:12]
            if term
        ]
        assignment_scores = assignment_scores_for(topic_key, topics, probabilities)
        representatives = representative_articles(rows, indexes, assignment_scores)
        topic_payloads.append(
            {
                "topicKey": topic_id,
                "label": label_for_topic(top_terms),
                "topTerms": top_terms,
                "representativeArticles": representatives,
                "assignments": [
                    {
                        "articleId": article_ids[index],
                        "assignmentScore": assignment_scores.get(index),
                        "isRepresentative": article_ids[index]
                        in {article["articleId"] for article in representatives},
                    }
                    for index in indexes
                ],
                "confidence": confidence_for(indexes, assignment_scores),
            }
        )

    write_json(
        args.output,
        {
            "algorithm": "bertopic_precomputed_embeddings",
            "algorithmVersion": algorithm_version(),
            "embeddingIndexId": args.embedding_index_id,
            "params": params(args),
            "articleCount": len(rows),
            "topics": topic_payloads,
            "skipped": {
                "missingEmbeddingCount": 0,
                "staleEmbeddingCount": 0,
            },
        },
    )
    return 0


def parse_args():
    parser = argparse.ArgumentParser(description="Build a Dibao corpus topic snapshot JSON file.")
    parser.add_argument("--db", required=True)
    parser.add_argument("--embedding-index-id", required=True)
    parser.add_argument("--max-articles", type=int, required=True)
    parser.add_argument("--scope-days", type=int, required=True)
    parser.add_argument("--min-topic-size", type=int, required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def load_rows(db_path: str, embedding_index_id: str, max_articles: int, scope_days: int):
    cutoff = current_epoch_ms() - max(scope_days, 1) * DAY_MS
    query = """
      select
        a.id as article_id,
        a.title,
        a.summary,
        substr(coalesce(ac.content_text, ''), 1, ?) as content_text,
        f.title as feed_title,
        ae.vector_blob
      from articles a
      join feeds f on f.id = a.feed_id
      left join article_contents ac on ac.article_id = a.id
      join article_embeddings ae
        on ae.article_id = a.id
       and ae.embedding_index_id = ?
       and ae.content_hash = coalesce(a.content_hash, a.id || ':' || a.updated_at)
      where f.enabled = 1
        and f.deleted_at is null
        and a.deleted_at is null
        and a.status != 'deleted'
        and coalesce(a.published_at, a.discovered_at) >= ?
        and (
          trim(coalesce(a.title, '')) != ''
          or trim(coalesce(a.summary, '')) != ''
          or trim(substr(coalesce(ac.content_text, ''), 1, 256)) != ''
        )
      order by coalesce(a.published_at, a.discovered_at) desc, a.id
      limit ?
    """
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        rows = []
        for row in connection.execute(
            query,
            (CONTENT_TEXT_LIMIT, embedding_index_id, cutoff, max(max_articles, 1)),
        ):
            vector = np.frombuffer(row["vector_blob"], dtype=np.float32)
            if vector.size == 0:
                continue
            rows.append(
                {
                    "article_id": row["article_id"],
                    "title": row["title"] or "",
                    "summary": row["summary"] or "",
                    "content_text": row["content_text"] or "",
                    "feed_title": row["feed_title"] or "",
                    "vector": vector,
                }
            )
        return rows
    finally:
        connection.close()


def document_text(row) -> str:
    return "\n\n".join(
        part
        for part in [row["title"], row["summary"], row["content_text"][:CONTENT_TEXT_LIMIT]]
        if part
    )


def assignment_scores_for(topic_key: int, topics, probabilities):
    scores = {}
    if probabilities is None:
        return scores
    probabilities_array = np.asarray(probabilities)
    if probabilities_array.ndim == 1:
        for index, topic in enumerate(topics):
            if topic == topic_key:
                scores[index] = float(probabilities_array[index])
        return scores
    positive_topics = sorted(topic for topic in set(topics) if topic != -1)
    if topic_key not in positive_topics:
        return scores
    column = positive_topics.index(topic_key)
    if column >= probabilities_array.shape[1]:
        return scores
    for index, topic in enumerate(topics):
        if topic == topic_key:
            scores[index] = float(probabilities_array[index, column])
    return scores


def representative_articles(rows, indexes, assignment_scores):
    ranked = sorted(
        indexes,
        key=lambda index: assignment_scores.get(index, 0.0),
        reverse=True,
    )[:8]
    return [
        {
            "articleId": rows[index]["article_id"],
            "title": rows[index]["title"],
            "feedTitle": rows[index]["feed_title"],
            "score": assignment_scores.get(index),
        }
        for index in ranked
    ]


def confidence_for(indexes, assignment_scores) -> float:
    scores = [assignment_scores[index] for index in indexes if index in assignment_scores]
    if not scores:
        return 0.5
    return float(max(0.0, min(1.0, sum(scores) / len(scores))))


def label_for_topic(top_terms) -> str | None:
    terms = [term["term"] for term in top_terms[:3] if term.get("term")]
    return " / ".join(terms) if terms else None


def algorithm_version() -> str:
    try:
        return f"bertopic:{version('bertopic')}"
    except Exception:
        return "bertopic:unknown"


def params(args):
    return {
        "maxArticles": args.max_articles,
        "scopeDays": args.scope_days,
        "minTopicSize": args.min_topic_size,
    }


def write_json(path: str, payload) -> None:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def current_epoch_ms() -> int:
    return int(__import__("time").time() * 1000)


if __name__ == "__main__":
    raise SystemExit(main())
