import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  Send,
  BotMessageSquare,
  User,
  Loader2,
  FileText,
  Plus,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  createChat,
  getChats,
  getChatMessages,
  sendMessageStream,
  setAuthToken,
} from '../lib/api';
import type { Chat, Message, Source } from '../lib/api';

const SUGGESTED_QUESTIONS = [
  'What are the main topics covered?',
  'Summarize the key features',
  'What are the most common FAQs?',
  'How do I get started?',
];

export default function ChatPage() {
  const { kbId, chatId: urlChatId } = useParams<{ kbId: string; chatId?: string }>();
  const { getToken } = useAuth();

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(urlChatId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setAuthToken(getToken);
    loadChats();
  }, [kbId]);

  useEffect(() => {
    if (activeChatId) loadMessages(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  async function loadChats() {
    if (!kbId) return;
    setLoadingChats(true);
    try {
      const res = await getChats(kbId);
      setChats(res.data);
      if (!activeChatId && res.data.length > 0) setActiveChatId(res.data[0]!.id);
    } catch (err) {
      console.error('Failed to load chats:', err);
    }
    setLoadingChats(false);
  }

  async function loadMessages(chatId: string) {
    try {
      const res = await getChatMessages(chatId);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function handleNewChat() {
    if (!kbId) return;
    try {
      const res = await createChat(kbId);
      setChats((prev) => [res.data, ...prev]);
      setActiveChatId(res.data.id);
      setMessages([]);
      setSources([]);
    } catch (err) {
      console.error('Failed to create chat:', err);
    }
  }

  async function handleSend(messageText?: string) {
    const text = messageText || input.trim();
    if (!text || streaming || !kbId) return;

    let currentChatId = activeChatId;

    if (!currentChatId) {
      try {
        const res = await createChat(kbId, text.substring(0, 80));
        currentChatId = res.data.id;
        setChats((prev) => [res.data, ...prev]);
        setActiveChatId(currentChatId);
      } catch (err) {
        console.error('Failed to auto-create chat:', err);
        return;
      }
    }

    const userMsg: Message = {
      id: 'temp-user-' + Date.now(),
      chatId: currentChatId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamingText('');
    setSources([]);

    try {
      const token = await getToken();
      if (!token) throw new Error('No auth token');

      let fullText = '';
      let chatSources: Source[] = [];

      await sendMessageStream(currentChatId, text, token, (data) => {
        if (data.type === 'text' && data.content) {
          fullText += data.content;
          setStreamingText(fullText);
        } else if (data.type === 'sources' && data.sources) {
          chatSources = data.sources;
          setSources(data.sources);
        }
      });

      const aiMsg: Message = {
        id: 'temp-ai-' + Date.now(),
        chatId: currentChatId,
        role: 'ai',
        content: fullText,
        sources: chatSources,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setStreamingText('');

      setChats((prev) =>
        prev.map((c) =>
          c.id === currentChatId ? { ...c, title: text.substring(0, 80), updatedAt: new Date().toISOString() } : c
        )
      );
    } catch (err: any) {
      console.error('Chat error:', err);
      setStreamingText('');
      setMessages((prev) => [
        ...prev,
        {
          id: 'temp-error-' + Date.now(),
          chatId: currentChatId,
          role: 'ai',
          content: '⚠️ An error occurred. Please try again.',
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    setStreaming(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const showEmptyState = messages.length === 0 && !streaming;

  return (
    <div style={{ height: '100vh', background: '#0f172a', color: 'white', display: 'flex' }}>
      {/* Chat Sidebar */}
      <aside style={{
        width: 280, borderRight: '1px solid #1e293b', background: 'rgba(2, 6, 23, 0.7)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: 16, borderBottom: '1px solid #1e293b' }}>
          <Link
            to={`/kb/${kbId}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem', marginBottom: 16 }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} /> Back to KB
          </Link>
          <button
            onClick={handleNewChat}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 0', borderRadius: 12, background: 'linear-gradient(to right, #2563eb, #4f46e5)',
              color: 'white', fontWeight: 500, fontSize: '0.875rem', border: 'none', cursor: 'pointer',
            }}
          >
            <Plus style={{ width: 16, height: 16 }} /> New Chat
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {loadingChats ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 style={{ width: 20, height: 20, color: '#475569', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : chats.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.75rem', padding: 32 }}>No chats yet</p>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                  fontSize: '0.875rem', border: 'none', cursor: 'pointer',
                  background: chat.id === activeChatId ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                  color: chat.id === activeChatId ? '#60a5fa' : '#94a3b8',
                  fontWeight: chat.id === activeChatId ? 500 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <MessageSquare style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{
          borderBottom: '1px solid #1e293b', background: 'rgba(2, 6, 23, 0.5)',
          backdropFilter: 'blur(12px)', padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BotMessageSquare style={{ width: 16, height: 16, color: 'white' }} />
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>AI Support Agent</p>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Powered by Gemini 2.5 Flash</p>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {showEmptyState ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ marginBottom: 32 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 16,
                  background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                }}>
                  <Sparkles style={{ width: 40, height: 40, color: '#60a5fa' }} />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Ask me anything</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', maxWidth: 400 }}>
                  I'll search through your uploaded documents and provide accurate answers with source citations.
                </p>
              </motion.div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 480, width: '100%' }}>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <motion.button
                    key={q}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => handleSend(q)}
                    style={{
                      padding: 12, textAlign: 'left', fontSize: '0.875rem', borderRadius: 12,
                      border: '1px solid #334155', background: 'rgba(30, 41, 59, 0.4)',
                      color: '#cbd5e1', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#475569'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)'; e.currentTarget.style.borderColor = '#334155'; }}
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', gap: 12, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
                >
                  {msg.role === 'ai' && (
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #4f46e5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4,
                    }}>
                      <BotMessageSquare style={{ width: 16, height: 16, color: 'white' }} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '80%', borderRadius: 16, padding: '12px 16px',
                    background: msg.role === 'user' ? '#2563eb' : 'rgba(30, 41, 59, 0.6)',
                    border: msg.role === 'user' ? 'none' : '1px solid rgba(51, 65, 85, 0.5)',
                  }}>
                    {msg.role === 'ai' ? (
                      <div className="prose" style={{ fontSize: '0.875rem' }}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
                    )}

                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8, fontWeight: 500 }}>📎 Sources:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {msg.sources.map((s, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.75rem',
                              color: '#94a3b8', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 8, padding: 8,
                            }}>
                              <FileText style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2, color: '#60a5fa' }} />
                              <div>
                                <span style={{ fontWeight: 500, color: '#cbd5e1' }}>{s.documentName}</span>
                                <span style={{ color: '#475569', marginLeft: 4 }}>({Math.round(s.score * 100)}% match)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: '#334155',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4,
                    }}>
                      <User style={{ width: 16, height: 16, color: '#cbd5e1' }} />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Streaming Message */}
              {streaming && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #4f46e5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4,
                  }}>
                    <BotMessageSquare style={{ width: 16, height: 16, color: 'white' }} />
                  </div>
                  <div style={{
                    maxWidth: '80%', borderRadius: 16, padding: '12px 16px',
                    background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)',
                  }}>
                    {streamingText ? (
                      <div className="prose" style={{ fontSize: '0.875rem' }}>
                        <ReactMarkdown>{streamingText}</ReactMarkdown>
                        <span style={{ display: 'inline-block', width: 8, height: 16, background: '#60a5fa', animation: 'blink 1s infinite', marginLeft: 2 }} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
                        <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '0.875rem' }}>Searching knowledge base...</span>
                      </div>
                    )}

                    {sources.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8, fontWeight: 500 }}>📎 Sources:</p>
                        {sources.map((s, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.75rem',
                            color: '#94a3b8', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 8, padding: 8, marginBottom: 4,
                          }}>
                            <FileText style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2, color: '#60a5fa' }} />
                            <span style={{ fontWeight: 500, color: '#cbd5e1' }}>{s.documentName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          borderTop: '1px solid #1e293b', background: 'rgba(2, 6, 23, 0.5)',
          backdropFilter: 'blur(12px)', padding: '16px 32px',
        }}>
          <div style={{ maxWidth: '48rem', margin: '0 auto', position: 'relative' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents..."
              rows={1}
              disabled={streaming}
              style={{
                width: '100%', padding: '14px 56px 14px 20px', background: '#1e293b',
                border: '1px solid #334155', borderRadius: 16, color: 'white',
                fontSize: '0.875rem', resize: 'none', outline: 'none',
                opacity: streaming ? 0.5 : 1,
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={streaming || !input.trim()}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                padding: 8, borderRadius: 12, background: '#2563eb', border: 'none',
                cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: streaming || !input.trim() ? 0.3 : 1,
              }}
            >
              <Send style={{ width: 16, height: 16, color: 'white' }} />
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#475569', marginTop: 8 }}>
            AI responses are based on your uploaded documents. Always verify critical information.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
