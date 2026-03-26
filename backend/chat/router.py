from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Literal, Optional

from backend.database.base import get_db
from backend.auth.service import get_current_user
from backend.auth.models import User
from backend.documents.models import Document
from backend.chat.rag import build_chain, format_docs
from backend.chat.service import get_ready_doc_or_raise
from backend.schemas import ChatTurn, ChatRequest, ChatResponse, DebugSearchResult


router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_ready_doc_or_raise(current_user.id, db)

    payload = {
        "question": request.question,
        "history": [t.model_dump() for t in (request.history or [])]
    }

    rag_chain, retrieve_docs = build_chain(user_id=current_user.id)

    source_docs = await retrieve_docs(payload)
    sources = list(set([
        doc.metadata.get("source", "unknown") for doc in source_docs
    ]))

    stream = await rag_chain(payload)
    chunks = []
    async for chunk in stream:
        chunks.append(chunk)
    answer = "".join(chunks)

    return ChatResponse(answer=answer, sources=sources)


@router.get("/debug_search", response_model=List[DebugSearchResult])
def debug_search(q: str, current_user: User = Depends(get_current_user)):
    from backend.chat.rag import get_user_vectorstore
    vectorstore = get_user_vectorstore(current_user.id)
    docs = vectorstore.similarity_search_with_score("search_query: " + q, k=6)
    return [
        DebugSearchResult(score=round(score, 4), preview=doc.page_content[:200])
        for doc, score in docs
    ]


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_ready_doc_or_raise(current_user.id, db)

    rag_chain, retrieve_docs = build_chain(user_id=current_user.id)

    async def token_generator():
        payload = {
            "question": request.question,
            "history": [t.model_dump() for t in (request.history or [])]
        }
        stream = await rag_chain(payload)
        async for chunk in stream:
            yield chunk
            await asyncio.sleep(0)

    return StreamingResponse(token_generator(), media_type="text/plain")
    