import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDocs, limit } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Chat, Message } from './types';
import { Menu } from 'lucide-react';
import { generateText, generateMultimodal, generateTextStream, generateMultimodalStream } from './services/gemini';

export default function App() {
  const [user] = useAuthState(auth);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Chats
  useEffect(() => {
    if (!user) {
      setChats([]);
      setActiveChatId(null);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      setChats(chatList);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch Messages
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(messageList);
    });

    return () => unsubscribe();
  }, [activeChatId]);

  const handleNewChat = async () => {
    if (!user) {
      setMessages([]);
      setActiveChatId(null);
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
      return;
    }

    const newChat = {
      userId: user.uid,
      title: 'New Conversation',
      lastMessage: '',
      updatedAt: Date.now(),
      createdAt: Date.now()
    };

    const docRef = await addDoc(collection(db, 'chats'), newChat);
    setActiveChatId(docRef.id);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const triggerAIResponse = async (chatId: string | null, content: string, type: Message['type'], history: Message[], fileData?: { data: string, mimeType: string }[]) => {
    try {
      const aiMsgId = (Date.now() + 1).toString();
      const initialAiMsg: Message = {
        id: aiMsgId,
        role: 'assistant',
        content: "Thinking...",
        timestamp: Date.now(),
        type: 'text'
      };
      setMessages(prev => [...prev, initialAiMsg]);

      const onChunk = (fullText: string) => {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: fullText } : m));
      };

      let finalAiResponse = "";
      if (type === 'multimodal' && fileData) {
        finalAiResponse = await generateMultimodalStream(content, fileData, history, onChunk);
      } else if (type === 'text') {
        finalAiResponse = await generateTextStream(content, history, onChunk);
      }

      if (finalAiResponse && chatId) {
        const aiMsgData = {
          role: 'assistant',
          content: finalAiResponse,
          timestamp: Date.now(),
          type: 'text'
        };
        await addDoc(collection(db, 'chats', chatId, 'messages'), aiMsgData);
        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: finalAiResponse,
          updatedAt: Date.now()
        });
      }
    } catch (error: any) {
      console.error("AI Response Error:", error);
      if (error.message?.includes("maximum allowed size")) {
        const errorMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: "MeemVa: I'm sorry, but the files you're trying to send are too large for me to process. Please try with smaller files or fewer images.",
          timestamp: Date.now(),
          type: 'text'
        };
        setMessages(prev => [...prev, errorMsg]);
      } else {
        throw error;
      }
    }
  };

  const handleSendMessage = async (content: string, type: Message['type'], mediaUrl?: string, fileData?: { data: string, mimeType: string }[]) => {
    if (!user) {
      // Local state for non-logged in users
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
        type,
        mediaUrl
      };
      setMessages(prev => [...prev, userMsg]);

      // AI response for non-logged in users
      await triggerAIResponse(null, content, type, messages, fileData);
      return;
    }

    let chatId = activeChatId;
    if (!chatId) {
      const newChat = {
        userId: user.uid,
        title: content.slice(0, 30) + '...',
        lastMessage: content,
        updatedAt: Date.now(),
        createdAt: Date.now()
      };
      const docRef = await addDoc(collection(db, 'chats'), newChat);
      chatId = docRef.id;
      setActiveChatId(chatId);
    }

    try {
      // For Firestore, we only save a small preview (mediaUrl) if it's an image.
      // We do NOT save the full fileData array to Firestore as it can easily exceed the 1MB limit.
      // We also check if mediaUrl is a large video data URL and strip it if so.
      // Firestore document limit is 1MB, so we keep mediaUrl under 800KB to be safe.
      const isLargeMedia = mediaUrl && mediaUrl.length > 800000;
      
      const userMsgData = {
        role: 'user',
        content,
        timestamp: Date.now(),
        type,
        ...(mediaUrl && !isLargeMedia && { mediaUrl }),
        // We don't save fileData to Firestore to avoid payload size errors.
        // It's only used for the AI analysis in the current session.
      };

      await addDoc(collection(db, 'chats', chatId, 'messages'), userMsgData);
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: content,
        updatedAt: Date.now(),
        ...(messages.length === 0 && { title: content.slice(0, 30) + '...' })
      });

      // We still pass the full fileData to the AI for analysis.
      await triggerAIResponse(chatId, content, type, messages, fileData);
    } catch (error: any) {
      console.error("Firestore Error:", error);
      throw error;
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return;

      const editedMessage = messages[messageIndex];
      const history = messages.slice(0, messageIndex);

      if (!user) {
        // Local state for non-logged in users
        const updatedMessage = { ...editedMessage, content: newContent, timestamp: Date.now() };
        setMessages([...history, updatedMessage]);
        await triggerAIResponse(null, newContent, editedMessage.type, history, editedMessage.fileData);
        return;
      }

      if (!activeChatId) return;

      // 2. Update the message in Firestore
      await updateDoc(doc(db, 'chats', activeChatId, 'messages', messageId), {
        content: newContent,
        timestamp: Date.now()
      });

      await updateDoc(doc(db, 'chats', activeChatId), {
        lastMessage: newContent,
        updatedAt: Date.now()
      });

      // 3. Delete all subsequent messages in Firestore
      const subsequentMessages = messages.slice(messageIndex + 1);
      for (const msg of subsequentMessages) {
        await deleteDoc(doc(db, 'chats', activeChatId, 'messages', msg.id));
      }

      // 5. Trigger AI response using history up to the edited message
      await triggerAIResponse(activeChatId, newContent, editedMessage.type, history, editedMessage.fileData);

    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  const handleAddAIMessage = async (content: string, type: Message['type'], mediaUrl?: string) => {
    if (!user || !activeChatId) return;
    
    const aiMsgData = {
      role: 'assistant',
      content,
      timestamp: Date.now(),
      type,
      ...(mediaUrl && { mediaUrl })
    };
    await addDoc(collection(db, 'chats', activeChatId, 'messages'), aiMsgData);
    await updateDoc(doc(db, 'chats', activeChatId), {
      lastMessage: content,
      updatedAt: Date.now()
    });
  };

  const handleDeleteChat = async (id: string) => {
    await deleteDoc(doc(db, 'chats', id));
    if (activeChatId === id) setActiveChatId(null);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    await updateDoc(doc(db, 'chats', id), {
      title: newTitle,
      updatedAt: Date.now()
    });
  };

  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-full overflow-hidden bg-zinc-950">
        <Sidebar
          chats={filteredChats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
          onSearch={setSearchQuery}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="flex-1 flex flex-col min-w-0 relative">
          {/* Mobile Menu Toggle */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden absolute top-4 left-4 z-20 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white"
            >
              <Menu size={20} />
            </button>
          )}

          <ChatWindow
            messages={messages}
            onSendMessage={handleSendMessage}
            onEditMessage={handleEditMessage}
            onAddAIMessage={handleAddAIMessage}
            isLoading={false}
            isLoggedIn={!!user}
          />
        </main>
      </div>
    </ErrorBoundary>
  );
}
