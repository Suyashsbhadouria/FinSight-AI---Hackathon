import os
import sys

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend.slm_client import SLMClient
from backend.rag import LightweightVectorStore
from backend.agent import LangGraphAgent

def test_agent():
    print("=== Testing LangGraph Agentic Workflow ===")
    
    # Init modules
    client = SLMClient()
    vector_store = LightweightVectorStore()
    
    # Feed mock document data
    mock_doc = {
        "company_name": "Apex Microdevices Inc.",
        "filename": "apex_10k_mock.pdf",
        "total_pages": 4,
        "sections": {
            "Business Overview": "Apex Microdevices specializes in fabless semiconductor design for mobile and edge computing devices.",
            "Risk Factors": "We have single-source manufacturer dependency on TSMC in Taiwan. This introduces geopolitics risk. We also face cybersecurity threat vectors targeting product layouts.",
            "Financial Statements": "For the year ended December 31, 2025, revenue was $1.45 Billion, an increase of 12% YoY. Gross margins decreased by 80bps to 48.2%."
        },
        "section_mapping": {"Business Overview": 1, "Risk Factors": 2, "Financial Statements": 3}
    }
    
    # Store doc
    vector_store.add_document(mock_doc)
    
    # Init agent
    agent = LangGraphAgent(client, vector_store)
    
    # Query 
    query = "What is Apex's revenue and what are their manufacturing risks?"
    print(f"\nUser Query: {query}")
    
    result = agent.run(query)
    
    print("\n--- Final Agent Response ---")
    print(result["response"])
    
    print("\n--- Citations Extracted ---")
    for cit in result["citations"]:
        print(f"- {cit}")
        
    print("\n--- LangGraph Reasoning Traces ---")
    for idx, log in enumerate(result["logs"]):
        print(f"Step {idx+1} [{log['step']}]:")
        print(f"{log['text']}\n")

if __name__ == "__main__":
    test_agent()
