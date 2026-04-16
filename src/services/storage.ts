import { MeetingReport } from './gemini';
import { getSupabase } from '../supabase';

export interface HistoryItem {
  id: string;
  date: string;
  title: string;
  report: MeetingReport;
  userId: string;
  userName?: string;
  userEmail?: string;
}

export const saveToHistory = async (report: MeetingReport, userId: string): Promise<HistoryItem | null> => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('meetings')
      .insert([
        {
          title: report.summary.slice(0, 50) + (report.summary.length > 50 ? '...' : ''),
          report,
          user_id: userId
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase Insert Error:', error);
      throw error;
    }

    return {
      id: data.id,
      date: data.created_at,
      title: data.title,
      report: data.report,
      userId: data.user_id
    };
  } catch (error) {
    console.error('Failed to save to history:', error);
    return null;
  }
};

export const getHistory = async (userId: string): Promise<HistoryItem[]> => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Supabase Fetch Error:', error);
      throw error;
    }

    return data.map(item => ({
      id: item.id,
      date: item.created_at,
      title: item.title,
      report: item.report,
      userId: item.user_id
    }));
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
};

export const deleteFromHistory = async (id: string): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to delete from history:', error);
    return false;
  }
};

export const updateHistoryItem = async (id: string, updates: Partial<HistoryItem>): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    const supabaseUpdates: any = {};
    if (updates.title) supabaseUpdates.title = updates.title;
    if (updates.report) supabaseUpdates.report = updates.report;

    const { error } = await supabase
      .from('meetings')
      .update(supabaseUpdates)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to update history item:', error);
    return false;
  }
};

export const clearHistory = async (userId: string): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to clear history:', error);
    return false;
  }
};

export const migrateFromLocalStorage = async (userId: string): Promise<number> => {
  try {
    const keys = ['echonotes_history', 'meeting_history', 'history', 'echonotes_meetings'];
    let migratedCount = 0;

    for (const key of keys) {
      const localData = localStorage.getItem(key);
      if (localData) {
        const items = JSON.parse(localData);
        if (Array.isArray(items)) {
          for (const item of items) {
            const report = item.report || item;
            if (report && report.summary) {
              await saveToHistory(report, userId);
              migratedCount++;
            }
          }
          localStorage.removeItem(key);
        }
      }
    }
    return migratedCount;
  } catch (error) {
    console.error('Migration failed:', error);
    return 0;
  }
};
