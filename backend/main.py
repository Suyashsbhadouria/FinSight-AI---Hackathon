import json
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.config import HOST, PORT
from backend.slm_client import SLMClient
from backend.parser import parse_filing_pdf
from backend.rag import LightweightVectorStore
from backend.agent import LangGraphAgent
from backend.guardrails import validate_input, validate_output
from backend.tools import competitor_analysis_tool
from backend.map_reduce import run_map_reduce_analysis
from backend.pipeline_logger import PipelineLogger, set_pipeline_logger

app = FastAPI(
    title="FinSight AI API",
    description="Intelligent Financial Filing Analysis Platform Backend"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory single-session database models
class AppState:
    def __init__(self):
        self.slm_client = SLMClient()
        self.vector_store = LightweightVectorStore()
        self.agent = LangGraphAgent(self.slm_client, self.vector_store)
        self.current_doc: Optional[Dict[str, Any]] = None
        self.extracted_risks: List[Dict[str, Any]] = []
        self.guard_logs: List[Dict[str, Any]] = []
        self.pipeline_logger = PipelineLogger()
        set_pipeline_logger(self.pipeline_logger)

state = AppState()

# Request schemas
class ChatRequest(BaseModel):
    query: str
    history: Optional[List[Dict[str, str]]] = []

class SearchRequest(BaseModel):
    query: str
    k: Optional[int] = 5
    search_type: Optional[str] = "semantic" # "semantic" or "keyword"

class CompetitorRequest(BaseModel):
    company_name: str

class MapReduceRequest(BaseModel):
    query: str
    mode: str  # "smart_search", "page_range", "section"
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    section_name: Optional[str] = None
    limit: Optional[int] = 6

# Helper to list navigable sections from parsed document metadata
def list_document_sections(doc: Dict[str, Any]) -> List[str]:
    mapped = list(doc.get("section_mapping", {}).keys())
    if mapped:
        return mapped
    sections = doc.get("sections", {})
    placeholder = "could not be located"
    return [
        name for name, content in sections.items()
        if placeholder not in content or len(content.strip()) > 120
    ]

# Helper to append guard log
def log_guard_action(stage: str, inp: str, result: Dict[str, Any]):
    state.guard_logs.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "stage": stage,
        "raw_text": inp[:100] + "..." if len(inp) > 100 else inp,
        "passed": result["passed"],
        "reason": result["reason"],
        "details": result.get("details", "")
    })

# --- ROUTES ---

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "FinSight AI",
        "document_loaded": state.current_doc is not None,
        "storage": "in-memory session (data resets on server restart)",
    }

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload financial filing PDF. Parse text, partition into standard 10-K/10-Q sections,
    and index in the lightweight vector store.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        content = await file.read()
        parsed = parse_filing_pdf(content, file.filename)
        
        # Save in-memory
        state.current_doc = parsed
        
        # Index document in vector store for RAG
        state.vector_store.add_document(parsed)
        
        # Reset extracted risks to force recalculation for the new document
        state.extracted_risks = []
        section_names = list_document_sections(parsed)

        return {
            "success": True,
            "filename": parsed["filename"],
            "company_name": parsed["company_name"],
            "total_pages": parsed["total_pages"],
            "sections_extracted": section_names
        }
    except Exception as e:
        print(f"[API] Error uploading/parsing document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(e)}")

@app.get("/api/document/status")
async def get_document_status():
    """
    Returns metadata about the currently uploaded filing, or null if empty.
    """
    if not state.current_doc:
        return {"uploaded": False, "document": None}
        
    return {
        "uploaded": True,
        "document": {
            "filename": state.current_doc["filename"],
            "company_name": state.current_doc["company_name"],
            "total_pages": state.current_doc["total_pages"],
            "section_mapping": state.current_doc["section_mapping"],
            "sections": list_document_sections(state.current_doc)
        }
    }

@app.get("/api/document/section/{section_name}")
async def get_document_section(section_name: str):
    """
    Retrieves the raw text for a specific section.
    """
    if not state.current_doc:
        raise HTTPException(status_code=404, detail="No active document uploaded.")
        
    sections = state.current_doc["sections"]
    if section_name not in sections:
        raise HTTPException(status_code=404, detail=f"Section '{section_name}' not found.")
        
    return {
        "section": section_name,
        "content": sections[section_name]
    }

@app.post("/api/search")
async def search_document(req: SearchRequest):
    """
    Performs keyword or semantic search across the uploaded document.
    """
    if not state.current_doc:
        raise HTTPException(status_code=404, detail="No active document uploaded.")
        
    if req.search_type == "keyword":
        results = state.vector_store.keyword_search(req.query, k=req.k)
    else:
        results = state.vector_store.search(req.query, k=req.k)
        
    return {"results": results}

