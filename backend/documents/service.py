from sqlalchemy.orm import Session
from backend.database.base import SessionLocal
from backend.documents.models import Document
from backend.documents.ingestion import ingest_document


def run_ingestion(file_path: str, user_id: int, doc_id: int):
    """
    Background task for document ingestion.
    Creates fresh DB session to avoid connection issues.
    """
    db = SessionLocal()
    try:
        ingest_document(file_path, user_id)
        doc = db.query(Document).filter(Document.id == doc_id).first()
        doc.status = "ready"
        db.commit()
    except Exception as e:
        print(f"Ingestion error: {e}")
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "failed"
            db.commit()
    finally:
        db.close()
