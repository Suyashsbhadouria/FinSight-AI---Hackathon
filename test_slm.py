import os
import sys

# Add current workspace to python path so we can import backend
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend.slm_client import SLMClient

def test_slm():
    print("=== Testing SLM Client ===")
    client = SLMClient()
    
    # Check loaded keys
    print(f"NVIDIA API Key loaded: {'Yes' if client.nvidia_api_key else 'No'}")
    print(f"Hugging Face API Key loaded: {'Yes' if client.hf_api_key else 'No'}")
    print(f"NVIDIA Model: {client.nvidia_model}")
    print(f"HF Model: {client.hf_model}")
    
    print("\n--- Test Query 1: standard conversation ---")
    prompt = "Explain in one sentence what a 10-K regulatory filing is."
    response = client.generate(prompt=prompt, temperature=0.2)
    print(f"Response:\n{response}\n")

    print("\n--- Test Query 2: structured JSON output ---")
    json_prompt = "Return a JSON object containing a list with one item representing a risk for a tech company."
    json_response = client.generate(prompt=json_prompt, temperature=0.1, response_format_json=True)
    print(f"JSON Response:\n{json_response}\n")

if __name__ == "__main__":
    test_slm()
