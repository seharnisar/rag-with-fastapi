from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, SystemMessage
from backend.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_llm(temperature: float = 0.3):
    return ChatOllama(
        model="llama3",
        base_url=settings.OLLAMA_BASE_URL,
        temperature=temperature,
        num_ctx=2048
    )


class NomicQueryEmbeddings(OllamaEmbeddings):
    def embed_query(self, text: str) -> list:
        return super().embed_query("search_query: " + text)


def get_user_vectorstore(user_id: int):
    embeddings = NomicQueryEmbeddings(
        model="nomic-embed-text",
        base_url=settings.OLLAMA_BASE_URL
    )
    return Chroma(
        collection_name=f"user_{user_id}",
        embedding_function=embeddings,
        persist_directory=settings.CHROMA_PATH
    )


async def rewrite_query(question: str, history: list) -> str:
    if not history:
        return question

    recent_history = history[-2:]
    history_text = ""
    for turn in recent_history:
        role = (turn.get("role") or "").strip().lower()
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        prefix = "User" if role == "user" else "Assistant"
        history_text += f"{prefix}: {content}\n"

    system = (
        "You are a query rewriting assistant. "
        "Given the LAST exchange in a conversation and a follow-up question, "
        "rewrite the follow-up into a single, self-contained search query "
        "by resolving pronouns like 'it', 'this', 'that' using only the most recent topic. "
        "If the follow-up is already self-contained, return it as-is. "
        "Output ONLY the rewritten query. No explanation, no quotes, no preamble."
    )

    user_msg = (
        f"Last exchange:\n{history_text}\n"
        f"Follow-up question: {question}\n\n"
        "Rewritten query:"
    )

    try:
        llm = get_llm(temperature=0.0)
        response = await llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=user_msg)
        ])
        rewritten = response.content.strip()
        if rewritten:
            logger.debug("Query rewrite: '%s' -> '%s'", question, rewritten)
            return rewritten
    except Exception as e:
        logger.warning("Query rewrite failed, falling back to original. Error: %s", e)

    return question


def format_docs(docs: list) -> str:
    if not docs:
        return "No relevant context found."
    return "\n\n---\n\n".join(
        f"[Source: {doc.metadata.get('source', 'unknown')}]\n{doc.page_content}"
        for doc in docs
    )


def format_history(history: list) -> str:
    if not history:
        return ""
    lines = []
    for turn in history[-8:]:
        role = (turn.get("role") or "").strip().lower()
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        prefix = "User" if role == "user" else "Assistant"
        lines.append(f"{prefix}: {content}")
    return "\n".join(lines)


prompt = ChatPromptTemplate.from_template("""
You are a helpful assistant that answers questions strictly based on the provided context.

Rules:
- Answer based on any relevant information found in the context, even if partial.
- Only say "This topic is not covered in your uploaded documents." if there is truly zero mention of the topic anywhere in the context.
- Do NOT pad the answer with unrelated information from the context.
- Do NOT explain other protocols or concepts just because they appear in the context.
- If multiple chunks cover different aspects of the topic, combine them into a complete answer.
- Use bullet points or numbered lists for clarity on technical concepts.
- Do NOT add filler phrases. Do NOT repeat the question.
- If the question is too vague, ask for clarification.
- Cite sources where relevant.

Context:
{context}

Chat history:
{history}

Question: {question}

Answer:
""")


def build_chain(user_id: int):
    vectorstore = get_user_vectorstore(user_id)

    retriever = vectorstore.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={
            "k": 5,
            "score_threshold": 0.3
        }
    )

    async def retrieve_docs(payload: dict) -> list:
        question = (payload.get("question") or "").strip()
        history = payload.get("history") or []
        search_query = await rewrite_query(question, history)
        docs = await retriever.ainvoke(search_query)
        logger.info("Retrieved %d docs for query: '%s'", len(docs), search_query)
        for i, doc in enumerate(docs):
            logger.info("Chunk %d: %s", i, doc.page_content[:150])
        return docs

    async def rag_chain(payload: dict):
        docs = await retrieve_docs(payload)
        chain_input = {
            "context": format_docs(docs),
            "history": format_history(payload.get("history") or []),
            "question": payload.get("question", ""),
        }
        chain = prompt | get_llm() | StrOutputParser()
        return chain.astream(chain_input)

    return rag_chain, retrieve_docs