from fastapi import HTTPException
from sqlalchemy.orm import Session
from backend.documents.models import Document


def get_ready_doc_or_raise(user_id: int, db: Session):
    """
    Check that user has at least one ready document.
    Raises HTTPException if no ready documents found.
    """
    doc = db.query(Document).filter(
        Document.user_id == user_id,
        Document.status == "ready"
    ).first()
    if not doc:
        raise HTTPException(
            status_code=400,
            detail="No documents ready. Please upload a PDF first."
        )
    return doc
