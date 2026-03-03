export interface User {
  _id: string;
  fname: string;
  lname: string;
  email: string;
  authProvider: string;
  gender: string;
  batch: string;
  isProfileComplete: boolean;
  avatar: string;
  fcmToken: string;
  isOnline: boolean;
  lastSeen: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: User | string;
  type: 'text' | 'image';
  text: string;
  image: string;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  _id: string;
  participants: User[];
  lastMessage: Message | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  page: number;
  totalPages: number;
  total: number;
  [key: string]: T[] | number;
}

export interface Stats {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  onlineUsers: number;
}
