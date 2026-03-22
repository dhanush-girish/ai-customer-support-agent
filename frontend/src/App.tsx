import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import ChatPage from './pages/ChatPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/" replace />
      </SignedOut>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kb/:kbId"
        element={
          <ProtectedRoute>
            <KnowledgeBasePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kb/:kbId/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kb/:kbId/chat/:chatId"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
