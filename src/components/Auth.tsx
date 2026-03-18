import React from 'react';
import { LogIn, LogOut, User } from 'lucide-react';
import { signInWithGoogle, logout, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

export const Auth: React.FC = () => {
  const [user, loading] = useAuthState(auth);

  if (loading) return <div className="animate-pulse w-8 h-8 rounded-full bg-zinc-800" />;

  if (user) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 transition-colors group">
        <img 
          src={user.photoURL || ''} 
          alt={user.displayName || ''} 
          className="w-8 h-8 rounded-full border border-aqua-blue/30"
          referrerPolicy="no-referrer"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user.displayName}</p>
          <p className="text-xs text-zinc-500 truncate">{user.email}</p>
        </div>
        <button 
          onClick={logout}
          className="p-2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login Error:", error);
      alert(`Login failed: ${error.message || "Unknown error"}`);
    }
  };

  return (
    <button
      onClick={handleLogin}
      className="flex items-center justify-center w-full px-4 py-2 bg-aqua-blue text-black rounded-lg font-medium hover:bg-aqua-blue/90 transition-colors"
      title="Sign in with Google"
    >
      <LogIn size={18} />
    </button>
  );
};
