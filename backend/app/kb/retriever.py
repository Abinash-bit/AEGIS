"""Hybrid retrieval over the knowledge-base chunks: BM25 + dense embeddings, fused with Reciprocal Rank Fusion.

* Dense: OpenAI embeddings (EMBEDDING_MODEL, default text-embedding-3-small) when OPENAI_API_KEY is set,
  otherwise local fastembed. If the chosen provider fails, try the other; if both fail, BM25 only.
  Chunk vectors are cached in backend/.cache/ (keyed by provider + model + content hash).
* Hazard filter: restrict to chunks tagged with the agent's hazard (risk/research chunks carry derived hazards).
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from functools import lru_cache
from typing import Optional

import numpy as np
from rank_bm25 import BM25Okapi

from .. import config
from ..models import Chunk

log = logging.getLogger(__name__)
_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = set("the a an and or of to in on for is are was were be been it this that with as at by from we you they i our".split())


def _tok(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP]


class Retriever:
    def __init__(self, path=config.KB_CHUNKS):
        raw = [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]
        self.records = raw
        self.chunks = [Chunk(**{k: r.get(k) for k in Chunk.model_fields if k in r}) for r in raw]
        self.by_id = {c.id: c for c in self.chunks}
        # index header + text so headings/podcast episode context help matching
        self.docs = [f"{r.get('context_header', '')}\n{r['text']}" for r in raw]
        self.bm25 = BM25Okapi([_tok(d) for d in self.docs])
        self.emb: Optional[np.ndarray] = None
        self.embedder = None
        if config.USE_DENSE:
            self._init_dense()

    # ---------------------------------------------------------------- dense
    def _init_dense(self):
        order = ["openai", "local"] if config.EMBED_PROVIDER == "openai" else ["local", "openai"]
        for provider in order:
            try:
                self._load_provider(provider)
                log.info("dense retrieval ready (%s, %d chunks)", self.embed_label, len(self.docs))
                return
            except Exception as e:  # noqa: BLE001 - try the next provider
                log.warning("embedding provider '%s' unavailable: %s", provider, e)
        log.warning("no embedding provider available, using BM25 only")
        self.embedder, self.emb = None, None

    def _load_provider(self, provider: str):
        if provider == "openai":
            import os
            if not os.getenv("OPENAI_API_KEY"):
                raise RuntimeError("OPENAI_API_KEY not set")
            from openai import OpenAI
            oa = OpenAI()
            model = config.OPENAI_EMBED_MODEL

            def embed(texts: list[str]) -> np.ndarray:
                vecs = []
                for i in range(0, len(texts), 64):
                    resp = oa.embeddings.create(model=model, input=texts[i:i + 64])
                    vecs += [d.embedding for d in sorted(resp.data, key=lambda d: d.index)]
                return np.array(vecs, dtype=np.float32)

            self._embed_docs = self._embed_query = embed
            self.embed_label = f"openai/{model}"
        else:
            from fastembed import TextEmbedding
            fe = TextEmbedding(model_name=config.LOCAL_EMBED_MODEL, cache_dir=str(config.CACHE_DIR / "models"))
            self._embed_docs = lambda texts: np.array(list(fe.embed(texts)), dtype=np.float32)
            self._embed_query = lambda texts: np.array(list(fe.query_embed(texts)), dtype=np.float32)
            self.embed_label = f"local/{config.LOCAL_EMBED_MODEL}"
        sig = hashlib.md5(("\n".join(self.docs) + self.embed_label).encode()).hexdigest()[:12]
        cache = config.CACHE_DIR / f"emb_{sig}.npy"
        if cache.exists():
            emb = np.load(cache)
        else:
            vecs = self._embed_docs(self.docs)
            emb = vecs / np.linalg.norm(vecs, axis=1, keepdims=True)
            np.save(cache, emb)
        self.emb, self.embedder = emb, provider
        self._qcache: dict[str, np.ndarray] = {}

    def _query_vec(self, query: str) -> np.ndarray:
        if query not in self._qcache:
            q = self._embed_query([query])[0]
            self._qcache[query] = q / np.linalg.norm(q)
        return self._qcache[query]

    @property
    def mode(self) -> str:
        return f"hybrid (BM25 + {self.embed_label})" if self.emb is not None else "BM25"

    # --------------------------------------------------------------- search
    def search(self, query: str, k: int = config.TOP_K, hazards: Optional[list[str]] = None,
               exclude: Optional[set[str]] = None) -> list[Chunk]:
        """hazards: KB hazard keys (e.g. 'space_radiation'). A chunk matches if it carries any of them."""
        idx = [i for i, c in enumerate(self.chunks)
               if (not hazards or set(c.hazards) & set(hazards)) and not (exclude and c.id in exclude)]
        if not idx:
            return []
        bm = self.bm25.get_scores(_tok(query))
        rankings = [sorted(idx, key=lambda i: bm[i], reverse=True)]
        if self.emb is not None:
            try:
                dense = self.emb @ self._query_vec(query)
                rankings.append(sorted(idx, key=lambda i: dense[i], reverse=True))
            except Exception as e:  # noqa: BLE001 - embedding API hiccup: answer with BM25 for this query
                log.warning("query embedding failed, BM25 only for this search: %s", e)
        # Reciprocal Rank Fusion
        fused: dict[int, float] = {}
        for ranking in rankings:
            for rank, i in enumerate(ranking):
                fused[i] = fused.get(i, 0.0) + 1.0 / (60 + rank + 1)
        top = sorted(fused, key=fused.get, reverse=True)[:k]
        return [self.chunks[i].model_copy(update={"score": round(fused[i], 5)}) for i in top]

    def hazard_votes(self, query: str, k: int = 12) -> dict[str, int]:
        """Which hazards does an open question touch? Count hazard tags among the top-k chunks."""
        votes: dict[str, int] = {}
        for c in self.search(query, k=k):
            for h in c.hazards:
                votes[h] = votes.get(h, 0) + 1
        return votes


@lru_cache(maxsize=1)
def get_retriever() -> Retriever:
    return Retriever()
