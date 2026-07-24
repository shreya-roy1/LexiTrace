import os
from qdrant_client.http import models
from backend.vector_store import (
    client, 
    COLLECTION_NAME, 
    sparse_vectorizer, 
    get_dense_embeddings
)

# CrossEncoder model name
RERANKER_MODEL_NAME = "BAAI/bge-reranker-large"
_reranker_model = None

def get_reranker():
    """
    Lazy load the CrossEncoder model.
    If it fails (e.g. offline/no GPU), returns None, and retrieval will log warning and skip rerank.
    """
    global _reranker_model
    if _reranker_model is None:
        try:
            from sentence_transformers import CrossEncoder
            print(f"Loading reranker model: {RERANKER_MODEL_NAME}...")
            # Use CPU if CUDA is not available
            _reranker_model = CrossEncoder(RERANKER_MODEL_NAME, max_length=512)
            print("Reranker model loaded successfully.")
        except Exception as e:
            print(f"Warning: Could not load CrossEncoder reranker ({e}). Proceeding without reranking.")
            _reranker_model = False # Set to False to indicate failure and avoid retrying
            
    return _reranker_model if _reranker_model is not False else None

def reciprocal_rank_fusion(dense_hits, sparse_hits, k=60):
    """
    Combines dense and sparse search results using Reciprocal Rank Fusion.
    """
    rrf_scores = {}
    doc_map = {}
    
    # Score dense hits
    for rank, hit in enumerate(dense_hits, start=1):
        doc_id = hit.id
        doc_map[doc_id] = hit
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (k + rank))
        
    # Score sparse hits
    for rank, hit in enumerate(sparse_hits, start=1):
        doc_id = hit.id
        doc_map[doc_id] = hit
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (k + rank))
        
    # Sort docs by RRF score descending
    sorted_docs = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    
    return [(doc_map[doc_id], score) for doc_id, score in sorted_docs]

def hybrid_search_and_rerank(query: str, top_k: int = 5):
    """
    Performs hybrid search on Qdrant, merges results via RRF, reranks via Cross-Encoder,
    and returns top_k documents.
    """
    # 1. Embed query
    dense_vector = get_dense_embeddings([query])[0]
    sparse_vector = sparse_vectorizer.get_sparse_vector(query)
    
    # Check if collection exists
    collections = [col.name for col in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        print(f"Collection {COLLECTION_NAME} does not exist. Returning empty results.")
        return []
        
    # 2. Dual Search
    # Dense Search
    dense_hits = client._client.search(
        collection_name=COLLECTION_NAME,
        query_vector=("dense", dense_vector),
        limit=20,
        with_payload=True
    )
    
    # Sparse Search
    sparse_hits = client._client.search(
        collection_name=COLLECTION_NAME,
        query_vector=models.NamedSparseVector(
            name="sparse",
            vector=sparse_vector
        ),
        limit=20,
        with_payload=True
    )
    
    # 3. Reciprocal Rank Fusion (RRF)
    fused_results = reciprocal_rank_fusion(dense_hits, sparse_hits)
    
    # Limit to top 20 candidates for reranking
    candidates = fused_results[:20]
    if not candidates:
        return []
        
    # 4. Rerank via Cross-Encoder
    reranker = get_reranker()
    if reranker is not None:
        try:
            # Prepare query-doc pairs
            pairs = [[query, item[0].payload.get("text", "")] for item in candidates]
            # Compute similarity scores
            scores = reranker.predict(pairs)
            
            # Combine candidates with scores
            reranked_results = []
            for idx, (hit, rrf_score) in enumerate(candidates):
                score = float(scores[idx])
                reranked_results.append({
                    "id": hit.id,
                    "score": score,
                    "payload": hit.payload,
                    "rrf_score": rrf_score
                })
                
            # Sort by reranked score descending
            reranked_results.sort(key=lambda x: x["score"], reverse=True)
            return reranked_results[:top_k]
        except Exception as e:
            print(f"Error during Cross-Encoder reranking: {e}. Falling back to RRF rankings.")
            
    # Fallback to RRF scores if reranker is not available or failed
    fallback_results = []
    for hit, rrf_score in candidates[:top_k]:
        fallback_results.append({
            "id": hit.id,
            "score": rrf_score, # Use RRF score as search score
            "payload": hit.payload,
            "rrf_score": rrf_score
        })
    return fallback_results

if __name__ == "__main__":
    # Test search
    print("Testing search...")
    res = hybrid_search_and_rerank("What are profits?", top_k=2)
    print("Search results:", res)
