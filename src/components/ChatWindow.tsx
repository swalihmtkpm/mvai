import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, Paperclip, X, Loader2, Play, FileText } from 'lucide-react';
import { Logo } from './Logo';
import { compressImage } from '../utils/image';
import { generateVideoThumbnail } from '../utils/video';
import { Message } from '../types';
import { MessageItem } from './MessageItem';
import { generateText, generateImage, generateVideo } from '../services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (content: string, type: Message['type'], mediaUrl?: string, fileData?: { data: string, mimeType: string }[]) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onAddAIMessage: (content: string, type: Message['type'], mediaUrl?: string) => void;
  isLoading: boolean;
  isLoggedIn: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  onSendMessage,
  onEditMessage,
  onAddAIMessage,
  isLoading,
  isLoggedIn
}) => {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ file: File, preview: string, fullData: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const processFiles = (files: File[]) => {
    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit for inlineData

    files.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File ${file.name} is too large. Please upload files smaller than 15MB for analysis.`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        let fullData = reader.result as string;
        let preview = fullData;

        if (file.type.startsWith('image/')) {
          try {
            preview = await compressImage(fullData);
          } catch (err) {
            console.error('Compression failed', err);
          }
        } else if (file.type.startsWith('video/')) {
          try {
            preview = await generateVideoThumbnail(file);
          } catch (err) {
            console.error('Thumbnail generation failed', err);
            // Fallback to video icon if thumbnail fails
          }
        }
        
        setAttachedFiles(prev => [...prev, { file, preview, fullData }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (files.length > 0) {
      processFiles(files);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isGenerating) return;

    const currentInput = input.trim();
    const currentFiles = [...attachedFiles];
    setInput('');
    setAttachedFiles([]);
    setIsGenerating(true);

    try {
      // Multimodal or Text
      if (currentFiles.length > 0) {
        const firstMedia = currentFiles.find(f => f.file.type.startsWith('image/') || f.file.type.startsWith('video/'));
        const fileData = currentFiles.map(f => ({ data: f.fullData, mimeType: f.file.type }));
        
        // If it's a single video, we want to try and show it as a video player
        const isSingleVideo = currentFiles.length === 1 && currentFiles[0].file.type.startsWith('video/');
        const mediaUrl = isSingleVideo ? currentFiles[0].fullData : firstMedia?.preview;
        const messageType = isSingleVideo ? 'video' : 'multimodal';

        onSendMessage(currentInput || (isSingleVideo ? "Analyze this video" : "Analyze these files"), messageType, mediaUrl, fileData);
      } else {
        onSendMessage(currentInput, 'text');
      }
    } catch (error: any) {
      console.error(error);
      onAddAIMessage(`Error: ${error.message}`, 'text');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-aqua-blue/20 flex items-center justify-center overflow-hidden">
            <Logo className="w-6 h-6 object-contain" />
          </div>
          <div>
            <h2 className="font-bold text-sm tracking-wide uppercase">MeemVa AI</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Active Now</span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-aqua-blue/10 flex items-center justify-center aqua-glow overflow-hidden p-4">
              <Logo className="w-full h-full object-contain" />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">Welcome to MeemVa AI</h3>
              <p className="text-zinc-500">
                Your sophisticated AI companion for text and multimodal analysis.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isLastUserMessage = msg.role === 'user' && 
              !messages.slice(index + 1).some(m => m.role === 'user');
            
            return (
              <MessageItem 
                key={msg.id} 
                message={msg} 
                onEdit={isLastUserMessage ? onEditMessage : undefined}
              />
            );
          })
        )}
        {isGenerating && (
          <div className="p-6 flex gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-aqua-blue/10 flex items-center justify-center">
              <Loader2 className="animate-spin text-aqua-blue" size={20} />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-zinc-900 rounded w-1/4" />
              <div className="h-4 bg-zinc-900 rounded w-3/4" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto relative">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachedFiles.map((file, i) => (
                <div key={i} className="relative group">
                  {file.file.type.startsWith('image/') ? (
                    <img src={file.preview} className="w-16 h-16 object-cover rounded-lg border border-zinc-800" />
                  ) : file.file.type.startsWith('video/') ? (
                    <div className="relative w-16 h-16 bg-zinc-800 rounded-lg border border-zinc-800 overflow-hidden flex items-center justify-center">
                      <video src={file.preview} className="w-full h-full object-cover opacity-50" />
                      <Play size={16} className="absolute text-white" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-zinc-800 rounded-lg flex items-center justify-center">
                      <FileText size={24} className="text-zinc-500" />
                    </div>
                  )}
                  <button 
                    onClick={() => removeFile(i)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative group">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              multiple 
              className="hidden" 
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onPaste={handlePaste}
              placeholder="Type your message here..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 pr-40 min-h-[60px] max-h-48 resize-none focus:outline-none focus:border-aqua-blue/50 transition-all text-sm"
              rows={1}
            />
            
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                  }
                }}
                className="p-2 text-zinc-500 hover:text-aqua-blue transition-colors rounded-xl"
                title="Upload Images"
              >
                <ImageIcon size={20} />
              </button>
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachedFiles.length === 0) || isGenerating}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  (input.trim() || attachedFiles.length > 0) && !isGenerating 
                    ? "bg-aqua-blue text-black hover:scale-105" 
                    : "bg-zinc-800 text-zinc-600"
                )}
              >
                {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </div>
          </div>
          
          <p className="mt-2 text-[10px] text-center text-zinc-600 font-medium uppercase tracking-widest">
            MeemVa AI may take a few seconds for deep thinking. Please check important information.
          </p>
        </div>
      </div>
    </div>
  );
};
