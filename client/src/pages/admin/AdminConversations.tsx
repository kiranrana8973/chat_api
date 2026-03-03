import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import type { Conversation } from '../../api/types';
import { ChevronLeft, ChevronRight, Eye, MessageSquare } from 'lucide-react';

export default function AdminConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/conversations', { params: { page, limit: 20 } });
      setConversations(data.conversations);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
          <MessageSquare size={20} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Conversations</h2>
          <p className="text-sm text-gray-500">{total} total conversations</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Participants</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Last Message</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Updated</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-4" colSpan={4}>
                      <div className="flex items-center gap-2 animate-pulse">
                        <div className="h-7 bg-gray-100 rounded-lg w-28" />
                        <div className="h-7 bg-gray-100 rounded-lg w-28" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : conversations.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">No conversations found</td></tr>
              ) : conversations.map((c) => (
                <tr key={c._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {c.participants.map((p) => (
                        <span key={p._id} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-lg text-xs font-medium">
                          <span className={`w-2 h-2 rounded-full ${p.isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          {p.fname} {p.lname}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">
                    {c.lastMessage ? (
                      c.lastMessage.type === 'image' ? (
                        <span className="text-gray-400 italic">Image</span>
                      ) : (
                        c.lastMessage.text || <span className="text-gray-300">(empty)</span>
                      )
                    ) : (
                      <span className="text-gray-300">No messages</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(c.updatedAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => navigate(`/admin/conversations/${c._id}`)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="View messages"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
