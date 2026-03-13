from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma
from typing import List

class NomicQueryEmbeddings(OllamaEmbeddings):
    def embed_query(self, text: str) -> list:
        return super().embed_query("search_query: " + text)

embeddings = NomicQueryEmbeddings(
    model="nomic-embed-text",
    base_url="http://localhost:11434"
)

vectorstore = Chroma(
    collection_name="user_1",
    embedding_function=embeddings,
    persist_directory="./chroma_db"
)

collection = vectorstore._collection
print("Total chunks:", collection.count())

text = """9.3 Multimedia Applications
661
Figure 9.9
User interface of a vat audioconference.
Before we look at RTP in detail, it will help to consider some of the applications that might use it."""

alpha_ratio = sum(c.isalpha() for c in text) / max(len(text), 1)
print(f"Alpha ratio: {alpha_ratio:.2f}")
