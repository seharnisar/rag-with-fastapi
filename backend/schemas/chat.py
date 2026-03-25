from pydantic import BaseModel
from typing import List, Literal, Optional


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    question: str
    history: Optional[List[ChatTurn]] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]


class DebugSearchResult(BaseModel):
    score: float
    preview: str