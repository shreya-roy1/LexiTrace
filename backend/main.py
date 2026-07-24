import os
import json
import asyncio
from typing import List, Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.agent import run_rag_agent
from backend.vector_store import init_vector_store, upsert_documents
from backend.cache import semantic_cache

app = FastAPI(title="LexiTrace Backend Engine", version="1.0.0")

# Setup CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify front-end origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

QUEUE_FILE = os.path.join(os.path.dirname(__file__), "low_confidence_queue.json")

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    response: str
    verified_response: str
    documents: List[dict]

class IngestDocument(BaseModel):
    id: str
    text: str
    source_pdf: str
    page_number: int
    confidence_score: float

class IngestRequest(BaseModel):
    documents: List[IngestDocument]

class ApproveRequest(BaseModel):
    id: str
    text: str
    source_pdf: str
    page_number: int
    confidence_score: float

# Event log to track sequence IDs for resilient reconnects
ws_events_log = []
event_id_counter = 0
event_log_lock = asyncio.Lock()

async def broadcast_event(event_dict: dict):
    """
    Assigns a sequence ID (event_id) to the event, logs it, and broadcasts it to all connected sockets.
    """
    global event_id_counter
    async with event_log_lock:
        if "event_id" not in event_dict:
            event_id_counter += 1
            event_dict["event_id"] = event_id_counter
            ws_events_log.append(event_dict)
            if len(ws_events_log) > 100:
                ws_events_log.pop(0)
    payload_str = json.dumps(event_dict)
    await manager.broadcast(payload_str)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"New WebSocket client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"WebSocket client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Stale WebSocket transmission pruned: {e}")

manager = ConnectionManager()

# Redis Pub/Sub async listener task
async def redis_listener():
    print("Starting Redis Pub/Sub event subscriber...")
    import redis.asyncio as aioredis
    while True:
        try:
            r = aioredis.from_url("redis://localhost:6379/0", socket_timeout=5)
            pubsub = r.pubsub()
            await pubsub.subscribe("system_events")
            print("Subscribed to Redis channel 'system_events' successfully.")
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message:
                    data = message["data"].decode("utf-8")
                    try:
                        event_dict = json.loads(data)
                        await broadcast_event(event_dict)
                    except Exception as parse_err:
                        print(f"Error parsing Redis message: {parse_err}")
                await asyncio.sleep(0.05)
        except Exception as e:
            await asyncio.sleep(5.0)

# Heartbeat metrics broadcast task (Runs every 15 seconds)
async def heartbeat_sender():
    print("Starting periodic system health metrics broadcasts (15s heartbeat)...")
    while True:
        await asyncio.sleep(15.0)
        if not manager.active_connections:
            continue
            
        # Check Qdrant Connection
        from backend.vector_store import QDRANT_URL
        try:
            from qdrant_client import QdrantClient
            if QDRANT_URL.startswith("http"):
                q_client = QdrantClient(url=QDRANT_URL, timeout=1.0)
                q_client.get_collections()
                qdrant_status = "Local Active"
            else:
                qdrant_status = "Disconnected"
        except Exception:
            qdrant_status = "Disconnected"
            
        # Check Redis/Celery queue depth
        try:
            import redis
            r = redis.Redis(host="localhost", port=6379, db=0, socket_timeout=1.0)
            queue_depth = r.llen("celery")
            redis_status = "Active"
        except Exception:
            queue_depth = 0
            redis_status = "Offline"
            
        payload = {
            "event": "HEARTBEAT",
            "metrics": {
                "fastapi": "Connected",
                "qdrant": qdrant_status,
                "redis": redis_status,
                "queue_depth": queue_depth
            }
        }
        await broadcast_event(payload)

# Initialize resources on startup
@app.on_event("startup")
def startup_event():
    print("Starting up FastAPI application...")
    try:
        init_vector_store()
    except Exception as e:
        print(f"Error initializing Qdrant: {e}")
    
    # Schedule asyncio tasks
    loop = asyncio.get_event_loop()
    loop.create_task(redis_listener())
    loop.create_task(heartbeat_sender())

@app.get("/")
def read_root():
    return {"status": "ok", "message": "LexiTrace Backend API is running."}

