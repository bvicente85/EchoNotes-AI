import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { getSupabase } from '../supabase';
import { HistoryItem } from '../services/storage';
import { X, Search, Calendar, User, FileText, ChevronRight, LayoutGrid, List, Check, Ban, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AdminDashboardProps {
  onClose: () => void;
  onSelectMeeting: (item: HistoryItem) => void;
}

export function AdminDashboard({ onClose, onSelectMeeting }: AdminDashboardProps) {
  const [meetings, setMeetings] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Tabs and User Management States
  const [activeTab, setActiveTab] = useState<'meetings' | 'users'>('meetings');
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const { language, t } = useLanguage();

  const fetchAllMeetings = async () => {
    try {
      const supabase = getSupabase();
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('*')
        .order('created_at', { ascending: false });

      if (meetingsError) throw meetingsError;

      const userIds = [...new Set((meetingsData || []).map((item: any) => item.user_id).filter(Boolean))];
      let profilesMap: Record<string, { display_name?: string; email?: string }> = {};

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', userIds);

        if (!profilesError && profilesData) {
          profilesData.forEach((prof: any) => {
            profilesMap[prof.id] = {
              display_name: prof.display_name,
              email: prof.email
            };
          });
        }
      }

      const allMeetings: HistoryItem[] = (meetingsData || []).map((item: any) => {
        const profile = profilesMap[item.user_id];
        return {
          id: item.id,
          userId: item.user_id,
          userName: profile?.display_name || `User ${item.user_id.substring(0, 5)}`,
          userEmail: profile?.email || 'No email associated',
          date: item.created_at,
          title: item.title,
          report: item.report
        };
      });
      
      setMeetings(allMeetings);
    } catch (error) {
      console.error("Error fetching all meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    setUsersLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching all users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMeetings();
    fetchAllUsers();
  }, []);

  const handleApproveUser = async (userId: string) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('profiles')
        .update({ approved: true, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, approved: true } : u));
    } catch (err) {
      console.error("Error approving user:", err);
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('profiles')
        .update({ approved: false, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, approved: false } : u));
    } catch (err) {
      console.error("Error rejecting user:", err);
    }
  };

  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.report.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    (u.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-app-bg/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 transition-colors duration-700"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-app-card w-full max-w-6xl h-full max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-app-border"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-app-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-app-green rounded-lg flex items-center justify-center">
                <LayoutGrid className="text-app-cream" size={18} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-app-fg">Admin Dashboard</h2>
            </div>
            <p className="text-sm text-app-fg/60 font-medium">
              {activeTab === 'meetings' 
                ? 'Monitoring all user meetings and reports' 
                : 'Approve and manage user accounts'}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Tabs Selector */}
            <div className="flex bg-app-bg p-1 rounded-xl border border-app-border mr-1 shrink-0">
              <button
                onClick={() => setActiveTab('meetings')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'meetings'
                    ? 'bg-app-card shadow-xs text-app-green'
                    : 'text-app-fg/40 hover:text-app-fg'
                }`}
              >
                <FileText size={14} />
                <span>{t('meetings')}</span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 relative ${
                  activeTab === 'users'
                    ? 'bg-app-card shadow-xs text-app-green'
                    : 'text-app-fg/40 hover:text-app-fg'
                }`}
              >
                <Users size={14} />
                <span>{t('userManagement')}</span>
                {users.some(u => u.approved === false && u.role !== 'admin' && u.email !== 'brunnofilipe@gmail.com') && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-app-card" />
                )}
              </button>
            </div>

            <div className="relative flex-1 md:w-64 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
              <input 
                type="text"
                placeholder={activeTab === 'meetings' ? "Search meetings or users..." : "Search registered users..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-app-bg border border-app-border rounded-2xl text-sm focus:ring-4 focus:ring-app-green/5 focus:border-app-green transition-all outline-none text-app-fg placeholder:text-app-fg/30"
              />
            </div>

            {activeTab === 'meetings' && (
              <div className="flex items-center bg-app-bg p-1 rounded-xl border border-app-border">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-app-card shadow-sm text-app-green' : 'text-app-fg/30 hover:text-app-fg'}`}
                >
                  <List size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-app-card shadow-sm text-app-green' : 'text-app-fg/30 hover:text-app-fg'}`}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            )}

            <button 
              onClick={onClose}
              className="p-2.5 bg-app-bg text-app-fg/30 hover:bg-app-border hover:text-app-fg rounded-2xl transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-app-bg/30">
          {activeTab === 'meetings' ? (
            loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-app-border border-t-app-green rounded-full animate-spin" />
                <p className="text-sm font-bold text-app-fg/30 uppercase tracking-widest">Loading global history...</p>
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-app-bg rounded-3xl flex items-center justify-center mb-6 border border-app-border">
                  <FileText className="text-app-fg/10" size={40} />
                </div>
                <h3 className="text-xl font-bold text-app-fg mb-2">No meetings found</h3>
                <p className="text-app-fg/60 max-w-xs mx-auto">Try adjusting your search or check back later for new user activity.</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-3">
                {filteredMeetings.map((meeting) => (
                  <motion.div 
                    key={meeting.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => onSelectMeeting(meeting)}
                    className="group bg-app-card border border-app-border p-4 rounded-2xl hover:border-app-green/50 hover:shadow-xl hover:shadow-app-green/5 transition-all cursor-pointer flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-app-bg rounded-xl flex items-center justify-center group-hover:bg-app-green/10 transition-colors border border-app-border">
                      <FileText className="text-app-fg/20 group-hover:text-app-green" size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-app-fg/40 uppercase tracking-widest">
                          {new Date(meeting.date).toLocaleDateString()} • {new Date(meeting.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] font-bold text-app-green uppercase tracking-widest bg-app-green/10 px-2 py-0.5 rounded-full">
                          {meeting.userName} ({meeting.userEmail})
                        </span>
                      </div>
                      <h4 className="font-bold text-app-fg truncate group-hover:text-app-green transition-colors">{meeting.title}</h4>
                      <p className="text-xs text-app-fg/70 line-clamp-2 mt-1 leading-relaxed">{meeting.report.summary}</p>
                    </div>
                    <ChevronRight className="text-app-fg/20 group-hover:text-app-green group-hover:translate-x-1 transition-all" size={20} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMeetings.map((meeting) => (
                  <motion.div 
                    key={meeting.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => onSelectMeeting(meeting)}
                    className="group bg-app-card border border-app-border p-6 rounded-3xl hover:border-app-green/50 hover:shadow-xl hover:shadow-app-green/5 transition-all cursor-pointer flex flex-col h-full"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-app-bg rounded-xl flex items-center justify-center group-hover:bg-app-green/10 transition-colors border border-app-border">
                        <FileText className="text-app-fg/20 group-hover:text-app-green" size={18} />
                      </div>
                      <span className="text-[10px] font-bold text-app-fg/40 uppercase tracking-widest">
                        {new Date(meeting.date).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-bold text-app-fg mb-2 group-hover:text-app-green transition-colors line-clamp-2">{meeting.title}</h4>
                    <p className="text-xs text-app-fg/80 line-clamp-4 mb-6 flex-1 leading-relaxed">{meeting.report.summary}</p>
                    <div className="pt-4 border-t border-app-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-app-bg rounded-full flex items-center justify-center border border-app-border">
                          <User size={10} className="text-app-fg/40" />
                        </div>
                        <span className="text-[10px] font-bold text-app-fg/40 uppercase tracking-widest">
                          {meeting.userName}
                        </span>
                      </div>
                      <ChevronRight className="text-app-fg/20 group-hover:text-app-green transition-all" size={16} />
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          ) : (
            /* USER MANAGEMENT TAB */
            usersLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-app-border border-t-app-green rounded-full animate-spin" />
                <p className="text-sm font-bold text-app-fg/30 uppercase tracking-widest">Loading registered users...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="h-full py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-app-bg rounded-3xl flex items-center justify-center mb-6 border border-app-border">
                      <User className="text-app-fg/10" size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-app-fg mb-2">
                      {language === 'portuguese' ? 'Nenhum utilizador encontrado' : 'No users found'}
                    </h3>
                    <p className="text-app-fg/40 max-w-xs mx-auto">
                      {language === 'portuguese' ? 'Tente ajustar a sua pesquisa.' : 'Try adjusting your search.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-3xl border border-app-border bg-app-card">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-app-border text-[10px] font-black uppercase tracking-widest text-app-fg/40 bg-app-bg/10">
                          <th className="py-4 px-6">{language === 'portuguese' ? 'Utilizador' : 'User'}</th>
                          <th className="py-4 px-6">{language === 'portuguese' ? 'Função' : 'Role'}</th>
                          <th className="py-4 px-6">{language === 'portuguese' ? 'Estado' : 'Status'}</th>
                          <th className="py-4 px-6">{language === 'portuguese' ? 'Última Atualização' : 'Last Updated'}</th>
                          <th className="py-4 px-6 text-right">{language === 'portuguese' ? 'Ações' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-border/40">
                        {filteredUsers.map((u) => {
                          const isUserAdmin = u.role === 'admin' || u.email === 'brunnofilipe@gmail.com';
                          const isPending = u.approved === false && !isUserAdmin;

                          return (
                            <motion.tr 
                              key={u.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="hover:bg-app-bg/5 transition-colors"
                            >
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-app-bg rounded-full flex items-center justify-center border border-app-border shrink-0">
                                    <User className="text-app-fg/40" size={16} />
                                  </div>
                                  <div className="min-w-0">
                                    <h5 className="font-bold text-app-fg truncate text-sm flex items-center gap-2">
                                      <span>{u.display_name || u.email?.split('@')[0]}</span>
                                      {isPending && (
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                      )}
                                    </h5>
                                    <p className="text-xs text-app-fg/50 truncate font-mono">
                                      {u.email || 'No email'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-sm font-medium">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  isUserAdmin 
                                    ? 'bg-amber-500/10 text-amber-500' 
                                    : 'bg-blue-500/10 text-blue-500'
                                }`}>
                                  {u.role || 'user'}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  !isPending 
                                    ? 'bg-app-green/10 text-app-green' 
                                    : 'bg-red-500/10 text-red-500 animate-pulse'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${!isPending ? 'bg-app-green' : 'bg-red-500 animate-ping'}`} />
                                  {!isPending ? t('approved') : t('pending')}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-xs font-semibold text-app-fg/40 font-mono">
                                {u.updated_at 
                                  ? new Date(u.updated_at).toLocaleDateString() + ' ' + new Date(u.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : '—'}
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {isPending ? (
                                    <>
                                      <button
                                        onClick={() => handleApproveUser(u.id)}
                                        className="h-8 px-3.5 bg-app-green hover:bg-app-dark-green text-white text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                                      >
                                        <Check size={12} />
                                        <span>{t('approve')}</span>
                                      </button>
                                      <button
                                        onClick={() => handleRejectUser(u.id)}
                                        className="h-8 px-3.5 border border-red-500/20 hover:bg-red-500/10 text-red-500 text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                      >
                                        <Ban size={12} />
                                        <span>{t('reject')}</span>
                                      </button>
                                    </>
                                  ) : (
                                    !isUserAdmin && (
                                      <button
                                        onClick={() => handleRejectUser(u.id)}
                                        className="h-8 px-3.5 border border-app-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-app-fg/40 text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                      >
                                        <Ban size={12} />
                                        <span>{language === 'portuguese' ? 'Desativar' : 'Deactivate'}</span>
                                      </button>
                                    )
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-app-border bg-app-bg/50 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-app-green rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-app-fg/40 uppercase tracking-widest">Live Monitoring Active</span>
            </div>
            <div className="text-[10px] font-bold text-app-fg/40 uppercase tracking-widest">
              {activeTab === 'meetings' ? (
                <>Total Meetings: <span className="text-app-fg font-black">{meetings.length}</span></>
              ) : (
                <>Total Users: <span className="text-app-fg font-black">{users.length}</span></>
              )}
            </div>
          </div>
          <p className="text-[10px] font-bold text-app-fg/20 uppercase tracking-widest">Admin Access Only • Confidential Data</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
