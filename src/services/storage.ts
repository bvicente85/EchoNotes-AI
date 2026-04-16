import { MeetingReport } from './gemini';
import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';

export interface HistoryItem {
  id: string;
  date: string;
  title: string;
  report: MeetingReport;
  userId: string;
  userName?: string;
  userEmail?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const saveToHistory = async (report: MeetingReport, userId: string): Promise<HistoryItem | null> => {
  const path = 'meetings';
  try {
    const docRef = await addDoc(collection(db, path), {
      title: report.summary.slice(0, 50) + (report.summary.length > 50 ? '...' : ''),
      report,
      userId: userId,
      date: new Date().toISOString(),
      createdAt: serverTimestamp()
    });

    return {
      id: docRef.id,
      date: new Date().toISOString(),
      title: report.summary.slice(0, 50) + (report.summary.length > 50 ? '...' : ''),
      report,
      userId
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export const getHistory = async (userId: string): Promise<HistoryItem[]> => {
  const path = 'meetings';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date || (data.createdAt?.toDate?.()?.toISOString()) || new Date().toISOString(),
        title: data.title,
        report: data.report,
        userId: data.userId
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const deleteFromHistory = async (id: string): Promise<boolean> => {
  const path = `meetings/${id}`;
  try {
    await deleteDoc(doc(db, 'meetings', id));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

export const updateHistoryItem = async (id: string, updates: Partial<HistoryItem>): Promise<boolean> => {
  const path = `meetings/${id}`;
  try {
    const firestoreUpdates: any = {};
    if (updates.title) firestoreUpdates.title = updates.title;
    if (updates.report) firestoreUpdates.report = updates.report;
    firestoreUpdates.updatedAt = serverTimestamp();

    await updateDoc(doc(db, 'meetings', id), firestoreUpdates);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
  }
};

export const clearHistory = async (userId: string): Promise<boolean> => {
  const path = 'meetings';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const deletePromises = querySnapshot.docs.map(document => deleteDoc(doc(db, path, document.id)));
    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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
