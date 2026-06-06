import re
from typing import Dict, Any, Tuple

# PII regex patterns
EMAIL_PATTERN = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
PHONE_PATTERN = re.compile(
    r'(?:\+?\d{1,3}[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}'
)
SSN_PATTERN = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
ADDRESS_PATTERN = re.compile(r'\b\d+\s+[A-Za-z0-9\s,.]+?\s+(?:Street|St|Avenue|Ave|Road|Rd|Highway|Hwy|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way)\b', re.IGNORECASE)

# SQL Injection patterns
SQL_INJECTION_PATTERN = re.compile(
    r"(\b(SELECT|UNION|INSERT|DELETE|UPDATE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b)|"
    r"(--)|(/\*|\*/)|(OR\s+['\"]?\d+['\"]?\s*=\s*['\"]?\d+['\"]?)", 
    re.IGNORECASE
)

# Prompt Injection patterns
PROMPT_INJECTION_PATTERN = re.compile(
    r"\b(ignore\s+(?:all\s+)?previous\s+instructions|"
    r"you\s+are\s+now\s+a\s+different|"
    r"jailbreak|"
    r"system\s+prompt|"
    r"override\s+settings|"
    r"forget\s+what\s+i\s+said)\b", 
    re.IGNORECASE
)

# Toxic terms (simplified keyword check)
TOXIC_TERMS = ["bastard", "fuck", "bitch", "asshole", "idiot", "retard", "stupid user", "kill yourself"]

# Allowed finance/business keywords for Domain Relevance
DOMAIN_KEYWORDS = [
    "filing", "10-k", "10-q", "annual report", "risk", "revenue", "income",
    "balance sheet", "cash flow", "cash", "competitor", "profit", "ebitda", "margin",
    "debt", "liability", "asset", "equity", "shareholder", "finance", "fiscal",
    "market", "stock", "growth", "performance", "ceo", "management", "outlook",
    "md&a", "sec", "earnings", "dividend", "investment", "audit", "compliance",
    "cybersecurity", "regulatory", "supply chain", "legal", "liquidity", "capital",
    "credit", "disclosure", "facility", "operating", "business", "semiconductor",
    # Common 10-K expense and operating topics
    "advertising", "marketing", "spend", "spent", "spending", "expense", "expenses",
    "cost", "costs", "payroll", "compensation", "employee", "employees", "human resource",
    "human resources", "personnel", "benefit", "benefits", "salary", "wages", "capex",
    "opex", "overhead", "operating expense", "sg&a", "research and development", "r&d",
    "tax", "taxes", "depreciation", "amortization", "acquisition", "merger",
]

# Expense/cost questions about a company are in-domain even without classic finance terms
EXPENSE_INTENT_PATTERN = re.compile(
    r"\b(spend|spent|spending|cost|costs|expense|expenses|pay|paid|payment|budget|invested|investment)\b",
    re.IGNORECASE,
)
FILING_CONTEXT_PATTERN = re.compile(
    r"\b(company|filing|10-k|10-q|annual|quarter|report|financial|business|corporation|firm)\b",
    re.IGNORECASE,
)

def mask_pii(text: str) -> str:
    """Masks typical PII patterns found in text."""
    masked = text
    masked = EMAIL_PATTERN.sub("[MASKED_EMAIL]", masked)
    masked = PHONE_PATTERN.sub("[MASKED_PHONE]", masked)
    masked = SSN_PATTERN.sub("[MASKED_SSN]", masked)
    masked = ADDRESS_PATTERN.sub("[MASKED_ADDRESS]", masked)
    return masked

def check_sql_injection(text: str) -> bool:
    """Returns True if SQL injection patterns are detected."""
    return bool(SQL_INJECTION_PATTERN.search(text))

def check_prompt_injection(text: str) -> bool:
    """Returns True if prompt injection patterns are detected."""
    return bool(PROMPT_INJECTION_PATTERN.search(text))

GREETING_PATTERN = re.compile(
    r"^(hi|hello|hey|thanks|thank you|good morning|good afternoon)[!.?\s]*$",
    re.IGNORECASE,
)

