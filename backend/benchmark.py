import os
import sys

# Add root folder to sys.path to enable backend imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.vector_store import upsert_documents
from backend.retrieval import hybrid_search_and_rerank

# 20 Golden Q&A Ground Truth Pairs for Corporate Documentation
GOLDEN_DATASET = [
    {
        "query": "What are profits for Q3?",
        "expected_pdf": "q3_report.pdf",
        "expected_page": 3,
        "text": "The quarterly profits of LexiTrace rose by 15% due to automation in Q3."
    },
    {
        "query": "What are client acquisitions for Q4?",
        "expected_pdf": "q4_report.pdf",
        "expected_page": 1,
        "text": "LexiTrace reported an increase in client acquisition by 45% in Q4."
    },
    {
        "query": "What are product development costs?",
        "expected_pdf": "cost_breakdown_2024.pdf",
        "expected_page": 5,
        "text": "Product Development Costs salaries are allocated at $4.2M and infrastructure is $1.1M."
    },
    {
        "query": "What is operating margin in Q3?",
        "expected_pdf": "q3_financial_report.pdf",
        "expected_page": 3,
        "text": "Operating Margin was reported at 14.5% based on initial estimates of total revenues."
    },
    {
        "query": "What is our custom software refund policy?",
        "expected_pdf": "refund_policy.pdf",
        "expected_page": 2,
        "text": "Custom software refunds are strictly prohibited after license generation unless approved."
    },
    {
        "query": "How many customer support agents are on staff?",
        "expected_pdf": "support_ops.pdf",
        "expected_page": 4,
        "text": "Customer support operations employ 35 full-time agents across three timezone shifts."
    },
    {
        "query": "What is our system security standard?",
        "expected_pdf": "security_audit.pdf",
        "expected_page": 12,
        "text": "LexiTrace RAG environments enforce TLS 1.3 encryption and AES-256 at rest."
    },
    {
        "query": "Who is the chief operations officer?",
        "expected_pdf": "leadership.pdf",
        "expected_page": 2,
        "text": "The Chief Operations Officer of LexiTrace is Sarah Jenkins, appointed in 2023."
    },
    {
        "query": "What is the marketing budget for 2024?",
        "expected_pdf": "marketing_plan.pdf",
        "expected_page": 8,
        "text": "The total global marketing budget for 2024 is set at $1.5M."
    },
    {
        "query": "How are sparse vectors indexed in Qdrant?",
        "expected_pdf": "architecture.pdf",
        "expected_page": 7,
        "text": "Sparse vectors are index-optimized using Qdrant sparse index params on disk."
    },
    {
        "query": "What are server hosting costs?",
        "expected_pdf": "hosting_expenses.pdf",
        "expected_page": 1,
        "text": "Server hosting costs are $8.5K monthly, including Redis, database backups, and nodes."
    },
    {
        "query": "What is our SLA for critical errors?",
        "expected_pdf": "sla_policy.pdf",
        "expected_page": 2,
        "text": "SLA policy requires a response within 30 minutes for Critical Tier 1 failures."
    },
    {
        "query": "When was the verification layer added?",
        "expected_pdf": "telemetry.pdf",
        "expected_page": 4,
        "text": "The citation verification layer utilizing NLI model was merged in July 2026."
    },
    {
        "query": "What is the training set for DeBERTa?",
        "expected_pdf": "deberta_notes.pdf",
        "expected_page": 1,
        "text": "The deberta-v3 model is trained on the MNLI dataset with 400K text pairs."
    },
    {
        "query": "What are target countries for expansion?",
        "expected_pdf": "global_expansion.pdf",
        "expected_page": 5,
        "text": "Expansion targets for 2025 include the United Kingdom, Canada, and Germany."
    },
    {
        "query": "What is our hybrid search RRF constant?",
        "expected_pdf": "config_spec.pdf",
        "expected_page": 2,
        "text": "Reciprocal Rank Fusion merges sparse and dense vectors with k constant set to 60."
    },
    {
        "query": "What is the database recovery point objective?",
        "expected_pdf": "disaster_recovery.pdf",
        "expected_page": 9,
        "text": "The database disaster recovery plan defines an RPO of 15 minutes."
    },
    {
        "query": "Are third-party LLMs used for verification?",
        "expected_pdf": "privacy.pdf",
        "expected_page": 3,
        "text": "Third-party LLMs are only sent redacted payloads to ensure compliance with privacy laws."
    },
    {
        "query": "What are office operational hours?",
        "expected_pdf": "facilities.pdf",
        "expected_page": 1,
        "text": "Office facilities are open Monday to Friday from 8:00 AM to 7:00 PM."
    },
    {
        "query": "What is our policy on personal devices?",
        "expected_pdf": "byod_policy.pdf",
        "expected_page": 3,
        "text": "The BYOD policy requires all personal devices to install MDM software."
    }
]

def run_benchmark():
    print("=== LEXITRACE GOLDEN DATASET BENCHMARK ===")
    
    # 1. Populate/ingest benchmark documents
    print("Ingesting golden dataset documents...")
    ingest_docs = []
    for idx, item in enumerate(GOLDEN_DATASET):
        ingest_docs.append({
            "id": f"bench-{idx}",
            "text": item["text"],
            "source_pdf": item["expected_pdf"],
            "page_number": item["expected_page"],
            "confidence_score": 1.0,
            "allowed_roles": ["finance_admin", "user"]
        })
    upsert_documents(ingest_docs)
    
    # 2. Run queries and measure recall
    print("Running retrieval benchmarks...")
    success_count = 0
    total = len(GOLDEN_DATASET)
    
    for idx, item in enumerate(GOLDEN_DATASET):
        query = item["query"]
        expected_pdf = item["expected_pdf"]
        
        # Retrieve top 5
        hits = hybrid_search_and_rerank(query, top_k=5, user_role="finance_admin")
        
        # Check if the expected source document is in hits
        found = False
        for hit in hits:
            payload = hit.get("payload", {})
            if payload.get("source_pdf") == expected_pdf:
                found = True
                break
                
        if found:
            success_count += 1
            print(f"[{idx+1}/{total}] PASS: '{query}' -> Found expected document '{expected_pdf}'")
        else:
            print(f"[{idx+1}/{total}] FAIL: '{query}' -> Expected '{expected_pdf}', retrieved: {[h.get('payload', {}).get('source_pdf') for h in hits]}")
            
    recall = (success_count / total) * 100
    print("\n==========================================")
    print(f"BENCHMARK COMPLETED: Recall@5 = {recall:.1f}% ({success_count}/{total} hits)")
    print("==========================================\n")
    
if __name__ == "__main__":
    run_benchmark()
