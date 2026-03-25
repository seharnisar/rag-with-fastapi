import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime
from backend.database.base import get_db
from backend.auth.service import get_current_user
from backend.auth.models import User
from backend.documents.models import Document
from backend.enums import DocumentStatus
from backend.documents.service import run_ingestion
from backend.documents.ingestion import get_user_vectorstore
from backend.config import settings
from backend.schemas import DocumentUploadResponse, DocumentResponse, DocumentDeleteResponse

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", status_code=201, response_model=DocumentUploadResponse)
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
        status=DocumentStatus.PROCESSING
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(run_ingestion, file_path, current_user.id, doc.id)

    return DocumentUploadResponse(message="File uploaded, processing started", document_id=doc.id)


@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    return docs


@router.delete("/{doc_id}", response_model=DocumentDeleteResponse)
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

    # Delete from Chroma
    try:
        vectorstore = get_user_vectorstore(current_user.id)
        collection = vectorstore._collection
        collection.delete(where={"source": doc.filename})
    except Exception as e:
        print(f"Chroma cleanup error: {e}")

    # Delete file from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    db.delete(doc)
    db.commit()
    return DocumentDeleteResponse(message="Document deleted")
    