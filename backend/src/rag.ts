import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import { getPrisma } from './db.js';

// pdf-parse has CJS-only types, use require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;

// ─── Gemini Client (lazy init so env vars are loaded) ─────
let _genai: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!_genai) {
    _genai = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']! });
  }
  return _genai;
}

// ─── Text Extraction ──────────────────────────────────────
export async function extractText(filePath: string, mimeType: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);

  if (mimeType === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }

  // Default: treat as plain text
  return buffer.toString('utf-8');
}

// ─── Chunking ─────────────────────────────────────────────
export function chunkText(text: string, chunkSize = 800, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start += chunkSize - overlap;
  }

  return chunks;
}

// ─── Embedding Generation ─────────────────────────────────
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getGenAI().models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      outputDimensionality: 768
    }
  });

  return response.embeddings?.[0]?.values ?? [];
}

// ─── Batch Embed & Store Chunks ───────────────────────────
export async function processDocument(
  documentId: string,
  text: string
): Promise<number> {
  const prisma = await getPrisma();
  const chunks = chunkText(text);

  // Helper to sleep and avoid hitting the 15 RPM / quota limits of Gemini free tier
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const chunkContent of chunks) {
    try {
      const embedding = await generateEmbedding(chunkContent);
      const vectorStr = `[${embedding.join(',')}]`;

      // Insert chunk with embedding using raw SQL (pgvector)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3::vector, NOW())`,
        documentId,
        chunkContent,
        vectorStr
      );
      
      // Delay to avoid hitting rate limits (429 Too Many Requests)
      await sleep(1000); 
    } catch (err) {
      console.error('Error generating embedding for chunk:', err);
      // We can continue with the next chunk even if one hits rate limits, 
      // but let's pause a bit longer if we do hit a 429
      await sleep(5000);
    }
  }

  return chunks.length;
}

// ─── Similarity Search ────────────────────────────────────
export async function searchSimilarChunks(
  knowledgeBaseId: string,
  query: string,
  topK = 5
): Promise<{ id: string; content: string; score: number; documentName: string }[]> {
  const prisma = await getPrisma();
  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const results: any[] = await prisma.$queryRawUnsafe(
    `SELECT dc.id, dc.content,
            1 - (dc.embedding <=> $1::vector) as score,
            d.name as "documentName"
     FROM "DocumentChunk" dc
     JOIN "Document" d ON d.id = dc."documentId"
     WHERE d."knowledgeBaseId" = $2
       AND dc.embedding IS NOT NULL
     ORDER BY dc.embedding <=> $1::vector
     LIMIT $3`,
    vectorStr,
    knowledgeBaseId,
    topK
  );

  return results.map((r: any) => ({
    id: r.id as string,
    content: r.content as string,
    score: Number(r.score),
    documentName: r.documentName as string,
  }));
}

// ─── Chat with RAG context (Streaming) ────────────────────
export async function* streamChatResponse(
  knowledgeBaseId: string,
  userMessage: string,
  chatHistory: { role: string; content: string }[]
): AsyncGenerator<string> {
  // 1. Find relevant chunks
  const relevantChunks = await searchSimilarChunks(knowledgeBaseId, userMessage, 5);

  const contextText = relevantChunks
    .map((c, i) => `[Source ${i + 1} - ${c.documentName}]:\n${c.content}`)
    .join('\n\n---\n\n');

  // 2. Build the prompt
  const systemPrompt = `You are a helpful AI customer support agent. Answer the user's question based ONLY on the provided context from the knowledge base. If the context doesn't contain enough information to answer the question, say so honestly.

When citing information, reference the source document name.

## Context from Knowledge Base:
${contextText || 'No relevant documents found in the knowledge base.'}`;

  // 3. Build message history
  const messages: { role: string; parts: { text: string }[] }[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'I understand. I will answer based on the provided knowledge base context and cite sources when applicable.' }] },
  ];

  // Add chat history (last 10 messages max)
  const recentHistory = chatHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  }

  // Add the new user message
  messages.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  // 4. Stream from Gemini
  const response = await getGenAI().models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: messages as any,
  });

  // Return sources metadata as first chunk
  const sourcesPayload = JSON.stringify({
    type: 'sources',
    sources: relevantChunks.map(c => ({
      id: c.id,
      documentName: c.documentName,
      score: c.score,
      preview: c.content.substring(0, 150) + '...',
    })),
  });
  yield `data: ${sourcesPayload}\n\n`;

  // Stream text chunks
  for await (const chunk of response) {
    const text = chunk.text ?? '';
    if (text) {
      yield `data: ${JSON.stringify({ type: 'text', content: text })}\n\n`;
    }
  }

  yield `data: ${JSON.stringify({ type: 'done' })}\n\n`;
}
