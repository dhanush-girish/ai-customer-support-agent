import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BotMessageSquare,
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  File,
} from 'lucide-react';
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getChats,
  setAuthToken,
} from '../lib/api';
import type { DocumentInfo, Chat } from '../lib/api';

export default function KnowledgeBasePage() {
  const { kbId } = useParams<{ kbId: string }>();
  const { getToken } = useAuth();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setAuthToken(getToken);
    loadData();
  }, [kbId]);

  async function loadData() {
    if (!kbId) return;
    setLoading(true);
    try {
      const [docsRes, chatsRes] = await Promise.all([
        getDocuments(kbId),
        getChats(kbId),
      ]);
      setDocuments(docsRes.data);
      setChats(chatsRes.data);
    } catch (err) {
      console.error('Failed to load KB data:', err);
    }
    setLoading(false);
  }

  async function handleUpload(files: FileList | File[]) {
    if (!kbId || files.length === 0) return;
    setUploading(true);
    setUploadStatus(null);

    let successCount = 0;
    let errorMsg = '';

    for (const file of Array.from(files)) {
      try {
        await uploadDocument(kbId, file);
        successCount++;
      } catch (err: any) {
        errorMsg = err.response?.data?.error || err.message;
        console.error('Upload error:', err);
      }
    }

    if (successCount > 0) {
      setUploadStatus({
        type: 'success',
        msg: `${successCount} document${successCount > 1 ? 's' : ''} uploaded and processed!`,
      });
      await loadData();
    }
    if (errorMsg) {
      setUploadStatus({ type: 'error', msg: errorMsg });
    }

    setUploading(false);
    setTimeout(() => setUploadStatus(null), 5000);
  }

  async function handleDeleteDoc(docId: string) {
    if (!kbId) return;
    if (!confirm('Delete this document and all its embeddings?')) return;
    try {
      await deleteDocument(kbId, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error('Failed to delete doc:', err);
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [kbId]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white' }}>
      {/* Top bar */}
      <header style={{
        borderBottom: '1px solid #1e293b', background: 'rgba(2, 6, 23, 0.7)',
        backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 30,
      }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>
              <ArrowLeft style={{ width: 16, height: 16 }} />
              Back
            </Link>
            <div style={{ width: 1, height: 24, background: '#1e293b' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BotMessageSquare style={{ width: 20, height: 20, color: '#60a5fa' }} />
              <span style={{ fontWeight: 600 }}>Knowledge Base</span>
            </div>
          </div>
          <Link
            to={`/kb/${kbId}/chat`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 20px', background: 'linear-gradient(to right, #2563eb, #4f46e5)',
              borderRadius: 12, fontWeight: 500, fontSize: '0.875rem', color: 'white',
              textDecoration: 'none', boxShadow: '0 4px 16px rgba(37, 99, 235, 0.25)',
            }}
          >
            <MessageSquare style={{ width: 16, height: 16 }} />
            Chat with AI
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '32px 24px' }}>
        {/* Upload Zone */}
        <div
          onDrop={(e) => {
            e.stopPropagation();
            onDrop(e);
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => document.getElementById('file-upload')?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#3b82f6' : '#334155'}`,
            borderRadius: 16, padding: '48px 24px', textAlign: 'center', marginBottom: 32,
            background: dragOver ? 'rgba(59, 130, 246, 0.08)' : 'rgba(30, 41, 59, 0.3)',
            transition: 'all 0.3s', cursor: 'pointer',
          }}
        >
          {uploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader2 style={{ width: 40, height: 40, color: '#60a5fa', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#cbd5e1', fontWeight: 500 }}>Processing document...</p>
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Extracting text, chunking, and generating embeddings</p>
              <motion.p 
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.5 }}
                style={{ color: '#fbbf24', fontSize: '0.875rem', fontWeight: 500, background: 'rgba(245, 158, 11, 0.1)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.2)' }}
              >
                Uploading file might take a minute, please wait...
              </motion.p>
            </div>
          ) : (
            <>
              <Upload style={{ width: 40, height: 40, color: '#64748b', margin: '0 auto 12px' }} />
              <p style={{ color: '#cbd5e1', fontWeight: 500, marginBottom: 4 }}>
                Drag & drop files here, or{' '}
                <span style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline' }}>
                  browse
                </span>
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  multiple
                  onChange={(e) => {
                    console.log('File input changed:', e.target.files);
                    if (e.target.files && e.target.files.length > 0) {
                      handleUpload(e.target.files);
                    }
                  }}
                  style={{ display: 'none' }}
                />
              </p>
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Supports PDF and TXT files (max 20MB)</p>
            </>
          )}
        </div>

        {/* Upload Status */}
        <AnimatePresence>
          {uploadStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                borderRadius: 12, marginBottom: 24,
                background: uploadStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${uploadStatus.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                color: uploadStatus.type === 'success' ? '#34d399' : '#f87171',
              }}
            >
              {uploadStatus.type === 'success' ? (
                <CheckCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
              ) : (
                <AlertCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
              )}
              <span style={{ fontSize: '0.875rem' }}>{uploadStatus.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 12 }}>
            <Loader2 style={{ width: 24, height: 24, color: '#60a5fa', animation: 'spin 1s linear infinite' }} />
            <motion.span 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 1 }}
              style={{ color: '#fbbf24', fontSize: '0.875rem', fontWeight: 500, background: 'rgba(245, 158, 11, 0.1)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.2)' }}
            >
              Loading might take a minute...
            </motion.span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
            {/* Documents */}
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText style={{ width: 20, height: 20, color: '#60a5fa' }} />
                Documents ({documents.length})
              </h2>
              {documents.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '64px 24px', border: '1px solid #1e293b',
                  borderRadius: 16, background: 'rgba(30, 41, 59, 0.2)',
                }}>
                  <File style={{ width: 48, height: 48, color: '#334155', margin: '0 auto 12px' }} />
                  <p style={{ color: '#94a3b8', fontWeight: 500 }}>No documents yet</p>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>Upload your first document above</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {documents.map((doc) => (
                    <motion.div
                      key={doc.id}
                      layout
                      style={{
                        display: 'flex', alignItems: 'center', gap: 16, padding: 16,
                        borderRadius: 12, border: '1px solid #1e293b',
                        background: 'rgba(30, 41, 59, 0.3)', transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{doc.type === 'application/pdf' ? '📄' : '📝'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                          {doc._count?.chunks ?? '?'} chunks • {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, color: '#475569', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'none'; }}
                      >
                        <Trash2 style={{ width: 16, height: 16 }} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Chats */}
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare style={{ width: 20, height: 20, color: '#a855f7' }} />
                Recent Chats ({chats.length})
              </h2>
              {chats.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '48px 16px', border: '1px solid #1e293b',
                  borderRadius: 16, background: 'rgba(30, 41, 59, 0.2)',
                }}>
                  <MessageSquare style={{ width: 40, height: 40, color: '#334155', margin: '0 auto 12px' }} />
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No chats yet</p>
                  <Link
                    to={`/kb/${kbId}/chat`}
                    style={{ color: '#60a5fa', fontSize: '0.875rem', marginTop: 8, display: 'inline-block', textDecoration: 'none' }}
                  >
                    Start your first chat →
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chats.slice(0, 10).map((chat) => (
                    <Link
                      key={chat.id}
                      to={`/kb/${kbId}/chat/${chat.id}`}
                      style={{
                        display: 'block', padding: 12, borderRadius: 12,
                        border: '1px solid #1e293b', background: 'rgba(30, 41, 59, 0.3)',
                        textDecoration: 'none', color: 'white', transition: 'all 0.2s',
                      }}
                    >
                      <p style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title}</p>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
