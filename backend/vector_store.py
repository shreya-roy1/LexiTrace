import os
import re
import hashlib
from collections import Counter
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http import models

# Load environment variables
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Initialize client
print(f"Connecting to Qdrant at {QDRANT_URL}...")
try:
    if QDRANT_URL.startswith("http"):
        # Attempt connection to Qdrant server
        client = QdrantClient(url=QDRANT_URL, timeout=5.0)
        # Test connection
        client.get_collections()
        print("Connected to Qdrant server successfully.")
    else:
        raise ValueError("Invalid QDRANT_URL format")
except Exception as e:
    print(f"Failed to connect to Qdrant server: {e}. Falling back to local in-memory storage...")
    client = QdrantClient(location=":memory:")

COLLECTION_NAME = "enterprise_docs"

class DeterministicSparseVectorizer:
    """
    A stateless, deterministic sparse vectorizer that maps words to hash indices
    and computes simple TF weights to simulate sparse keyword vectorization (BM25).
    """
    def __init__(self, num_buckets=1000000):
        self.num_buckets = num_buckets

    def get_sparse_vector(self, text: str):
        # Clean text and tokenize
        tokens = re.findall(r'\b\w+\b', text.lower())
        if not tokens:
            return models.SparseVector(indices=[], values=[])
        
        counts = Counter(tokens)
        indices = []
        values = []
        
        for token, count in counts.items():
            # Generate a deterministic hash in range [0, num_buckets-1]
            h = int(hashlib.md5(token.encode('utf-8')).hexdigest()[:8], 16) % self.num_buckets
            # Simulating term frequency weight log(1 + count)
            weight = float(np.log1p(count))
            indices.append(h)
            values.append(weight)
            
        # Qdrant requires sorted indices
        sorted_pairs = sorted(zip(indices, values))
        return models.SparseVector(
            indices=[p[0] for p in sorted_pairs],
            values=[p[1] for p in sorted_pairs]
        )

sparse_vectorizer = DeterministicSparseVectorizer()

def get_dense_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generates 1536-dimensional dense embeddings.
    If OPENAI_API_KEY is not set or is a placeholder, falls back to a deterministic 
    mock embedding generator to ensure offline testability.
    """
    is_valid_key = OPENAI_API_KEY and not OPENAI_API_KEY.startswith("your-")
    
    if is_valid_key:
        try:
            from langchain_openai import OpenAIEmbeddings
            embeddings = OpenAIEmbeddings(model="text-embedding-3-large", openai_api_key=OPENAI_API_KEY)
            return embeddings.embed_documents(texts)
        except Exception as e:
            print(f"Error calling OpenAI API: {e}. Falling back to mock embeddings...")
            
    # Deterministic mock embeddings: 1536 dims, normalized
    mock_embeddings = []
    for text in texts:
        # Seed generator with hash of the text for deterministic behavior
        h = int(hashlib.md5(text.encode('utf-8')).hexdigest()[:8], 16)
        rng = np.random.default_rng(h)
        vec = rng.normal(size=1536)
        vec = vec / np.linalg.norm(vec)
        mock_embeddings.append(vec.tolist())
    return mock_embeddings

def init_vector_store():
    """
    Create the collection in Qdrant with both dense and sparse configurations if it does not exist.
    """
    collections = [col.name for col in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        print(f"Creating Qdrant collection: {COLLECTION_NAME}...")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config={
                "dense": models.VectorParams(
                    size=1536,
                    distance=models.Distance.COSINE
                )
            },
            sparse_vectors_config={
                "sparse": models.SparseVectorParams(
                    index=models.SparseIndexParams(
                        on_disk=True
                    )
                )
            }
        )
        print(f"Collection '{COLLECTION_NAME}' created successfully.")
    else:
        print(f"Collection '{COLLECTION_NAME}' already exists.")

def upsert_documents(documents: list[dict]):
    """
    Upsert list of document chunks into Qdrant.
    Each doc in documents should be a dict containing:
    - id: str or int
    - text: str
    - source_pdf: str
    - page_number: int
    - confidence_score: float
    """
    if not documents:
        return
        
    init_vector_store()
    
    texts = [doc["text"] for doc in documents]
    dense_vecs = get_dense_embeddings(texts)
    
    points = []
    import uuid
    for idx, doc in enumerate(documents):
        raw_id = doc.get("id", str(idx))
        
        # Ensure ID is a valid integer or UUID for Qdrant
        try:
            # Try parsing as integer
            doc_id = int(raw_id)
        except ValueError:
            try:
                # Try parsing as UUID
                uuid.UUID(str(raw_id))
                doc_id = str(raw_id)
            except ValueError:
                # Convert arbitrary string to deterministic UUID
                doc_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(raw_id)))
                
        text = doc["text"]
        
        # Format payload
        payload = {
            "text": text,
            "source_pdf": doc.get("source_pdf", "unknown"),
            "page_number": int(doc.get("page_number", 0)),
            "confidence_score": float(doc.get("confidence_score", 1.0))
        }
        
        # Generate sparse vector
        sparse_vec = sparse_vectorizer.get_sparse_vector(text)
        
        # Build PointStruct
        point = models.PointStruct(
            id=doc_id,
            vector={
                "dense": dense_vecs[idx],
                "sparse": sparse_vec
            },
            payload=payload
        )
        points.append(point)
        
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points
    )
    print(f"Upserted {len(points)} documents into Qdrant.")

if __name__ == "__main__":
    # Test initialization and basic upsert
    init_vector_store()
    test_docs = [
        {
            "id": "test-1",
            "text": "The quarterly profits of LexiTrace rose by 15% due to automation.",
            "source_pdf": "q3_report.pdf",
            "page_number": 3,
            "confidence_score": 0.95
        },
        {
            "id": "test-2",
            "text": "LexiTrace reported an increase in client acquisition by 45% in Q4.",
            "source_pdf": "q4_report.pdf",
            "page_number": 1,
            "confidence_score": 0.82
        }
    ]
    upsert_documents(test_docs)
