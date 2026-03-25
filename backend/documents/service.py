from backend.database.base import SessionLocal
from backend.documents.models import Document
from backend.enums import DocumentStatus
from backend.documents.ingestion import ingest_document


async def run_ingestion(file_path: str, user_id: int, doc_id: int):
    db = SessionLocal()
    try:
        await ingest_document(file_path, user_id)
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = DocumentStatus.READY
            db.commit()
        else:
            print(f"Ingestion error: doc_id {doc_id} not found in DB")
    except Exception as e:
        print(f"Ingestion error: {e}")
        db.rollback()
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = DocumentStatus.FAILED
            db.commit()
    finally:
        db.close()