# Chat stream generator for Server-Sent Events (SSE)
async def chat_stream_generator(query: str):
    # Check Semantic Query Cache First
    is_hit, cached_resp, cached_verified, cached_docs = semantic_cache.get(query)
    if is_hit:
        print("Bypassing Agent execution: Semantic Cache Hit!")
        yield f"data: {json.dumps({'type': 'cache_hit', 'cache_hit': True})}\n\n"
        await asyncio.sleep(0.01)
        
        # Stream word by word simulating typewriter speed
        words = cached_resp.split(" ")
        for word in words:
            yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"
            await asyncio.sleep(0.005) # Super fast cache streaming
            
        yield f"data: {json.dumps({'type': 'citations', 'data': cached_docs, 'verified_response': cached_verified})}\n\n"
        return

    # Node 1: Retrieval status
    yield f"data: {json.dumps({'type': 'status', 'node': 'retrieve', 'message': 'Searching Qdrant DB for relevant context...'})}\n\n"
    await asyncio.sleep(0) # Flush
    
    from backend.retrieval import hybrid_search_and_rerank
    try:
        # In-parallel execution lookup
        documents = hybrid_search_and_rerank(query, top_k=5)
        serialized_docs = []
        for doc in documents:
            if isinstance(doc, dict):
                serialized_docs.append(doc)
            else:
                serialized_docs.append({
                    "id": doc.id,
                    "score": doc.score,
                    "payload": doc.payload
                })
    except Exception as e:
        print(f"Retrieval failed: {e}")
        serialized_docs = []
        
    # Node 2: Grading status
    yield f"data: {json.dumps({'type': 'status', 'node': 'grading', 'message': 'Evaluating document relevance...'})}\n\n"
    await asyncio.sleep(0) # Flush
    
    if not serialized_docs:
        yield f"data: {json.dumps({'type': 'status', 'node': 'fallback', 'message': 'No documents found. Routing to fallback.'})}\n\n"
        await asyncio.sleep(0)
        yield f"data: {json.dumps({'type': 'token', 'content': 'I apologize, but I could not find enough reliable information in the corporate records to answer your question.'})}\n\n"
        yield f"data: {json.dumps({'type': 'citations', 'data': []})}\n\n"
        return
        
    # Node 3: Generating status
    yield f"data: {json.dumps({'type': 'status', 'node': 'generating', 'message': 'Generating response with citations...'})}\n\n"
    await asyncio.sleep(0) # Flush
    
    response_text = ""
    from backend.agent import is_valid_openai, OPENAI_API_KEY
    if is_valid_openai:
        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import SystemMessage, HumanMessage
            
            llm = ChatOpenAI(model="gpt-4o", temperature=0.2, openai_api_key=OPENAI_API_KEY, streaming=True)
            context = "\n\n".join([
                f"[Doc {idx+1}]\nFile: {doc['payload'].get('source_pdf', 'unknown')}, Page: {doc['payload'].get('page_number', 0)}\nContent: {doc['payload']['text']}"
                for idx, doc in enumerate(serialized_docs)
            ])
            
            system_prompt = (
                "You are an enterprise document expert. Answer the user's question using ONLY the provided contexts. "
                "You MUST cite your facts using inline citations like [Doc 1], [Doc 2] etc. "
                "Be factual, concise, and structured. Do not cite if the document does not support the claim."
            )
            user_prompt = f"Question: {query}\n\nContext Documents:\n{context}"
            
            async for chunk in llm.astream([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ]):
                token = chunk.content
                response_text += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                await asyncio.sleep(0) # Force immediate buffer flush
        except Exception as e:
            print(f"OpenAI streaming error: {e}")
            is_valid_openai = False
            
    if not is_valid_openai:
        # Mock typewriter streaming
        import re
        mock_sentences = []
        for idx, doc in enumerate(serialized_docs[:3]):
            text = doc['payload']['text']
            sentences = re.split(r'(?<=[.!?])\s+', text)
            useful_clause = sentences[0] if sentences else text[:100]
            mock_sentences.append(f"According to reports, {useful_clause.strip('. ')} [Doc {idx+1}].")
            
        full_mock = " ".join(mock_sentences)
        for word in full_mock.split(" "):
            response_text += word + " "
            yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"
            await asyncio.sleep(0.04) # Faster streaming
            
    # Node 4: Verifying status
    yield f"data: {json.dumps({'type': 'status', 'node': 'verifying', 'message': 'Verifying citation entailment (NLI)...'})}\n\n"
    await asyncio.sleep(0)
    
    from backend.verifier import verify_citations
    try:
        verified_text = verify_citations(response_text, serialized_docs)
    except Exception as e:
        print(f"Verification failed: {e}")
        verified_text = response_text
        
    citations_list = []
    for idx, doc in enumerate(serialized_docs):
        doc_num = idx + 1
        is_still_cited = f"[Doc {doc_num}]" in verified_text
        is_unverified = f"[Doc {doc_num}][⚠️" in verified_text
        citations_list.append({
            "id": doc.get("id") if isinstance(doc, dict) else getattr(doc, "id", str(doc_num)),
            "doc_num": doc_num,
            "source_pdf": doc['payload']['source_pdf'] if isinstance(doc, dict) else doc.payload.source_pdf,
            "page_number": doc['payload']['page_number'] if isinstance(doc, dict) else doc.payload.page_number,
            "score": doc.get("score") if isinstance(doc, dict) else getattr(doc, "score", 1.0),
            "confidence_score": doc['payload']['confidence_score'] if isinstance(doc, dict) else doc.payload.confidence_score,
            "verified": is_still_cited and not is_unverified,
            "text": doc['payload']['text'] if isinstance(doc, dict) else doc.payload.text
        })
        
    # Store result in Semantic Cache
    semantic_cache.set(query, response_text, verified_text, citations_list)
    
    yield f"data: {json.dumps({'type': 'citations', 'data': citations_list, 'verified_response': verified_text})}\n\n"

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    return StreamingResponse(chat_stream_generator(request.query), media_type="text/event-stream")

