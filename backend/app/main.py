import time
import uuid
import asyncio
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import verify_token, get_password_hash
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.logs import RetrievalLog, AIResponseLog

from app.api.auth import router as auth_router
from app.api.documents import router as doc_router
from app.api.conversations import router as conv_router
from app.api.dashboard import router as dash_router

from app.services.rag import retrieve_context, build_prompts, get_llm

app = FastAPI(title=settings.PROJECT_NAME)

# Setup CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup DB seeding event
@app.on_event("startup")
def on_startup():
    # 1. Create tables if they do not exist
    Base.metadata.create_all(bind=engine)
    
    # 2. Seed initial users
    db = SessionLocal()
    try:
        # Seed Admin
        admin_email = "admin@company.com"
        admin_user = db.query(User).filter(User.email == admin_email).first()
        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                email=admin_email,
                password_hash=get_password_hash("adminpassword"),
                full_name="System Administrator",
                role="ADMIN"
            )
            db.add(admin_user)
            print("Seeded default admin account: admin@company.com / adminpassword")
            
        # Seed Support Agent
        agent_email = "agent@company.com"
        agent_user = db.query(User).filter(User.email == agent_email).first()
        if not agent_user:
            agent_user = User(
                id=uuid.uuid4(),
                email=agent_email,
                password_hash=get_password_hash("agentpassword"),
                full_name="Support Agent",
                role="SUPPORT_AGENT"
            )
            db.add(agent_user)
            print("Seeded default support agent account: agent@company.com / agentpassword")
            
        db.commit()
    except Exception as e:
        print(f"Error seeding initial database state: {e}")
        db.rollback()
    finally:
        db.close()

# Include REST Routers
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(doc_router, prefix=f"{settings.API_V1_STR}/documents", tags=["Documents"])
app.include_router(conv_router, prefix=f"{settings.API_V1_STR}/conversations", tags=["Conversations"])
app.include_router(dash_router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["Dashboard"])

@app.get("/")
def root():
    return {"status": "running", "project": settings.PROJECT_NAME}

# WebSocket Chat Connection Manager
@app.websocket("/api/ws/chat/{conversation_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    conversation_id: uuid.UUID,
    token: str = Query(...)
):
    await websocket.accept()
    
    # 1. Authenticate user from Token query parameter
    subject = verify_token(token)
    if not subject:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid authentication token")
        return
        
    db = SessionLocal()
    try:
        user_uuid = uuid.UUID(subject)
        user = db.query(User).filter(User.id == user_uuid).first()
    except ValueError:
        user = db.query(User).filter(User.email == subject).first()
        
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User details not found")
        db.close()
        return
        
    # Check conversation ownership
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user.id
    ).first()
    
    if not conversation:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Conversation access denied")
        db.close()
        return
        
    db.close()
    
    # 2. Connection loop
    try:
        while True:
            # Wait for user query
            data = await websocket.receive_json()
            if data.get("type") != "question":
                continue
                
            query_text = data.get("message", "").strip()
            if not query_text:
                continue
                
            db = SessionLocal()
            try:
                # Refresh session states
                current_conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
                
                # A. Retrieve grounded context chunks
                retrieval_start_time = time.time()
                sources = retrieve_context(query_text)
                retrieval_latency_ms = int((time.time() - retrieval_start_time) * 1000)
                
                # B. Save user message to database
                user_msg = Message(
                    id=uuid.uuid4(),
                    conversation_id=conversation_id,
                    role="USER",
                    content=query_text
                )
                db.add(user_msg)
                db.commit()
                db.refresh(user_msg)
                
                # C. Send sources to the client immediately
                await websocket.send_json({
                    "type": "sources",
                    "sources": [
                        {
                            "chunk_id": s["chunk_id"],
                            "document_name": s["document_name"],
                            "page_number": s["page_number"],
                            "similarity": s["similarity"],
                            "chunk_text": s["chunk_text"]
                        } for s in sources
                    ]
                })
                
                # D. Build prompt and stream token generations
                system_prompt, user_prompt = build_prompts(query_text, sources)
                llm = get_llm()
                
                llm_start_time = time.time()
                accumulated_text = ""
                
                # Check for MockLLM vs production generators
                is_mock = "MockLLM" in str(type(llm))
                
                if is_mock:
                    # Fake token streaming for mock testing
                    mock_response = (
                        f"Based on the uploaded documentation context, here is the support draft for your query: '{query_text}'.\n\n"
                        "Please verify specific sections with the citations tab."
                    )
                    # If no sources matched:
                    if not sources:
                        mock_response = "I could not find this information in the uploaded documentation."
                        
                    for word in mock_response.split(" "):
                        await websocket.send_json({
                            "type": "token",
                            "content": word + " "
                        })
                        accumulated_text += word + " "
                        await asyncio.sleep(0.08)
                else:
                    try:
                        # Standard LlamaIndex LLM stream_chat with message roles to prevent repetition loops
                        from llama_index.core.llms import ChatMessage, MessageRole
                        messages = [
                            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
                            ChatMessage(role=MessageRole.USER, content=user_prompt)
                        ]
                        response_gen = llm.stream_chat(messages)
                        
                        for response in response_gen:
                            token_delta = response.delta or ""
                            # Sometimes delta is empty but message content increases
                            if not token_delta and response.message and response.message.content:
                                token_delta = response.message.content[len(accumulated_text):]
                            await websocket.send_json({
                                "type": "token",
                                "content": token_delta
                            })
                            accumulated_text += token_delta
                    except Exception as llm_err:
                        print(f"Error streaming LLM response: {llm_err}")
                        accumulated_text = "I encountered an error generating a grounded response. Please try again."
                        await websocket.send_json({
                            "type": "token",
                            "content": accumulated_text
                        })
                
                # E. Streaming complete signal
                generation_time_ms = int((time.time() - llm_start_time) * 1000)
                await websocket.send_json({"type": "done"})
                
                # F. Store Assistant response message in DB
                assistant_msg = Message(
                    id=uuid.uuid4(),
                    conversation_id=conversation_id,
                    role="ASSISTANT",
                    content=accumulated_text.strip(),
                    retrieved_sources=sources
                )
                db.add(assistant_msg)
                db.commit()
                db.refresh(assistant_msg)
                
                # G. Log retrieval stats
                retrieval_log = RetrievalLog(
                    message_id=assistant_msg.id,
                    query_text=query_text,
                    top_k=len(sources),
                    retrieval_latency_ms=retrieval_latency_ms
                )
                db.add(retrieval_log)
                
                # H. Log AI generation stats
                ai_log = AIResponseLog(
                    message_id=assistant_msg.id,
                    model_name=getattr(llm, "model", "MockModel"),
                    generation_time_ms=generation_time_ms
                )
                db.add(ai_log)
                
                # Update conversation timestamp
                current_conv.updated_at = func.now()
                db.commit()
                
            except Exception as e:
                db.rollback()
                print(f"Error handling query inside WebSocket session: {e}")
                await websocket.send_json({
                    "type": "error",
                    "content": f"System Error: {str(e)}"
                })
            finally:
                db.close()
                
    except WebSocketDisconnect:
        print(f"WebSocket session disconnected for conversation: {conversation_id}")
    except Exception as e:
        print(f"General WebSocket exception: {e}")
