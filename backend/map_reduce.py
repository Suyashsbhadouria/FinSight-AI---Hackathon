import re
import concurrent.futures
from typing import List, Dict, Any, Optional
from backend.slm_client import SLMClient
from backend.rag import LightweightVectorStore
from backend.pipeline_logger import get_pipeline_logger


def map_single_page(
    page_num: int,
    page_text: str,
    query: str,
    company_name: str,
    slm_client: SLMClient,
    run_id: Optional[str] = None,
) -> str:
    """
    Map Step: Analyze a single page of a financial document with respect to the user query.
    """
    clean_text = page_text.strip()
    if not clean_text or len(clean_text) < 50:
        return "NO_RELEVANT_INFO"

    system_prompt = (
        "You are an expert financial analyst. Your task is to analyze the provided page of a financial filing with respect to the user query.\n"
        "Identify and summarize any disclosures, discussions, data points, or risks related to the query.\n"
        "Keep your summary concise (2-4 bullet points or a short paragraph).\n"
        "If the page contains no relevant information for the query, reply exactly with: 'NO_RELEVANT_INFO'. Do not add any other words."
    )

    prompt = (
        f"Company Name: {company_name}\n"
        f"Document Page Number: {page_num}\n"
        f"Analysis Topic/Query: '{query}'\n\n"
        f"--- Page Content Start ---\n"
        f"{clean_text[:4000]}\n"
        f"--- Page Content End ---\n\n"
        f"Provide the analysis for this page, or reply 'NO_RELEVANT_INFO' if there is no relevant information."
    )

    get_pipeline_logger().log_augmentation(
        pipeline="map_reduce",
        stage=f"map_page_{page_num}",
        description=f"Built map-phase prompt for page {page_num}",
        input_text=clean_text[:4000],
        output_text=prompt,
        run_id=run_id,
        extra={"page_num": page_num},
    )

    try:
        response = slm_client.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=500,
            pipeline="map_reduce",
            stage=f"map_page_{page_num}",
            run_id=run_id,
        )
        cleaned = response.strip()
        if not cleaned or "placeholder response because no" in cleaned.lower():
            return "NO_RELEVANT_INFO"
        return cleaned
    except Exception as e:
        print(f"[MapReduce] Error in map_single_page for Page {page_num}: {e}")
        return "NO_RELEVANT_INFO"