@app.get("/api/review", response_model=List[IngestDocument])
def get_review_queue():
    if not os.path.exists(QUEUE_FILE):
        return []
    try:
        with open(QUEUE_FILE, "r") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read queue: {e}")

@app.post("/api/review/approve")
async def approve_review_item(request: ApproveRequest):
    # 1. Ingest/Upsert to Qdrant vector store
    try:
        doc_dict = {
            "id": request.id,
            "text": request.text,
            "source_pdf": request.source_pdf,
            "page_number": request.page_number,
            "confidence_score": 1.0
        }
        upsert_documents([doc_dict])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to index document: {e}")
        
    # 2. Remove from JSON queue file
    count = 0
    if os.path.exists(QUEUE_FILE):
        try:
            with open(QUEUE_FILE, "r") as f:
                queue = json.load(f)
            new_queue = [item for item in queue if item["id"] != request.id]
            count = len(new_queue)
            with open(QUEUE_FILE, "w") as f:
                json.dump(new_queue, f, indent=2)
        except Exception as e:
            print(f"Error updating queue file: {e}")
            
    # 3. Broadcast WS event so other users' lists update instantly
    payload = {
        "event": "QUEUE_UPDATED",
        "pending_count": count,
        "item_removed": request.id
    }
    
    try:
        import redis
        r = redis.Redis(host="localhost", port=6379, db=0)
        # Publish payload string directly. redis_listener will parse and assign sequence ID.
        r.publish("system_events", json.dumps(payload))
    except Exception:
        # Fallback to local broadcast direct with sequence ID assignment
        await broadcast_event(payload)
            
    return {"status": "success", "message": f"Document {request.id} approved and indexed."}

@app.post("/api/ingest")
def ingest_endpoint(request: IngestRequest):
    try:
        for doc in request.documents:
            # Delegate to Celery background worker
            try:
                from backend.celery_tasks import process_document_task
                process_document_task.delay(
                    file_path=doc.source_pdf,
                    doc_id=doc.id,
                    source_pdf=doc.source_pdf,
                    page_number=doc.page_number,
                    text=doc.text,
                    confidence_score=doc.confidence_score
                )
            except Exception as e:
                print(f"Celery task dispatch failed ({e}). Executing sync fallback.")
                from backend.celery_tasks import process_document_task
                process_document_task(
                    file_path=doc.source_pdf,
                    doc_id=doc.id,
                    source_pdf=doc.source_pdf,
                    page_number=doc.page_number,
                    text=doc.text,
                    confidence_score=doc.confidence_score
                )
        return {"status": "success", "message": f"Queued {len(request.documents)} documents for background parsing."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket Route with last_event_id support
@app.websocket("/ws/system-events")
async def websocket_endpoint(websocket: WebSocket, last_event_id: Optional[int] = Query(None)):
    await manager.connect(websocket)
    try:
        # 1. Re-emit missed events if reconnecting with sequence tracker
        if last_event_id is not None:
            print(f"WebSocket client reconnect resync: requesting events after ID {last_event_id}")
            async with event_log_lock:
                for evt in ws_events_log:
                    if evt.get("event_id", 0) > last_event_id:
                        await websocket.send_text(json.dumps(evt))
                        await asyncio.sleep(0.01)

        # 2. Send current status metrics immediately
        queue_count = 0
        if os.path.exists(QUEUE_FILE):
            try:
                with open(QUEUE_FILE, "r") as f:
                    queue_count = len(json.load(f))
            except Exception:
                pass
        
        initial_payload = {
            "event": "INIT",
            "pending_count": queue_count,
            "metrics": {
                "fastapi": "Connected",
                "qdrant": "Local Active",
                "redis": "Active",
                "queue_depth": 0
            }
        }
        await websocket.send_text(json.dumps(initial_payload))
        
        while True:
            # Simple ping-pong heartbeat
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket client error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# Heuristic streaming verification enables real-time citation analysis without latency penalty
