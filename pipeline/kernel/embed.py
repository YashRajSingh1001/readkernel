"""Turn article text into vectors for similarity.

"local" uses a small open embedding model through fastembed (runs on CPU,
free, about 130 MB downloaded once). "simple" is a hashed word-count vector
with no download; it is less accurate and is the fallback.
"""

from __future__ import annotations

import hashlib
import math
import os
import re
import warnings
from collections import Counter
from pathlib import Path

import numpy as np

LOCAL_MODEL = "BAAI/bge-small-en-v1.5"
HASH_DIM = 4096

STOPWORDS = set(
    "a an and are as at be by for from has have in is it its new of on or that the this to "
    "was will with after over says said how why what who now just more than into about".split()
)

_model = None


def article_text(title: str, description: str) -> str:
    return f"{title}. {description[:300]}"


def embed(texts: list[str], backend: str = "local", cache_dir: Path | None = None) -> tuple[np.ndarray, str]:
    """Return (unit-length vectors, backend actually used)."""
    if not texts:
        return np.zeros((0, 1)), backend
    if backend == "local":
        try:
            return _embed_local(texts, cache_dir), "local"
        except Exception as exc:  # missing package or model download failed
            print(f"[kernel] local embeddings unavailable ({exc}); using simple matching.")
    return _embed_simple(texts), "simple"


def _embed_local(texts: list[str], cache_dir: Path | None) -> np.ndarray:
    global _model
    if _model is None:
        # Quiet the model hub's Windows symlink and progress-bar warnings.
        os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
        warnings.filterwarnings("ignore", module="huggingface_hub")
        from fastembed import TextEmbedding

        _model = TextEmbedding(LOCAL_MODEL, cache_dir=str(cache_dir) if cache_dir else None)
    vectors = np.array(list(_model.embed(texts)), dtype=np.float32)
    return _normalise(vectors)


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9][a-z0-9\-\.]*[a-z0-9]|[a-z0-9]", text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 1]


def _embed_simple(texts: list[str]) -> np.ndarray:
    docs = [Counter(_tokens(t)) for t in texts]
    df = Counter(word for doc in docs for word in doc)
    n = len(docs)
    vectors = np.zeros((n, HASH_DIM), dtype=np.float32)
    for i, doc in enumerate(docs):
        for word, count in doc.items():
            slot = int(hashlib.md5(word.encode()).hexdigest()[:8], 16) % HASH_DIM
            idf = math.log((1 + n) / (1 + df[word])) + 1.0
            vectors[i, slot] += (1 + math.log(count)) * idf
    return _normalise(vectors)


def _normalise(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vectors / norms
