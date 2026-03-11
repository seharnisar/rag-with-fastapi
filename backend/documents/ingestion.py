import os
import re
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma
from backend.config import settings
from typing import List
import logging

logger = logging.getLogger(__name__)

# Patterns that indicate a chunk is junk (cover, TOC, publisher metadata)
JUNK_PATTERNS = [
    r"^M\s*A\s*N\s*N\s*I\s*N\s*G",
    r"IN ACTION\s*$",
    r"^Christopher M\. Bishop",
    r"Pattern Recognition and\s*Machine Learning",
    r"Information Science and Statistics",
    r"Series Editors",
    r"^\s*Second\s*Edition\s*$",
    r"^\s*Introduction\s*to\s*Machine\s*Learning",
]
JUNK_RE = re.compile("|".join(JUNK_PATTERNS), re.IGNORECASE | re.MULTILINE)

TOC_KEYWORDS = [
    "table of contents",
    "contents\n",
    "preface\n",
    "bibliography\n",
    "index\n",
    "appendix\n",
    "list of figures",
    "list of tables",
]


def is_junk_chunk(text: str) -> bool:
    text = text.strip()

    if len(text) < 50:
        logger.debug("FILTERED (too short): %s", text[:80])
        return True

    if JUNK_RE.search(text):
        logger.debug("FILTERED (junk pattern): %s", text[:80])
        return True

    # Looks like a TOC — lots of short lines with dots/numbers
    lines = text.splitlines()
    dot_lines = sum(1 for l in lines if re.search(r"\.{3,}|\s{2,}\d+$", l))
    if len(lines) > 3 and dot_lines / max(len(lines), 1) > 0.4:
        logger.debug("FILTERED (TOC dots): %s", text[:80])
        return True

    if any(kw in text.lower() for kw in TOC_KEYWORDS):
        logger.debug("FILTERED (TOC keyword): %s", text[:80])
        return True

    # FIX: Lowered from 0.4 → 0.25 — technical networking content has lots of
    # acronyms (ATM, LAN, SMTF), numbers, and punctuation that lower alpha ratio
    alpha_ratio = sum(c.isalpha() for c in text) / max(len(text), 1)
    if alpha_ratio < 0.25:
        logger.debug("FILTERED (low alpha %.2f): %s", alpha_ratio, text[:80])
        return True

    return False


class NomicDocumentEmbeddings(OllamaEmbeddings):
    """
    Wraps OllamaEmbeddings to prepend 'search_document:' prefix at ingest time.
    Query-side prefix ('search_query:') is applied separately in rag.py.
    """
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        prefixed = ["search_document: " + t for t in texts]
        return super().embed_documents(prefixed)


def get_user_vectorstore(user_id: int):
    embeddings = NomicDocumentEmbeddings(
        model="nomic-embed-text",
        base_url=settings.OLLAMA_BASE_URL
    )
    return Chroma(
        collection_name=f"user_{user_id}",
        embedding_function=embeddings,
        persist_directory=settings.CHROMA_PATH
    )


def looks_like_front_matter(text: str) -> bool:
    """
    Heuristic to detect cover/TOC pages so we can skip them
    without a hard-coded page count.
    """
    text_lower = text.lower().strip()
    front_matter_signals = [
        "table of contents",
        "all rights reserved",
        "isbn",
        "published by",
        "copyright ©",
        "www.",
        "printed in",
    ]
    signal_hits = sum(1 for s in front_matter_signals if s in text_lower)
    # Also flag very short pages (covers, blank pages)
    if len(text.strip()) < 150:
        return True
    return signal_hits >= 2


def ingest_document(file_path: str, user_id: int):
    loader = PyMuPDFLoader(file_path)
    pages = loader.load()

    # FIX: Replace hard-coded pages[5:] with content-based front matter detection
    pages = [p for p in pages if not looks_like_front_matter(p.page_content)]
    logger.info("After front-matter filtering: %d pages remaining", len(pages))

    # FIX: Larger chunk_size (800) fits full concept explanations in one chunk.
    #      Reduced overlap (150) avoids excessive duplication while still
    #      preserving cross-boundary context.
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        separators=["\n\n", "\n", ".", "!", "?", " "]
    )
    chunks = splitter.split_documents(pages)

    before = len(chunks)
    chunks = [c for c in chunks if not is_junk_chunk(c.page_content)]
    after = len(chunks)
    logger.info(
        "Ingestion: %d chunks after filtering (removed %d junk chunks)",
        after, before - after
    )

    for chunk in chunks:
        chunk.metadata["user_id"] = str(user_id)
        chunk.metadata["source"] = os.path.basename(file_path)

    vectorstore = get_user_vectorstore(user_id)

    batch_size = 500
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        vectorstore.add_documents(batch)
        logger.info(
            "Ingested batch %d/%d",
            i // batch_size + 1,
            -(-len(chunks) // batch_size)
        )

    logger.info(
        "Ingestion complete: %d chunks stored for user %d", after, user_id
    )