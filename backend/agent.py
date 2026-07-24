import os
import re
from typing import List, TypedDict, Any
from langgraph.graph import StateGraph, END
from backend.retrieval import hybrid_search_and_rerank
from backend.verifier import verify_citations

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
is_valid_openai = OPENAI_API_KEY and not OPENAI_API_KEY.startswith("your-")

# Define Agent State
class AgentState(TypedDict):
    query: str
    original_query: str
    documents: List[dict]
    response: str
    loop_count: int
    is_sufficient: bool
    verified_response: str

# 1. Retrieve Node
def retrieve_node(state: AgentState) -> dict:
    query = state["query"]
    print(f"--- RETRIEVAL NODE: searching for '{query}' ---")
    documents = hybrid_search_and_rerank(query, top_k=5)
    print(f"Retrieved {len(documents)} documents.")
    return {"documents": documents}

# 2. Grade Documents Node
def grade_documents_node(state: AgentState) -> dict:
    query = state["original_query"]
    documents = state["documents"]
    loop_count = state.get("loop_count", 0)
    print(f"--- GRADING NODE: checking relevance for '{query}' ---")
    
    if not documents:
        print("No documents found. Grading: INSUFFICIENT.")
        return {"is_sufficient": False, "loop_count": loop_count}
        
    highest_score = documents[0].get("score", 0)
    if highest_score >= 0.88:
        print(f"First-pass retrieval score is high ({highest_score} >= 0.88). Bypassing rewrite loop.")
        return {"is_sufficient": True, "loop_count": loop_count}
        
    if is_valid_openai:
        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import SystemMessage, HumanMessage
            
            llm = ChatOpenAI(model="gpt-4o", temperature=0, openai_api_key=OPENAI_API_KEY)
            
            # Format documents text for context
            context = "\n\n".join([f"Document {idx+1}:\n{doc['payload']['text']}" for idx, doc in enumerate(documents)])
            
            system_prompt = (
                "You are an expert retrieval evaluator. Grade whether the provided document contexts "
                "are collectively SUFFICIENT to answer the user's question. "
                "Reply with exactly one word: 'YES' if they are sufficient, or 'NO' if they are not."
            )
            user_prompt = f"User Question: {query}\n\nContext:\n{context}"
            
            response = llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ])
            
            grade = response.content.strip().upper()
            print(f"LLM Grading decision: {grade}")
            is_sufficient = "YES" in grade
            return {"is_sufficient": is_sufficient, "loop_count": loop_count}
        except Exception as e:
            print(f"LLM grading failed ({e}). Using heuristic fallback.")
            
    # Heuristic Grader: Sufficient if the highest-ranking search score is decent
    # For cross-encoder, a score > -2.0 is usually a strong indicator of relevance.
    # For RRF fallback, any hit counts.
    highest_score = documents[0].get("score", 0)
    print(f"Heuristic checking: highest document relevance score is {highest_score}")
    is_sufficient = len(documents) > 0 and highest_score > -5.0
    print(f"Heuristic Grading decision: {is_sufficient}")
    
    return {"is_sufficient": is_sufficient, "loop_count": loop_count}

# 3. Rewrite Query Node
def rewrite_query_node(state: AgentState) -> dict:
    query = state["query"]
    loop_count = state.get("loop_count", 0) + 1
    print(f"--- REWRITE QUERY NODE: improving query '{query}' (attempt {loop_count}) ---")
    
    if is_valid_openai:
        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import SystemMessage, HumanMessage
            
            llm = ChatOpenAI(model="gpt-4o", temperature=0.2, openai_api_key=OPENAI_API_KEY)
            
            system_prompt = (
                "You are a search expert. Rewrite the user's query to optimize for a hybrid dense/sparse "
                "vector retrieval database. Return ONLY the rewritten query text and nothing else."
            )
            response = llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"Original Query: {query}")
            ])
            rewritten = response.content.strip()
            print(f"Rewritten query: '{rewritten}'")
            return {"query": rewritten, "loop_count": loop_count}
        except Exception as e:
            print(f"LLM rewriting failed ({e}). Using basic query expansion.")
            
    # Basic Query Expansion Fallback
    words = re.findall(r'\b\w+\b', query)
    expanded = " ".join(words) + " documentation reports details"
    print(f"Heuristic rewritten query: '{expanded}'")
    return {"query": expanded, "loop_count": loop_count}

