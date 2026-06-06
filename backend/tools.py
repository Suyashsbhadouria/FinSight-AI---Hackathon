import json
import re
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

from backend.rag import LightweightVectorStore


def rag_retrieve_tool(
    vector_store: LightweightVectorStore,
    query: str,
    k: int = 4,
    pipeline: str = "assistant",
    run_id: Optional[str] = None,
) -> str:
    """
    Search tool to retrieve relevant sections and context chunks from the uploaded financial document.
    """
    print(f"[Tools] Executing RAG retrieval for query: '{query}'...")
    results = vector_store.search(
        query, k=k, pipeline=pipeline, stage="rag_retrieve", run_id=run_id
    )
    if not results:
        results = vector_store.keyword_search(
            query, k=k, pipeline=pipeline, stage="rag_retrieve_fallback", run_id=run_id
        )

    if not results:
        return "RAG Retrieval Result: No matching content found in the filing document."

    formatted_results = []
    for idx, res in enumerate(results):
        formatted_results.append(
            f"--- Reference Context {idx+1} (Section: {res['section']}, Page: {res['page']}, Similarity Score: {res['score']:.4f}) ---\n"
            f"{res['text']}"
        )
    return "\n\n".join(formatted_results)


def web_search_tool(query: str, max_results: int = 4) -> str:
    """
    Search tool to search the internet for industry information, competitor data, and benchmarking facts.
    """
    print(f"[Tools] Executing Web Search for query: '{query}'...")
    try:
        results = []
        with DDGS() as ddgs:
            ddg_results = ddgs.text(query, max_results=max_results)
            for r in ddg_results:
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                })

        if not results:
            return f"Web Search Result: No findings on the web for query '{query}'."

        formatted_results = []
        for idx, res in enumerate(results):
            formatted_results.append(
                f"--- Web Search Result {idx+1} ---\n"
                f"Title: {res['title']}\n"
                f"URL: {res['url']}\n"
                f"Snippet: {res['snippet']}"
            )
        return "\n\n".join(formatted_results)
    except Exception as e:
        print(f"[Tools] Web search failed: {e}")
        return f"Web Search Error: Search service unavailable. Details: {str(e)}"


def web_scrape_tool(url: str) -> str:
    """
    Scraper tool to fetch web page contents and extract readable text.
    """
    print(f"[Tools] Scraping URL: '{url}'...")
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return f"Web Scrape Error: Failed to fetch {url}. Status code: {response.status_code}"

        soup = BeautifulSoup(response.text, "html.parser")

        for script in soup(["script", "style"]):
            script.decompose()

        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = "\n".join(chunk for chunk in chunks if chunk)

        truncated_text = text[:3000]
        return f"--- Scraped Content from {url} (Truncated) ---\n{truncated_text}"
    except Exception as e:
        return f"Web Scrape Error: An exception occurred while scraping {url}. Details: {str(e)}"


def competitor_analysis_tool(company_name: str, slm_client: Any) -> str:
    """
    Analyzes competitors by searching the web and using the LLM to structure competitor data.
    """
    print(f"[Tools] Triggering competitor analysis for {company_name}...")

    query = f"{company_name} main competitors revenue growth margins"
    search_context = web_search_tool(query, max_results=3)

    if search_context.startswith("Web Search Error:"):
        raise RuntimeError(search_context)

    system_prompt = (
        "You are an expert financial analyst. Extract competitor metrics from the provided web search results "
        "and return a clean JSON list matching the schema. Only include data supported by the search results; "
        "if a field is unavailable, use 'Not disclosed'."
    )

    prompt = (
        f"Based on the following web search results about competitors of {company_name}, "
        f"extract and structure details for the top 2-3 competitors.\n\n"
        f"Search Results:\n{search_context}\n\n"
        f"Return JSON strictly in this format, with no markdown wrappers or text outside the JSON:\n"
        f"{{\n"
        f"  \"competitors\": [\n"
        f"    {{\n"
        f"      \"name\": \"Competitor Name\",\n"
        f"      \"revenue\": \"Revenue ($ Billion/Million)\",\n"
        f"      \"growth\": \"Year-over-Year Growth (%)\",\n"
        f"      \"margin\": \"Operating/Gross Margin (%)\",\n"
        f"      \"risks\": \"Short summary of key strategic/operational risks\",\n"
        f"      \"initiatives\": \"Short summary of key business initiatives\"\n"
        f"    }}\n"
        f"  ]\n"
        f"}}\n"
    )

    response_text = slm_client.generate(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=0.1,
        response_format_json=True,
    )

    cleaned = re.sub(r"```(?:json)?|```", "", response_text).strip()
    json_data = json.loads(cleaned)
    if not json_data.get("competitors"):
        raise RuntimeError("Competitor analysis returned no competitor records from search results.")
    return json.dumps(json_data, indent=2)
