import os
import sys

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend.slm_client import SLMClient
from backend.rag import LightweightVectorStore
from backend.map_reduce import run_map_reduce_analysis

def test_map_reduce():
    print("=== Testing Map-Reduce Analysis Module ===")
    
    # Initialize components
    client = SLMClient()
    vector_store = LightweightVectorStore()
    
    # Mock document containing pages and sections
    mock_doc = {
        "company_name": "Apex Microdevices Inc.",
        "filename": "apex_10k_mock.pdf",
        "total_pages": 4,
        "sections": {
            "Business Overview": "[Page 1]\nApex Microdevices specializes in fabless semiconductor design for mobile and edge computing devices.",
            "Risk Factors": "[Page 2]\nWe have single-source manufacturer dependency on TSMC in Taiwan. This introduces geopolitics risk.\n[Page 3]\nWe also face cybersecurity threat vectors targeting product layouts.",
            "Financial Statements": "[Page 4]\nFor the year ended December 31, 2025, revenue was $1.45 Billion, an increase of 12% YoY. Gross margins decreased by 80bps to 48.2%."
        },
        "section_mapping": {"Business Overview": 1, "Risk Factors": 2, "Financial Statements": 4},
        "pages": [
            {"page_num": 1, "text": "Apex Microdevices specializes in fabless semiconductor design for mobile and edge computing devices."},
            {"page_num": 2, "text": "We have single-source manufacturer dependency on TSMC in Taiwan. This introduces geopolitics risk."},
            {"page_num": 3, "text": "We also face cybersecurity threat vectors targeting product layouts."},
            {"page_num": 4, "text": "For the year ended December 31, 2025, revenue was $1.45 Billion, an increase of 12% YoY. Gross margins decreased by 80bps to 48.2%."}
        ]
    }
    
    # Index document in vector store for Smart Search Mode
    vector_store.add_document(mock_doc)
    
    # 1. Test page_range mode
    print("\n--- Test Mode 1: page_range (Pages 2-3) ---")
    res_range = run_map_reduce_analysis(
        doc=mock_doc,
        query="Explain the manufacturing dependencies and cybersecurity risks",
        mode="page_range",
        mode_params={"start_page": 2, "end_page": 3},
        slm_client=client,
        vector_store=vector_store
    )
    print(f"Success: {res_range['success']}")
    print(f"Pages Analyzed: {res_range['pages_analyzed']}")
    print(f"Report Output:\n{res_range['report']}")
    print(f"Intermediate summaries count: {len(res_range['intermediate_summaries'])}")

    # 2. Test smart_search mode
    print("\n--- Test Mode 2: smart_search (Query: revenue and financial growth) ---")
    res_smart = run_map_reduce_analysis(
        doc=mock_doc,
        query="What is the revenue growth and gross margins?",
        mode="smart_search",
        mode_params={"limit": 2},
        slm_client=client,
        vector_store=vector_store
    )
    print(f"Success: {res_smart['success']}")
    print(f"Pages Analyzed: {res_smart['pages_analyzed']}")
    print(f"Report Output:\n{res_smart['report']}")

if __name__ == "__main__":
    test_map_reduce()
