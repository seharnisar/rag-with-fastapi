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
from backend.chat.rag import build_chain
from backend.chat.service import get_ready_doc_or_raise

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    question: str
    history: Optional[List[ChatTurn]] = None


@router.post("/")
def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_ready_doc_or_raise(current_user.id, db)

    payload = {
        "question": request.question,
        "history": [t.model_dump() for t in (request.history or [])]
    }

    chain, retrieve_docs = build_chain(user_id=current_user.id)

    source_docs = retrieve_docs(payload)
    sources = list(set([
        doc.metadata.get("source", "unknown") for doc in source_docs
    ]))

    answer = chain.invoke(payload)

    return {
        "answer": answer,
        "sources": sources
    }


@router.get("/debug/search")
def debug_search(q: str, current_user: User = Depends(get_current_user)):
    from backend.chat.rag import get_user_vectorstore
    vectorstore = get_user_vectorstore(current_user.id)
    docs = vectorstore.similarity_search_with_score("search_query: " + q, k=6)
    return [
        {"score": round(score, 4), "preview": doc.page_content[:200]}
        for doc, score in docs
    ]
    
@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_ready_doc_or_raise(current_user.id, db)

    chain, _ = build_chain(user_id=current_user.id)

    async def token_generator():
        payload = {
            "question": request.question,
            "history": [t.model_dump() for t in (request.history or [])]
        }
        async for chunk in chain.astream(payload):
            yield chunk
            await asyncio.sleep(0)

    return StreamingResponse(token_generator(), media_type="text/plain")
