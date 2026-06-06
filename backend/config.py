import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

# NVIDIA NIM Configuration
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1"
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct")

# Hugging Face Configuration (Fallback)
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "")
HF_MODEL = os.getenv("HF_MODEL", "meta-llama/Meta-Llama-3-8B-Instruct")

# Application Settings
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))

# Validate keys and log warning if none are present
if not NVIDIA_API_KEY and not HUGGINGFACE_API_KEY:
    print("[WARNING] Neither NVIDIA_API_KEY nor HUGGINGFACE_API_KEY is configured in the environment.")
