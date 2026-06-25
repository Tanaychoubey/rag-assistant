import { useEffect, useState, useRef } from 'react';
import { MessageSquare, Send, Plus, Trash2, User as UserIcon, AlertTriangle, BookOpen, ArrowUp, ChevronLeft } from 'lucide-react';
import client, { API_URL } from '../../api/client';
import { Conversation, Message, Citation } from '../../types';

const cleanMessageContent = (content: string) => {
  if (!content) return '';
  return content
    .replace(/\[Source\s+\d+\](?:\s+File:\s+[^\s,]+,\s+Page:\s+\d+)?/gi, '')
    .replace(/\([^\)]+\.pdf,?\s*(?:Page|Pg\.?)?\s*:\s*\d+\)/gi, '')
    .replace(/\([^\)]+\.pdf,?\s*(?:Page|Pg\.?)?\s*\d+\)/gi, '')
    .replace(/\((?:Page|Pg\.?)\s*\d+\)/gi, '')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s+\./g, '.')
    .replace(/\s\s+/g, ' ')
    .trim();
};

export default function ChatWindow() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Input states
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamCitations, setStreamCitations] = useState<Citation[]>([]);

  // Selected Citation for details display
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef<Conversation | null>(null);

  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  useEffect(() => {
    if (!activeConv) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    // Re-establish WebSocket connection whenever activeConv changes or mounts
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    initWebSocket(activeConv.id);

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [activeConv]);

  const fetchConversations = async (selectFirst = false) => {
    try {
      const response = await client.get('/conversations');
      setConversations(response.data);
      if (selectFirst && response.data.length > 0 && !activeConv) {
        handleSelectConversation(response.data[0]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch conversation list.');
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    fetchConversations(true);
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  // Scroll chat viewport to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamText, isStreaming]);

  const handleCreateConversation = async () => {
    try {
      const title = `Support Session #${conversations.length + 1}`;
      const response = await client.post('/conversations', null, {
        params: { title }
      });
      const newConv = response.data;
      setConversations((prev) => [newConv, ...prev]);
      handleSelectConversation(newConv);
    } catch (err) {
      console.error(err);
      setError('Failed to start a new chat session.');
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await client.delete(`/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConv?.id === id) {
        setActiveConv(null);
        setMessages([]);
        setMobileView('list');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to delete chat session.');
    }
  };

  const handleSelectConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setMobileView('chat'); // Switch view on mobile
    setLoadingMessages(true);
    setError('');
    
    try {
      const response = await client.get(`/conversations/${conv.id}`);
      setMessages(response.data.messages);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch message history.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const initWebSocket = (conversationId: string) => {
    setError(''); // Clear any previous errors on initialization
    const token = localStorage.getItem('token') || '';
    
    // Calculate websocket host matching standard configurations
    let wsHost = window.location.host;
    if (API_URL) {
      wsHost = API_URL.replace(/^https?:\/\//, '');
    }
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${wsProtocol}//${wsHost}/api/ws/chat/${conversationId}?token=${token}`;
    
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      if (socketRef.current !== socket) return;
      console.log('Chat WebSocket connected.');
      setError(''); // Clear error on successful connection
    };

    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return;
      const data = JSON.parse(event.data);
      
      if (data.type === 'sources') {
        setStreamCitations(data.sources);
      } else if (data.type === 'token') {
        setIsStreaming(true);
        setStreamText((prev) => prev + data.content);
      } else if (data.type === 'done') {
        const currentConv = activeConvRef.current;
        if (currentConv) {
          client.get(`/conversations/${currentConv.id}`)
            .then((response) => {
              setMessages(response.data.messages);
              setIsStreaming(false);
              setStreamText('');
              setStreamCitations([]);
            })
            .catch((err) => {
              console.error('Silent refresh failed:', err);
              setIsStreaming(false);
              setStreamText('');
              setStreamCitations([]);
            });
        } else {
          setIsStreaming(false);
          setStreamText('');
          setStreamCitations([]);
        }
      } else if (data.type === 'error') {
        setIsStreaming(false);
        setError(data.content);
        setStreamText('');
        setStreamCitations([]);
      }
    };

    socket.onerror = (err) => {
      if (socketRef.current !== socket) return;
      console.error('WebSocket Error:', err);
      setError('WebSocket connection error.');
      setIsStreaming(false);
    };

    socket.onclose = () => {
      if (socketRef.current !== socket) return;
      console.log('Chat WebSocket closed.');
    };
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !socketRef.current) return;
    
    const messageContent = input.trim();
    setInput('');
    setError('');

    // Pre-inject User message locally to keep UI responsive
    const localUserMsg: Message = {
      id: crypto.randomUUID() as any,
      role: 'USER',
      content: messageContent,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, localUserMsg]);
    
    // Clear stream buffers
    setStreamText('');
    setStreamCitations([]);
    
    // Send via socket
    socketRef.current.send(
      JSON.stringify({
        type: 'question',
        message: messageContent
      })
    );
  };

  const handleRegenerate = (content: string) => {
    if (isStreaming || !socketRef.current) return;
    setError('');
    setStreamText('');
    setStreamCitations([]);
    
    socketRef.current.send(
      JSON.stringify({
        type: 'question',
        message: content
      })
    );
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden animate-fade-in relative">
      {/* Left Chat Sidebar (Sessions List) */}
      <div className={`w-full md:w-80 glass-panel border-r border-black/5 flex-col h-full shrink-0 ${mobileView === 'list' ? 'flex' : 'hidden md:flex'}`}>
        <div className="p-4 border-b border-white/5">
          <button
            onClick={handleCreateConversation}
            className="w-full btn-primary-glow text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-glass cursor-pointer"
          >
            <Plus size={16} />
            <span>New Chat Session</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-left">
          {loadingConv ? (
            <p className="text-center text-xs text-slate-500 py-6">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-6">No chat sessions started.</p>
          ) : (
            conversations.map((c) => {
              const isActive = activeConv?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectConversation(c)}
                  className={`group w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-zinc-600 hover:text-[#1c1c1e] hover:bg-black/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <MessageSquare size={16} className={isActive ? 'text-white' : 'text-[#8e8e93]'} />
                    <span className="truncate">{c.title}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, c.id)}
                    className="text-zinc-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/5 cursor-pointer"
                    title="Delete Chat"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex-col h-full overflow-hidden bg-white ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}>
        {activeConv ? (
          <>
            {/* Active Session Info Header */}
            <div className="px-6 py-3.5 border-b border-black/5 flex items-center justify-between bg-white text-left">
              <div className="flex items-center">
                {/* Back button on mobile */}
                <button
                  onClick={() => setMobileView('list')}
                  className="md:hidden text-[#007aff] flex items-center gap-0.5 text-sm font-semibold mr-3 cursor-pointer"
                >
                  <ChevronLeft size={20} />
                  <span>Chats</span>
                </button>
                
                <div>
                  <h3 className="font-bold text-[#1c1c1e] text-sm">{activeConv.title}</h3>
                  <p className="text-[11px] text-[#8e8e93]">WebSocket grounded chat session.</p>
                </div>
              </div>
            </div>

            {/* Error alerts */}
            {error && (
              <div className="mx-6 mt-4 flex items-center gap-2 bg-danger/10 border border-danger/20 text-danger text-xs rounded-xl p-3 text-left">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Messages Viewport */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Loading chat messages...
                </div>
              ) : messages.length === 0 && !isStreaming ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center border border-black/10 text-xl">
                    💬
                  </div>
                  <p className="text-xs">Ask a support query to retrieve grounded context responses.</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isUser = msg.role === 'USER';
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {/* Content Card */}
                        <div className={`max-w-[85%] md:max-w-[70%] flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-[14px] leading-snug text-left ${
                              isUser
                                ? 'bg-[#007aff] text-white rounded-br-sm shadow-sm'
                                : 'bg-[#e9e9eb] text-[#1c1c1e] rounded-bl-sm'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{cleanMessageContent(msg.content)}</p>
                          </div>

                          {/* Sources list (only for Assistant messages) */}
                          {!isUser && msg.retrieved_sources && msg.retrieved_sources.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              {msg.retrieved_sources.map((src, idx) => (
                                <button
                                  key={src.chunk_id || idx}
                                  onClick={() => setSelectedCitation(src)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-black/5 border border-black/10 text-zinc-600 hover:border-black/20 hover:text-[#1c1c1e] transition-all cursor-pointer"
                                >
                                  <BookOpen size={9} />
                                  <span>{src.document_name} (Pg. {src.page_number})</span>
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {/* Regeneration Trigger */}
                          {isUser && !isStreaming && (
                            <button
                              onClick={() => handleRegenerate(msg.content)}
                              className="text-[9px] text-zinc-500 hover:text-zinc-700 font-semibold uppercase tracking-wider cursor-pointer mt-0.5"
                            >
                              Regenerate
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Streaming Block */}
                  {isStreaming && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="max-w-[85%] md:max-w-[70%] flex flex-col gap-1.5 items-start text-left">
                        <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-[14px] leading-snug bg-[#e9e9eb] text-[#1c1c1e]">
                          {streamText ? (
                            <p className="whitespace-pre-wrap">{cleanMessageContent(streamText)}</p>
                          ) : (
                            <div className="flex items-center gap-1.5 py-1 px-1">
                              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          )}
                        </div>

                        {streamCitations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-0.5 animate-fade-in">
                            {streamCitations.map((src, idx) => (
                              <button
                                key={src.chunk_id || idx}
                                onClick={() => setSelectedCitation(src)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-black/5 border border-black/10 text-zinc-600 hover:border-black/20 hover:text-[#1c1c1e] transition-all cursor-pointer"
                              >
                                <BookOpen size={9} />
                                <span>{src.document_name} (Pg. {src.page_number})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input Form */}
            <div className="px-6 py-4 bg-white">
              <form onSubmit={handleSendMessage} className="relative flex items-center">
                <input
                  type="text"
                  placeholder={isStreaming ? "Generating answer..." : "Ask a question..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isStreaming}
                  className="w-full bg-[#f2f2f7] text-[#1c1c1e] border border-black/5 pl-4 pr-12 py-3 rounded-full text-sm outline-none focus:border-black/10 transition-all placeholder-zinc-400"
                  required
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isStreaming}
                  className="w-8 h-8 rounded-full bg-[#0a84ff] text-white flex items-center justify-center absolute right-2 hover:bg-[#007aff] transition-all disabled:opacity-30 disabled:hover:bg-[#0a84ff] cursor-pointer"
                >
                  <ArrowUp size={14} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-black/5 flex items-center justify-center border border-black/10 text-3xl shadow-glass">
              🧠
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#1c1c1e]">Grounded Knowledge Agent</h3>
              <p className="text-xs text-[#8e8e93]">Select or start a chat session to query the indexed documents database.</p>
            </div>
            <button
              onClick={handleCreateConversation}
              className="btn-primary-glow text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-glass cursor-pointer"
            >
              <Plus size={14} />
              <span>Start Session</span>
            </button>
          </div>
        )}
      </div>

      {/* Selected Citation Detail Overlay Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-xl max-h-[90vh] flex flex-col p-6 rounded-3xl relative overflow-hidden border border-black/10 text-left">
            {/* Banner top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-[#5856d6]" />

            <div className="flex items-center justify-between border-b border-black/5 pb-3 mb-4 shrink-0">
              <div className="flex items-center gap-2 text-primary">
                <BookOpen size={20} />
                <h3 className="text-base font-bold text-[#1c1c1e]">Source Citation Details</h3>
              </div>
              <button
                onClick={() => setSelectedCitation(null)}
                className="text-[#007aff] hover:text-[#0056b3] text-sm font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 text-sm text-[#1c1c1e] overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-black/5 rounded-xl p-3 border border-black/5">
                  <span className="text-[10px] text-[#8e8e93] font-semibold uppercase">Document Name</span>
                  <p className="font-semibold text-[#1c1c1e] truncate">{selectedCitation.document_name}</p>
                </div>
                <div className="bg-black/5 rounded-xl p-3 border border-black/5">
                  <span className="text-[10px] text-[#8e8e93] font-semibold uppercase">Page Reference</span>
                  <p className="font-semibold text-[#1c1c1e]">Page {selectedCitation.page_number}</p>
                </div>
                <div className="bg-black/5 rounded-xl p-3 border border-black/5">
                  <span className="text-[10px] text-[#8e8e93] font-semibold uppercase">Similarity Score</span>
                  <p className="font-semibold text-success">{(selectedCitation.similarity * 100).toFixed(1)}% Match</p>
                </div>
                <div className="bg-black/5 rounded-xl p-3 border border-black/5">
                  <span className="text-[10px] text-[#8e8e93] font-semibold uppercase">Chunk ID</span>
                  <p className="font-mono text-xs text-[#3a3a3c] truncate">{selectedCitation.chunk_id}</p>
                </div>
              </div>

              <div className="bg-black/5 rounded-2xl p-4 border border-black/5">
                <span className="text-[10px] text-[#8e8e93] font-semibold uppercase">Source Excerpt Snippet</span>
                <p className="mt-1 font-mono text-xs text-[#1c1c1e] leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap select-text selection:bg-primary/30">
                  {selectedCitation.chunk_text}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
