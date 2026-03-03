import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import type { Stats } from '../../api/types';
import { Users, MessageSquare, MessagesSquare, Wifi, TrendingUp } from 'lucide-react';

const statCards = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, bg: 'bg-blue-50', text: 'text-blue-600' },
  { key: 'totalConversations', label: 'Conversations', icon: MessageSquare, bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { key: 'totalMessages', label: 'Messages', icon: MessagesSquare, bg: 'bg-violet-50', text: 'text-violet-600' },
  { key: 'onlineUsers', label: 'Online Now', icon: Wifi, bg: 'bg-amber-50', text: 'text-amber-600' },
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats').then(({ data }) => {
      setStats(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.fname}
        </h1>
        <p className="text-gray-500 mt-1">Here's what's happening with your chat platform.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1,2,3,4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {statCards.map((card, i) => (
              <div key={card.key} className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md transition-shadow animate-slide-up" style={{ animationDelay: `${i * 75}ms` }}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`${card.bg} w-11 h-11 rounded-xl flex items-center justify-center`}>
                    <card.icon size={20} className={card.text} />
                  </div>
                  <TrendingUp size={16} className="text-emerald-500 mt-1" />
                </div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">
                  {stats[card.key].toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Platform Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-4">
                <div className="w-2 h-10 bg-indigo-500 rounded-full" />
                <div>
                  <p className="text-sm text-gray-500">Avg messages/conversation</p>
                  <p className="text-lg font-bold text-gray-900">
                    {stats.totalConversations > 0
                      ? Math.round(stats.totalMessages / stats.totalConversations)
                      : 0}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-2 h-10 bg-emerald-500 rounded-full" />
                <div>
                  <p className="text-sm text-gray-500">User activity rate</p>
                  <p className="text-lg font-bold text-gray-900">
                    {stats.totalUsers > 0
                      ? Math.round((stats.onlineUsers / stats.totalUsers) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-2 h-10 bg-amber-500 rounded-full" />
                <div>
                  <p className="text-sm text-gray-500">Currently online</p>
                  <p className="text-lg font-bold text-gray-900">
                    {stats.onlineUsers} user{stats.onlineUsers !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-red-600 text-sm">
          Failed to load statistics. Please try refreshing the page.
        </div>
      )}
    </div>
  );
}
