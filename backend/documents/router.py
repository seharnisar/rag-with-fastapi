import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session

from backend.database.base import get_db, SessionLocal  # FIX: import SessionLocal
from backend.auth.router import get_current_user
from backend.auth.models import User
from backend.documents.models import Document
from backend.documents.ingestion import ingest_document
from backend.config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])


# FIX: Create a fresh DB session inside the background task.
# The session passed from the request handler is closed by FastAPI
# before the background task runs, causing silent ingestion failures
# that leave documents stuck in "processing" status forever.
def run_ingestion(file_path: str, user_id: int, doc_id: int):
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


@router.post("/upload", status_code=201)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    user_upload_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_upload_dir, exist_ok=True)
    file_path = os.path.join(user_upload_dir, file.filename)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    doc = Document(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        status="processing"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # FIX: Don't pass `db` — background task creates its own session
    background_tasks.add_task(run_ingestion, file_path, current_user.id, doc.id)

    return {"message": "File uploaded, processing started", "document_id": doc.id}


@router.get("/")
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    return docs


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}