"""
gasckk_memory.py
================
Persistent user-memory layer for GASCKK Academic AI.
Uses  mem0ai  (v2.x)  +  Chroma vector store (local)
     +  Groq LLM (gpt-oss-20b)
     +  HuggingFace Embeddings (all-MiniLM-L6-v2)

Key public functions
--------------------
save_memory(user_email, user_text, bot_text)  → None
recall_memories(user_email, query)            → str  (formatted for prompt)
get_all_memories(user_email)                  → list[dict]
delete_all_memories(user_email)               → None
"""

import os
import sys

# UTF-8 stdout on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ── Suppress noisy warnings at import time ──────────────────────────────────
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

# ── Configuration ───────────────────────────────────────────────────────────
GROQ_API_KEY  = "your_groq_api_key_here"
CHROMA_PATH   = "./gasckk_mem0_chroma"
COLLECTION    = "gasckk_user_memories"
# llama-3.1-8b-instant: 20,000 TPM on Groq free tier (mem0 extraction needs ~8100 tokens)
GROQ_MODEL    = "llama-3.1-8b-instant"
EMBED_MODEL   = "sentence-transformers/all-MiniLM-L6-v2"

MEM0_CONFIG = {
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": COLLECTION,
            "path": CHROMA_PATH,
        },
    },
    "llm": {
        "provider": "groq",
        "config": {
            "model": GROQ_MODEL,
            "api_key": GROQ_API_KEY,
            "temperature": 0.1,
            "max_tokens": 512,
        },
    },
    "embedder": {
        "provider": "huggingface",
        "config": {
            "model": EMBED_MODEL,
        },
    },
}

# ── Lazy-initialise the Memory singleton ───────────────────────────────────
_memory = None


def _get_memory():
    """Return (and lazily initialise) the global Memory instance."""
    global _memory
    if _memory is not None:
        return _memory
    try:
        from mem0 import Memory  # type: ignore
        _memory = Memory.from_config(MEM0_CONFIG)
        print("✅ mem0 Memory layer initialised successfully.")
    except Exception as exc:
        print(f"⚠️  mem0 Memory layer failed to initialise: {exc}")
        _memory = None
    return _memory


# ── Public helpers ──────────────────────────────────────────────────────────

def save_memory(user_email: str, user_text: str, bot_text: str) -> None:
    """
    Extract and persist a memory from the latest user↔bot exchange.

    We combine both sides of the conversation so mem0 can pull out
    facts about the user (name, course, preferences, past questions, etc.).
    """
    m = _get_memory()
    if m is None:
        return
    # Only save if there's something meaningful
    combined = f"User: {user_text.strip()}\nAssistant: {bot_text.strip()}"
    try:
        m.add(combined, user_id=user_email)
    except Exception as exc:
        # Never let memory errors propagate to the main chat flow
        print(f"⚠️  mem0 save_memory error: {exc}")


# ── Cached ChromaDB Singletons ───────────────────────────────────────────────
_chroma_client = None
_chroma_ef = None


def _get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        import chromadb
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    return _chroma_client


def _get_embedding_function():
    global _chroma_ef
    if _chroma_ef is None:
        from chromadb.utils import embedding_functions
        _chroma_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
    return _chroma_ef


