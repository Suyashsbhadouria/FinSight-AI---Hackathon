import re
import math
import numpy as np
import requests
from typing import List, Dict, Any, Tuple
from backend import config

class LightweightVectorStore:
    """
    An in-memory Vector Database that handles document chunking, embedding generation,
    and cosine similarity queries.
    """

    def __init__(self):
        self.chunks: List[Dict[str, Any]] = []
        self.embeddings: List[np.ndarray] = []
        
        # Load local embedding model
        try:
            from sentence_transformers import SentenceTransformer
            print("[RAG] Loading local SentenceTransformer model 'all-MiniLM-L6-v2'...")
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            print("[RAG] Successfully loaded local SentenceTransformer.")
        except Exception as e:
            print(f"[RAG] Failed to load local SentenceTransformer: {e}. Remote APIs or TF-IDF will be used.")
            self.model = None

        # Centralized Client settings
        self.nvidia_key = config.NVIDIA_API_KEY
        self.nvidia_url = "https://integrate.api.nvidia.com/v1/embeddings"
        self.nvidia_model = "nvidia/embeddings-nv-embed-qa-4"

        self.hf_key = config.HUGGINGFACE_API_KEY
        self.hf_url = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"

    def chunk_text(self, text: str, section_name: str, chunk_size: int = 1000, overlap: int = 200) -> List[Dict[str, Any]]:
        """
        Splits text into chunks of specified size and overlap.
        Preserves page number metadata if present in the text (e.g. [Page X] or --- PAGE X ---).
        """
        chunks = []
        current_page = 1
        
        # Split text into pages if structured with page tags
        pages = re.split(r'\[Page\s+(\d+)\]', text)
        
        # If the regex split yields pages, reconstruct with page numbers
        if len(pages) > 1:
            i = 0
            while i < len(pages):
                val = pages[i]
                if val is None or val == '':
                    i += 1
                    continue
                # If it's a page number, update current_page
                if val.isdigit():
                    current_page = int(val)
                    i += 1
                    # Next element contains page content
                    if i < len(pages):
                        page_content = pages[i] or ""
                        # Chunk the page content
                        chunks.extend(self._split_string(page_content, chunk_size, overlap, section_name, current_page))
                else:
                    # It's leading text before any page markers
                    chunks.extend(self._split_string(val, chunk_size, overlap, section_name, current_page))
                i += 1
        else:
            # Chunk the whole text directly
            chunks.extend(self._split_string(text, chunk_size, overlap, section_name, current_page))
            
        return chunks

    def _split_string(self, text: str, chunk_size: int, overlap: int, section: str, page: int) -> List[Dict[str, Any]]:
        words = text.split()
        chunks = []
        if not words:
            return []
            
        i = 0
        while i < len(words):
            chunk_words = words[i:i + chunk_size]
            chunk_text = " ".join(chunk_words)
            if chunk_text.strip():
                chunks.append({
                    "text": chunk_text,
                    "section": section,
                    "page": page
                })
            # Advance index by chunk_size - overlap (word count equivalent, approx 150 words)
            step = max(1, chunk_size - overlap)
            i += step
            
            # Prevent infinite loop
            if i >= len(words) and len(chunk_words) < chunk_size:
                break
        return chunks

    def _get_embedding(self, text: str) -> np.ndarray:
        """
        Obtains dense embedding vector for a single query.
        """
        embs = self._get_embeddings_batch([text])
        return embs[0] if embs else np.zeros(21)

    def _get_embeddings_batch(self, texts: List[str]) -> List[np.ndarray]:
        """
        Obtains dense embedding vectors for a list of texts in batches.
        Prioritizes the local SentenceTransformer model, with fallbacks to remote/TF-IDF APIs if needed.
        """
        results: List[np.ndarray] = []
        batch_size = 20
        
        for idx in range(0, len(texts), batch_size):
            batch_texts = texts[idx : idx + batch_size]
            batch_embeddings = None

            # 1. Prioritize Local SentenceTransformer
            if self.model is not None:
                try:
                    embeddings = self.model.encode(batch_texts, convert_to_numpy=True)
                    batch_embeddings = [np.array(emb, dtype=float) for emb in embeddings]
                except Exception as e:
                    print(f"[RAG] Local SentenceTransformer encoding failed: {e}. Falling back...")

            # 2. Remote Fallback: Nvidia NIM
            if not batch_embeddings and self.nvidia_key:
                try:
                    headers = {
                        "Authorization": f"Bearer {self.nvidia_key}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "input": batch_texts,
                        "model": self.nvidia_model,
                        "input_type": "passage"
                    }
                    response = requests.post(self.nvidia_url, json=payload, headers=headers, timeout=15)
                    if response.status_code == 200:
                        data_items = response.json().get("data", [])
                        sorted_items = sorted(data_items, key=lambda x: x.get("index", 0))
                        batch_embeddings = [np.array(item["embedding"], dtype=float) for item in sorted_items]
                except Exception as e:
                    print(f"[RAG] Nvidia Batch Embedding fallback failed: {e}")

            # 3. Remote Fallback: Hugging Face
            if not batch_embeddings and self.hf_key:
                try:
                    headers = {
                        "Authorization": f"Bearer {self.hf_key}",
                        "Content-Type": "application/json"
                    }
                    response = requests.post(self.hf_url, json={"inputs": batch_texts}, headers=headers, timeout=15)
                    if response.status_code == 200:
                        vector_data = response.json()
                        if isinstance(vector_data, list):
                            batch_embeddings = []
                            for item in vector_data:
                                if isinstance(item, list):
                                    if len(item) > 0 and isinstance(item[0], list):
                                        # Mean pool over tokens
                                        arr = np.mean(np.array(item, dtype=float), axis=0)
                                        batch_embeddings.append(arr)
                                    else:
                                        batch_embeddings.append(np.array(item, dtype=float))
                                else:
                                    batch_embeddings.append(np.array(item, dtype=float))
                except Exception as e:
                    print(f"[RAG] Hugging Face Batch Embedding fallback failed: {e}")

            # 4. Fallback: TF-IDF local vectors
            if not batch_embeddings:
                batch_embeddings = []
                vocab = ["revenue", "risk", "profit", "liability", "asset", "debt", "margin", "growth",
                         "cybersecurity", "competitor", "supply", "chain", "compliance", "legal", "audit", 
                         "operations", "financial", "management", "liquidity", "customer", "product"]
                
                for text in batch_texts:
                    words = re.findall(r'\b\w{3,15}\b', text.lower())
                    freq = [words.count(w) for w in vocab]
                    vector = np.array(freq, dtype=float)
                    norm = np.linalg.norm(vector)
                    if norm > 0:
                        vector = vector / norm
                    else:
                        vector = np.ones(len(vocab)) / math.sqrt(len(vocab))
                    batch_embeddings.append(vector)
            
            results.extend(batch_embeddings)
            
        return results

    def add_document(self, parsed_doc: Dict[str, Any]):
        """
        Chunks and indexes all sections of the parsed document in fast batches.
        """
        print(f"[RAG] Chunking and indexing document for {parsed_doc['company_name']}...")
        self.chunks = []
        self.embeddings = []
        
        all_chunks = []
        for sec_name, sec_text in parsed_doc["sections"].items():
            if "could not be located" in sec_text:
                continue
            sec_chunks = self.chunk_text(sec_text, sec_name)
            all_chunks.extend(sec_chunks)
            
        print(f"[RAG] Generated {len(all_chunks)} chunks. Creating embeddings in batches...")
        
        # Fast batched retrieval
        texts = [c["text"] for c in all_chunks]
        embs = self._get_embeddings_batch(texts)
        
        for chunk, emb in zip(all_chunks, embs):
            self.chunks.append(chunk)
            self.embeddings.append(emb)
            
        print(f"[RAG] Successfully indexed {len(self.chunks)} chunks.")

    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """
        Finds the k-most similar text chunks using cosine similarity.
        """
        if not self.chunks:
            return []
            
        query_emb = self._get_embedding(query)
        similarities = []
        
        for emb in self.embeddings:
            # Cosine similarity calculation
            dot = np.dot(query_emb, emb)
            norm_q = np.linalg.norm(query_emb)
            norm_e = np.linalg.norm(emb)
            if norm_q > 0 and norm_e > 0:
                sim = dot / (norm_q * norm_e)
            else:
                sim = 0.0
            similarities.append(sim)
            
        top_indices = np.argsort(similarities)[::-1][:k]
        
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            chunk = self.chunks[idx].copy()
            chunk["score"] = score
            results.append(chunk)
            
        return results

    def keyword_search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """
        Performs basic keyword matching for fallback/search features.
        """
        if not self.chunks:
            return []
            
        terms = [t.lower() for t in query.split() if len(t) > 2]
        if not terms:
            terms = [query.lower()]
            
        matches = []
        for chunk in self.chunks:
            text_lower = chunk["text"].lower()
            # Calculate match frequency
            score = sum(1 for term in terms if term in text_lower)
            if score > 0:
                c = chunk.copy()
                c["score"] = float(score) / len(terms)
                matches.append(c)
                
        # Sort by match score
        matches = sorted(matches, key=lambda x: x["score"], reverse=True)
        return matches[:k]
