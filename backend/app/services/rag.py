import os
import time
import uuid
from typing import Generator, List, Dict, Any, Tuple
import qdrant_client
from qdrant_client.http.models import Distance, VectorParams, Filter, FieldCondition, MatchValue
from pypdf import PdfReader

from llama_index.core import Document as LlamaDocument, VectorStoreIndex, StorageContext
from llama_index.core.node_parser import SentenceSplitter
from llama_index.vector_stores.qdrant import QdrantVectorStore

from app.core.config import settings
from llama_index.core.embeddings import BaseEmbedding
from llama_index.core.llms import CustomLLM, CompletionResponse, CompletionResponseGen, LLMMetadata
from llama_index.core.llms.callbacks import llm_completion_callback
from pydantic import PrivateAttr

class AQGeminiEmbedding(BaseEmbedding):
    _client: Any = PrivateAttr()
    _model_name: str = PrivateAttr()

    def __init__(self, api_key: str, model_name: str = "models/text-embedding-004", **kwargs):
        super().__init__(**kwargs)
        self._model_name = model_name
        from google import genai
        self._client = genai.Client(
            api_key=api_key,
            http_options={
                'headers': {'Authorization': f'Bearer {api_key}'}
            }
        )

    def _get_query_embedding(self, query: str) -> list[float]:
        response = self._client.models.embed_content(
            model=self._model_name,
            contents=query
        )
        return response.embeddings[0].values

    def _get_text_embedding(self, text: str) -> list[float]:
        response = self._client.models.embed_content(
            model=self._model_name,
            contents=text
        )
        return response.embeddings[0].values

    def _get_text_embeddings(self, texts: list[str]) -> list[list[float]]:
        response = self._client.models.embed_content(
            model=self._model_name,
            contents=texts
        )
        return [emb.values for emb in response.embeddings]

    async def _aget_query_embedding(self, query: str) -> list[float]:
        return self._get_query_embedding(query)

    async def _aget_text_embedding(self, text: str) -> list[float]:
        return self._get_text_embedding(text)


class AQGeminiLLM(CustomLLM):
    _client: Any = PrivateAttr()
    _model: str = PrivateAttr()

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash", **kwargs):
        super().__init__(**kwargs)
        self._model = model
        from google import genai
        self._client = genai.Client(
            api_key=api_key,
            http_options={
                'headers': {'Authorization': f'Bearer {api_key}'}
            }
        )

    @property
    def metadata(self) -> LLMMetadata:
        return LLMMetadata(
            context_window=1000000,
            num_output=8192,
            model_name=self._model,
        )

    @llm_completion_callback()
    def complete(self, prompt: str, **kwargs: Any) -> CompletionResponse:
        response = self._client.models.generate_content(
            model=self._model,
            contents=prompt,
        )
        return CompletionResponse(text=response.text)

    @llm_completion_callback()
    def stream_complete(self, prompt: str, **kwargs: Any) -> CompletionResponseGen:
        response = self._client.models.generate_content_stream(
            model=self._model,
            contents=prompt,
        )
        text = ""
        for chunk in response:
            text += chunk.text
            yield CompletionResponse(text=text, delta=chunk.text)


# Initialize Qdrant Client supporting local container or cloud services
qdrant_client_instance = qdrant_client.QdrantClient(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None
)

# Setup Embeddings lazily to avoid heavy torch/HuggingFace imports on startup
_embed_model = None
_vector_size = 384
_collection_name = "document_chunks"

