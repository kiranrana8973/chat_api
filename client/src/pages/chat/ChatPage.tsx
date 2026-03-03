import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import type { Conversation, Message, User } from '../../api/types';
import {
  Send, ImagePlus, Search, LogOut, Plus, X, MessageCircle, Check, CheckCheck, ChevronUp,
} from 'lucide-react';

const avatarColors = [
  'from-blue-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
  'from-cyan-500 to-blue-500',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function ChatPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchUsers, setSearchUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);

  const getOther = useCallback((conv: Conversation) => {
    return conv.participants.find((p) => p._id !== user?._id) || conv.participants[0];
  }, [user]);

  // Socket.IO setup
  useEffect(() => {
    if (!token) return;
    const socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('new-message', (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      setConversations((prev) =>
        prev.map((c) =>
          c._id === msg.conversation || c._id === (msg as any).conversation?._id
            ? { ...c, lastMessage: msg, updatedAt: msg.createdAt }
            : c,
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      );
    });

    socket.on('user-online', ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    });

    socket.on('user-offline', ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    socket.on('typing', ({ conversationId, senderId }: { conversationId: string; senderId: string }) => {
      setTypingUsers((prev) => new Map(prev).set(conversationId, senderId));
    });

    socket.on('stop-typing', ({ conversationId }: { conversationId: string }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(conversationId);
        return next;
      });
    });

    socket.on('messages-read', ({ conversationId, readByUserId }: { conversationId: string; readByUserId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.conversation === conversationId && !m.readBy.includes(readByUserId)
            ? { ...m, readBy: [...m.readBy, readByUserId] }
            : m,
        ),
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    api.get('/conversations').then(({ data }) => setConversations(data));
  }, []);

  useEffect(() => {
    if (!activeConv) return;
    setMessages([]);
    setPage(1);
    setLoadingMessages(true);
    api.get(`/messages/${activeConv._id}`, { params: { page: 1, limit: 50 } })
      .then(({ data }) => {
        setMessages(data.messages.reverse());
        setTotalPages(data.totalPages);
        socketRef.current?.emit('mark-read', { conversationId: activeConv._id });
      })
      .finally(() => setLoadingMessages(false));
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMore = async () => {
    if (!activeConv || page >= totalPages) return;
    const nextPage = page + 1;
    const { data } = await api.get(`/messages/${activeConv._id}`, { params: { page: nextPage, limit: 50 } });
    setMessages((prev) => [...data.messages.reverse(), ...prev]);
    setPage(nextPage);
  };

  const handleSend = () => {
    if (!text.trim() || !activeConv || !socketRef.current) return;
    socketRef.current.emit('send-message', {
      conversationId: activeConv._id,
      text: text.trim(),
      type: 'text',
    });
    setText('');
    socketRef.current.emit('stop-typing', {
      conversationId: activeConv._id,
      receiverId: getOther(activeConv)._id,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('conversationId', activeConv._id);
      formData.append('type', 'image');
      formData.append('image', file);
      const { data } = await api.post('/messages', formData);
      setMessages((prev) => {
        if (prev.some((m) => m._id === data._id)) return prev;
        return [...prev, data];
      });
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConv._id
            ? { ...c, lastMessage: data, updatedAt: data.createdAt }
            : c,
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      );
    } catch { /* ignore */ }
    setSending(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTyping = () => {
    if (!activeConv || !socketRef.current) return;
    const other = getOther(activeConv);
    socketRef.current.emit('typing', {
      conversationId: activeConv._id,
      receiverId: other._id,
    });
  };

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchUsers([]); return; }
    const { data } = await api.get('/users', { params: { search: q } });
    setSearchUsers(data);
  };

  const startConversation = async (participantId: string) => {
    const { data } = await api.post('/conversations', { participantId });
    setConversations((prev) => {
      if (prev.some((c) => c._id === data._id)) return prev;
      return [data, ...prev];
    });
    setActiveConv(data);
    setShowNewChat(false);
    setSearchQuery('');
    setSearchUsers([]);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const isOnline = (userId: string) => onlineUsers.has(userId);

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar */}
      <div className="w-[340px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
              <MessageCircle size={18} className="text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">Messages</h1>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setShowNewChat(true)}
              className="p-2.5 hover:bg-gray-100 rounded-xl transition-all text-gray-500 hover:text-indigo-600" title="New chat">
              <Plus size={18} />
            </button>
            <button onClick={handleLogout}
              className="p-2.5 hover:bg-gray-100 rounded-xl transition-all text-gray-500 hover:text-red-500" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <MessageCircle size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">No conversations yet</p>
              <p className="text-gray-400 text-sm mt-1 mb-4">Start chatting with someone</p>
              <button onClick={() => setShowNewChat(true)}
                className="text-sm text-indigo-600 font-semibold hover:text-indigo-700 transition">
                Start a new chat
              </button>
            </div>
          ) : conversations.map((conv) => {
            const other = getOther(conv);
            const isActive = activeConv?._id === conv._id;
            const typing = typingUsers.get(conv._id);
            const color = getAvatarColor(other.fname + other.lname);
            return (
              <button key={conv._id} onClick={() => setActiveConv(conv)}
                className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all ${
                  isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}>
                <div className="relative shrink-0">
                  <div className={`w-11 h-11 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-white text-sm font-bold`}>
                    {other.fname[0]}{other.lname[0]}
                  </div>
                  {(isOnline(other._id) || other.isOnline) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-[2.5px] border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className={`font-semibold text-sm ${isActive ? 'text-indigo-700' : 'text-gray-900'}`}>
                      {other.fname} {other.lname}
                    </span>
                    {conv.lastMessage && (
                      <span className="text-[11px] text-gray-400 ml-2 shrink-0">{formatTime(conv.lastMessage.createdAt)}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {typing ? (
                      <span className="text-indigo-500 font-medium">typing...</span>
                    ) : conv.lastMessage ? (
                      conv.lastMessage.type === 'image' ? 'Sent an image' : conv.lastMessage.text
                    ) : (
                      <span className="text-gray-400">No messages yet</span>
                    )}
                  </p>
                </div>
                {isActive && <div className="w-1 h-8 bg-indigo-600 rounded-full -mr-1" />}
              </button>
            );
          })}
        </div>

        {/* Current user info */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center gap-3">
          <div className={`w-9 h-9 bg-gradient-to-br ${user ? getAvatarColor(user.fname + user.lname) : 'from-gray-400 to-gray-500'} rounded-lg flex items-center justify-center text-white text-xs font-bold`}>
            {user?.fname[0]}{user?.lname[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.fname} {user?.lname}</p>
            <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      {activeConv ? (() => {
        const other = getOther(activeConv);
        const color = getAvatarColor(other.fname + other.lname);
        return (
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="h-16 px-6 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0">
              <div className="relative">
                <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-white text-sm font-bold`}>
                  {other.fname[0]}{other.lname[0]}
                </div>
                {(isOnline(other._id) || other.isOnline) && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {other.fname} {other.lname}
                </h3>
                <p className="text-xs text-gray-500">
                  {typingUsers.has(activeConv._id) ? (
                    <span className="text-indigo-500 font-medium">typing...</span>
                  ) : isOnline(other._id) || other.isOnline ? (
                    <span className="text-emerald-500">Online</span>
                  ) : (
                    `Last seen ${formatTime(other.lastSeen)}`
                  )}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 bg-gray-50">
              {page < totalPages && (
                <button onClick={loadMore}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium py-2.5 hover:bg-indigo-50 rounded-xl transition-all">
                  <ChevronUp size={14} />
                  Load older messages
                </button>
              )}

              {loadingMessages ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                    <MessageCircle size={24} className="text-gray-300" />
                  </div>
                  <p className="text-gray-400 text-sm">No messages yet. Say hello!</p>
                </div>
              ) : messages.map((msg) => {
                const isMine = (typeof msg.sender === 'string' ? msg.sender : msg.sender._id) === user?._id;
                const readByOther = msg.readBy.length > 1;
                return (
                  <div key={msg._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[65%] rounded-2xl px-4 py-2.5 ${
                      isMine
                        ? 'bg-indigo-600 text-white rounded-br-lg'
                        : 'bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-lg'
                    }`}>
                      {msg.type === 'image' && msg.image && (
                        <img src={`/${msg.image}`} alt="Sent image"
                          className="rounded-xl max-w-full max-h-52 mb-1.5 cursor-pointer hover:opacity-90 transition"
                          onClick={() => window.open(`/${msg.image}`, '_blank')} />
                      )}
                      {msg.text && <p className="text-[14px] leading-relaxed">{msg.text}</p>}
                      <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[10px] ${isMine ? 'text-indigo-300' : 'text-gray-400'}`}>
                          {formatTime(msg.createdAt)}
                        </span>
                        {isMine && (
                          readByOther
                            ? <CheckCheck size={13} className="text-blue-300" />
                            : <Check size={13} className="text-indigo-300" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {typingUsers.has(activeConv._id) && (
                <div className="flex justify-start">
                  <div className="bg-white shadow-sm border border-gray-100 rounded-2xl px-4 py-3 rounded-bl-lg">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-3.5 bg-white border-t border-gray-200">
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <button onClick={() => fileInputRef.current?.click()} disabled={sending}
                  className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                  <ImagePlus size={20} />
                </button>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => { setText(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-200 border border-transparent transition-all placeholder:text-gray-400"
                />
                <button onClick={handleSend} disabled={!text.trim() || sending}
                  className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-sm shadow-indigo-500/25 active:scale-95">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        );
      })() : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={36} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-500">Select a conversation</h3>
            <p className="text-sm text-gray-400 mt-1.5 max-w-xs">
              Choose from your existing chats or start a new one
            </p>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">New Conversation</h3>
              <button onClick={() => { setShowNewChat(false); setSearchUsers([]); setSearchQuery(''); }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchQuery} onChange={(e) => handleSearchUsers(e.target.value)}
                  placeholder="Search by name or email..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400" />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {searchUsers.length === 0 && searchQuery && (
                  <p className="text-center text-sm text-gray-400 py-8">No users found</p>
                )}
                {!searchQuery && (
                  <p className="text-center text-sm text-gray-400 py-8">
                    Type a name or email to find users
                  </p>
                )}
                {searchUsers.map((u) => {
                  const color = getAvatarColor(u.fname + u.lname);
                  return (
                    <button key={u._id} onClick={() => startConversation(u._id)}
                      className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-xl text-left transition-all">
                      <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-white text-sm font-bold`}>
                        {u.fname[0]}{u.lname[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{u.fname} {u.lname}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
