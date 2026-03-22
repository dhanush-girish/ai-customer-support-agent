import express from 'express';
import type { RequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import multer from 'multer';
import fs from 'fs';
import { getPrisma } from './db.js';
import {
  extractText,
  processDocument,
  streamChatResponse,
} from './rag.js';

dotenv.config();

// Cast Clerk middleware for Express v5 compatibility
const requireAuth = ClerkExpressRequireAuth() as unknown as RequestHandler;

const app = express();
const port = process.env['PORT'] || 3000;

// Multer config — accept PDF and TXT
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are allowed'));
    }
  },
});

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ─── Helper: get internal user from Clerk auth ──────────
async function getOrCreateUser(auth: any) {
  const prisma = await getPrisma();
  const clerkUserId = auth.userId;
  let user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId: clerkUserId,
        email: auth.sessionClaims?.email || `user-${clerkUserId}@app.local`,
      },
    });
  }
  return user;
}

// ═══════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', msg: 'AI Support Agent backend running' });
});

// ═══════════════════════════════════════════════
// AUTH — User Profile
// ═══════════════════════════════════════════════

app.get('/api/me', requireAuth, async (req: any, res) => {
  try {
    const user = await getOrCreateUser(req.auth);
    res.json(user);
  } catch (err: any) {
    console.error('Error in /api/me:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// KNOWLEDGE BASES
// ═══════════════════════════════════════════════

// List all KBs for user
app.get('/api/knowledge-bases', requireAuth, async (req: any, res) => {
  try {
    const prisma = await getPrisma();
    const user = await getOrCreateUser(req.auth);

    const kbs = await prisma.knowledgeBase.findMany({
      where: { userId: user.id },
      include: {
        documents: { select: { id: true, name: true, type: true, createdAt: true } },
        _count: { select: { chats: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(kbs);
  } catch (err: any) {
    console.error('Error listing KBs:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new KB
app.post('/api/knowledge-bases', requireAuth, async (req: any, res) => {
  try {
    const prisma = await getPrisma();
    const user = await getOrCreateUser(req.auth);

    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const kb = await prisma.knowledgeBase.create({
      data: { name, description: description || '', userId: user.id },
    });
    res.json(kb);
  } catch (err: any) {
    console.error('Error creating KB:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a KB
app.delete('/api/knowledge-bases/:id', requireAuth, async (req: any, res) => {
  try {
    const prisma = await getPrisma();
    const user = await getOrCreateUser(req.auth);
    const kbId = req.params.id;

    // Verify ownership
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, userId: user.id },
    });
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

    // Cascade delete: chunks → documents → chats/messages → KB
    const docs = await prisma.document.findMany({ where: { knowledgeBaseId: kbId } });
    for (const doc of docs) {
      await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });
    }
    await prisma.document.deleteMany({ where: { knowledgeBaseId: kbId } });

    const chats = await prisma.chat.findMany({ where: { knowledgeBaseId: kbId } });
    for (const chat of chats) {
      await prisma.message.deleteMany({ where: { chatId: chat.id } });
    }
    await prisma.chat.deleteMany({ where: { knowledgeBaseId: kbId } });
    await prisma.knowledgeBase.delete({ where: { id: kbId } });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting KB:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// DOCUMENT UPLOAD & PROCESSING
// ═══════════════════════════════════════════════

// Upload a document to a KB
app.post(
  '/api/knowledge-bases/:kbId/documents',
  requireAuth,
  upload.single('file'),
  async (req: any, res) => {
    try {
      const prisma = await getPrisma();
      const user = await getOrCreateUser(req.auth);
      const kbId = req.params.kbId;

      // Verify KB ownership
      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: kbId, userId: user.id },
      });
      if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const filePath = req.file.path;
      const fileName = req.file.originalname;
      const mimeType = req.file.mimetype;

      // 1. Extract text
      const text = await extractText(filePath, mimeType);
      if (!text || text.trim().length === 0) {
        // Cleanup file
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'Could not extract text from file' });
      }

      // 2. Save document to DB
      const document = await prisma.document.create({
        data: {
          name: fileName,
          content: text,
          type: mimeType,
          knowledgeBaseId: kbId,
        },
      });

      // 3. Process: chunk + embed + store
      const chunkCount = await processDocument(document.id, text);

      // Cleanup uploaded file
      fs.unlinkSync(filePath);

      res.json({
        document: {
          id: document.id,
          name: document.name,
          type: document.type,
          createdAt: document.createdAt,
        },
        chunksCreated: chunkCount,
      });
    } catch (err: any) {
      console.error('Error uploading document:', err.message);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
);

// List documents in a KB
app.get('/api/knowledge-bases/:kbId/documents', requireAuth, async (req: any, res) => {
  try {
    const prisma = await getPrisma();
    const user = await getOrCreateUser(req.auth);
    const kbId = req.params.kbId;

    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, userId: user.id },
    });
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

    const documents = await prisma.document.findMany({
      where: { knowledgeBaseId: kbId },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        _count: { select: { chunks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(documents);
  } catch (err: any) {
    console.error('Error listing documents:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a document
app.delete('/api/knowledge-bases/:kbId/documents/:docId', requireAuth, async (req: any, res) => {
  try {
    const prisma = await getPrisma();
    const user = await getOrCreateUser(req.auth);
    const { kbId, docId } = req.params;

    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, userId: user.id },
    });
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

    await prisma.documentChunk.deleteMany({ where: { documentId: docId } });
    await prisma.document.delete({ where: { id: docId } });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting document:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════

// Create a new chat
app.post('/api/knowledge-bases/:kbId/chats', requireAuth, async (req: any, res) => {
  try {
    const prisma = await getPrisma();
    const user = await getOrCreateUser(req.auth);
    const kbId = req.params.kbId;

    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, userId: user.id },
    });
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

    const { title } = req.body;
    const chat = await prisma.chat.create({
      data: {
        title: title || 'New Chat',
        userId: user.id,
        knowledgeBaseId: kbId,
      },
    });
    res.json(chat);
  } catch (err: any) {
    console.error('Error creating chat:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List chats for a KB
app.get('/api/knowledge-bases/:kbId/chats', requireAuth, async (req: any, res) => {
  try {
    const prisma = await getPrisma();
    const user = await getOrCreateUser(req.auth);
    const kbId = req.params.kbId;

    const chats = await prisma.chat.findMany({
      where: { knowledgeBaseId: kbId, userId: user.id },
      include: {
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(chats);
  } catch (err: any) {
    console.error('Error listing chats:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get chat messages
app.get('/api/chats/:chatId/messages', requireAuth, async (req: any, res) => {
  try {
    const prisma = await getPrisma();
    const user = await getOrCreateUser(req.auth);
    const chatId = req.params.chatId;

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.id },
    });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (err: any) {
    console.error('Error getting messages:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a message & stream AI response (SSE)
app.post('/api/chats/:chatId/messages', requireAuth, async (req: any, res) => {
  try {
    const prisma = await getPrisma();
    const user = await getOrCreateUser(req.auth);
    const chatId = req.params.chatId;

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Save user message
    await prisma.message.create({
      data: {
        chatId,
        role: 'user',
        content: message,
      },
    });

    // Update chat title if it's the first message
    if (chat.messages.length === 0) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { title: message.substring(0, 80) },
      });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Build chat history for context
    const chatHistory = chat.messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // Stream AI response
    let fullResponse = '';
    let sources: any = null;

    for await (const chunk of streamChatResponse(chat.knowledgeBaseId, message, chatHistory)) {
      res.write(chunk);

      // Parse to collect full response
      try {
        const dataStr = chunk.replace('data: ', '').trim();
        if (dataStr) {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'text') {
            fullResponse += parsed.content;
          } else if (parsed.type === 'sources') {
            sources = parsed.sources;
          }
        }
      } catch {
        // Skip unparseable chunks
      }
    }

    // Save AI message to DB
    await prisma.message.create({
      data: {
        chatId,
        role: 'ai',
        content: fullResponse,
        sources: sources ? JSON.parse(JSON.stringify(sources)) : undefined,
      },
    });

    // Update chat timestamp
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    res.end();
  } catch (err: any) {
    console.error('Error in chat stream:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    }
  }
});

// ═══════════════════════════════════════════════
// ADMIN — Basic Stats
// ═══════════════════════════════════════════════

app.get('/api/admin/stats', requireAuth, async (req: any, res) => {
  try {
    const prisma = await getPrisma();

    const [userCount, kbCount, docCount, chatCount] = await Promise.all([
      prisma.user.count(),
      prisma.knowledgeBase.count(),
      prisma.document.count(),
      prisma.chat.count(),
    ]);

    res.json({
      users: userCount,
      knowledgeBases: kbCount,
      documents: docCount,
      chats: chatCount,
    });
  } catch (err: any) {
    console.error('Error getting stats:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════

async function start() {
  try {
    await getPrisma();
    app.listen(port, () => {
      console.log(`🚀 Backend listening on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
