import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { BotMessageSquare } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="px-6 py-4 flex items-center justify-between z-10 relative bg-slate-950/80 backdrop-blur-sm border-b border-slate-800/50">
      <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <BotMessageSquare className="w-7 h-7 text-blue-400" />
        <span className="font-bold text-xl tracking-tight text-white">SupportRAG</span>
      </Link>
      <nav>
        <SignedOut>
          <div className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg text-sm font-semibold text-white transition-all cursor-pointer hover:scale-105 active:scale-95">
            <SignInButton mode="modal" />
          </div>
        </SignedOut>
        <SignedIn>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-sm font-semibold hover:text-blue-400 text-gray-200 transition-colors">
              Dashboard
            </Link>
            <UserButton />
          </div>
        </SignedIn>
      </nav>
    </header>
  );
}
