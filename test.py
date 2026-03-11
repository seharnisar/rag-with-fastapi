from backend.documents.ingestion import get_user_vectorstore

vectorstore = get_user_vectorstore(1)
results = vectorstore.similarity_search("SSH Telnet", k=5)
for r in results:
    print(r.page_content[:300])
    print("---")

import chromadb
client = chromadb.PersistentClient(path="/Users/mc/Downloads/Rag-bot/chroma_db")
for col in client.list_collections():
    print(col.name, col.count())


results = vectorstore.similarity_search_with_score("SSH Telnet protocol", k=10)
for doc, score in results:
    print(f"Score: {score:.3f} | Source: {doc.metadata.get('source')} | {doc.page_content[:150]}")
    print("---")