def get_embed_config():
    global _embed_model, _vector_size, _collection_name
    if _embed_model is not None:
        return _embed_model, _vector_size, _collection_name
        
    # Check for direct HF Inference API key first to bypass blocked Gemini accounts
    if settings.HF_API_KEY:
        from llama_index.embeddings.huggingface_api import HuggingFaceInferenceAPIEmbedding
        _embed_model = HuggingFaceInferenceAPIEmbedding(
            model_name="BAAI/bge-small-en-v1.5",
            token=settings.HF_API_KEY
        )
        _vector_size = 384
        _collection_name = "document_chunks_huggingface_api"
        
    # Check for direct API key presence first to bypass loading heavy HuggingFace models on serverless/free tiers
    elif settings.GEMINI_API_KEY:
        if settings.GEMINI_API_KEY.startswith("AQ."):
            _embed_model = AQGeminiEmbedding(
                api_key=settings.GEMINI_API_KEY,
                model_name="models/text-embedding-004"
            )
        else:
            from llama_index.embeddings.gemini import GeminiEmbedding
            _embed_model = GeminiEmbedding(
                api_key=settings.GEMINI_API_KEY,
                model_name="models/embedding-001"
            )
        _vector_size = 768
        _collection_name = "document_chunks_gemini"
        
    elif settings.OPENAI_API_KEY:
        from llama_index.embeddings.openai import OpenAIEmbedding
        _embed_model = OpenAIEmbedding(
            api_key=settings.OPENAI_API_KEY,
            model_name="text-embedding-3-small"
        )
        _vector_size = 1536
        _collection_name = "document_chunks_openai"
        
    else:
        print("Warning: No cloud embedding API keys (HF_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY) were found. Local embeddings are disabled to prevent out-of-memory crashes on free tiers. Falling back to MockEmbedding.")
        from llama_index.core.embeddings.mock import MockEmbedding
        _embed_model = MockEmbedding(co_dimension=384)
        _vector_size = 384
        _collection_name = "document_chunks_mock"
            
    return _embed_model, _vector_size, _collection_name

# Initialize Qdrant Collection
def init_qdrant():
    embed_model, size, collection_name = get_embed_config()
    try:
        if not qdrant_client_instance.collection_exists(collection_name=collection_name):
            qdrant_client_instance.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=size, distance=Distance.COSINE),
            )
            print(f"Created Qdrant collection: {collection_name} (Size: {size})")
    except Exception as e:
        print(f"Error initializing Qdrant: {e}")

# Helper to load LLM based on configuration
def get_llm():
    provider = settings.LLM_PROVIDER.lower()
    
    if provider == "gemini" and settings.GEMINI_API_KEY:
        if settings.GEMINI_API_KEY.startswith("AQ."):
            return AQGeminiLLM(api_key=settings.GEMINI_API_KEY, model="gemini-1.5-flash")
        else:
            from llama_index.llms.gemini import Gemini
            return Gemini(api_key=settings.GEMINI_API_KEY, model="models/gemini-1.5-flash")
    
    elif provider == "ollama":
        from llama_index.llms.ollama import Ollama
        return Ollama(
            base_url=settings.OLLAMA_URL,
            model=settings.OLLAMA_MODEL,
            request_timeout=60.0
        )
    
    elif provider == "openai" and settings.OPENAI_API_KEY:
        from llama_index.llms.openai import OpenAI
        return OpenAI(api_key=settings.OPENAI_API_KEY, model="gpt-4o-mini")
        
    elif provider == "groq" and settings.GROQ_API_KEY:
        from llama_index.llms.groq import Groq
        return Groq(api_key=settings.GROQ_API_KEY, model="llama-3.3-70b-versatile", temperature=0.0)
        
    else:
        # Fallback to Mock LLM for local development testing
        print("Warning: Using Mock LLM because no cloud key or Ollama was loaded.")
        from llama_index.core.llms.mock import MockLLM
        return MockLLM()

def extract_text_from_file(file_path: str, file_type: str) -> List[Dict[str, Any]]:
    """Extract text from PDF or TXT, return list of dicts with page and text."""
    pages = []
    if file_type.lower() == "pdf":
        reader = PdfReader(file_path)
        for idx, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                pages.append({
                    "page": idx + 1,
                    "text": text.strip()
                })
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        pages.append({
            "page": 1,
            "text": text.strip()
        })
    return pages