def recall_memories(user_email: str, query: str, top_k: int = 5) -> str:
    """
    Search stored memories relevant to `query` for `user_email` directly from ChromaDB.
    Returns a formatted string ready to inject into the LLM prompt.
    """
    if not user_email:
        return ""
    try:
        client = _get_chroma_client()

        # Check if the query is asking about the student's own details or identity
        detail_keywords = [
            "detail", "details", "who am i", "my name", "about me", "profile",
            "remember", "my info", "who i am", "my details", "tell me about me",
            "விவரம்", "பெயர்", "யார்", "நினைவு", "பற்றி"
        ]
        is_asking_details = any(kw in query.lower() for kw in detail_keywords)

        if is_asking_details:
            # Metadata lookup only — zero embedding calculation needed
            collection = client.get_or_create_collection(name=COLLECTION)
            all_data = collection.get(where={"user_id": user_email}, include=["documents"])
            docs = all_data.get("documents", [])
        else:
            # Semantic similarity search using cached embedder
            ef = _get_embedding_function()
            collection = client.get_or_create_collection(name=COLLECTION, embedding_function=ef)
            res = collection.query(
                query_texts=[query],
                where={"user_id": user_email},
                n_results=top_k
            )
            docs = res.get("documents", [[]])[0] if res.get("documents") else []

        if not docs:
            return ""

        # Filter out empty or 'None' strings and deduplicate
        clean_docs = []
        for d in docs:
            if d and isinstance(d, str):
                s = d.strip()
                if s and s.lower() != "none" and s not in clean_docs:
                    clean_docs.append(s)

        if not clean_docs:
            return ""

        lines = [f"- {d}" for d in clean_docs]
        return "STUDENT PERSONAL CONTEXT (LEARNED FROM MEMORY FOR THIS USER):\n" + "\n".join(lines)
    except Exception as exc:
        print(f"⚠️  recall_memories error ({type(exc).__name__}): {exc}")
        return ""



def get_all_memories(user_email: str) -> list:
    """
    Return all stored memory items for the user as a list of dicts.
    Each dict has keys: id, memory, created_at, updated_at, user_id.
    Reads directly from ChromaDB metadata without loading heavy neural embedders.
    """
    if not user_email:
        return []
    try:
        client = _get_chroma_client()
        collection = client.get_or_create_collection(name=COLLECTION)

        result = collection.get(
            where={"user_id": user_email},
            include=["documents", "metadatas"]
        )
        items = []
        ids = result.get("ids", [])
        docs = result.get("documents", [])
        metas = result.get("metadatas", [])
        for i, mem_id in enumerate(ids):
            doc = docs[i] if i < len(docs) else ""
            meta = metas[i] if i < len(metas) else {}
            if doc and isinstance(doc, str) and doc.strip() and doc.strip().lower() != "none":
                items.append({
                    "id": mem_id,
                    "memory": doc.strip(),
                    "created_at": meta.get("created_at", "") if isinstance(meta, dict) else "",
                    "updated_at": meta.get("updated_at", "") if isinstance(meta, dict) else "",
                    "user_id": user_email,
                })
        return items
    except Exception as exc:
        print(f"⚠️  get_all_memories error: {exc}")
        return []


def delete_single_memory(memory_id: str) -> bool:
    """Delete a specific memory by its ID directly from ChromaDB."""
    if not memory_id:
        return False
    try:
        client = _get_chroma_client()
        collection = client.get_or_create_collection(name=COLLECTION)
        collection.delete(ids=[memory_id])
        print(f"🗑️  Deleted memory {memory_id}")
        return True
    except Exception as exc:
        print(f"⚠️  delete_single_memory error ({type(exc).__name__}): {exc}")
        return False



def add_direct_memory(user_email: str, text: str) -> bool:
    """
    Explicitly save a memory fact for a user directly into ChromaDB.
    """
    if not text.strip() or not user_email:
        print("⚠️  add_direct_memory: empty text or email.")
        return False
    try:
        import uuid, datetime
        client = _get_chroma_client()
        ef = _get_embedding_function()
        collection = client.get_or_create_collection(name=COLLECTION, embedding_function=ef)

        mem_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        collection.add(
            ids=[mem_id],
            documents=[text.strip()],
            metadatas=[{
                "user_id": user_email,
                "created_at": now,
                "updated_at": now,
            }]
        )
        print(f"✅ add_direct_memory: saved '{text.strip()[:60]}...' for {user_email}")
        return True
    except Exception as exc:
        print(f"⚠️  add_direct_memory error ({type(exc).__name__}): {exc}")
        raise


def delete_all_memories(user_email: str) -> None:
    """Delete ALL memories stored for a particular user."""
    m = _get_memory()
    if m is None:
        return
    try:
        items = get_all_memories(user_email)
        for item in items:
            mem_id = item.get("id")
            if mem_id:
                try:
                    m.delete(mem_id)
                except Exception:
                    pass
        print(f"🗑️  Deleted {len(items)} memories for {user_email}.")
    except Exception as exc:
        print(f"⚠️  mem0 delete_all_memories error: {exc}")

