import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { getSupabase } from '../supabase';
import { HistoryItem } from '../services/storage';
import { X, Search, Calendar, User, FileText, ChevronRight, LayoutGrid, List } from 'lucide-react';

interface AdminDashboardProps {
  onClose: () => void;
  onSelectMeeting: (item: HistoryItem) => void;
}

export function AdminDashboard({ onClose, onSelectMeeting }: AdminDashboardProps) {
  const [meetings, setMeetings] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  useEffect(() => {
    const fetchAllMeetings = async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('meetings')
          .select(`
            *,
            profiles:user_id (
              display_name,
              email
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const allMeetings: HistoryItem[] = data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          userName: item.profiles?.display_name || `User ${item.user_id.substring(0, 5)}`,
          userEmail: item.profiles?.email || 'No email associated',
          date: item.created_at,
          title: item.title,
          report: item.report
        }));
        
        setMeetings(allMeetings);
      } catch (error) {
        console.error("Error fetching all meetings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllMeetings();
  }, []);

  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.report.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.userId.toLowerCase().includes(searchQuery.toLowerCase())
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
            <p className="text-sm text-black/60 font-medium">Monitoring all user meetings and reports</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={16} />
              <input 
                type="text"
                placeholder="Search meetings or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-app-bg border border-app-border rounded-2xl text-sm focus:ring-4 focus:ring-app-green/5 focus:border-app-green transition-all outline-none text-black placeholder:text-black/20"
              />
            </div>
            <div className="flex items-center bg-app-bg p-1 rounded-xl border border-app-border">
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-app-card shadow-sm text-app-green' : 'text-app-brown/30 hover:text-app-fg'}`}
              >
                <List size={18} />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-app-card shadow-sm text-app-green' : 'text-app-brown/30 hover:text-app-fg'}`}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
            <button 
              onClick={onClose}
              className="p-2.5 bg-app-bg text-app-brown/40 hover:bg-app-border hover:text-app-fg rounded-2xl transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-app-bg/30">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-app-border border-t-app-green rounded-full animate-spin" />
              <p className="text-sm font-bold text-app-brown/30 uppercase tracking-widest">Loading global history...</p>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-app-bg rounded-3xl flex items-center justify-center mb-6 border border-app-border">
                <FileText className="text-app-brown/10" size={40} />
              </div>
              <h3 className="text-xl font-bold text-app-fg mb-2">No meetings found</h3>
              <p className="text-app-brown/60 max-w-xs mx-auto">Try adjusting your search or check back later for new user activity.</p>
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
                    <FileText className="text-app-brown/20 group-hover:text-app-green" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                        {new Date(meeting.date).toLocaleDateString()} • {new Date(meeting.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] font-bold text-app-green uppercase tracking-widest bg-app-green/10 px-2 py-0.5 rounded-full">
                        {meeting.userName} ({meeting.userEmail})
                      </span>
                    </div>
                    <h4 className="font-bold text-black truncate group-hover:text-app-green transition-colors">{meeting.title}</h4>
                    <p className="text-xs text-black/70 line-clamp-2 mt-1 leading-relaxed">{meeting.report.summary}</p>
                  </div>
                  <ChevronRight className="text-black/20 group-hover:text-app-green group-hover:translate-x-1 transition-all" size={20} />
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
                      <FileText className="text-app-brown/20 group-hover:text-app-green" size={18} />
                    </div>
                    <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                      {new Date(meeting.date).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-black mb-2 group-hover:text-app-green transition-colors line-clamp-2">{meeting.title}</h4>
                  <p className="text-xs text-black/80 line-clamp-4 mb-6 flex-1 leading-relaxed">{meeting.report.summary}</p>
                  <div className="pt-4 border-t border-app-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-app-bg rounded-full flex items-center justify-center border border-app-border">
                        <User size={10} className="text-black/40" />
                      </div>
                      <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest">
                        {meeting.userName}
                      </span>
                    </div>
                    <ChevronRight className="text-black/20 group-hover:text-app-green transition-all" size={16} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-app-border bg-app-bg/50 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-app-green rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest">Live Monitoring Active</span>
            </div>
            <div className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
              Total Meetings: <span className="text-black">{meetings.length}</span>
            </div>
          </div>
          <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest">Admin Access Only • Confidential Data</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
