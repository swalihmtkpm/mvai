import React, { useState } from 'react';
import { Plus, Search, MessageSquare, Trash2, Settings, Menu, X, Edit2, Check } from 'lucide-react';
import { Logo } from './Logo';
import { Chat } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Auth } from './Auth';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onSearch: (query: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onSearch,
  isOpen,
  onToggle
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  const startEditing = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const saveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameChat(id, editTitle.trim());
    }
    setEditingChatId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-zinc-950 border-r border-zinc-800 transition-transform duration-300 lg:relative lg:translate-x-0",
        !isOpen && "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-aqua-blue/20 flex items-center justify-center overflow-hidden">
                <Logo className="w-6 h-6 object-contain" />
              </div>
              <h1 className="text-xl font-bold aqua-text tracking-tight">MeemVa AI</h1>
            </div>
            <button 
              onClick={onToggle}
              className="lg:hidden p-2 text-zinc-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <button
            onClick={onNewChat}
            className="flex items-center gap-2 w-full px-4 py-3 mb-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-aqua-blue/50 transition-all group"
          >
            <Plus size={18} className="text-aqua-blue group-hover:scale-110 transition-transform" />
            <span className="font-medium">New Chat</span>
          </button>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-aqua-blue/50 transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all",
                  activeChatId === chat.id 
                    ? "bg-aqua-blue/10 border border-aqua-blue/20" 
                    : "hover:bg-zinc-900 border border-transparent"
                )}
                onClick={() => onSelectChat(chat.id)}
              >
                <MessageSquare 
                  size={18} 
                  className={activeChatId === chat.id ? "text-aqua-blue" : "text-zinc-500"} 
                />
                <div className="flex-1 min-w-0">
                  {editingChatId === chat.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => saveRename(chat.id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRename(chat.id)}
                        className="w-full bg-zinc-800 text-sm px-1 rounded focus:outline-none focus:ring-1 focus:ring-aqua-blue"
                      />
                      <button onClick={(e) => { e.stopPropagation(); saveRename(chat.id); }}>
                        <Check size={14} className="text-emerald-500" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className={cn(
                        "text-sm font-medium truncate",
                        activeChatId === chat.id ? "text-white" : "text-zinc-300"
                      )}>
                        {chat.title}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {formatDistanceToNow(chat.updatedAt)} ago
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(chat);
                    }}
                    className="p-1.5 text-zinc-600 hover:text-aqua-blue"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="p-1.5 text-zinc-600 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-zinc-800">
            <Auth />
          </div>
        </div>
      </aside>
    </>
  );
};
