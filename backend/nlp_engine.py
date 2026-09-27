import re
import logging
import torch
from transformers import AutoTokenizer, AutoModelForTokenClassification, AutoModelForSequenceClassification
from typing import List, Dict, Any

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NLPEngine:
    def __init__(self, model_path=None):
        logger.info("Initializing Deterministic Regex Extraction Engine...")

    def process_fir_text(self, text: str) -> Dict[str, Any]:
        # 1. Isolate Sections
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        
        # 2. Complainant Name & Contact (PATCHED)
        plaintiffs = []
        comp_phone = None
        # Added Dr. and Contact to boundaries. Made title matching optional but robust.
        comp_match = re.search(r'(?:Complainant|Informant)\s*[:\-]?\s*(?:Shri\s+|Mr\.\s+|Mrs\.\s+|Ms\.\s+|Dr\.\s+)?([A-Za-z\s\.]+?)(?:,|\s+S/O|\s+D/O|\s+R/O|\s+Phone|\s+Contact|\n|$)', text, re.IGNORECASE)
        if comp_match:
            p_name = comp_match.group(1).strip()
            if len(p_name) > 2:
                plaintiffs.append(p_name)
                
        comp_phone_match = re.search(r'(?:Complainant|Informant).*?(?:Phone|Contact)\s*[:\-]?\s*(?:\+91[\-\s]?)?([6-9]\d{9})', text, re.IGNORECASE | re.DOTALL)
        if comp_phone_match:
            comp_phone = comp_phone_match.group(1)

        # 3. Suspect Names (PATCHED)
        suspects = []
        accused_match = re.search(r'(?:Accused|Suspect|Aaropi)\s*Name\s*[:\-]?\s*([A-Za-z\s\.]+?)(?:\s*\(|\s*,|\s*\n|$)', text, re.IGNORECASE)
        if accused_match:
            s_name = accused_match.group(1).strip()
            if len(s_name) > 2:
                suspects.append(s_name)
        else:
            # Strict capitalization matching to prevent sentence bleed (e.g. stops at lowercase "regarding")
            intro_match = re.search(r'(?:introduced himself as|calling as|named)\s*[\"\']?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})[\"\']?', text)
            if intro_match:
                suspects.append(intro_match.group(1).strip())

        # 4. Suspect Phone Numbers (Strict 10 digits, exclude complainant)
        all_phones = re.findall(r'(?<!\d)(?:(?:\+91[\-\s]?)?|0)?([6-9]\d{9})(?!\d)', text)
        phone_anchors = []
        
        accused_phone_match = re.search(r'(?:Accused|Suspect)\s*Phone\s*[:\-]?\s*([0-9\s,\+]+)', text, re.IGNORECASE)
        if accused_phone_match:
            extracted = re.findall(r'(?<!\d)([6-9]\d{9})(?!\d)', accused_phone_match.group(1))
            phone_anchors.extend(extracted)
            
        for p in all_phones:
            if p != comp_phone and p not in phone_anchors:
                phone_anchors.append(p)

        # 5. Financial Anchors (DO NOT ATTACH PHONES TO IFSC)
        # Strictly find ONE bank account number
        financial_anchors = []
        acc_match = re.search(r'(?:Bank\s*Account(?:\s*Number)?|A/C\s*(?:No\.?)?|Account\s*Number)\s*[:\-]?\s*(\d{9,18})\b', text, re.IGNORECASE)
        ifsc_match = re.search(r'\b([A-Z]{4}0[A-Z0-9]{6})\b', text, re.IGNORECASE)
        bank_match = re.search(r'\b(HDFC|SBI|State Bank of India|ICICI|Axis|PNB|Kotak|Bank of Baroda)\b', text, re.IGNORECASE)
        
        if acc_match:
            acc_num = acc_match.group(1).strip()
            ifsc_code = ifsc_match.group(1).upper() if ifsc_match else "UNKNOWN_IFSC"
            bank_name = bank_match.group(1) if bank_match else "Bank"
            # Consolidated Anchor representation
            financial_anchors.append(f"{acc_num}@{ifsc_code} ({bank_name})")

        # 6. Vehicle Anchors
        vehicle_anchors = []
        veh_match = re.search(r'\b([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4})\b', text, re.IGNORECASE)
        if veh_match:
            clean_veh = re.sub(r'[-\s]', '', veh_match.group(1)).upper()
            vehicle_anchors.append(clean_veh)

        # 7. Case Summary
        summary = "Financial fraud / extortion complaint"
        inc_match = re.search(r'Incident Details\s*:\s*(.*?)(?=\n\n|\n[A-Z][a-z]+\s*:|$)', text, re.IGNORECASE | re.DOTALL)
        if inc_match:
            summary = inc_match.group(1).strip()[:180] + "..."

        return {
            "case_summary": summary,
            "identified_suspects": list(dict.fromkeys(suspects)),
            "identified_plaintiffs": list(dict.fromkeys(plaintiffs)),
            "phone_anchors": list(dict.fromkeys(phone_anchors)),
            "financial_anchors": list(dict.fromkeys(financial_anchors)),
            "vehicle_anchors": list(dict.fromkeys(vehicle_anchors))
        }
