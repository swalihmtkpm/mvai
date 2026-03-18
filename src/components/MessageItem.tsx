import React, { useState } from 'react';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, Bot, Image as ImageIcon, Video, Play, Download, Copy, Check, Pencil, Save, X as CloseIcon, FileText } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MessageItemProps {
  message: Message;
  onEdit?: (id: string, content: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onEdit }) => {
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      "flex gap-4 p-6 transition-colors group",
      isAssistant ? "bg-zinc-900/50" : "bg-transparent"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
        isAssistant ? "bg-aqua-blue/20 text-aqua-blue" : "bg-zinc-800 text-zinc-400"
      )}>
        {isAssistant ? <Bot size={24} /> : <User size={24} />}
      </div>

      <div className="flex-1 min-w-0 space-y-2 relative">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide uppercase">
              {isAssistant ? 'MeemVa' : 'You'}
            </span>
            <span className="text-xs text-zinc-500">
              {format(message.timestamp, 'HH:mm')}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {onEdit && !isAssistant && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-zinc-500 hover:text-aqua-blue opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-aqua-blue/10"
                title="Edit message"
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1.5 text-zinc-500 hover:text-aqua-blue opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-aqua-blue/10"
              title="Copy message"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm focus:outline-none focus:border-aqua-blue/50 min-h-[100px] resize-y"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
              >
                <CloseIcon size={14} />
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editContent.trim() && editContent !== message.content) {
                    onEdit?.(message.id, editContent);
                  }
                  setIsEditing(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-aqua-blue text-black rounded-lg hover:scale-105 transition-all"
              >
                <Save size={14} />
                Save & Resend
              </button>
            </div>
          </div>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {message.fileData && message.fileData.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-4">
            {message.fileData.map((file, idx) => (
              <div key={idx} className="relative group max-w-2xl">
                {file.mimeType.startsWith('image/') ? (
                  <img 
                    src={file.data} 
                    alt="Uploaded content" 
                    className="rounded-2xl border border-zinc-800 aqua-glow max-h-[500px] object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : file.mimeType.startsWith('video/') ? (
                  <video 
                    src={file.data} 
                    controls 
                    className="rounded-2xl border border-zinc-800 aqua-glow max-h-[500px] w-full"
                  />
                ) : (
                  <div className="p-4 bg-zinc-800 rounded-2xl border border-zinc-700 flex items-center gap-3">
                    <FileText className="text-zinc-500" />
                    <span className="text-sm text-zinc-300">Attachment {idx + 1}</span>
                  </div>
                )}
                <a 
                  href={file.data} 
                  download={`meemva-content-${idx}`}
                  className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                >
                  <Download size={18} className="text-white" />
                </a>
              </div>
            ))}
          </div>
        ) : (message.type === 'image' || message.type === 'multimodal') && message.mediaUrl && (
          <div className="mt-4 relative group max-w-2xl">
            {message.mediaUrl.startsWith('data:video/') ? (
              <video 
                src={message.mediaUrl} 
                controls 
                className="rounded-2xl border border-zinc-800 aqua-glow max-h-[500px] w-full"
              />
            ) : (
              <img 
                src={message.mediaUrl} 
                alt="Uploaded content" 
                className="rounded-2xl border border-zinc-800 aqua-glow max-h-[500px] object-contain"
                referrerPolicy="no-referrer"
              />
            )}
            <a 
              href={message.mediaUrl} 
              download={message.mediaUrl.startsWith('data:video/') ? "meemva-content.mp4" : "meemva-content.png"}
              className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <Download size={18} className="text-white" />
            </a>
          </div>
        )}

        {message.type === 'video' && message.mediaUrl && (
          <div className="mt-4 max-w-2xl">
            <video 
              src={message.mediaUrl} 
              controls 
              className="rounded-2xl border border-zinc-800 aqua-glow w-full"
            />
          </div>
        )}

        {message.type === 'audio' && message.mediaUrl && (
          <div className="mt-4 max-w-md">
            <audio 
              src={message.mediaUrl} 
              controls 
              className="w-full h-10 rounded-full bg-zinc-800"
            />
          </div>
        )}
      </div>
    </div>
  );
};
