import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# In-memory cap; full records are always appended to the NDJSON file.
_MAX_MEMORY_ENTRIES = 500
_PREVIEW_CHARS = 2000


class PipelineLogger:
    """Structured logger for retrievals, augmentations, generations, and LLM responses."""

    def __init__(self, log_dir: str = "logs"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_file = self.log_dir / "pipeline.ndjson"
        self.entries: List[Dict[str, Any]] = []

    def new_run_id(self) -> str:
        return str(uuid.uuid4())

    def _write(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        entry.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        self.entries.append(entry)
        if len(self.entries) > _MAX_MEMORY_ENTRIES:
            self.entries = self.entries[-_MAX_MEMORY_ENTRIES:]

        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        print(
            f"[PipelineLog][{entry.get('pipeline', '?')}]"
            f"[{entry.get('event_type', '?')}]"
            f" {entry.get('stage', '')}"
        )
        return entry

    @staticmethod
    def _preview(text: Optional[str], limit: int = _PREVIEW_CHARS) -> Optional[str]:
        if text is None:
            return None
        if len(text) <= limit:
            return text
        return text[:limit] + f"... [truncated, {len(text)} chars total]"

    def log_retrieval(
        self,
        *,
        pipeline: str,
        stage: str,
        query: str,
        results: List[Dict[str, Any]],
        search_type: str = "semantic",
        run_id: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        summarized = [
            {
                "section": r.get("section"),
                "page": r.get("page"),
                "score": r.get("score"),
                "text": r.get("text", ""),
            }
            for r in results
        ]
        return self._write({
            "event_type": "retrieval",
            "pipeline": pipeline,
            "stage": stage,
            "run_id": run_id,
            "search_type": search_type,
            "query": query,
            "result_count": len(results),
            "results": summarized,
            **(extra or {}),
        })

    def log_augmentation(
        self,
        *,
        pipeline: str,
        stage: str,
        description: str,
        input_text: Optional[str] = None,
        output_text: Optional[str] = None,
        run_id: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self._write({
            "event_type": "augmentation",
            "pipeline": pipeline,
            "stage": stage,
            "run_id": run_id,
            "description": description,
            "input": input_text,
            "output": output_text,
            **(extra or {}),
        })

    def log_generation(
        self,
        *,
        pipeline: str,
        stage: str,
        system_prompt: Optional[str],
        prompt: str,
        temperature: float,
        max_tokens: int,
        response_format_json: bool = False,
        run_id: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self._write({
            "event_type": "generation",
            "pipeline": pipeline,
            "stage": stage,
            "run_id": run_id,
            "system_prompt": system_prompt,
            "prompt": prompt,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format_json": response_format_json,
            **(extra or {}),
        })

    def log_llm_response(
        self,
        *,
        pipeline: str,
        stage: str,
        response: str,
        provider: str,
        run_id: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self._write({
            "event_type": "llm_response",
            "pipeline": pipeline,
            "stage": stage,
            "run_id": run_id,
            "provider": provider,
            "response": response,
            **(extra or {}),
        })

    def get_logs(
        self,
        pipeline: Optional[str] = None,
        run_id: Optional[str] = None,
        limit: int = 100,
        truncate: bool = True,
    ) -> List[Dict[str, Any]]:
        logs = self.entries
        if pipeline:
            logs = [e for e in logs if e.get("pipeline") == pipeline]
        if run_id:
            logs = [e for e in logs if e.get("run_id") == run_id]
        logs = logs[-limit:]

        if not truncate:
            return logs

        previewed: List[Dict[str, Any]] = []
        for entry in logs:
            copy = dict(entry)
            for key in ("prompt", "system_prompt", "response", "input", "output", "query"):
                if key in copy and isinstance(copy[key], str):
                    copy[key] = self._preview(copy[key])
            if "results" in copy:
                copy["results"] = [
                    {**r, "text": self._preview(r.get("text", ""), 500)}
                    for r in copy.get("results", [])
                ]
            previewed.append(copy)
        return previewed

    def clear(self) -> None:
        self.entries.clear()


_logger: Optional[PipelineLogger] = None


def get_pipeline_logger() -> PipelineLogger:
    global _logger
    if _logger is None:
        _logger = PipelineLogger()
    return _logger


def set_pipeline_logger(logger: PipelineLogger) -> None:
    global _logger
    _logger = logger
