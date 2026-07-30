import re

def mask_pii(text: str) -> str:
    """
    Masks sensitive data (SSN, credit cards, emails, phone numbers) 
    before storing or sending to external LLM providers.
    """
    if not text:
        return text
        
    # Mask Social Security Numbers (SSN): XXX-XX-XXXX
    text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED SSN]', text)
    
    # Mask Credit Cards: 13-19 digits with optional spaces/hyphens
    text = re.sub(r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b', '[REDACTED CARD]', text)
    
    # Mask Email Addresses
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[REDACTED EMAIL]', text)
    
    # Mask Phone Numbers: general US formatted numbers
    text = re.sub(r'\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b', '[REDACTED PHONE]', text)
    
    return text
