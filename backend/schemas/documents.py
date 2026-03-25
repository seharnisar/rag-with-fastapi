from pydantic import BaseModel
from datetime import datetime


class DocumentUploadResponse(BaseModel):
    message: str
    document_id: int


class DocumentResponse(BaseModel):
    id: int
    filename: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentDeleteResponse(BaseModel):
    message: str