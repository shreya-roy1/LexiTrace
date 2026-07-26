import os
import re

_nli_pipeline = None

def load_nli_threshold() -> float:
    """
    Loads the NLI entailment threshold from config.yaml.
    Defaults to 0.75 if the file does not exist, cannot be read,
    or does not contain a valid threshold.
    """
    threshold = 0.75
    # Look in the backend folder and parent/root workspace folders
    paths = [
        os.path.join(os.path.dirname(__file__), "config.yaml"),
        "config.yaml",
        "backend/config.yaml"
    ]
    for path in paths:
        if os.path.exists(path):
            try:
                # Try parsing using PyYAML if installed
                try:
                    import yaml
                    with open(path, "r") as f:
                        config = yaml.safe_load(f)
                    if config:
                        # Check nested production structure first
                        nested_threshold = config.get("pipeline", {}).get("citation_verification", {}).get("threshold")
                        if nested_threshold is not None:
                            threshold = float(nested_threshold)
                            print(f"Loaded NLI threshold from nested YAML config ({path}): {threshold}")
                            return threshold
                        # Fallback to flat structure
                        if "nli_threshold" in config:
                            threshold = float(config["nli_threshold"])
                            print(f"Loaded NLI threshold from flat YAML config ({path}): {threshold}")
                            return threshold
                except ImportError:
                    pass
                
                # Fallback simple regex parsing to avoid dependency on PyYAML
                with open(path, "r") as f:
                    content = f.read()
                
                # Try locating threshold under citation_verification block first
                citation_block = re.search(r'citation_verification\s*:\s*\n((?:\s+.*\n?)*)', content)
                if citation_block:
                    block_content = citation_block.group(1)
                    match = re.search(r'threshold\s*:\s*([\d\.]+)', block_content)
                    if match:
                        threshold = float(match.group(1))
                        print(f"Loaded NLI threshold from regex citation_verification block ({path}): {threshold}")
                        return threshold
                
                # Fallback to flat threshold check
                match = re.search(r'(?:nli_threshold|threshold)\s*:\s*([\d\.]+)', content)
                if match:
                    threshold = float(match.group(1))
                    print(f"Loaded NLI threshold from regex fallback ({path}): {threshold}")
                    return threshold
            except Exception as e:
                print(f"Warning: Failed to load config from {path}: {e}")
                
    return threshold


def get_nli_pipeline():
    """
    Lazy loads the NLI classifier pipeline.
    Falls back to None if model fails to load (e.g. offline, cuda issues).
    """
    global _nli_pipeline
    if _nli_pipeline is None:
        try:
            from transformers import pipeline
            print("Loading HuggingFace NLI model: cross-encoder/nli-deberta-v3-base...")
            # Load with device -1 (CPU) by default, or 0 if CUDA is active.
            import torch
            device = 0 if torch.cuda.is_available() else -1
            _nli_pipeline = pipeline(
                "text-classification", 
                model="cross-encoder/nli-deberta-v3-base", 
                device=device
            )
            print("NLI model loaded successfully.")
        except Exception as e:
            print(f"Warning: Could not load NLI model ({e}). Proceeding with heuristic citation verification.")
            _nli_pipeline = False
            
    return _nli_pipeline if _nli_pipeline is not False else None

