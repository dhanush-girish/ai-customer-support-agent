import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { BotMessageSquare, Upload, MessageSquare, Shield, Zap, Database } from 'lucide-react';

function FeatureCard({ icon: Icon, title, desc, color }: {
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group"
      style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid #1e293b', background: 'rgba(15, 23, 42, 0.7)', transition: 'all 0.3s' }}
      whileHover={{ borderColor: '#334155', y: -4 }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: color,
          marginBottom: 16,
          transition: 'transform 0.3s',
        }}
      >
        <Icon style={{ width: 24, height: 24, color: 'white' }} />
      </div>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'white' }}>{title}</h3>
      <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6 }}>{desc}</p>
    </motion.div>
  );
}

const features = [
  {
    icon: Upload,
    title: 'Upload Documents',
    desc: 'Drop in PDFs or text files — we extract and index them automatically.',
    color: 'linear-gradient(135deg, #3b82f6, #22d3ee)',
  },
  {
    icon: MessageSquare,
    title: 'AI Chat',
    desc: 'Ask questions and get instant, context-aware answers with source citations.',
    color: 'linear-gradient(135deg, #a855f7, #ec4899)',
  },
  {
    icon: Database,
    title: 'Knowledge Bases',
    desc: 'Organize docs into separate knowledge bases for different projects or teams.',
    color: 'linear-gradient(135deg, #f97316, #eab308)',
  },
  {
    icon: Zap,
    title: 'Streaming Responses',
    desc: 'Real-time streaming answers powered by Google Gemini 2.0 Flash.',
    color: 'linear-gradient(135deg, #22c55e, #10b981)',
  },
  {
    icon: Shield,
    title: 'Secure Auth',
    desc: 'Google authentication via Clerk — your data stays private.',
    color: 'linear-gradient(135deg, #ef4444, #fb7185)',
  },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: 'white', overflow: 'hidden', position: 'relative' }}>
      {/* Background gradient blobs */}
      <div style={{
        position: 'absolute', top: -200, left: '20%', width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
        filter: 'blur(80px)', zIndex: 0,
      }} />
      <div style={{
        position: 'absolute', bottom: -100, right: '10%', width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, transparent 70%)',
        filter: 'blur(80px)', zIndex: 0,
      }} />

      {/* Navbar */}
      <header style={{
        padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 10, borderBottom: '1px solid rgba(30, 41, 59, 0.5)',
        background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BotMessageSquare style={{ width: 28, height: 28, color: '#60a5fa' }} />
          <span style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.025em' }}>SupportRAG</span>
        </div>
        <nav>
          <SignedOut>
            <SignInButton mode="modal">
              <button style={{
                padding: '8px 20px', background: 'linear-gradient(to right, #2563eb, #4f46e5)',
                borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, color: 'white',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              }}>
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Link to="/dashboard" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0', textDecoration: 'none' }}>Dashboard</Link>
              <UserButton />
            </div>
          </SignedIn>
        </nav>
      </header>

      {/* Hero */}
      <main style={{ maxWidth: '56rem', margin: '0 auto', paddingTop: '8rem', paddingBottom: '5rem', paddingLeft: 24, paddingRight: 24, textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 9999, border: '1px solid rgba(59, 130, 246, 0.2)',
            background: 'rgba(59, 130, 246, 0.08)', color: '#60a5fa', fontSize: '0.875rem',
            fontWeight: 500, marginBottom: 32,
          }}>
            <BotMessageSquare style={{ width: 16, height: 16 }} />
            Powered by Gemini 2.5 & pgvector
          </div>
        </motion.div>

        <motion.h1
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800, letterSpacing: '-0.03em',
            marginBottom: 24, lineHeight: 1.1,
            background: 'linear-gradient(to right, #60a5fa, #818cf8, #a855f7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          AI Customer<br />Support Agent
        </motion.h1>

        <motion.p
          style={{ fontSize: '1.125rem', color: '#94a3b8', maxWidth: '36rem', margin: '0 auto', lineHeight: 1.7, marginBottom: 48 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Upload your documents, build knowledge bases, and let AI handle customer questions
          with accurate, source-cited answers in real time.
        </motion.p>

        <motion.div
          style={{ display: 'flex', justifyContent: 'center', gap: 16 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <SignedOut>
            <SignInButton mode="modal">
              <button style={{
                padding: '14px 36px', background: 'linear-gradient(to right, #2563eb, #4f46e5)',
                borderRadius: 14, fontSize: '1.125rem', fontWeight: 600, color: 'white',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 8px 32px rgba(37, 99, 235, 0.3)',
              }}>
                Get Started — Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              to="/dashboard"
              style={{
                padding: '14px 36px', background: 'linear-gradient(to right, #2563eb, #4f46e5)',
                borderRadius: 14, fontSize: '1.125rem', fontWeight: 600, color: 'white',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 32px rgba(37, 99, 235, 0.3)', transition: 'all 0.2s',
              }}
            >
              Go to Dashboard →
            </Link>
          </SignedIn>
        </motion.div>
      </main>

      {/* Features Grid */}
      <section style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 24px 80px', position: 'relative', zIndex: 10 }}>
        <motion.h2
          style={{ fontSize: '1.875rem', fontWeight: 700, textAlign: 'center', marginBottom: 64, color: '#e2e8f0' }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Everything you need for AI-powered support
        </motion.h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {features.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} desc={f.desc} color={f.color} />
          ))}
        </div>
      </section>
    </div>
  );
}
