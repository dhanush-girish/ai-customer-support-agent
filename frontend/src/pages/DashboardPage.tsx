import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BotMessageSquare,
  Database,
  Plus,
  FileText,
  MessageSquare,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { getKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase, setAuthToken } from '../lib/api';
import type { KnowledgeBase } from '../lib/api';

const styles = {
  page: { minHeight: '100vh', background: '#0f172a', color: 'white', display: 'flex' } as React.CSSProperties,
  sidebar: {
    width: 256, borderRight: '1px solid #1e293b', background: 'rgba(2, 6, 23, 0.7)',
    padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 8,
  } as React.CSSProperties,
  main: { flex: 1, padding: 32, overflowY: 'auto' as const },
  createBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', background: 'linear-gradient(to right, #2563eb, #4f46e5)',
    borderRadius: 12, fontWeight: 500, fontSize: '0.875rem', color: 'white',
    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.25)',
  } as React.CSSProperties,
  card: {
    padding: 24, borderRadius: 16, border: '1px solid #1e293b',
    background: 'rgba(30, 41, 59, 0.3)', position: 'relative' as const,
    transition: 'all 0.3s', cursor: 'default',
  } as React.CSSProperties,
  modal: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  } as React.CSSProperties,
  modalBox: {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  } as React.CSSProperties,
  input: {
    width: '100%', padding: '10px 16px', background: '#1e293b', border: '1px solid #334155',
    borderRadius: 12, color: 'white', fontSize: '0.875rem', outline: 'none',
    transition: 'border-color 0.2s',
  } as React.CSSProperties,
  textarea: {
    width: '100%', padding: '10px 16px', background: '#1e293b', border: '1px solid #334155',
    borderRadius: 12, color: 'white', fontSize: '0.875rem', outline: 'none',
    resize: 'none' as const, transition: 'border-color 0.2s',
  } as React.CSSProperties,
};

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setAuthToken(getToken);
    loadKBs();
  }, []);

  async function loadKBs() {
    setLoading(true);
    try {
      const res = await getKnowledgeBases();
      setKbs(res.data);
    } catch (err) {
      console.error('Failed to load KBs:', err);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createKnowledgeBase(newName.trim(), newDesc.trim());
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      await loadKBs();
    } catch (err) {
      console.error('Failed to create KB:', err);
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this knowledge base and all its documents?')) return;
    try {
      await deleteKnowledgeBase(id);
      setKbs((prev) => prev.filter((kb) => kb.id !== id));
    } catch (err) {
      console.error('Failed to delete KB:', err);
    }
  }

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, padding: '0 8px', textDecoration: 'none', color: 'white' }}>
          <BotMessageSquare style={{ width: 24, height: 24, color: '#60a5fa' }} />
          <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>SupportRAG</span>
        </Link>

        <Link
          to="/dashboard"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            background: 'rgba(37, 99, 235, 0.1)', color: '#60a5fa', borderRadius: 8,
            textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
          }}
        >
          <Database style={{ width: 16, height: 16 }} />
          Knowledge Bases
        </Link>

        <div style={{ marginTop: 'auto', padding: '16px 8px 0', borderTop: '1px solid #1e293b' }}>
          <UserButton showName />
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0 }}>Knowledge Bases</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: 4 }}>Upload documents and chat with AI about them</p>
          </div>
          <button onClick={() => setShowCreate(true)} style={styles.createBtn}>
            <Plus style={{ width: 16, height: 16 }} />
            New Knowledge Base
          </button>
        </header>

        {/* Create KB Modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={styles.modal}
              onClick={() => setShowCreate(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={styles.modalBox}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Create Knowledge Base</h2>
                  <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, color: '#94a3b8' }}>
                    <X style={{ width: 20, height: 20 }} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: 6 }}>Name</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Product Documentation"
                      style={styles.input}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: 6 }}>
                      Description <span style={{ color: '#64748b' }}>(optional)</span>
                    </label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="What kind of documents will this contain?"
                      rows={3}
                      style={styles.textarea}
                    />
                  </div>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                    style={{
                      ...styles.createBtn,
                      width: '100%', justifyContent: 'center',
                      opacity: creating || !newName.trim() ? 0.5 : 1,
                    }}
                  >
                    {creating ? (
                      <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Creating...</>
                    ) : 'Create'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KB Cards */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader2 style={{ width: 32, height: 32, color: '#60a5fa', animation: 'spin 1s linear infinite' }} />
              <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Loading knowledge bases...</span>
            </div>
          </div>
        ) : kbs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 256, textAlign: 'center' }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 16, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Database style={{ width: 32, height: 32, color: '#475569' }} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>No knowledge bases yet</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 24, maxWidth: 360 }}>
              Create your first knowledge base and upload documents to start chatting with AI.
            </p>
            <button onClick={() => setShowCreate(true)} style={styles.createBtn}>
              <Plus style={{ width: 16, height: 16 }} />
              Create First KB
            </button>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {kbs.map((kb, i) => (
              <motion.div
                key={kb.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={styles.card}
                whileHover={{ borderColor: '#334155', y: -4 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Database style={{ width: 20, height: 20, color: 'white' }} />
                  </div>
                  <button
                    onClick={() => handleDelete(kb.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#475569', transition: 'all 0.2s' }}
                    title="Delete"
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'none'; }}
                  >
                    <Trash2 style={{ width: 16, height: 16 }} />
                  </button>
                </div>

                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 4, color: 'white' }}>{kb.name}</h3>
                {kb.description && (
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 16, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{kb.description}</p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.75rem', color: '#64748b', marginBottom: 16 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FileText style={{ width: 14, height: 14 }} />
                    {kb.documents.length} doc{kb.documents.length !== 1 ? 's' : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MessageSquare style={{ width: 14, height: 14 }} />
                    {kb._count.chats} chat{kb._count.chats !== 1 ? 's' : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Link
                    to={`/kb/${kb.id}`}
                    style={{
                      flex: 1, textAlign: 'center', padding: '8px 0', fontSize: '0.875rem', fontWeight: 500,
                      borderRadius: 8, background: 'rgba(51, 65, 85, 0.5)', color: '#cbd5e1', textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    Manage
                  </Link>
                  <Link
                    to={`/kb/${kb.id}/chat`}
                    style={{
                      flex: 1, textAlign: 'center', padding: '8px 0', fontSize: '0.875rem', fontWeight: 500,
                      borderRadius: 8, background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    Chat →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Spin animation for loaders */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