def heuristic_entailment_check(premise: str, hypothesis: str) -> bool:
    """
    Fallback checking when NLI model is unavailable.
    Checks word overlap (ignoring common stopwords) and number matching.
    """
    # Lowercase and clean words
    p_words = set(re.findall(r'\b\w+\b', premise.lower()))
    h_words = re.findall(r'\b\w+\b', hypothesis.lower())
    
    if not h_words:
        return True
        
    stopwords = {"the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "of", "in", "on", "at", "for", "with"}
    h_filtered = [w for w in h_words if w not in stopwords]
    
    # 1. Match numbers strictly. If a number in the hypothesis is NOT in the premise, it's not entailed.
    h_numbers = re.findall(r'\b\d+(?:\.\d+)?\b', hypothesis)
    p_numbers = re.findall(r'\b\d+(?:\.\d+)?\b', premise)
    for num in h_numbers:
        if num not in p_numbers:
            return False
            
    # 2. Check overlap ratio for non-stopwords
    if not h_filtered:
        return True
    match_count = sum(1 for w in h_filtered if w in p_words)
    overlap_ratio = match_count / len(h_filtered)
    
    # If 70% of non-stopwords in the hypothesis are present in the premise, we assume entailment
    return overlap_ratio >= 0.70

def verify_citations(llm_response: str, context_docs: list[dict]) -> str:
    """
    Parses LLM response, extracts sentences with citations like [Doc X],
    verifies them against the corresponding source chunk in context_docs.
    Appends [⚠️ Citation Unverified] if the claim is not supported.
    """
    if not llm_response:
        return llm_response
        
    # Split text into sentences using simple regex
    sentences = re.split(r'(?<=[.!?])\s+', llm_response)
    verified_sentences = []
    
    nli = get_nli_pipeline()
    
    for sentence in sentences:
        # Find all citations in this sentence like [Doc 1], [Doc 2], etc.
        citations = re.findall(r'\[Doc\s+(\d+)\]', sentence)
        
        if not citations:
            verified_sentences.append(sentence)
            continue
            
        # Strip citation tokens to get the clean claim
        clean_claim = re.sub(r'\[Doc\s+\d+\]', '', sentence).strip()
        
        # Track which citations fail verification
        failed_citations = []
        
        for cit_str in citations:
            doc_idx = int(cit_str) - 1 # 1-based indexing for documents
            
            if doc_idx < 0 or doc_idx >= len(context_docs):
                # Out of bounds doc index -> unverified
                failed_citations.append(cit_str)
                continue
                
            doc = context_docs[doc_idx]
            # Handle list of dict or Qdrant points depending on format
            if isinstance(doc, dict):
                premise = doc.get("payload", {}).get("text", doc.get("text", ""))
            else:
                # Qdrant Hit or Point
                premise = getattr(doc, "payload", {}).get("text", "")
                
            # Perform verification
            is_entailed = False
            if nli is not None:
                try:
                    # nli-deberta-v3-base outputs label 'entailment', 'neutral', or 'contradiction'
                    res = nli({"text": premise, "text_pair": clean_claim})
                    if isinstance(res, list):
                        res = res[0]
                    # Let's check label. If the model outputs standard class labels:
                    label = res['label'].lower()
                    score = res['score']
                    
                    threshold = load_nli_threshold()
                    if label == 'entailment' and score >= threshold:
                        is_entailed = True
                    elif 'label_0' in label or 'label_1' in label or 'label_2' in label:
                        # Some versions output LABEL_0, LABEL_1, etc.
                        # Usually: Label 0 = entailment, Label 1 = neutral, Label 2 = contradiction
                        # If label is LABEL_0 (entailment) and score >= threshold
                        if '0' in label and score >= threshold:
                            is_entailed = True
                except Exception as e:
                    print(f"NLI model inference error: {e}. Falling back to heuristic.")
                    is_entailed = heuristic_entailment_check(premise, clean_claim)
            else:
                is_entailed = heuristic_entailment_check(premise, clean_claim)
                
            if not is_entailed:
                failed_citations.append(cit_str)
                
        # Modify sentence: insert warning marker after failed citations
        mod_sentence = sentence
        for failed in set(failed_citations):
            # Replace [Doc X] with [Doc X][⚠️ Citation Unverified]
            target = f"[Doc {failed}]"
            replacement = f"{target}[⚠️ Citation Unverified]"
            mod_sentence = mod_sentence.replace(target, replacement)
            
        verified_sentences.append(mod_sentence)
        
    return " ".join(verified_sentences)

if __name__ == "__main__":
    # Test verifier
    docs = [
        {"text": "LexiTrace was founded in 2024 by expert AI researchers and specializes in document verification systems."},
        {"text": "In the third quarter, LexiTrace's profits rose by 15% due to new enterprise automation products."}
    ]
    
    test_response = "LexiTrace was founded in 2024 [Doc 1]. In Q3, profits went up by 15% [Doc 2]. However, profits rose by 50% [Doc 2]."
    
    print("Testing verification:")
    print("Original:", test_response)
    print("Verified:", verify_citations(test_response, docs))