@app.get("/api/risks")
async def get_risks():
    """
    Extracts and summarizes key risks from the document (specifically 'Risk Factors' section)
    using the SLM. Caches findings.
    """
    if not state.current_doc:
        raise HTTPException(status_code=404, detail="No active document uploaded.")
        
    # Check cache first
    if state.extracted_risks:
        return {"risks": state.extracted_risks}

    # Fetch Risk Factors section
    risk_section = state.current_doc["sections"].get("Risk Factors", "")
    if "could not be located" in risk_section or len(risk_section) < 500:
        # Fallback to general search inside the vector store for risk factors if section not parsed
        retrieve_query = "What are the primary business, operational, and regulatory risks discussed?"
        risk_section = state.vector_store.search(retrieve_query, k=3)
        risk_section = "\n\n".join([r["text"] for r in risk_section])

    system_prompt = (
        "You are an expert AI risk analyst. Extract the primary business and financial risks discussed in the filing. "
        "Format the output strictly as a JSON object containing a list of risk items. Do not add markdown or extra text.\n"
        "Schema:\n"
        "{\n"
        "  \"risks\": [\n"
        "    {\n"
        "      \"title\": \"Brief Risk Title\",\n"
        "      \"description\": \"1-2 sentence detailed description of the risk.\",\n"
        "      \"severity\": 1-10 integer,\n"
        "      \"evidence\": \"Verbatim snippet of supporting evidence from text.\",\n"
        "      \"location\": \"Page number or section name\"\n"
        "    }\n"
        "  ]\n"
        "}"
    )

    prompt = (
        f"Based on the following risk disclosures, extract the top 5 risks according to the schema:\n\n"
        f"{risk_section[:15000]}" # Limit chunk size to avoid context exhaustion
    )

    try:
        response_text = state.slm_client.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            response_format_json=True
        )
        
        # Clean potential markdown markdown wrapping
        cleaned = re.sub(r'```(?:json)?|```', '', response_text).strip()
        parsed_risks = json.loads(cleaned)
        state.extracted_risks = parsed_risks.get("risks", [])
        for risk in state.extracted_risks:
            sev = risk.get("severity")
            if isinstance(sev, str):
                try:
                    risk["severity"] = float(sev)
                except ValueError:
                    risk["severity"] = 5
    except Exception as e:
        print(f"[API] Error structuring risks with SLM: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Risk extraction failed: {str(e)}. Upload a filing with readable risk disclosures and retry.",
        )

    return {"risks": state.extracted_risks}

@app.post("/api/chat")
async def chat_with_agent(req: ChatRequest):
    """
    Chat with the RAG agent about the document. Monitors input safety and output toxicity.
    """
    if not state.current_doc:
        raise HTTPException(status_code=400, detail="Please upload a financial filing document before initiating chat.")

    # 1. Input Guard Layer
    input_audit = validate_input(req.query)
    log_guard_action("INPUT", req.query, input_audit)
    run_id = state.pipeline_logger.new_run_id()

    if not input_audit["passed"]:
        return {
            "response": f"Security Alert: {input_audit['reason']}. {input_audit['details']}",
            "citations": [],
            "logs": [{"step": "GUARDRAIL", "text": f"Blocked input: {input_audit['reason']}"}],
            "safety_audit": {"input_passed": False, "output_passed": True, "input_log": input_audit, "output_log": None},
            "run_id": run_id,
        }

    sanitized_query = input_audit["sanitized_query"]
    if sanitized_query != req.query:
        state.pipeline_logger.log_augmentation(
            pipeline="assistant",
            stage="input_guardrail",
            description="Input sanitized by guardrails before agent run",
            input_text=req.query,
            output_text=sanitized_query,
            run_id=run_id,
        )

    # 2. Run LangGraph Agent workflow
    try:
        agent_result = state.agent.run(sanitized_query, req.history, run_id=run_id)
        raw_response = agent_result["response"]
    except Exception as e:
        print(f"[API] Error running LangGraph agent: {e}")
        raise HTTPException(status_code=500, detail=f"Agent workflow error: {str(e)}")

    # 3. Output Guard Layer
    output_audit = validate_output(raw_response)
    log_guard_action("OUTPUT", raw_response, output_audit)

    final_response = output_audit["sanitized_response"]
    if final_response != raw_response:
        state.pipeline_logger.log_augmentation(
            pipeline="assistant",
            stage="output_guardrail",
            description="Output sanitized by guardrails before client response",
            input_text=raw_response,
            output_text=final_response,
            run_id=run_id,
        )

    return {
        "response": final_response,
        "citations": agent_result["citations"],
        "logs": agent_result["logs"],
        "safety_audit": {
            "input_passed": True,
            "output_passed": output_audit["passed"],
            "input_log": input_audit,
            "output_log": output_audit
        },
        "run_id": run_id,
    }

