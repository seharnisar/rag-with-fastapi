from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, SystemMessage
from backend.config import settings
import logging

logger = logging.getLogger(__name__)


def get_llm(temperature: float = 0.3):
    return ChatOllama(
        model="llama3",
        base_url=settings.OLLAMA_BASE_URL,
        temperature=temperature
    )


class NomicQueryEmbeddings(OllamaEmbeddings):
    """
    Wraps OllamaEmbeddings to prepend search_query: prefix at query time.
    Keeps stored chunk text clean — prefix only applied during embedding.
    """
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


def rewrite_query(question: str, history: list) -> str:
    """
    Use LLM to rewrite the question into a self-contained search query
    using conversation history. Falls back to original on failure.
    """

    if not history:
        return question

    # Only use the last 2 turns (1 user + 1 assistant) to avoid
    # the LLM grabbing context from earlier unrelated topics
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
        response = llm.invoke([
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


def build_chain(user_id: int):
    vectorstore = get_user_vectorstore(user_id)

    retriever = vectorstore.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={
        "k": 8,
        "score_threshold": 0.3
    }
)

    prompt = ChatPromptTemplate.from_template("""
You are a helpful assistant that answers questions strictly based on the provided context.

Rules:
- Read the context carefully. Only answer if the context DIRECTLY discusses the topic in the question.
- If the context contains related but different topics, do NOT use them to answer. Say: "This topic is not covered in your uploaded documents."
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

    def retrieve_docs(payload: dict) -> list:
        question = (payload.get("question") or "").strip()
        history = payload.get("history") or []
        search_query = rewrite_query(question, history)
        docs = retriever.invoke(search_query)
        logger.debug("Retrieved %d docs for query: '%s'", len(docs), search_query)
        return docs

    chain = (
        {
            "context": lambda payload: format_docs(retrieve_docs(payload)),
            "history": lambda payload: format_history(payload.get("history") or []),
            "question": lambda payload: payload.get("question", ""),
        }
        | prompt
        | get_llm()
        | StrOutputParser()
    )

    return chain, retrieve_docs