# 4. Generate Node
def generate_node(state: AgentState) -> dict:
    query = state["original_query"]
    documents = state["documents"]
    print("--- GENERATION NODE: producing response ---")
    
    if is_valid_openai:
        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import SystemMessage, HumanMessage
            
            llm = ChatOpenAI(model="gpt-4o", temperature=0.2, openai_api_key=OPENAI_API_KEY)
            
            context = "\n\n".join([
                f"[Doc {idx+1}]\nFile: {doc['payload'].get('source_pdf', 'unknown')}, Page: {doc['payload'].get('page_number', 0)}\nContent: {doc['payload']['text']}"
                for idx, doc in enumerate(documents)
            ])
            
            system_prompt = (
                "You are an enterprise document expert. Answer the user's question using ONLY the provided contexts. "
                "You MUST cite your facts using inline citations like [Doc 1], [Doc 2] etc. "
                "Be factual, concise, and structured. Do not cite if the document does not support the claim."
            )
            user_prompt = f"Question: {query}\n\nContext Documents:\n{context}"
            
            response = llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ])
            return {"response": response.content.strip()}
        except Exception as e:
            print(f"LLM generation failed ({e}). Using mock response generator.")
            
    # Mock Response Generator using text from context docs
    # Grabs sentences containing numbers or keywords and constructs a mock answer with inline citations.
    mock_sentences = []
    for idx, doc in enumerate(documents[:3]):
        text = doc['payload']['text']
        # Extract a short factual clause or sentence
        sentences = re.split(r'(?<=[.!?])\s+', text)
        useful_clause = sentences[0] if sentences else text[:100]
        mock_sentences.append(f"According to reports, {useful_clause.strip('. ')} [Doc {idx+1}].")
        
    response = " ".join(mock_sentences)
    print(f"Mock Response generated: {response}")
    return {"response": response}

# 5. Verify Citations Node
def verify_citations_node(state: AgentState) -> dict:
    response = state["response"]
    documents = state["documents"]
    print("--- VERIFY CITATIONS NODE: checking NLI entailment ---")
    verified_response = verify_citations(response, documents)
    print("Verified response computed.")
    return {"verified_response": verified_response}

# 6. Fallback Node
def fallback_node(state: AgentState) -> dict:
    print("--- FALLBACK NODE ---")
    msg = "I apologize, but I could not find enough reliable information in the corporate records to answer your question."
    return {"response": msg, "verified_response": msg}

# Build LangGraph Workflow
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("grade_documents", grade_documents_node)
workflow.add_node("rewrite_query", rewrite_query_node)
workflow.add_node("generate", generate_node)
workflow.add_node("verify_citations", verify_citations_node)
workflow.add_node("fallback", fallback_node)

# Set entry point
workflow.set_entry_point("retrieve")

# Add edges
workflow.add_edge("retrieve", "grade_documents")

def route_after_grading(state: AgentState):
    if state.get("is_sufficient"):
        return "generate"
    elif state.get("loop_count", 0) < 3:
        return "rewrite_query"
    else:
        return "fallback"

workflow.add_conditional_edges(
    "grade_documents",
    route_after_grading,
    {
        "generate": "generate",
        "rewrite_query": "rewrite_query",
        "fallback": "fallback"
    }
)

workflow.add_edge("rewrite_query", "retrieve")
workflow.add_edge("generate", "verify_citations")
workflow.add_edge("verify_citations", END)
workflow.add_edge("fallback", END)

# Compile
agent_graph = workflow.compile()

def run_rag_agent(query: str) -> dict:
    """
    Runner helper for the agent.
    """
    initial_state = {
        "query": query,
        "original_query": query,
        "documents": [],
        "response": "",
        "loop_count": 0,
        "is_sufficient": False,
        "verified_response": ""
    }
    
    result = agent_graph.invoke(initial_state)
    return result

if __name__ == "__main__":
    # Test agent workflow
    print("Running test agent call:")
    res = run_rag_agent("What are the quarterly profits of LexiTrace?")
    print("Response:", res["verified_response"])
