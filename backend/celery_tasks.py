import os
import json
import redis
from celery import Celery
from backend.vector_store import upsert_documents

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "lexitrace_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_always_eager=False,
    task_ignore_result=True
)

@celery_app.task(name="backend.celery_tasks.process_document_task")
def process_document_task(file_path: str, doc_id: str, source_pdf: str, page_number: int, text: str, confidence_score: float):
    print(f"Asynchronous task processing document chunk: {doc_id}")
    
    # Ingestion Routing Rules:
    if confidence_score >= 0.85:
        doc_dict = {
            "id": doc_id,
            "text": text,
            "source_pdf": source_pdf,
            "page_number": page_number,
            "confidence_score": confidence_score
        }
        try:
            upsert_documents([doc_dict])
            print(f"High-confidence document {doc_id} directly indexed to Qdrant.")
        except Exception as e:
            print(f"Error upserting high-confidence doc in task: {e}")
    else:
        # Route to HITL Queue (JSON Database fallback)
        queue_file = os.path.join(os.path.dirname(__file__), "low_confidence_queue.json")
        try:
            queue = []
            if os.path.exists(queue_file):
                with open(queue_file, "r") as f:
                    queue = json.load(f)
            
            # Avoid duplicate ids
            if not any(item["id"] == doc_id for item in queue):
                queue.append({
                    "id": doc_id,
                    "text": text,
                    "source_pdf": source_pdf,
                    "page_number": page_number,
                    "confidence_score": confidence_score
                })
                with open(queue_file, "w") as f:
                    json.dump(queue, f, indent=2)
            print(f"Low-confidence document {doc_id} routed to HITL Review Queue.")
        except Exception as e:
            print(f"Error storing low-confidence doc in task: {e}")

    # Broadcast WebSocket update event over Redis PubSub
    try:
        r = redis.Redis.from_url(REDIS_URL)
        # Read queue status count
        queue_file = os.path.join(os.path.dirname(__file__), "low_confidence_queue.json")
        count = 0
        if os.path.exists(queue_file):
            with open(queue_file, "r") as f:
                count = len(json.load(f))
                
        payload = {
            "event": "QUEUE_UPDATED",
            "pending_count": count,
            "item": {
                "id": doc_id,
                "file_name": source_pdf,
                "confidence": confidence_score
            }
        }
        r.publish("system_events", json.dumps(payload))
        print("Broadcast update event published to Redis pub/sub.")
    except Exception as e:
        print(f"Failed to publish Redis event in task (Redis might be offline): {e}")
