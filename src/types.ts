export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'audio' | 'multimodal';
  mediaUrl?: string;
  fileData?: { data: string, mimeType: string }[];
  metadata?: any;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  lastMessage: string;
  updatedAt: number;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
}