def check_domain_relevance(text: str) -> bool:
    """
    Returns True if the text is relevant to financial and filing analyses.
    Checks for the presence of standard financial terms.
    """
    text_lower = text.lower().strip()
    if GREETING_PATTERN.match(text_lower):
        return True
    if any(kw in text_lower for kw in DOMAIN_KEYWORDS):
        return True
    if EXPENSE_INTENT_PATTERN.search(text_lower) and FILING_CONTEXT_PATTERN.search(text_lower):
        return True
    return False

# #region agent log
def _debug_guardrail_log(location: str, message: str, data: dict, hypothesis_id: str) -> None:
    try:
        import json as _json, time as _time
        with open("debug-1f95b2.log", "a", encoding="utf-8") as _f:
            _f.write(_json.dumps({
                "sessionId": "1f95b2",
                "location": location,
                "message": message,
                "data": data,
                "timestamp": int(_time.time() * 1000),
                "hypothesisId": hypothesis_id,
            }) + "\n")
    except OSError:
        pass
# #endregion

def check_toxicity(text: str) -> bool:
    """Returns True if toxic terms are found in the text."""
    text_lower = text.lower()
    return any(term in text_lower for term in TOXIC_TERMS)

def validate_input(user_query: str) -> Dict[str, Any]:
    """
    Validates user inputs before passing to the AI pipeline.
    Returns audit status: {'passed': bool, 'reason': str, 'sanitized_query': str}
    """
    # 1. SQL Injection Check
    if check_sql_injection(user_query):
        return {
            "passed": False,
            "reason": "Potential SQL Injection detected.",
            "sanitized_query": user_query,
            "details": "Input matched common database query injection patterns."
        }
    
    # 2. Prompt Injection Check
    if check_prompt_injection(user_query):
        return {
            "passed": False,
            "reason": "Potential Prompt Injection detected.",
            "sanitized_query": user_query,
            "details": "Input contains directives trying to override system prompts."
        }

    # 3. Domain Relevance Validation
    if not check_domain_relevance(user_query):
        # #region agent log
        _debug_guardrail_log(
            "guardrails.py:validate_input",
            "domain check failed",
            {
                "query_preview": user_query[:120],
                "sql_injection": check_sql_injection(user_query),
                "prompt_injection": check_prompt_injection(user_query),
                "expense_intent": bool(EXPENSE_INTENT_PATTERN.search(user_query)),
                "filing_context": bool(FILING_CONTEXT_PATTERN.search(user_query)),
            },
            "H1",
        )
        # #endregion
        return {
            "passed": False,
            "reason": "Off-topic query rejected.",
            "sanitized_query": user_query,
            "details": "The query is unrelated to financial filings, business risks, performance, or competitor analysis."
        }

    # 4. PII Detection and Masking
    masked_query = mask_pii(user_query)
    pii_found = masked_query != user_query

    return {
        "passed": True,
        "reason": "Input passed all validation checks." + (" (PII Masked)" if pii_found else ""),
        "sanitized_query": masked_query,
        "details": "No injections detected; domain validated; PII checked and masked if present."
    }

def validate_output(ai_response: str) -> Dict[str, Any]:
    """
    Validates AI outputs before sending to the client.
    Returns: {'passed': bool, 'reason': str, 'sanitized_response': str}
    """
    # 1. Toxicity Check
    if check_toxicity(ai_response):
        return {
            "passed": False,
            "reason": "Blocked toxic AI content.",
            "sanitized_response": "Response blocked: Generated content failed safety guidelines.",
            "details": "Output contained language flagged as toxic or abusive."
        }

    # 2. PII Detection and Masking
    masked_response = mask_pii(ai_response)
    pii_found = masked_response != ai_response

    return {
        "passed": True,
        "reason": "Output passed safety checks." + (" (PII Masked)" if pii_found else ""),
        "sanitized_response": masked_response,
        "details": "Toxicity check passed; PII checked and masked if present."
    }
