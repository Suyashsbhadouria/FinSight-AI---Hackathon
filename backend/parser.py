import re
import os
from io import BytesIO
from typing import Dict, Any, List, Tuple
from pypdf import PdfReader

# Regex patterns to find sections
SECTION_PATTERNS = {
    "Business Overview": re.compile(r'\bITEM\s+1\.?\s+BUSINESS\b', re.IGNORECASE),
    "Risk Factors": re.compile(r'\bITEM\s+1A\.?\s+RISK\s+FACTORS\b', re.IGNORECASE),
    "Legal Proceedings": re.compile(r'\bITEM\s+3\.?\s+LEGAL\s+PROCEEDINGS\b', re.IGNORECASE),
    "MD&A": re.compile(r'\bITEM\s+7\.?\s+MANAGEMENT\'S\s+DISCUSSION\s+AND\s+ANALYSIS\b|\bITEM\s+7\.?\s+MD\s*&\s*A\b', re.IGNORECASE),
    "Market Risk": re.compile(r'\bITEM\s+7A\.?\s+QUANTITATIVE\s+AND\s+QUALITATIVE\s+DISCLOSURES\s+ABOUT\s+MARKET\s+RISK\b', re.IGNORECASE),
    "Financial Statements": re.compile(r'\bITEM\s+8\.?\s+FINANCIAL\s+STATEMENTS\b', re.IGNORECASE)
}

def clean_text(text: str) -> str:
    """Removes double spaces and weird character encodings."""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_filing_pdf(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Extracts text page by page from the given file bytes and structures it into sections.
    """
    print(f"[Parser] Reading PDF '{filename}' ({len(file_bytes)} bytes)...")
    reader = PdfReader(BytesIO(file_bytes))
    num_pages = len(reader.pages)
    print(f"[Parser] PDF has {num_pages} pages.")

    # 1. Extract text and track page numbers
    page_texts: List[Tuple[int, str]] = []
    full_text = ""
    for idx, page in enumerate(reader.pages):
        page_num = idx + 1
        txt = page.extract_text() or ""
        page_texts.append((page_num, txt))
        full_text += f"\n--- PAGE {page_num} ---\n" + txt

    # 2. Extract company name if possible
    company_name = "Unknown Corp"
    # Search first few pages for standard "UNITED STATES SECURITIES AND EXCHANGE COMMISSION" and the line below it
    first_pages_text = "".join([pt[1] for pt in page_texts[:5]])
    # Try finding something like "Commission File Number ... \n [Company Name]"
    name_match = re.search(r'(?:COMMISSION\s+FILE\s+NUMBER.*?)\n\s*([A-Z\s,.]+?)(?:\n|Inc\.|Co\.|Corp\.)', first_pages_text, re.IGNORECASE)
    if name_match:
        company_name = clean_text(name_match.group(1))
    else:
        # Fallback search for common titles
        m = re.search(r'\b([A-Z][A-Za-z0-9\s,&.]{3,50}\s+(?:Corporation|Corp\.|Incorporated|Inc\.|Company|Co\.|Ltd\.))\b', first_pages_text)
        if m:
            company_name = m.group(1)

    print(f"[Parser] Detected Company Name: {company_name}")

    # 3. Identify section boundaries by searching through pages
    # We want to map: Section -> start_page and end_page
    section_pages: Dict[str, List[int]] = {}
    found_matches: List[Dict[str, Any]] = []

    for page_num, text in page_texts:
        for section_name, pattern in SECTION_PATTERNS.items():
            matches = list(pattern.finditer(text))
            if matches:
                # Store the page where it was found
                found_matches.append({
                    "section": section_name,
                    "page": page_num,
                    "index": matches[0].start()
                })

    # Sort found matches by page number
    found_matches = sorted(found_matches, key=lambda x: x["page"])

    # Eliminate duplicates of the same section, keeping the first occurrence (usually the Table of Contents or first mention)
    # Actually Table of Contents matches are common, we usually want the second match if the first match is in the first 5 pages and there is a subsequent match.
    # Let's filter out matches in the Table of Contents (usually first 10% of pages) if there's a match later.
    final_section_starts: Dict[str, int] = {}
    for match in found_matches:
        sec = match["section"]
        page = match["page"]
        
        # If we already have a start page for this section:
        if sec in final_section_starts:
            # If the original match was on a very early page (likely Table of Contents) and this new match is later, update it
            if final_section_starts[sec] <= 10 and page > 10:
                final_section_starts[sec] = page
        else:
            final_section_starts[sec] = page

    # Reconstruct text sections based on these starting pages
    sorted_starts = sorted(final_section_starts.items(), key=lambda x: x[1])
    
    sections_content: Dict[str, str] = {}
    
    # If no sections were found, partition text evenly or place everything under 'Other'
    if not sorted_starts:
        sections_content["Other"] = full_text
    else:
        # Extract slices of pages
        for i in range(len(sorted_starts)):
            sec_name, start_page = sorted_starts[i]
            # End page is start page of next section, or last page
            end_page = sorted_starts[i+1][1] - 1 if i + 1 < len(sorted_starts) else num_pages
            
            # Extract text for this range
            sec_text = ""
            for p_num, p_txt in page_texts:
                if start_page <= p_num <= end_page:
                    sec_text += f"\n[Page {p_num}]\n" + p_txt
            
            sections_content[sec_name] = sec_text

        # Capture any text before the first section as "Intro / Overview"
        first_start = sorted_starts[0][1]
        if first_start > 1:
            intro_text = ""
            for p_num, p_txt in page_texts:
                if p_num < first_start:
                    intro_text += f"\n[Page {p_num}]\n" + p_txt
            sections_content["General Information"] = intro_text

    # Standardize empty sections
    for sec_name in SECTION_PATTERNS.keys():
        if sec_name not in sections_content:
            sections_content[sec_name] = f"Section '{sec_name}' could not be located in the uploaded filing document."

    return {
        "filename": filename,
        "company_name": company_name,
        "total_pages": num_pages,
        "sections": sections_content,
        "section_mapping": final_section_starts,
        "pages": [{"page_num": p_num, "text": p_txt} for p_num, p_txt in page_texts]
    }
