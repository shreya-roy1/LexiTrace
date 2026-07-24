import os
import json
import redis
import hashlib
import numpy as np
from typing import Tuple, Optional, List
from backend.vector_store import get_dense_embeddings

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class SemanticCache:
    def __init__(self):
        self.client = None
        self.in_memory_cache = {}
        try:
            self.client = redis.Redis.from_url(REDIS_URL, socket_timeout=1.0)
            self.client.ping()
            print("Connected to Redis semantic cache successfully.")
        except Exception as e:
            print(f"Redis semantic cache offline: {e}. Falling back to in-memory cache.")

    def _get_all_keys(self) -> List[str]:
        if self.client:
            try:
                return [k.decode("utf-8") for k in self.client.keys("semcache:*")]
            except Exception as e:
                print(f"Failed to fetch keys from Redis: {e}")
                return []
        else:
            return list(self.in_memory_cache.keys())

    def get(self, query: str) -> Tuple[bool, Optional[str], Optional[str], Optional[List[dict]]]:
        """
        Check if a query with >=95% similarity is cached.
        Returns: (is_hit, response, verified_response, documents)
        """
        try:
            query_vector = np.array(get_dense_embeddings([query])[0])
        except Exception as e:
            print(f"Error generating embedding for query cache check: {e}")
            return False, None, None, None

        keys = self._get_all_keys()
        best_similarity = 0.0
        best_key = None

        for key in keys:
            try:
                if self.client:
                    val = self.client.get(key)
                    if not val:
                        continue
                    cached_data = json.loads(val.decode("utf-8"))
                else:
                    cached_data = self.in_memory_cache.get(key)
                    if not cached_data:
                        continue
                
                cached_vector = np.array(cached_data["vector"])
                
                # Cosine Similarity Calculation
                dot_product = np.dot(query_vector, cached_vector)
                norm_q = np.linalg.norm(query_vector)
                norm_c = np.linalg.norm(cached_vector)
                
                similarity = dot_product / (norm_q * norm_c) if (norm_q > 0 and norm_c > 0) else 0.0
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_key = key
            except Exception as e:
                print(f"Error evaluating cached key {key}: {e}")

        if best_key and best_similarity >= 0.95:
            print(f"Semantic Cache Hit! Match Similarity: {best_similarity:.4f}")
            try:
                if self.client:
                    val = self.client.get(best_key)
                    data = json.loads(val.decode("utf-8")) if val else None
                else:
                    data = self.in_memory_cache.get(best_key)
                
                if data:
                    return True, data["response"], data["verified_response"], data["documents"]
            except Exception as e:
                print(f"Error parsing cache payload: {e}")

        return False, None, None, None

    def set(self, query: str, response: str, verified_response: str, documents: List[dict]):
        try:
            query_vector = get_dense_embeddings([query])[0]
            cache_payload = {
                "query": query,
                "vector": query_vector,
                "response": response,
                "verified_response": verified_response,
                "documents": documents
            }
            
            key_hash = hashlib.md5(query.lower().strip().encode("utf-8")).hexdigest()
            key = f"semcache:{key_hash}"
            
            if self.client:
                # Cache for 24 hours
                self.client.set(key, json.dumps(cache_payload), ex=86400)
            else:
                self.in_memory_cache[key] = cache_payload
            print(f"Query cached under key: {key}")
        except Exception as e:
            print(f"Failed to write query to semantic cache: {e}")

semantic_cache = SemanticCache()