def index_document(document_id: uuid.UUID, file_path: str, file_name: str) -> Tuple[int, int]:
    """Parse, chunk, embed, and index a document into Qdrant."""
    init_qdrant()
    embed_model, size, collection_name = get_embed_config()
    
    # 1. Extract text
    pages = extract_text_from_file(file_path, file_name.split(".")[-1])
    total_pages = len(pages)
    
    # 2. Parse into LlamaIndex documents with metadata
    llama_docs = []
    for page_data in pages:
        llama_docs.append(
            LlamaDocument(
                text=page_data["text"],
                metadata={
                    "document_id": str(document_id),
                    "document_name": file_name,
                    "page_number": page_data["page"]
                }
            )
        )
    
    if not llama_docs:
        raise ValueError("No text could be extracted from document.")

    # 3. Create nodes using SentenceSplitter
    parser = SentenceSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP
    )
    nodes = parser.get_nodes_from_documents(llama_docs)
    chunk_count = len(nodes)
    
    # Inject unique ID for Qdrant storage
    for node in nodes:
        node.id_ = str(uuid.uuid4())
        # Ensure metadata contains chunk_text
        node.metadata["chunk_id"] = node.id_
        node.metadata["chunk_text"] = node.get_content()
        node.metadata["created_at"] = time.strftime("%Y-%m-%d")

    # 4. Insert into Qdrant
    vector_store = QdrantVectorStore(
        client=qdrant_client_instance,
        collection_name=collection_name
    )
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    
    # Generate Index and write vectors
    VectorStoreIndex(
        nodes,
        storage_context=storage_context,
        embed_model=embed_model
    )
    
    return total_pages, chunk_count

def delete_document_vectors(document_id: uuid.UUID):
    """Delete document vector points from Qdrant."""
    init_qdrant()
    embed_model, size, collection_name = get_embed_config()
    qdrant_client_instance.delete(
        collection_name=collection_name,
        points_filter=Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=str(document_id))
                )
            ]
        )
    )

def retrieve_context(query_text: str) -> List[Dict[str, Any]]:
    """Retrieve relevant chunks from Qdrant with details."""
    # Check if the query is a simple greeting to avoid retrieving unrelated sources
    cleaned = query_text.lower().strip("?!. ")
    greetings = {"hi", "hello", "hey", "good morning", "good afternoon", "good evening", "greetings", "yo", "sup", "hola", "thanks", "thank you"}
    if cleaned in greetings:
        return []
        
    init_qdrant()
    embed_model, size, collection_name = get_embed_config()
    
    vector_store = QdrantVectorStore(
        client=qdrant_client_instance,
        collection_name=collection_name
    )
    index = VectorStoreIndex.from_vector_store(
        vector_store,
        embed_model=embed_model
    )
    retriever = index.as_retriever(similarity_top_k=5)
    
    start_time = time.time()
    nodes = retriever.retrieve(query_text)
    latency_ms = int((time.time() - start_time) * 1000)
    
    sources = []
    for node in nodes:
        # LlamaIndex returns score as node.score
        meta = node.node.metadata
        sources.append({
            "chunk_id": meta.get("chunk_id", node.node.id_),
            "document_id": meta.get("document_id"),
            "document_name": meta.get("document_name", "Unknown Document"),
            "page_number": meta.get("page_number", 1),
            "chunk_text": node.node.text,
            "similarity": float(node.score or 0.0),
            "latency_ms": latency_ms
        })
    return sources

def build_prompts(query_text: str, sources: List[Dict[str, Any]]) -> Tuple[str, str]:
    """Build grounded system and user prompts."""
    system_prompt = (
        "You are a professional customer support assistant.\n"
        "If the user's query is a simple greeting or polite conversation (like 'hi', 'hello', 'good morning', 'thank you', etc.), "
        "respond with a polite greeting or general helpful response without demanding document context.\n"
        "Otherwise, for any factual or informational questions, you must answer using ONLY the provided documentation context below. "
        "Do NOT write any meta-commentary, introductory explanation, or discussion about which pages are not relevant or missing. "
        "Just answer the question directly and concisely based on the context.\n"
        "Do NOT include any inline parenthetical citations, page references, or document names (e.g. '(HR-Policy.pdf, Page: 18)') inside your text response, as they will be displayed separately to the user. Just state the facts directly.\n"
        "If the answer cannot be found in the context, say exactly:\n"
        "\"I could not find this information in the uploaded documentation.\""
    )
    
    context_str = ""
    for idx, src in enumerate(sources):
        context_str += f"\n--- [Source {idx+1}] File: {src['document_name']}, Page: {src['page_number']}, Similarity: {src['similarity']:.4f} ---\n"
        context_str += f"Content: {src['chunk_text']}\n"
        
    user_prompt = f"Retrieved Context:\n{context_str}\n\nQuestion: {query_text}\nAnswer:"
    
    return system_prompt, user_prompt
