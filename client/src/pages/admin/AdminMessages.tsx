import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import type { Message, User } from '../../api/types';
import { ArrowLeft, ChevronLeft, ChevronRight, Image, CheckCheck } from 'lucide-react';

const avatarColors = [
  'from-blue-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function AdminMessages() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/conversations/${id}/messages`, { params: { page, limit: 30 } });
      setMessages(data.messages);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id, page]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const formatTime = (d: string) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const getSender = (sender: User | string) => {
    if (typeof sender === 'string') return { name: 'Unknown', initials: '??', color: avatarColors[0] };
    const name = `${sender.fname} ${sender.lname}`;
    return { name, initials: `${sender.fname[0]}${sender.lname[0]}`, color: getColor(name) };
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/conversations')}
          className="p-2.5 hover:bg-gray-100 rounded-xl transition-all text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Message Thread</h2>
          <p className="text-sm text-gray-500">{total} messages in this conversation</p>
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-9 h-9 bg-gray-100 rounded-lg shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-gray-100 rounded w-24" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>No messages in this conversation</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {[...messages].reverse().map((msg) => {
              const { name, initials, color } = getSender(msg.sender);
              return (
                <div key={msg._id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">{name}</span>
                        <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                        {msg.readBy.length > 1 && (
                          <CheckCheck size={14} className="text-blue-500" />
                        )}
                      </div>
                      {msg.type === 'image' ? (
                        <div className="space-y-1.5">
                          {msg.text && <p className="text-sm text-gray-700">{msg.text}</p>}
                          <div className="flex items-center gap-1.5 text-sm">
                            <Image size={14} className="text-gray-400" />
                            <a href={`/${msg.image}`} target="_blank" rel="noreferrer"
                              className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium">{msg.image}</a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 leading-relaxed">{msg.text}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/50">
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 transition-all">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
