from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database.base import Base, engine
from backend.auth.router import router as auth_router
from backend.documents.router import router as documents_router
from backend.chat.router import router as chat_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="RAG Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(chat_router)

@app.get("/")
def health_check():
    return {"status": "ok"}