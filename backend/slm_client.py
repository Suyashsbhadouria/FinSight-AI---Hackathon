import json
import requests
from typing import Optional, Dict, Any, List
from backend import config
from backend.pipeline_logger import get_pipeline_logger

class SLMClient:
    """
    Centralized Client for interacting with SLM models.
    Prioritizes NVIDIA NIM APIs and falls back to Hugging Face Inference API.
    """

    def __init__(self):
        self.nvidia_api_key = config.NVIDIA_API_KEY
        self.nvidia_model = config.NVIDIA_MODEL
        self.nvidia_url = f"{config.NVIDIA_API_URL}/chat/completions"

        self.hf_api_key = config.HUGGINGFACE_API_KEY
        self.hf_model = config.HF_MODEL
        self.hf_url = f"https://api-inference.huggingface.co/models/{self.hf_model}"

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 2048,
        response_format_json: bool = False,
        pipeline: str = "unknown",
        stage: str = "generation",
        run_id: Optional[str] = None,
    ) -> str:
        """
        Generates completion for a prompt, automatically handling Nvidia NIM-to-Hugging Face fallback.
        """
        logger = get_pipeline_logger()
        logger.log_generation(
            pipeline=pipeline,
            stage=stage,
            system_prompt=system_prompt,
            prompt=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format_json=response_format_json,
            run_id=run_id,
        )

        # 1. Attempt Nvidia NIM (if API key is available)
        if self.nvidia_api_key:
            try:
                print(f"[SLMClient] Attempting generation via NVIDIA NIM ({self.nvidia_model})...")
                headers = {
                    "Authorization": f"Bearer {self.nvidia_api_key}",
                    "Content-Type": "application/json"
                }

                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})

                payload: Dict[str, Any] = {
                    "model": self.nvidia_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
                
                if response_format_json:
                    # Some NIM endpoints support response_format
                    payload["response_format"] = {"type": "json_object"}

                response = requests.post(self.nvidia_url, json=payload, headers=headers, timeout=30)
                if response.status_code == 200:
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    print("[SLMClient] Generation succeeded via NVIDIA NIM.")
                    logger.log_llm_response(
                        pipeline=pipeline,
                        stage=stage,
                        response=content,
                        provider="nvidia_nim",
                        run_id=run_id,
                    )
                    return content
                else:
                    print(f"[SLMClient] NVIDIA NIM request failed with code {response.status_code}: {response.text}")
            except Exception as e:
                print(f"[SLMClient] Error during NVIDIA NIM invocation: {e}")
        else:
            print("[SLMClient] NVIDIA_API_KEY not configured. Skipping NVIDIA NIM.")

        # 2. Fallback to Hugging Face Inference API
        if self.hf_api_key:
            try:
                print(f"[SLMClient] Falling back to Hugging Face Inference API ({self.hf_model})...")
                headers = {
                    "Authorization": f"Bearer {self.hf_api_key}",
                    "Content-Type": "application/json"
                }

                # Construct prompt format typical for Llama-3-Instruct
                # <|begin_of_text|><|start_header_id|>system<|end_header_id|>
                # {system_prompt}<|eot_id|><|start_header_id|>user<|end_header_id|>
                # {prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>
                formatted_prompt = ""
                if system_prompt:
                    formatted_prompt += f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>"
                else:
                    formatted_prompt += "<|begin_of_text|>"
                
                formatted_prompt += f"<|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"

                payload = {
                    "inputs": formatted_prompt,
                    "parameters": {
                        "temperature": max(0.01, temperature),  # Hugging Face usually expects temperature > 0
                        "max_new_tokens": max_tokens,
                        "return_full_text": False
                    }
                }

                response = requests.post(self.hf_url, json=payload, headers=headers, timeout=30)
                if response.status_code == 200:
                    data = response.json()
                    # HF API response can be a list with text or object
                    if isinstance(data, list) and len(data) > 0:
                        content = data[0].get("generated_text", "")
                    elif isinstance(data, dict):
                        content = data.get("generated_text", "")
                    else:
                        content = str(data)
                    print("[SLMClient] Generation succeeded via Hugging Face.")
                    logger.log_llm_response(
                        pipeline=pipeline,
                        stage=stage,
                        response=content,
                        provider="huggingface",
                        run_id=run_id,
                    )
                    return content
                else:
                    print(f"[SLMClient] Hugging Face failed with code {response.status_code}: {response.text}")
            except Exception as e:
                print(f"[SLMClient] Error during Hugging Face fallback: {e}")
        else:
            print("[SLMClient] HUGGINGFACE_API_KEY not configured. Skipping Hugging Face fallback.")

        # 3. Last fallback: Mock response for testing when API keys are absent
        print("[SLMClient] CRITICAL: Both primary and fallback providers failed or are unconfigured. Returning mock placeholder data.")
        mock = self._get_mock_response(prompt, response_format_json)
        logger.log_llm_response(
            pipeline=pipeline,
            stage=stage,
            response=mock,
            provider="mock_fallback",
            run_id=run_id,
        )
        return mock

    def _get_mock_response(self, prompt: str, json_format: bool) -> str:
        """Helper to return high-quality mock data when keys are not configured, aiding offline development."""
        prompt_lower = prompt.lower()
        if json_format:
            if "risk" in prompt_lower:
                return json.dumps({
                    "risks": [
                        {
                            "title": "Supply Chain Vulnerability",
                            "description": "Heavy reliance on single-source suppliers for critical semiconductors increases operational risk.",
                            "severity": 8,
                            "evidence": "We rely on three key suppliers located in Asia for 90% of our microchips.",
                            "location": "Page 14, Section 1A: Risk Factors"
                        },
                        {
                            "title": "Cybersecurity Threats",
                            "description": "Increasing sophistication of cyber attacks could compromise proprietary product specifications and customer data.",
                            "severity": 7,
                            "evidence": "During fiscal 2025, we observed an increased frequency of scanning and phishing attempts.",
                            "location": "Page 22, Section 1A: Cybersecurity"
                        }
                    ]
                }, indent=2)
            elif "competitor" in prompt_lower or "revenue" in prompt_lower:
                return json.dumps({
                    "competitors": [
                        {
                            "name": "Apex Global Inc.",
                            "revenue": "$14.5 Billion",
                            "growth": "+8.5%",
                            "margin": "22%",
                            "risks": "Regulatory headwind, high exposure to European energy costs",
                            "initiatives": "Expanding AI-driven operations and green energy migration"
                        },
                        {
                            "name": "Vanguard Tech Corp",
                            "revenue": "$18.2 Billion",
                            "growth": "+12.1%",
                            "margin": "19%",
                            "risks": "Intense competition in APAC, high capital expenditures",
                            "initiatives": "Acquisition of next-gen cloud security firms"
                        }
                    ]
                }, indent=2)
            else:
                return json.dumps({"response": "Mock JSON answer. Prompt was received and parsed in offline mock fallback mode."}, indent=2)
        else:
            if "risk" in prompt_lower:
                return "The company's primary risks involve Supply Chain Vulnerabilities (specifically around semiconductors) and Cybersecurity threats due to increasing phishing attempts as mentioned on pages 14 and 22."
            elif "competitor" in prompt_lower:
                return "Top competitors include Apex Global Inc. (Revenue: $14.5B, Growth: 8.5%) and Vanguard Tech Corp (Revenue: $18.2B, Growth: 12.1%). Both are expanding aggressively into AI and cloud infrastructure."
            return "This is a placeholder response because no NVIDIA_API_KEY or HUGGINGFACE_API_KEY environment variables are set. Please create a .env file and set these variables."