@app.post("/api/competitors")
async def run_competitor_analysis(req: CompetitorRequest):
    """
    Gathers top 2-3 competitor financial metrics, initiatives, and risks.
    """
    try:
        json_results_str = competitor_analysis_tool(req.company_name, state.slm_client)
        data = json.loads(json_results_str)
        return data
    except Exception as e:
        print(f"[API] Competitor analysis route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze/map-reduce")
async def map_reduce_analyze(req: MapReduceRequest):
    """
    Runs parallel Map-Reduce analysis across the pages of the uploaded document.
    """
    if not state.current_doc:
        raise HTTPException(status_code=400, detail="Please upload a financial filing document before initiating analysis.")

    try:
        input_audit = validate_input(req.query)
        log_guard_action("INPUT_MR", req.query, input_audit)
        run_id = state.pipeline_logger.new_run_id()

        if not input_audit["passed"]:
            return {
                "success": False,
                "error": f"Security Check Failed: {input_audit['reason']}",
                "report": f"### Security Check Failed\n\nThe query was blocked by our guardrails.\n\n**Reason:** {input_audit['reason']}\n\n**Details:** {input_audit.get('details', '')}",
                "pages_analyzed": [],
                "intermediate_summaries": [],
                "run_id": run_id,
            }

        sanitized_query = input_audit["sanitized_query"]
        if sanitized_query != req.query:
            state.pipeline_logger.log_augmentation(
                pipeline="map_reduce",
                stage="input_guardrail",
                description="Input sanitized by guardrails before map-reduce run",
                input_text=req.query,
                output_text=sanitized_query,
                run_id=run_id,
            )

        params = {
            "start_page": req.start_page,
            "end_page": req.end_page,
            "section_name": req.section_name,
            "limit": req.limit
        }

        result = run_map_reduce_analysis(
            doc=state.current_doc,
            query=sanitized_query,
            mode=req.mode,
            mode_params=params,
            slm_client=state.slm_client,
            vector_store=state.vector_store,
            run_id=run_id,
        )

        if result.get("success") and "report" in result:
            output_audit = validate_output(result["report"])
            log_guard_action("OUTPUT_MR", result["report"], output_audit)
            if output_audit["sanitized_response"] != result["report"]:
                state.pipeline_logger.log_augmentation(
                    pipeline="map_reduce",
                    stage="output_guardrail",
                    description="Report sanitized by guardrails before client response",
                    input_text=result["report"],
                    output_text=output_audit["sanitized_response"],
                    run_id=run_id,
                )
            result["report"] = output_audit["sanitized_response"]

        return result
    except Exception as e:
        print(f"[API] Map-Reduce analysis route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/guardrails/logs")
async def get_guardrail_logs():
    """
    Returns history of Guard Layer checks.
    """
    return {"logs": state.guard_logs}

@app.get("/api/guardrails/stats")
async def get_guardrail_stats():
    """
    Returns aggregate guardrail metrics derived from the live audit log.
    """
    logs = state.guard_logs
    blocked = [log for log in logs if not log["passed"]]
    pii_masked = [
        log for log in logs
        if log["passed"] and "PII Masked" in log.get("reason", "")
    ]
    toxicity_blocked = [
        log for log in blocked
        if log.get("stage", "").startswith("OUTPUT")
    ]
    return {
        "total_checks": len(logs),
        "injections_blocked": len(blocked),
        "pii_redacted": len(pii_masked),
        "toxicity_blocks": len(toxicity_blocked),
        "checks_passed": len(logs) - len(blocked),
    }

@app.get("/api/pipeline/logs")
async def get_pipeline_logs(
    pipeline: Optional[str] = None,
    run_id: Optional[str] = None,
    limit: int = 100,
    truncate: bool = True,
):
    """
    Returns structured pipeline logs for assistant and map-reduce runs.
    Full untruncated records are persisted to logs/pipeline.ndjson.
    """
    logs = state.pipeline_logger.get_logs(
        pipeline=pipeline,
        run_id=run_id,
        limit=min(limit, 500),
        truncate=truncate,
    )
    return {
        "logs": logs,
        "log_file": str(state.pipeline_logger.log_file),
        "total_in_memory": len(state.pipeline_logger.entries),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=True)