def run_map_reduce_analysis(
    doc: Dict[str, Any],
    query: str,
    mode: str,
    mode_params: Dict[str, Any],
    slm_client: SLMClient,
    vector_store: LightweightVectorStore,
    run_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes the full Map-Reduce pipeline for analyzing PDF page content.
    """
    logger = get_pipeline_logger()
    run_id = run_id or logger.new_run_id()

    print(f"[MapReduce] Initiating analysis for company '{doc['company_name']}' under mode '{mode}'...")

    logger.log_augmentation(
        pipeline="map_reduce",
        stage="pipeline_start",
        description="Map-Reduce analysis started",
        input_text=query,
        output_text="",
        run_id=run_id,
        extra={"mode": mode, "mode_params": mode_params, "company": doc.get("company_name")},
    )

    pages = doc.get("pages", [])
    if not pages:
        print("[MapReduce] Raw pages array not found. Reconstructing from sections content...")
        page_dict = {}
        for sec_name, sec_text in doc.get("sections", {}).items():
            if "could not be located" in sec_text:
                continue
            parts = re.split(r'\[Page\s+(\d+)\]', sec_text)
            if len(parts) > 1:
                i = 0
                while i < len(parts):
                    val = parts[i]
                    if val.isdigit():
                        p_num = int(val)
                        p_txt = parts[i + 1] if i + 1 < len(parts) else ""
                        page_dict[p_num] = page_dict.get(p_num, "") + "\n" + p_txt
                        i += 2
                    else:
                        i += 1
            else:
                page_dict[1] = page_dict.get(1, "") + "\n" + sec_text
        pages = [{"page_num": k, "text": v.strip()} for k, v in sorted(page_dict.items())]

    page_by_num = {p["page_num"]: p["text"] for p in pages}
    total_pages = doc.get("total_pages", len(page_by_num))
    target_page_nums = []

    if mode == "page_range":
        start_page = int(mode_params.get("start_page", 1))
        end_page = int(mode_params.get("end_page", total_pages))
        start_page = max(1, start_page)
        end_page = min(total_pages, end_page)
        target_page_nums = list(range(start_page, end_page + 1))
        print(f"[MapReduce] Page Range mode: Selected pages {start_page} to {end_page}.")

    elif mode == "section":
        section_name = mode_params.get("section_name", "")
        section_mapping = doc.get("section_mapping", {})

        if section_name not in section_mapping:
            available = list(section_mapping.keys())
            print(f"[MapReduce] Section '{section_name}' not found. Available: {available}")
            return {
                "success": False,
                "error": (
                    f"Section '{section_name}' was not found in this filing. "
                    f"Available sections: {', '.join(available)}."
                ),
                "pages_analyzed": [],
                "intermediate_summaries": [],
                "report": "",
                "run_id": run_id,
            }

        start_page = section_mapping[section_name]
        sorted_starts = sorted(section_mapping.items(), key=lambda x: x[1])
        end_page = total_pages
        for i, (name, s_page) in enumerate(sorted_starts):
            if name == section_name and i + 1 < len(sorted_starts):
                end_page = sorted_starts[i + 1][1] - 1
                break
        target_page_nums = list(range(start_page, end_page + 1))
        print(f"[MapReduce] Section mode '{section_name}': Selected pages {start_page} to {end_page}.")

    elif mode == "smart_search" or mode == "focused":
        limit = int(mode_params.get("limit", 6))
        print(f"[MapReduce] Smart Search Mode: Searching vector store for top matching pages. Limit={limit}...")
        search_results = vector_store.search(
            query, k=25, pipeline="map_reduce", stage="smart_search", run_id=run_id
        )
        if not search_results:
            search_results = vector_store.keyword_search(
                query, k=25, pipeline="map_reduce", stage="smart_search_fallback", run_id=run_id
            )

        seen_pages = set()
        pages_ordered = []
        for res in search_results:
            pg = res.get("page")
            if pg and pg not in seen_pages:
                seen_pages.add(pg)
                pages_ordered.append(pg)
                if len(pages_ordered) >= limit:
                    break

        target_page_nums = sorted(pages_ordered)
        print(f"[MapReduce] Smart Search Mode: Selected most relevant pages: {target_page_nums}")

    else:
        target_page_nums = list(range(1, min(6, total_pages + 1)))
        print(f"[MapReduce] Unknown mode '{mode}'. Defaulting to pages {target_page_nums}.")

    valid_pages = [p for p in target_page_nums if p in page_by_num]

    logger.log_augmentation(
        pipeline="map_reduce",
        stage="page_selection",
        description="Selected target pages for map phase",
        input_text=query,
        output_text=str(valid_pages),
        run_id=run_id,
        extra={"mode": mode, "page_count": len(valid_pages)},
    )

    if not valid_pages:
        return {
            "success": False,
            "error": "No pages selected or parsed text is unavailable for the selected range.",
            "pages_analyzed": [],
            "intermediate_summaries": [],
            "report": "Analysis could not be performed because no page content was selected.",
            "run_id": run_id,
        }

    print(f"[MapReduce] Mapping query across {len(valid_pages)} pages in parallel (max 5 workers)...")
    intermediate_summaries = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_page = {
            executor.submit(
                map_single_page,
                p_num,
                page_by_num[p_num],
                query,
                doc["company_name"],
                slm_client,
                run_id,
            ): p_num
            for p_num in valid_pages
        }

        for future in concurrent.futures.as_completed(future_to_page):
            p_num = future_to_page[future]
            try:
                page_summary = future.result()
                is_relevant = (
                    page_summary
                    and page_summary.strip().upper() != "NO_RELEVANT_INFO"
                )
                if is_relevant:
                    intermediate_summaries.append({
                        "page_num": p_num,
                        "summary": page_summary,
                    })
            except Exception as e:
                print(f"[MapReduce] Map step failed for page {p_num}: {e}")

    intermediate_summaries.sort(key=lambda x: x["page_num"])
    print(f"[MapReduce] Map step complete. Found relevant disclosures on {len(intermediate_summaries)} pages.")

    if not intermediate_summaries:
        no_info_msg = f"No relevant information regarding '{query}' was found in the analyzed pages of the filing."
        return {
            "success": True,
            "pages_analyzed": valid_pages,
            "intermediate_summaries": [],
            "report": f"### Executive Summary\n\n{no_info_msg}\n\n*Note: Analyzed filing pages {valid_pages}.*",
            "run_id": run_id,
        }

    print("[MapReduce] Reducing page summaries into final synthesized report...")
    combined_summaries_text = ""
    for item in intermediate_summaries:
        combined_summaries_text += (
            f"--- Summary from Page {item['page_num']} ---\n"
            f"{item['summary']}\n\n"
        )

    reduce_system_prompt = (
        "You are a senior investment research analyst. Synthesize the provided page-by-page financial disclosures into a single cohesive, structured analysis report.\n"
        "Requirements:\n"
        "- Structure the report logically with clear headings (e.g. Executive Summary, Key Findings, Strategic Implications/Risks).\n"
        "- Cite page numbers in parentheses next to facts and metrics, for example: (Page X) or (Pages X, Y).\n"
        "- Do not introduce external facts or hallucinate numbers not found in the source text.\n"
        "- Format the report in beautiful, professional Markdown."
    )

    reduce_prompt = (
        f"Company Name: {doc['company_name']}\n"
        f"Analysis Topic: '{query}'\n\n"
        f"Page-by-page findings collected during the map phase:\n\n"
        f"{combined_summaries_text}"
        f"Write a synthesized analysis report addressing the topic based on these findings."
    )

    logger.log_augmentation(
        pipeline="map_reduce",
        stage="reduce_prompt",
        description="Assembled reduce-phase prompt from page summaries",
        input_text=combined_summaries_text,
        output_text=reduce_prompt,
        run_id=run_id,
        extra={"summary_count": len(intermediate_summaries)},
    )

    try:
        report = slm_client.generate(
            prompt=reduce_prompt,
            system_prompt=reduce_system_prompt,
            temperature=0.2,
            max_tokens=1500,
            pipeline="map_reduce",
            stage="reduce",
            run_id=run_id,
        )
    except Exception as e:
        print(f"[MapReduce] Reduce step synthesis failed: {e}")
        fallback_report = f"### Synthesized Analysis for {doc['company_name']}: {query}\n\n"
        fallback_report += "Due to a system error in the synthesis engine, the page-by-page summaries are listed below directly:\n\n"
        for item in intermediate_summaries:
            fallback_report += f"#### Page {item['page_num']}\n{item['summary']}\n\n"
        report = fallback_report

    print("[MapReduce] Map-Reduce analysis finished successfully.")
    return {
        "success": True,
        "pages_analyzed": valid_pages,
        "intermediate_summaries": intermediate_summaries,
        "report": report,
        "run_id": run_id,
    }
