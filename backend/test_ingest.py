import requests
import json
import time

BACKEND_URL = "http://localhost:8000"

def run_test_ingestion():
    print("Starting LexiTrace Test Ingestion...")
    
    # Wait for FastAPI server to start
    max_retries = 10
    server_ok = False
    for i in range(max_retries):
        try:
            r = requests.get(f"{BACKEND_URL}/")
            if r.status_code == 200:
                server_ok = True
                print("FastAPI backend is online.")
                break
        except requests.ConnectionError:
            pass
        print(f"Waiting for backend to start (attempt {i+1}/{max_retries})...")
        time.sleep(2)
        
    if not server_ok:
        print("Error: Could not connect to FastAPI backend server. Exiting.")
        return
        
    # Ingestion Data representing a scanned PDF with Table 3
    payload = {
        "documents": [
            {
                "id": "pdf-doc-1",
                "text": (
                    "Table 3: LexiTrace Q3 Performance Figures\n"
                    "------------------------------------------\n"
                    "Division          | Revenue  | Growth | Margin\n"
                    "AI Search Engine  | $12.4M   | +15%   | 14.5%\n"
                    "Document Parser   | $8.1M    | +8%    | 12.0%\n"
                    "NLI Verification  | $4.5M    | +45%   | 18.2%\n"
                    "------------------------------------------\n"
                    "Total             | $25.0M   | +12%   | 14.3%\n"
                    "Note: AI Search Engine saw high growth due to auto-indexing modules."
                ),
                "source_pdf": "q3_financial_report.pdf",
                "page_number": 3,
                "confidence_score": 0.95
            },
            {
                "id": "pdf-doc-2",
                "text": (
                    "Product Development Costs breakdown for Q4 2024.\n"
                    "Salaries: $4.2M allocated to engineering and research staff.\n"
                    "Infrastructure: $1.1M spent on cloud compute and Qdrant cluster host.\n"
                    "Licensing: $0.3M for proprietary models and API usage licenses.\n"
                    "Total Development Expenses: $5.6M."
                ),
                "source_pdf": "cost_breakdown_2024.pdf",
                "page_number": 5,
                "confidence_score": 0.98
            }
        ]
    }
    
    print("Sending document chunks with complex table data to backend /api/ingest...")
    try:
        response = requests.post(f"{BACKEND_URL}/api/ingest", json=payload)
        if response.status_code == 200:
            print("Successfully ingested test document chunks!")
            print("Response:", response.json())
        else:
            print(f"Failed to ingest documents: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error during ingestion request: {e}")

if __name__ == "__main__":
    run_test_ingestion()
