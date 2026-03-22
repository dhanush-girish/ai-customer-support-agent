import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Attach Clerk token to every request
export function setAuthToken(getToken: () => Promise<string | null>) {
  api.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

// ─── Types ────────────────────────────────────
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  documents: DocumentInfo[];
  _count: { chats: number };
}

export interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  _count?: { chunks: number };
}

export interface Chat {
  id: string;
  title: string;
  knowledgeBaseId: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'ai';
  content: string;
  sources?: Source[];
  createdAt: string;
}

export interface Source {
  id: string;
  documentName: string;
  score: number;
  preview: string;
}

// ─── API Calls ────────────────────────────────

// User
export const getMe = () => api.get('/me');

// Knowledge Bases
export const getKnowledgeBases = () => api.get<KnowledgeBase[]>('/knowledge-bases');
export const createKnowledgeBase = (name: string, description: string) =>
  api.post<KnowledgeBase>('/knowledge-bases', { name, description });
export const deleteKnowledgeBase = (id: string) =>
  api.delete(`/knowledge-bases/${id}`);

// Documents
export const getDocuments = (kbId: string) =>
  api.get<DocumentInfo[]>(`/knowledge-bases/${kbId}/documents`);
export const uploadDocument = (kbId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/knowledge-bases/${kbId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deleteDocument = (kbId: string, docId: string) =>
  api.delete(`/knowledge-bases/${kbId}/documents/${docId}`);

// Chats
export const getChats = (kbId: string) =>
  api.get<Chat[]>(`/knowledge-bases/${kbId}/chats`);
export const createChat = (kbId: string, title?: string) =>
  api.post<Chat>(`/knowledge-bases/${kbId}/chats`, { title });
export const getChatMessages = (chatId: string) =>
  api.get<Message[]>(`/chats/${chatId}/messages`);

// Chat streaming — uses fetch for SSE
export async function sendMessageStream(
  chatId: string,
  message: string,
  token: string,
  onChunk: (data: { type: string; content?: string; sources?: Source[]; message?: string }) => void
) {
  const response = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error('No reader available');

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          onChunk(data);
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}

// Admin
export const getAdminStats = () => api.get('/admin/stats');
